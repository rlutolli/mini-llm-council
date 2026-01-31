import { useState, useEffect } from 'react';
import { Settings, Key, Users, ExternalLink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  getSettings,
  saveSettings,
  getAPIKeys,
  saveAPIKeys,
  getCouncilConfig,
  saveCouncilConfig,
  resetCouncilConfig,
  AVAILABLE_MODELS,
} from '@/lib/storage';
import type { AppSettings } from '@/types/council';
import type { APIKeys, CouncilConfig } from '@/lib/storage';
import { SystemMetrics, BitNetStatus } from './settings';
import { Terminal } from 'lucide-react';

const COUNCIL_ROLES = [
  { id: 'advocate', name: 'The Advocate', description: 'Champion of Possibilities' },
  { id: 'skeptic', name: 'The Skeptic', description: 'Guardian of Caution' },
  { id: 'analyst', name: 'The Analyst', description: 'Voice of Logic' },
  { id: 'pragmatist', name: 'The Pragmatist', description: 'Master of Execution' },
  { id: 'visionary', name: 'The Visionary', description: 'Keeper of Tomorrow' },
  { id: 'chairman', name: 'Chairman', description: 'Synthesizer of Wisdom' },
];

const API_PROVIDERS = [
  {
    key: 'openrouter' as const,
    name: 'OpenRouter',
    description: 'DeepSeek R1, Qwen3, Mistral (50/day free)',
    url: 'https://openrouter.ai/keys',
  },
  {
    key: 'groq' as const,
    name: 'Groq',
    description: 'Llama 3.3, Gemma (14,400/day free)',
    url: 'https://console.groq.com/keys',
  },
  {
    key: 'google' as const,
    name: 'Google AI',
    description: 'Gemini 2.0 Flash (1,500/day free)',
    url: 'https://aistudio.google.com/apikey',
  },
];

export function SettingsModal() {
  const [settings, setSettings] = useState<AppSettings>({ mode: 'demo', theme: 'system', autoFallback: true });
  const [apiKeys, setApiKeys] = useState<APIKeys>({});
  const [councilConfig, setCouncilConfig] = useState<CouncilConfig>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
    setApiKeys(getAPIKeys());
    setCouncilConfig(getCouncilConfig());
  }, [open]);

  const handleModeChange = (isLive: boolean) => {
    const newSettings = { ...settings, mode: isLive ? 'live' as const : 'demo' as const };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleAutoFallbackChange = (enabled: boolean) => {
    const newSettings = { ...settings, autoFallback: enabled };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleAPIKeyChange = (provider: keyof APIKeys, value: string) => {
    const newKeys = { ...apiKeys, [provider]: value || undefined };
    setApiKeys(newKeys);
    saveAPIKeys(newKeys);
  };

  const handleModelChange = (roleId: string, model: string) => {
    const newConfig = { ...councilConfig, [roleId]: model };
    setCouncilConfig(newConfig);
    saveCouncilConfig(newConfig);
  };

  const handleResetModels = () => {
    resetCouncilConfig();
    setCouncilConfig(getCouncilConfig());
  };


  const configuredKeysCount = Object.values(apiKeys).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI Council experience
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="api-keys" className="relative">
              API Keys
              {configuredKeysCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs justify-center">
                  {configuredKeysCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="mode-toggle">Live Mode</Label>
                  <Badge variant={settings.mode === 'live' ? 'default' : 'secondary'} className="text-xs">
                    {settings.mode === 'live' ? 'Active' : 'Demo'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.mode === 'live'
                    ? 'Using real AI models via LMArena + fallback APIs'
                    : 'Using simulated responses for testing'
                  }
                </p>
              </div>
              <Switch
                id="mode-toggle"
                checked={settings.mode === 'live'}
                onCheckedChange={handleModeChange}
              />
            </div>

            {/* Auto-Fallback Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="space-y-1">
                <Label htmlFor="fallback-toggle">Auto-Fallback</Label>
                <p className="text-xs text-muted-foreground">
                  {settings.autoFallback
                    ? 'Automatically use backup API when rate-limited'
                    : 'Ask before using fallback providers'
                  }
                </p>
              </div>
              <Switch
                id="fallback-toggle"
                checked={settings.autoFallback}
                onCheckedChange={handleAutoFallbackChange}
              />
            </div>

            {settings.mode === 'live' && configuredKeysCount === 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ No fallback API keys configured. If a model is rate-limited, there will be no backup.
                </p>
              </div>
            )}
          </TabsContent>


          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Optional fallback API keys. Used when LMArena models are rate-limited. Keys are stored locally in your browser.
            </p>

            {API_PROVIDERS.map((provider) => (
              <div key={provider.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={provider.key} className="text-sm font-medium">
                    {provider.name}
                  </Label>
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    Get key <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id={provider.key}
                  type="password"
                  placeholder={`Enter ${provider.name} API key`}
                  value={apiKeys[provider.key] || ''}
                  onChange={(e) => handleAPIKeyChange(provider.key, e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">{provider.description}</p>
              </div>
            ))}
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Customize which model powers each council role.
              </p>
              <Button variant="ghost" size="sm" onClick={handleResetModels}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>

            <div className="space-y-3">
              {COUNCIL_ROLES.map((role) => (
                <div key={role.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{role.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{role.description}</p>
                  </div>
                  <Select
                    value={councilConfig[role.id] || 'GPT-4o'}
                    onValueChange={(value) => handleModelChange(role.id, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4 mt-4">
            <SystemMetrics />
            <BitNetStatus />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
