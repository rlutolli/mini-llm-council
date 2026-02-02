"""
LMArena Browser Agent - Web automation for Arena.ai

Clean implementation with:
- Proper Cloudflare detection and wait logic
- Correct prompt sending (user's actual prompt)
- Stable tab management
- Popup dismissal
"""

import os
import time
import json
import logging
import base64
from typing import Generator, Optional, Dict, Any
from threading import Lock
from DrissionPage import ChromiumPage, ChromiumOptions, Chromium

from backend.config import BROWSER_USER_DATA_DIR, LMSYS_URL

logger = logging.getLogger(__name__)


class RateLimitError(Exception):
    """Raised when a model is rate-limited or challenged."""
    def __init__(self, model_id: str, challenge_type: str = "rate-limit"):
        self.model_id = model_id
        self.challenge_type = challenge_type
        super().__init__(f"{model_id} is {challenge_type}")


class LMSYSAgent:
    """
    Web Agent for Arena.ai using DrissionPage.
    Singleton pattern ensures single browser instance.
    """
    
    _instance = None
    _browser = None
    _lock = Lock()
    
    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(LMSYSAgent, cls).__new__(cls)
            return cls._instance
    
    def __init__(self, headless: bool = False):
        with self._lock:
            if LMSYSAgent._browser is None:
                try:
                    logger.info(f"Initializing Chromium (headless={headless})...")
                    options = ChromiumOptions()
                    options.set_user_data_path(BROWSER_USER_DATA_DIR)
                    options.auto_port()
                    options.headless(headless)
                    options.set_argument('--window-size=1280,720')
                    options.set_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
                    
                    LMSYSAgent._browser = Chromium(options)
                    self.active_models: Dict[str, ChromiumPage] = {}
                    self._model_ready: Dict[str, bool] = {}  # Track if model is selected
                    logger.info("Web Agent initialized successfully.")
                except Exception as e:
                    logger.error(f"Failed to initialize Web Agent: {e}")
                    raise e
            else:
                if not hasattr(self, 'active_models'):
                    self.active_models = {}
                if not hasattr(self, '_model_ready'):
                    self._model_ready = {}
    
    @property
    def browser(self):
        return LMSYSAgent._browser
    
    # ==================== TAB MANAGEMENT ====================
    
    def get_model_tab(self, model_id: str, model_name: str) -> ChromiumPage:
        """Get or create a tab for a specific model."""
        # Check for existing valid tab
        if model_id in self.active_models:
            tab = self.active_models[model_id]
            try:
                # Verify tab is still alive
                _ = tab.url
                self.browser.activate_tab(tab.tab_id)
                return tab
            except Exception:
                logger.warning(f"Tab for {model_id} disconnected, recreating")
                self._cleanup_tab(model_id)
        
        # Create new tab
        logger.info(f"Creating new tab for {model_name}...")
        tab = self.browser.new_tab(LMSYS_URL)
        self.active_models[model_id] = tab
        self._model_ready[model_id] = False
        
        return tab

    def show_browser(self):
        """Bring the browser window to front (if not headless)."""
        if self.browser:
            try:
                # Force window to top/focus
                self.browser.set.window_state('maximized')
                # Activate current tab
                tab = self.browser.latest_tab
                self.browser.activate_tab(tab.tab_id)
                logger.info("Browser brought to foreground")
                return True
            except Exception as e:
                logger.error(f"Failed to show browser: {e}")
        return False
    
    def _cleanup_tab(self, model_id: str):
        """Clean up a dead tab."""
        if model_id in self.active_models:
            del self.active_models[model_id]
        if model_id in self._model_ready:
            del self._model_ready[model_id]
    
    # ==================== CLOUDFLARE HANDLING ====================
    
    def _is_cloudflare_page(self, tab: ChromiumPage) -> bool:
        """
        Check if page is showing a Cloudflare challenge.
        Targets actual "Security Verification" modals and Turnstile iframes.
        """
        try:
            # Check for Cloudflare challenge DOM elements
            cf_check_js = """
            (function() {
                // Check for Cloudflare challenge iframe
                if (document.querySelector('iframe[src*="challenges.cloudflare.com"]')) return true;
                if (document.querySelector('iframe[src*="turnstile"]')) return true;
                
                // Check for Cloudflare-specific elements/modals
                if (document.getElementById('cf-browser-verification')) return true;
                if (document.querySelector('.cf-challenge-running')) return true;
                if (document.querySelector('[data-ray]')) return true;
                
                // NEW: Check for the specific arena.ai challenge text seen in screenshot
                const bodyText = document.body.innerText;
                if (bodyText.includes('Verify you are human') && bodyText.includes('arena.ai')) return true;

                // Check for "Security Verification" text in modal
                const verificationModal = Array.from(document.querySelectorAll('div')).find(d => 
                    d.textContent.includes('Security Verification') && 
                    d.textContent.includes('Verify you are human')
                );
                if (verificationModal) return true;

                // Check for the "Just a moment..." page title
                if (document.title.includes('Just a moment') || document.title === 'arena.ai' && document.body.innerText.includes('human')) return true;
                
                return false;
            })();
            """
            return tab.run_js(cf_check_js) == True
        except Exception:
            return False
    
    def _solve_cloudflare_challenge(self, tab: ChromiumPage) -> bool:
        """
        Attempt to solve a Cloudflare challenge automatically using mouse simulation.
        Focused on the 'Verify you are human' checkbox in Turnstile iframes.
        """
        try:
            # 1. Look for the Turnstile iframe
            # Wait a bit for iframe to load properly
            time.sleep(2)
            
            iframe = tab.ele('css:iframe[src*="challenges.cloudflare.com"]', timeout=3)
            if not iframe:
                iframe = tab.ele('css:iframe[src*="turnstile"]', timeout=2)
                
            if not iframe:
                # Search for a button that might be the checkbox
                checkbox = tab.ele('css:input[type="checkbox"], #challenge-stage input', timeout=2)
                if not checkbox:
                    return False
            else:
                # Find checkbox inside iframe
                checkbox = iframe.ele('css:input[type="checkbox"], .mark, .checkbox', timeout=3)
            
            if checkbox:
                logger.info("Cloudflare checkbox found, attempting human-like click...")
                # Simulate human-like movement
                # Get element center
                rect = checkbox.rect.midpoint
                
                # Move mouse in a slightly non-linear way if possible, or just move and click
                tab.actions.move_to(checkbox)
                time.sleep(0.5)
                checkbox.click()
                logger.info("Cloudflare checkbox clicked.")
                
                # Wait for potential clearance
                time.sleep(3)
                return not self._is_cloudflare_page(tab)
            
            return False
        except Exception as e:
            logger.warning(f"Cloudflare solver failed: {e}")
            return False

    def _wait_for_cloudflare(self, tab: ChromiumPage, timeout: int = 60) -> bool:
        """Wait for Cloudflare challenge to be resolved, attempting auto-solve first."""
        logger.info("Cloudflare/Security challenge detected, attempting auto-solve...")
        
        # Try auto-solving first
        if self._solve_cloudflare_challenge(tab):
            logger.info("Cloudflare challenge auto-solved!")
            return True
            
        logger.info("Auto-solve failed or not applicable, waiting for manual/background resolution...")
        for i in range(timeout):
            if not self._is_cloudflare_page(tab):
                logger.info(f"Challenge resolved after {i} seconds")
                time.sleep(1.5)  # Stabilization wait
                return True
            
            # Periodically retry auto-solve
            if i > 0 and i % 10 == 0:
                self._solve_cloudflare_challenge(tab)
                
            time.sleep(1)
        
        logger.error(f"Challenge timeout after {timeout} seconds")
        return False
    
    # ==================== POPUP DISMISSAL ====================
    
    def _dismiss_all_popups(self, tab: ChromiumPage):
        """
        Dismiss ALL Arena popups:
        - Cookie consent ("Accept Cookies")
        - Welcome popup ("Hide this")  
        - Terms of Use / Privacy Policy ("Agree")
        - Generic close/dismiss buttons
        """
        dismiss_js = """
        (function() {
            let dismissed = [];
            
            // Helper to click by text
            const clickByText = (selectors, textList) => {
                const elements = Array.from(document.querySelectorAll(selectors));
                const target = elements.find(el => {
                    const t = (el.textContent || '').trim().toLowerCase();
                    return textList.some(wanted => t === wanted || t.includes(wanted));
                });
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            };

            // 1. Terms of Use / Privacy Policy - "Agree"
            if (clickByText('button', ['agree', 'i agree', 'accept and agree'])) dismissed.push('terms');
            
            // 2. Cookie consent - "Accept Cookies"
            if (clickByText('button', ['accept cookies', 'allow all'])) dismissed.push('cookies');
            
            // 3. Welcome popup - "Hide this"
            if (clickByText('button', ['hide this', 'dismiss welcome'])) dismissed.push('welcome');
            
            // 4. Generic dismiss/close/ok/got it
            if (clickByText('button', ['dismiss', 'close', 'got it', 'ok', 'continue'])) dismissed.push('generic');
            
            // 5. X close buttons
            document.querySelectorAll('[aria-label*="close" i], [aria-label*="dismiss" i]').forEach(btn => {
                const b = btn.tagName === 'BUTTON' ? btn : btn.closest('button');
                if (b) { b.click(); dismissed.push('x-close'); }
            });

            // 6. Radix/Shadcn specific dialog closers
            document.querySelectorAll('[data-state="open"] button').forEach(btn => {
                if (btn.innerText.toLowerCase().includes('close')) {
                    btn.click();
                    dismissed.push('radix-close');
                }
            });
            
            return dismissed.join(',') || 'none';
        })();
        """
        
        try:
            # First pass
            result = tab.run_js(dismiss_js)
            if result and result != 'none':
                logger.info(f"Dismissed popups: {result}")
                time.sleep(1.0)
            
            # Press Enter as requested (handles Terms focus)
            tab.actions.key_down('Enter')
            tab.actions.key_up('Enter')
            time.sleep(0.5)
            
            # Second pass
            tab.run_js(dismiss_js)
                
        except Exception as e:
            logger.warning(f"Popup dismissal error: {e}")
    
    # ==================== MODEL SELECTION ====================
    
    def _ensure_direct_chat_mode(self, tab: ChromiumPage):
        """Ensure the UI is in 'Direct Chat' mode."""
        logger.info("Ensuring 'Direct Chat' mode...")
        mode_js = """
        (function() {
            try {
                // 1. Check if we are already in Direct Chat
                const allBtns = Array.from(document.querySelectorAll('button'));
                const headerBtns = allBtns.filter(b => b.getBoundingClientRect().top < 100);
                
                const modeBtn = headerBtns.find(b => b.innerText.includes('Direct Chat'));
                if (modeBtn) return 'already-direct';

                // 2. Find the switcher button (usually 'Battle' or 'Side-by-Side' or has a chevron)
                // It's the leftmost dropdown in the header group
                headerBtns.sort((a,b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
                const switcher = headerBtns.find(b => b.innerText.includes('Battle') || b.innerText.includes('Side-by-Side') || b.innerText.includes('Arena'));
                
                if (switcher) {
                    switcher.click();
                    return 'clicked-switcher';
                }
                return 'no-switcher-found';
            } catch(e) { return 'error:' + e.message; }
        })();
        """
        result = tab.run_js(mode_js)
        logger.info(f"Mode check result: {result}")
        
        if result == 'clicked-switcher':
            time.sleep(1.5)
            # Find and click 'Direct Chat' option in the menu
            select_js = """
            (function() {
                const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], button, li'));
                const target = options.find(o => o.innerText.toLowerCase().includes('direct chat'));
                if (target) {
                    target.click();
                    return 'success';
                }
                return 'not-found';
            })();
            """
            res2 = tab.run_js(select_js)
            logger.info(f"Select direct chat result: {res2}")
            time.sleep(2.0)

    def _select_model(self, tab: ChromiumPage, model_name: str) -> bool:
        """Select the specified model in Arena's dropdown."""
        self._ensure_direct_chat_mode(tab)
        logger.info(f"Selecting model: {model_name}")
        
        try:
            # The Model dropdown is the SECOND button in the center header group
            # (Right of the Direct Chat / Mode selector)
            find_model_dropdown_js = """
            (function() {
                try {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const headerBtns = buttons.filter(b => {
                        const r = b.getBoundingClientRect();
                        return r.top < 100 && r.width > 30 && r.height > 20;
                    });
                    
                    // Sort by left position to find relative order
                    headerBtns.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
                    
                    // The main group is usually centered. The mode selector is the 1st, model selector is 2nd.
                    // Let's find the mode selector first to be sure.
                    const modeIdx = headerBtns.findIndex(b => b.innerText.includes('Direct Chat'));
                    
                    if (modeIdx !== -1 && modeIdx + 1 < headerBtns.length) {
                        const modelBtn = headerButtons[modeIdx + 1];
                        modelBtn.scrollIntoView();
                        modelBtn.click();
                        return 'clicked_model_dropdown';
                    }
                    
                    // Fallback: look for button with common model names or text-xs (model dropdown is smaller)
                    const modelBtn = headerButtons.find(b => 
                        !b.innerText.includes('Direct Chat') && 
                        (b.innerText.toLowerCase().includes('gpt') || 
                         b.innerText.toLowerCase().includes('gemini') || 
                         b.innerText.toLowerCase().includes('llama') ||
                         b.classList.contains('text-xs'))
                    );
                    
                    if (modelBtn) {
                        modelBtn.click();
                        return 'clicked_model_dropdown_by_text';
                    }

                    return 'no_model_dropdown_detected';
                } catch(e) { return 'error:' + e.message; }
            })();
            """
            
            result = tab.run_js(find_model_dropdown_js)
            logger.info(f"Model dropdown selection result: {result}")
            
            if not result or 'error' in str(result) or result == 'no_model_dropdown_detected':
                 logger.warning(f"Could not find model dropdown precisely: {result}")
                 # Last ditch: look for any combobox that isn't the first
                 cbs = tab.eles('css:button[role="combobox"]', timeout=2)
                 if len(cbs) >= 2:
                     cbs[1].click()
                     logger.info("Clicked second combobox as fallback")
                 else:
                     return True
            
            time.sleep(1.0)
            
            # Now search for the model in the dropdown (portal input)
            search = tab.ele('css:input[placeholder*="Search"], input[placeholder*="Choose model"]', timeout=3)
            if search:
                search.clear()
                search.input(model_name)
                time.sleep(1.0)
            else:
                # Try finding it in the DOM if not an actual input
                tab.actions.type(model_name)
                time.sleep(1.0)
            
            # Click the matching option
            select_js = f"""
            (function() {{
                const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li'));
                const target = options.find(o => o.textContent.toLowerCase().includes('{model_name.lower()}'));
                if (target) {{
                    target.scrollIntoView();
                    target.click();
                    return true;
                }}
                return false;
            }})();
            """
            success = tab.run_js(select_js)
            logger.info(f"Model selection {model_name}: {'Success' if success else 'Failed'}")
            
            # Escape to close dropdown if still open
            tab.actions.key_down('Escape')
            tab.actions.key_up('Escape')
            time.sleep(0.5)
            
            return True
            
        except Exception as e:
            logger.error(f"Model selection error: {e}")
            return False
    
    # ==================== PROMPT SENDING ====================
    
    def _send_prompt(self, tab: ChromiumPage, prompt: str) -> bool:
        """Send the user's prompt to Arena's chat input."""
        logger.info(f"Sending prompt ({len(prompt)} chars)...")
        
        try:
            # 1. Find the chat textarea
            textarea = tab.ele('css:textarea[placeholder*="Ask"], textarea[placeholder*="anything"]', timeout=5)
            if not textarea:
                # Fallback
                textarea = tab.ele('css:textarea', timeout=2)
            
            if not textarea:
                logger.error("Chat textarea not found")
                return False
            
            # 2. Input and Double Enter
            textarea.click()
            textarea.clear()
            textarea.input(prompt)
            time.sleep(0.5)
            
            # User specified: Enter twice (Terms + Submit)
            logger.info("Sending Double Enter...")
            tab.actions.key_down('Enter')
            tab.actions.key_up('Enter')
            time.sleep(0.8)
            tab.actions.key_down('Enter')
            tab.actions.key_up('Enter')
            
            # 3. Fallback: Submit button
            time.sleep(1.0)
            submit_btn = tab.ele('css:button[aria-label*="Send"], button[aria-label*="submit"]', timeout=1)
            if submit_btn:
                submit_btn.click()
            
            logger.info("Prompt sent successfully")
            return True
            
        except Exception as e:
            logger.error(f"Send prompt error: {e}")
            return False

    def _check_rate_limit(self, tab: ChromiumPage) -> bool:
        """Check for red rate limit text."""
        rate_limit_js = """
        (function() {
            const elements = Array.from(document.querySelectorAll('span, div, p, [class*="error"]'));
            return elements.some(el => {
                const text = el.textContent.toLowerCase();
                const style = window.getComputedStyle(el);
                const isRed = style.color.includes('rgb(239, 68, 68)') || style.color.includes('255, 0, 0');
                return isRed && (text.includes('rate limit') || text.includes('too many requests') || text.includes('wait'));
            });
        })();
        """
        try:
            return tab.run_js(rate_limit_js) == True
        except:
            return False

    
    # ==================== RESPONSE STREAMING ====================
    
    def _stream_response(self, tab: ChromiumPage) -> Generator[str, None, None]:
        """Stream the model's response from Arena."""
        logger.info("Streaming response...")
        
        last_content = ""
        empty_count = 0
        max_empty = 60  # Increased timeout - 60 seconds of no new content
        
        while empty_count < max_empty:
            try:
                # Arena-specific response extraction
                # The response appears after the model name header (e.g., "gemini-3-pro")
                response_js = """
                (function() {
                    const results = { text: null, debug: [] };
                    
                    // Helper to get substantial text from element
                    const getSubstantialText = (el) => {
                        if (!el) return null;
                        const text = (el.innerText || '').trim();
                        // Ignore short or UI-only text
                        if (text.length < 5) return null;
                        if (text.includes('Arena') && text.length < 50) return null;
                        return text;
                    };

                    // Method 1: Target the chat area container specifically
                    const chatArea = document.querySelector('#chat-area');
                    if (chatArea) {
                        const messages = Array.from(chatArea.querySelectorAll('.prose, .markdown, [class*="message"], [class*="chat-history"]'));
                        results.debug.push('Found ' + messages.length + ' potential messages in #chat-area');
                        if (messages.length > 0) {
                            for (let i = messages.length - 1; i >= 0; i--) {
                                const text = getSubstantialText(messages[i]);
                                if (text && !messages[i].classList.contains('user-message')) {
                                    return { text: text, debug: results.debug };
                                }
                            }
                        }
                    }

                    // Method 2: Look for elements with prose/markdown/bot class anywhere
                    const proseSelectors = ['.prose', '.markdown', '[data-testid="bot-message"]', '.message-content'];
                    for (const selector of proseSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            results.debug.push('Found ' + elements.length + ' elements with ' + selector);
                            const last = elements[elements.length - 1];
                            const text = getSubstantialText(last);
                            if (text) return { text: text, debug: results.debug };
                        }
                    }
                    
                    // Method 3: Find the largest visible text block that isn't UI
                    const allMainDivs = Array.from(document.querySelectorAll('main div, #chat-area div'));
                    let bestMatch = '';
                    allMainDivs.slice(-20).forEach(div => { // Focus on recent divs
                        const text = getSubstantialText(div);
                        if (text && text.length > bestMatch.length && text.length < 10000) {
                            // Filter out buttons/textareas/nav
                            if (div.querySelector('textarea') || div.querySelector('button')) return;
                            if (text.includes('Skip') || text.includes('Terms')) return;
                            bestMatch = text;
                        }
                    });
                    
                    if (bestMatch) {
                        return { text: bestMatch, debug: results.debug };
                    }
                    
                    return results;
                })();
                """
                
                res = tab.run_js(response_js)
                if not res:
                    empty_count += 1
                    time.sleep(1)
                    continue
                    
                content = res.get('text')
                debug_info = res.get('debug', [])
                
                if content and len(content.strip()) > 3:
                    if content != last_content:
                        # Calculate new text to yield
                        if content.startswith(last_content):
                            new_part = content[len(last_content):]
                        else:
                            new_part = content
                        
                        if new_part and len(new_part.strip()) > 0:
                            logger.info(f"Streaming {len(new_part)} new chars...")
                            yield new_part
                            last_content = content
                            empty_count = 0
                        else:
                            empty_count += 1
                    else:
                        empty_count += 1
                else:
                    empty_count += 1
                
                # Check if response is still being generated
                is_streaming = tab.run_js("""
                    document.querySelector('button[aria-label*="Stop"], [class*="loading"], [class*="typing"]') !== null
                """)
                
                # Only break early if not streaming and we've waited a bit
                if not is_streaming and empty_count > 10 and len(last_content) > 50:
                    logger.info("Response appears complete")
                    break
                
                time.sleep(0.5)  # Check more frequently
                
            except Exception as e:
                logger.error(f"Stream error: {e}")
                break
        
        logger.info(f"Stream finished. Total: {len(last_content)} chars")
    
    # ==================== MAIN CHAT METHOD ====================
    
    def chat_stream(self, prompt: str, model_id: str, model_name: str) -> Generator[str, None, None]:
        """Send a prompt and stream the response following the exact 8-step flow."""
        try:
            # 1. Get/Load Tab
            tab = self.get_model_tab(model_id, model_name)
            tab.wait.doc_loaded()
            time.sleep(3.0)  # Extra stabilization for lmarena.ai
            
            # 2. Initial Challenge Check
            if self._is_cloudflare_page(tab):
                yield f"[CHALLENGE:cloudflare:{model_id}]"
                if not self._wait_for_cloudflare(tab):
                    raise RateLimitError(model_id, "cloudflare-timeout")
            
            # 3. Dismiss Popups (Cookies, Welcome, Terms)
            self._dismiss_all_popups(tab)
            time.sleep(1.0)
            
            # 4. Model Selection
            if not self._model_ready.get(model_id, False):
                self._select_model(tab, model_name)
                self._model_ready[model_id] = True
            
            # 5. Send Prompt (Double Enter)
            if not self._send_prompt(tab, prompt):
                raise Exception("Failed to send prompt")
            
            # 6. Mid-flow Checks (Challenge + Popups)
            time.sleep(1.5)
            if self._is_cloudflare_page(tab):
                yield f"[CHALLENGE:cloudflare:{model_id}]"
                if not self._wait_for_cloudflare(tab):
                    raise RateLimitError(model_id, "cloudflare-midflow-timeout")
            self._dismiss_all_popups(tab)
            
            # 7. Rate Limit Check
            if self._check_rate_limit(tab):
                logger.warning(f"Rate limit detected for {model_name}")
                raise RateLimitError(model_id, "rate-limit")
                
            # 8. Stream response
            yield from self._stream_response(tab)
            
        except RateLimitError:
            raise
        except Exception as e:
            logger.error(f"Chat error for {model_name}: {e}")
            raise
    
    # ==================== UTILITY METHODS ====================
    
    def get_challenge_screenshot(self, model_id: str) -> Optional[str]:
        """Capture screenshot for in-app challenge solving."""
        if model_id not in self.active_models:
            return None
        
        try:
            tab = self.active_models[model_id]
            screenshot_bytes = tab.get_screenshot(as_bytes='png')
            return base64.b64encode(screenshot_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return None
    
    def click_at_position(self, model_id: str, x: int, y: int) -> bool:
        """Click at position for in-app challenge solving."""
        if model_id not in self.active_models:
            return False
        
        try:
            tab = self.active_models[model_id]
            tab.actions.move_to((x, y)).click()
            time.sleep(1)
            return True
        except Exception as e:
            logger.error(f"Click failed: {e}")
            return False
    
    def close(self):
        """Close the browser."""
        try:
            if LMSYSAgent._browser:
                LMSYSAgent._browser.quit()
                LMSYSAgent._browser = None
                LMSYSAgent._instance = None
        except Exception as e:
            logger.error(f"Close error: {e}")
