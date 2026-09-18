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

// Relative "x ago" for key usage display.
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type Provider = "openai" | "anthropic" | "google" | "groq" | "together" | "openrouter" | "huggingface" | "nvidia" | "deepseek" | "ollama" | "github" | "custom";
type ProviderInfo = {
  value: Provider;
  label: string;
  freeModel: string;
  keyHint: string;
  url: string;
  description: string;
  tier: "free-local" | "free-tier" | "paid";
};

const PROVIDERS: ProviderInfo[] = [
  { value: "openrouter", label: "OpenRouter", freeModel: "google/gemma-4-26b-a4b-it:free", keyHint: "sk-or-v1-…", url: "https://openrouter.ai/keys", description: "Free models available. Mixes OpenAI / Anthropic / Google / NVIDIA behind one key.", tier: "free-tier" },
  { value: "google", label: "Google Gemini", freeModel: "gemini-2.5-flash", keyHint: "AIza… / AQ.…", url: "https://aistudio.google.com/apikey", description: "Free tier: 15 RPM, 1M tokens/min.", tier: "free-tier" },
  { value: "groq", label: "Groq", freeModel: "openai/gpt-oss-20b", keyHint: "gsk_…", url: "https://console.groq.com/keys", description: "Free tier with ultra-fast inference.", tier: "free-tier" },
  { value: "openai", label: "OpenAI", freeModel: "gpt-4o-mini", keyHint: "sk-…", url: "https://platform.openai.com/api-keys", description: "Paid. gpt-4o-mini is cheapest.", tier: "paid" },
  { value: "anthropic", label: "Anthropic", freeModel: "claude-3-haiku-20240307", keyHint: "sk-ant-…", url: "https://console.anthropic.com/", description: "Paid. Haiku is cheapest.", tier: "paid" },
  { value: "huggingface", label: "HuggingFace", freeModel: "meta-llama/Llama-3.1-8B-Instruct", keyHint: "hf_…", url: "https://huggingface.co/settings/tokens", description: "Free inference via router.", tier: "free-tier" },
  { value: "together", label: "Together AI", freeModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", keyHint: "sg-…", url: "https://api.together.xyz/settings/api-keys", description: "Free trial credits available.", tier: "paid" },
  { value: "nvidia", label: "NVIDIA NIM", freeModel: "nvidia/nemotron-3.5-lightning-30b-a3b", keyHint: "nvapi-…", url: "https://build.nvidia.com/", description: "Free credits. Nemotron + Llama via OpenAI-compatible API.", tier: "free-tier" },
  { value: "deepseek", label: "DeepSeek", freeModel: "deepseek-chat", keyHint: "sk-…", url: "https://platform.deepseek.com/api_keys", description: "Cheapest reasoning-grade API. Select DeepSeek explicitly (keys share the sk- prefix with OpenAI).", tier: "paid" },
  { value: "github", label: "GitHub Models", freeModel: "openai/gpt-4o-mini", keyHint: "github_pat_…", url: "https://github.com/settings/tokens", description: "Free inference quota with a Personal Access Token.", tier: "free-tier" },
  { value: "ollama", label: "Ollama (local, free)", freeModel: "llama3.1:8b", keyHint: "no key needed", url: "", description: "100% free, private, offline via http://localhost:11434/v1.", tier: "free-local" },
  { value: "custom", label: "Custom endpoint", freeModel: "", keyHint: "any", url: "", description: "Any OpenAI-compatible /chat/completions endpoint.", tier: "paid" },
];

export function AiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [keys, setKeys] = useState<Array<{
    id: string; provider: string; label: string; key_preview: string;
    status: string; last_used_at: string | null; last_error: string | null;
  }>>([]);
  const [prefs, setPrefs] = useState({
    default_provider: "openrouter",
    default_model: "google/gemma-4-26b-a4b-it:free",
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
    const effectiveKey = form.api_key.trim() || (form.provider === "ollama" ? "ollama" : "");
    if (!effectiveKey) return toast.error("Paste an API key first.");
    setSaving(true);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          api_key: effectiveKey,
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
    const effectiveKey = form.api_key.trim() || (form.provider === "ollama" ? "ollama" : "");
    if (!effectiveKey) return toast.error("Paste an API key first.");
    setTesting(true);
    try {
      const res = await fetch("/api/ai/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: form.provider, api_key: effectiveKey, base_url: form.base_url || undefined }),
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
                        <span className="flex items-center gap-1.5">
                          {p.label}
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold ring-1 ring-inset ${p.tier === "free-local" ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20" : p.tier === "free-tier" ? "bg-sky-100 text-sky-700 ring-sky-600/20" : "bg-slate-100 text-slate-600 ring-slate-600/20"}`}>
                            {p.tier === "free-local" ? "100% FREE" : p.tier === "free-tier" ? "FREE TIER" : "PAID"}
                          </span>
                        </span>
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
                  placeholder={form.provider === "ollama" ? "leave blank for local Ollama" : providerInfo.keyHint}
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" onClick={testKey} disabled={testing || (!form.api_key.trim() && form.provider !== "ollama")}>
                  <TestTube2 className="mr-2 h-4 w-4" /> {testing ? "Testing…" : "Test"}
                </Button>
              </div>
              {(form.provider === "custom" || form.provider === "ollama") && (
                <Input
                  value={form.base_url}
                  onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                  placeholder={form.provider === "ollama" ? "http://localhost:11434/v1" : "https://your-endpoint/v1"}
                  className="font-mono"
                />
              )}
              {providerInfo.url && (
                <a href={providerInfo.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Get a key from {providerInfo.label} →
                </a>
              )}
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <Button onClick={saveKey} disabled={saving || (!form.api_key.trim() && form.provider !== "ollama")}>
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
                  <div key={k.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{k.provider}</span>
                        {k.status === "active" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : k.status === "expired" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Revoked
                          </span>
                        )}
                        {k.last_used_at && (
                          <span className="hidden text-[11px] text-slate-400 sm:inline" title={new Date(k.last_used_at).toLocaleString()}>
                            used {timeAgo(k.last_used_at)}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{k.key_preview}</div>
                      {k.last_error && <div className="text-xs text-red-600">Last error: {k.last_error}</div>}
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
            <strong>Recommended free stack:</strong> OpenRouter gemma free → Gemini free → Groq gpt-oss → Ollama local (offline, ₹0).
          </div>

          <Button onClick={savePrefs} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
