"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, KeyRound, TestTube2, Trash2 } from "lucide-react";

type Provider = "openai" | "anthropic" | "google" | "groq" | "together" | "openrouter" | "huggingface" | "custom";
type ProviderInfo = {
  value: Provider;
  label: string;
  freeModel: string;
  keyHint: string;
  url: string;
  description: string;
};

const PROVIDERS: ProviderInfo[] = [
  { value: "openrouter", label: "OpenRouter", freeModel: "nvidia/nemotron-3.5-lightning:free", keyHint: "sk-or-v1-…", url: "https://openrouter.ai/keys", description: "Free models available. Mixes OpenAI / Anthropic / Google / NVIDIA behind one key." },
  { value: "google", label: "Google Gemini", freeModel: "gemini-2.5-flash", keyHint: "AIza… / AQ.…", url: "https://aistudio.google.com/apikey", description: "Free tier: 15 RPM, 1M tokens/min." },
  { value: "groq", label: "Groq", freeModel: "openai/gpt-oss-20b", keyHint: "gsk_…", url: "https://console.groq.com/keys", description: "Free tier with ultra-fast inference." },
  { value: "openai", label: "OpenAI", freeModel: "gpt-4o-mini", keyHint: "sk-…", url: "https://platform.openai.com/api-keys", description: "Paid. gpt-4o-mini is cheapest." },
  { value: "anthropic", label: "Anthropic", freeModel: "claude-3-haiku-20240307", keyHint: "sk-ant-…", url: "https://console.anthropic.com/", description: "Paid. Haiku is cheapest." },
  { value: "huggingface", label: "HuggingFace", freeModel: "meta-llama/Llama-3.1-8B-Instruct", keyHint: "hf_…", url: "https://huggingface.co/settings/tokens", description: "Free inference via router." },
  { value: "together", label: "Together AI", freeModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", keyHint: "sg-…", url: "https://api.together.xyz/settings/api-keys", description: "Free trial credits available." },
  { value: "custom", label: "Custom endpoint", freeModel: "", keyHint: "any", url: "", description: "Any OpenAI-compatible /chat/completions endpoint." },
];

export function AiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [keys, setKeys] = useState<Array<{ id: string; provider: string; label: string; key_preview: string }>>([]);
  const [prefs, setPrefs] = useState({
    default_provider: "openrouter",
    default_model: "nvidia/nemotron-3.5-lightning:free",
    tier_a_model: "",
    tier_b_model: "",
    tier_c_model: "",
    allow_free_fallbacks: true,
    prefer_free_tiers: true,
  });

  const [form, setForm] = useState({ provider: "openrouter" as Provider, api_key: "", label: "Default", base_url: "" });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetch("/api/ai/keys")
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => {
        setKeys(data.keys ?? []);
        if (data.preferences) setPrefs(data.preferences);
      })
      .catch(() => toast.error("Failed to load AI settings"))
      .finally(() => setLoading(false));
  }, []);

  const providerInfo = useMemo(() => PROVIDERS.find((p) => p.value === form.provider) ?? PROVIDERS[0], [form.provider]);

  async function saveKey() {
    if (!form.api_key.trim()) return toast.error("Paste an API key first.");
    setSaving(true);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          api_key: form.api_key,
          label: form.label,
          prefer_free_tiers: prefs.prefer_free_tiers,
          tier_a_model: prefs.tier_a_model || undefined,
          tier_b_model: prefs.tier_b_model || undefined,
          tier_c_model: prefs.tier_c_model || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("AI key saved");
      setForm((f) => ({ ...f, api_key: "" }));
      setShowKey(false);
      const list = await fetch("/api/ai/keys").then((r) => r.json());
      setKeys(list.keys ?? []);
      setPrefs(list.preferences ?? prefs);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function testKey() {
    if (!form.api_key.trim()) return toast.error("Paste an API key first.");
    setTesting(true);
    try {
      const res = await fetch("/api/ai/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: form.provider, api_key: form.api_key, base_url: form.base_url || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Key valid · ${data.latencyMs}ms · model: ${data.model}`);
      } else {
        toast.error(data.error ?? "Key rejected");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function deleteKey(id: string) {
    const res = await fetch(`/api/ai/keys/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete key");
    setKeys((k) => k.filter((x) => x.id !== id));
    toast.success("Key revoked");
  }

  async function savePrefs() {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefs_only: true,
          default_provider: prefs.default_provider,
          default_model: prefs.default_model,
          prefer_free_tiers: prefs.prefer_free_tiers,
          tier_a_model: prefs.tier_a_model || null,
          tier_b_model: prefs.tier_b_model || null,
          tier_c_model: prefs.tier_c_model || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Preferences saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>AI settings</CardTitle>
          <CardDescription>Loading your keys…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> AI provider keys (BYOK)</CardTitle>
          <CardDescription>
            Bring your own API key. Keys are encrypted at rest and never exposed to the client.
            Free-tier providers are prioritized when allowed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v as Provider }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span>{p.label}</span>
                        {p.freeModel && <span className="text-xs text-emerald-600">Free: {p.freeModel}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{providerInfo.description}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Default" />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>API key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder={providerInfo.keyHint}
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" onClick={testKey} disabled={testing || !form.api_key.trim()}>
                  <TestTube2 className="mr-2 h-4 w-4" /> {testing ? "Testing…" : "Test"}
                </Button>
              </div>
              {form.provider === "custom" && (
                <Input
                  value={form.base_url}
                  onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                  placeholder="https://your-endpoint/v1"
                  className="font-mono"
                />
              )}
              <a href={providerInfo.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                Get a key from {providerInfo.label} →
              </a>
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <Button onClick={saveKey} disabled={saving || !form.api_key.trim()}>
                {saving ? "Saving…" : "Save key"}
              </Button>
              {providerInfo.freeModel && (
                <span className="text-xs text-emerald-600 font-medium">Free model: {providerInfo.freeModel}</span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="mb-3 text-sm font-semibold">Saved keys</h4>
            {!keys.length ? (
              <p className="text-sm text-slate-500">No keys saved yet. Add one above to unlock AI tutor, quiz generation, and flashcards.</p>
            ) : (
              <div className="space-y-2">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium capitalize">{k.provider}</div>
                      <div className="font-mono text-xs text-slate-500">{k.key_preview}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle>AI preferences</CardTitle>
          <CardDescription>Default provider, model overrides per tier, and free-tier routing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Default provider</Label>
              <Select value={prefs.default_provider} onValueChange={(v) => setPrefs((p) => ({ ...p, default_provider: typeof v === "string" && v ? v : p.default_provider }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Default model</Label>
              <Input value={prefs.default_model} onChange={(e) => setPrefs((p) => ({ ...p, default_model: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tier A (cheap / classify)</Label>
              <Input value={prefs.tier_a_model} onChange={(e) => setPrefs((p) => ({ ...p, tier_a_model: e.target.value }))} placeholder={providerInfo.freeModel || "model slug"} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tier B (standard tutor)</Label>
              <Input value={prefs.tier_b_model} onChange={(e) => setPrefs((p) => ({ ...p, tier_b_model: e.target.value }))} placeholder={providerInfo.freeModel || "model slug"} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tier C (reasoning / copilot)</Label>
              <Input value={prefs.tier_c_model} onChange={(e) => setPrefs((p) => ({ ...p, tier_c_model: e.target.value }))} placeholder={providerInfo.freeModel || "model slug"} />
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.prefer_free_tiers}
                onChange={(e) => setPrefs((p) => ({ ...p, prefer_free_tiers: e.target.checked }))}
              />
              Prefer free-tier models when available
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.allow_free_fallbacks}
                onChange={(e) => setPrefs((p) => ({ ...p, allow_free_fallbacks: e.target.checked }))}
              />
              Allow free fallbacks when key fails
            </label>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <strong>Recommended free stack:</strong> OpenRouter with <code className="font-mono">nvidia/nemotron-3.5-lightning:free</code>, Google Gemini free tier, or Groq with <code className="font-mono">openai/gpt-oss-20b</code>. All work with just an API key — no credit card.
          </div>

          <Button onClick={savePrefs} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
