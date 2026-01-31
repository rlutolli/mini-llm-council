#!/usr/bin/env python3
"""
BitNet Manager - Automated Setup and Model Management

This script handles:
- Dependency verification (cmake, clang, conda)
- Cloning/updating the BitNet repository
- Downloading models without overwriting existing data
- Building and configuring the inference binary
- Version tracking for safe updates

Usage:
    python scripts/bitnet_manager.py setup          # Full setup
    python scripts/bitnet_manager.py update-models  # Update models only
    python scripts/bitnet_manager.py check          # Check installation status
"""

import argparse
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("bitnet-manager")


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class BitNetConfig:
    """Configuration for BitNet installation"""
    repo_url: str = "https://github.com/microsoft/BitNet.git"
    install_dir: Path = Path.home() / "bitnet"
    models_dir: Path = Path.home() / "bitnet" / "models"
    versions_file: Path = Path.home() / ".bitnet" / "versions.json"
    
    # Available models
    models: Dict[str, str] = None
    
    def __post_init__(self):
        if self.models is None:
            self.models = {
                "BitNet-b1.58-2B-4T": "microsoft/BitNet-b1.58-2B-4T-gguf",
                "Falcon3-1B-1.58bit": "tiiuae/Falcon3-1B-Instruct-1.58bit",
                "Falcon3-3B-1.58bit": "tiiuae/Falcon3-3B-Instruct-1.58bit",
            }


DEFAULT_CONFIG = BitNetConfig()


# ============================================================================
# Dependency Checking
# ============================================================================

def check_command(cmd: str, min_version: Optional[str] = None) -> Tuple[bool, str]:
    """Check if a command exists and optionally verify version"""
    try:
        result = subprocess.run(
            [cmd, "--version"],
            capture_output=True,
            text=True
        )
        version_line = result.stdout.split("\n")[0] if result.stdout else result.stderr.split("\n")[0]
        return True, version_line
    except FileNotFoundError:
        return False, "Not found"


def check_dependencies() -> Dict[str, dict]:
    """Verify all required dependencies are installed"""
    deps = {}
    
    # Python
    py_ok = sys.version_info >= (3, 9)
    deps["python"] = {
        "ok": py_ok,
        "version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "required": ">=3.9",
    }
    
    # CMake
    cmake_ok, cmake_ver = check_command("cmake")
    deps["cmake"] = {
        "ok": cmake_ok,
        "version": cmake_ver,
        "required": ">=3.22",
    }
    
    # Clang
    # Check for clang-18 first, then generic clang
    clang_ok = False
    clang_ver = "Not found"
    for clang_cmd in ["clang-18", "clang"]:
        ok, ver = check_command(clang_cmd)
        if ok:
            clang_ok = True
            clang_ver = ver
            break
    
    deps["clang"] = {
        "ok": clang_ok,
        "version": clang_ver,
        "required": ">=18",
    }
    
    # Conda (optional but recommended)
    conda_ok, conda_ver = check_command("conda")
    deps["conda"] = {
        "ok": conda_ok,
        "version": conda_ver,
        "required": "optional",
    }
    
    # Git
    git_ok, git_ver = check_command("git")
    deps["git"] = {
        "ok": git_ok,
        "version": git_ver,
        "required": "any",
    }
    
    # huggingface-cli
    hf_ok, hf_ver = check_command("huggingface-cli")
    deps["huggingface-cli"] = {
        "ok": hf_ok,
        "version": hf_ver if hf_ok else "pip install huggingface_hub",
        "required": "any",
    }
    
    return deps


def print_deps_table(deps: Dict[str, dict]):
    """Print dependency status as a table"""
    print("\n┌─ Dependency Check ─────────────────────────────────┐")
    for name, info in deps.items():
        status = "✓" if info["ok"] else "✗"
        color = "\033[92m" if info["ok"] else "\033[91m"
        reset = "\033[0m"
        print(f"│ {color}{status}{reset} {name:20} {info['version'][:30]:30} │")
    print("└────────────────────────────────────────────────────┘\n")


# ============================================================================
# Repository Management
# ============================================================================

def clone_or_update_repo(config: BitNetConfig) -> bool:
    """Clone BitNet repo or pull latest if exists"""
    if config.install_dir.exists():
        logger.info(f"Updating existing repo at {config.install_dir}")
        try:
            subprocess.run(
                ["git", "pull", "--rebase"],
                cwd=config.install_dir,
                check=True
            )
            subprocess.run(
                ["git", "submodule", "update", "--init", "--recursive"],
                cwd=config.install_dir,
                check=True
            )
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to update repo: {e}")
            return False
    else:
        logger.info(f"Cloning BitNet to {config.install_dir}")
        try:
            subprocess.run(
                ["git", "clone", "--recursive", config.repo_url, str(config.install_dir)],
                check=True
            )
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to clone repo: {e}")
            return False


# ============================================================================
# Model Management
# ============================================================================

def get_model_hash(model_path: Path) -> Optional[str]:
    """Get SHA256 hash of model file for version tracking"""
    if not model_path.exists():
        return None
    
    # Find the .gguf file
    gguf_files = list(model_path.glob("*.gguf"))
    if not gguf_files:
        return None
    
    # Hash the first 10MB for speed
    hasher = hashlib.sha256()
    with open(gguf_files[0], "rb") as f:
        hasher.update(f.read(10 * 1024 * 1024))
    
    return hasher.hexdigest()[:16]


def load_versions(config: BitNetConfig) -> Dict[str, str]:
    """Load version tracking file"""
    if config.versions_file.exists():
        with open(config.versions_file) as f:
            return json.load(f)
    return {}


def save_versions(config: BitNetConfig, versions: Dict[str, str]):
    """Save version tracking file"""
    config.versions_file.parent.mkdir(parents=True, exist_ok=True)
    with open(config.versions_file, "w") as f:
        json.dump(versions, f, indent=2)


def download_model(
    model_name: str, 
    hf_repo: str, 
    config: BitNetConfig,
    force: bool = False
) -> bool:
    """
    Download model from HuggingFace without overwriting existing data.
    
    Returns True if model was downloaded/updated.
    """
    model_dir = config.models_dir / model_name
    versions = load_versions(config)
    
    # Check if model exists
    if model_dir.exists() and not force:
        current_hash = get_model_hash(model_dir)
        if current_hash and current_hash == versions.get(model_name):
            logger.info(f"Model {model_name} is up to date (hash: {current_hash})")
            return False
    
    # Download model
    logger.info(f"Downloading {model_name} from {hf_repo}...")
    try:
        subprocess.run(
            [
                "huggingface-cli", "download",
                hf_repo,
                "--local-dir", str(model_dir),
                "--local-dir-use-symlinks", "False"
            ],
            check=True
        )
        
        # Update version tracking
        new_hash = get_model_hash(model_dir)
        if new_hash:
            versions[model_name] = new_hash
            save_versions(config, versions)
        
        logger.info(f"Successfully downloaded {model_name}")
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to download {model_name}: {e}")
        return False


def update_all_models(config: BitNetConfig, force: bool = False) -> Dict[str, bool]:
    """Download/update all configured models"""
    results = {}
    for model_name, hf_repo in config.models.items():
        results[model_name] = download_model(model_name, hf_repo, config, force)
    return results


# ============================================================================
# Build System
# ============================================================================

def install_python_deps(config: BitNetConfig) -> bool:
    """Install Python dependencies from requirements.txt"""
    req_file = config.install_dir / "requirements.txt"
    if not req_file.exists():
        logger.warning("requirements.txt not found")
        return True
    
    logger.info("Installing Python dependencies...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(req_file), "-q"],
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install dependencies: {e}")
        return False


def build_model(model_name: str, config: BitNetConfig) -> bool:
    """Build/convert model using setup_env.py"""
    model_dir = config.models_dir / model_name
    if not model_dir.exists():
        logger.error(f"Model directory not found: {model_dir}")
        return False
    
    setup_script = config.install_dir / "setup_env.py"
    if not setup_script.exists():
        logger.error("setup_env.py not found")
        return False
    
    logger.info(f"Building {model_name} with i2_s quantization...")
    try:
        subprocess.run(
            [
                sys.executable, str(setup_script),
                "-md", str(model_dir),
                "-q", "i2_s"
            ],
            cwd=config.install_dir,
            check=True
        )
        logger.info(f"Successfully built {model_name}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to build {model_name}: {e}")
        return False


# ============================================================================
# LLVM/Clang Installation (Linux only)
# ============================================================================

def install_llvm_clang() -> bool:
    """Install LLVM/Clang 18 on Debian/Ubuntu"""
    if sys.platform != "linux":
        logger.warning("LLVM auto-install only supported on Linux")
        return False
    
    logger.info("Installing LLVM/Clang 18...")
    try:
        # Use the official LLVM installation script
        subprocess.run(
            ["bash", "-c", "wget -qO- https://apt.llvm.org/llvm.sh | sudo bash -s 18"],
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"LLVM installation failed: {e}")
        logger.info("Manual install: sudo apt install clang-18 cmake")
        return False


# ============================================================================
# CLI Commands
# ============================================================================

def cmd_check(args, config: BitNetConfig):
    """Check installation status"""
    print("\n=== BitNet Installation Status ===\n")
    
    # Dependencies
    deps = check_dependencies()
    print_deps_table(deps)
    
    # Repository
    if config.install_dir.exists():
        print(f"✓ Repository installed at: {config.install_dir}")
    else:
        print(f"✗ Repository not found at: {config.install_dir}")
    
    # Models
    print("\n┌─ Installed Models ─────────────────────────────────┐")
    versions = load_versions(config)
    for model_name in config.models.keys():
        model_dir = config.models_dir / model_name
        if model_dir.exists():
            hash_val = versions.get(model_name, "unknown")
            print(f"│ ✓ {model_name:30} (hash: {hash_val}) │")
        else:
            print(f"│ ✗ {model_name:30} (not installed)      │")
    print("└────────────────────────────────────────────────────┘\n")
    
    # Check for ready-to-use
    all_ready = all(d["ok"] for d in deps.values() if d["required"] != "optional")
    if all_ready and config.install_dir.exists():
        print("✓ BitNet is ready to use!")
    else:
        missing = [k for k, v in deps.items() if not v["ok"] and v["required"] != "optional"]
        if missing:
            print(f"✗ Missing dependencies: {', '.join(missing)}")


def cmd_setup(args, config: BitNetConfig):
    """Full setup: clone, install deps, download model, build"""
    print("\n=== BitNet Full Setup ===\n")
    
    # Check and install dependencies
    deps = check_dependencies()
    print_deps_table(deps)
    
    # Check critical deps
    if not deps["clang"]["ok"]:
        logger.warning("Clang not found. Attempting to install...")
        if not install_llvm_clang():
            logger.error("Please install clang>=18 manually")
            return False
    
    if not deps["huggingface-cli"]["ok"]:
        logger.info("Installing huggingface-cli...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "huggingface_hub"])
    
    # Clone/update repo
    if not clone_or_update_repo(config):
        return False
    
    # Install Python deps
    if not install_python_deps(config):
        return False
    
    # Download default model
    default_model = "BitNet-b1.58-2B-4T"
    if default_model in config.models:
        download_model(default_model, config.models[default_model], config)
        build_model(default_model, config)
    
    print("\n✓ Setup complete!")
    print(f"  Repository: {config.install_dir}")
    print(f"  Models: {config.models_dir}")
    print(f"\nTo test: python {config.install_dir}/run_inference.py -m {config.models_dir}/{default_model}/ggml-model-i2_s.gguf -p 'Hello' -cnv")
    
    return True


def cmd_update_models(args, config: BitNetConfig):
    """Update all models without overwriting"""
    print("\n=== Updating BitNet Models ===\n")
    
    results = update_all_models(config, force=args.force)
    
    print("\nUpdate Results:")
    for model, downloaded in results.items():
        status = "Updated" if downloaded else "Already up to date"
        print(f"  {model}: {status}")


def cmd_build(args, config: BitNetConfig):
    """Build a specific model"""
    if not args.model:
        logger.error("Please specify --model")
        return
    
    build_model(args.model, config)


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="BitNet Manager - Setup and update BitNet models"
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # check
    check_parser = subparsers.add_parser("check", help="Check installation status")
    
    # setup
    setup_parser = subparsers.add_parser("setup", help="Full setup")
    
    # update-models
    update_parser = subparsers.add_parser("update-models", help="Update models")
    update_parser.add_argument("--force", action="store_true", help="Force re-download")
    
    # build
    build_parser = subparsers.add_parser("build", help="Build a model")
    build_parser.add_argument("--model", type=str, help="Model name to build")
    
    args = parser.parse_args()
    config = DEFAULT_CONFIG
    
    if args.command == "check":
        cmd_check(args, config)
    elif args.command == "setup":
        cmd_setup(args, config)
    elif args.command == "update-models":
        cmd_update_models(args, config)
    elif args.command == "build":
        cmd_build(args, config)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
