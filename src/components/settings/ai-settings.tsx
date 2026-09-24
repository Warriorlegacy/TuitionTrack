"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Eye, EyeOff, KeyRound, RefreshCw, TestTube2, Trash2 } from "lucide-react";

// Relative "x ago" for key usage display.
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "together"
  | "openrouter"
  | "huggingface"
  | "nvidia"
  | "deepseek"
  | "ollama"
  | "ollama_cloud"
  | "github"
  | "opencode"
  | "custom";

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
  { value: "groq", label: "Groq", freeModel: "qwen/qwen3.8-27b", keyHint: "gsk_…", url: "https://console.groq.com/keys", description: "Free tier with ultra-fast inference (Qwen, Llama, OSS).", tier: "free-tier" },
  { value: "google", label: "Google Gemini", freeModel: "gemini-2.5-flash-lite", keyHint: "AIza… / AQ.…", url: "https://aistudio.google.com/apikey", description: "Free tier: 15 RPM, 1M tokens/min.", tier: "free-tier" },
  { value: "openrouter", label: "OpenRouter", freeModel: "google/gemma-4-26b-a4b-it:free", keyHint: "sk-or-v1-…", url: "https://openrouter.ai/keys", description: "Free models available. Mixes OpenAI / Anthropic / Google / NVIDIA behind one key.", tier: "free-tier" },
  { value: "ollama_cloud", label: "Ollama Cloud", freeModel: "gemma4:31b", keyHint: "API key from ollama.com/settings/keys", url: "https://ollama.com/settings/keys", description: "Official Ollama Cloud API (ollama.com/v1). Free usage credits for Gemma 4, GPT-OSS & Nemotron 3.", tier: "free-tier" },
  { value: "ollama", label: "Ollama (local, free)", freeModel: "llama3.1:8b", keyHint: "no key needed", url: "", description: "100% free, private, offline via http://localhost:11434/v1.", tier: "free-local" },
  { value: "openai", label: "OpenAI", freeModel: "gpt-4o-mini", keyHint: "sk-…", url: "https://platform.openai.com/api-keys", description: "Paid. gpt-4o-mini is cheapest.", tier: "paid" },
  { value: "anthropic", label: "Anthropic", freeModel: "claude-3-haiku-20240307", keyHint: "sk-ant-…", url: "https://console.anthropic.com/", description: "Paid. Haiku is cheapest.", tier: "paid" },
  { value: "huggingface", label: "HuggingFace", freeModel: "meta-llama/Llama-3.1-8B-Instruct", keyHint: "hf_…", url: "https://huggingface.co/settings/tokens", description: "Free inference via router.", tier: "free-tier" },
  { value: "together", label: "Together AI", freeModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", keyHint: "sg-…", url: "https://api.together.xyz/settings/api-keys", description: "Free trial credits available.", tier: "paid" },
  { value: "nvidia", label: "NVIDIA NIM", freeModel: "nvidia/nemotron-3.5-lightning-30b-a3b", keyHint: "nvapi-…", url: "https://build.nvidia.com/", description: "Free credits. Nemotron + Llama via OpenAI-compatible API.", tier: "free-tier" },
  { value: "deepseek", label: "DeepSeek", freeModel: "deepseek-chat", keyHint: "sk-…", url: "https://platform.deepseek.com/api_keys", description: "Cheapest reasoning-grade API. Select DeepSeek explicitly (keys share the sk- prefix with OpenAI).", tier: "paid" },
  { value: "github", label: "GitHub Models", freeModel: "openai/gpt-4o-mini", keyHint: "github_pat_…", url: "https://github.com/settings/tokens", description: "Free inference quota with a Personal Access Token.", tier: "free-tier" },
  { value: "opencode", label: "OpenCode", freeModel: "", keyHint: "oc_sk_…", url: "https://opencode.ai/console", description: "Server-side credential for paid models only. Verified: OpenCode free models work inside OpenCode only — this app never bills them; free traffic uses the providers above.", tier: "paid" },
  { value: "custom", label: "Custom endpoint", freeModel: "", keyHint: "any", url: "", description: "Any OpenAI-compatible /chat/completions endpoint.", tier: "paid" },
];

// Model picker: choose from the latest models for a provider (live list
// via API key if entered, curated list otherwise) or type a custom slug.
function ModelSelect({
  label,
  value,
  provider,
  apiKey,
  fallbackHint,
  onChange,
}: {
  label: string;
  value: string;
  provider: string;
  apiKey?: string;
  fallbackHint: string;
  onChange: (v: string) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState(false);

  const loadModels = useCallback((keyToUse?: string) => {
    let dead = false;
    setLoading(true);
    const keyParam = keyToUse && keyToUse.trim() && keyToUse.trim() !== "ollama"
      ? `&apiKey=${encodeURIComponent(keyToUse.trim())}`
      : "";
    fetch(`/api/ai/models?provider=${encodeURIComponent(provider)}${keyParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        if (dead) return;
        setModels(d.models ?? []);
        setLive(Boolean(d.live));
      })
      .catch(() => {})
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, [provider]);

  useEffect(() => {
    setCustom(false);
    return loadModels(apiKey);
  }, [provider, loadModels, apiKey]);

  const inList = value !== "" && models.includes(value);
  const selectValue = custom ? "__custom" : value === "" ? "__auto" : inList ? value : "__custom";
  const showCustom = custom || (!inList && value !== "");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {apiKey && apiKey.trim() && apiKey.trim() !== "ollama" && (
          <button
            type="button"
            onClick={() => loadModels(apiKey)}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Fetching…" : "Fetch live models"}
          </button>
        )}
      </div>
      {!showCustom ? (
        <Select
          value={selectValue}
          onValueChange={(v) => {
            if (v === "__custom") setCustom(true);
            else if (typeof v === "string") onChange(v === "__auto" ? "" : v);
          }}
        >
          <SelectTrigger className="font-mono text-xs">
            <SelectValue placeholder={fallbackHint ? `Auto (${fallbackHint})` : "Auto (free pool)"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto">
              Auto — {fallbackHint ? `default (${fallbackHint})` : "tier free pool + fallback"}
            </SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                <span className="font-mono text-xs">{m}</span>
              </SelectItem>
            ))}
            <SelectItem value="__custom">Custom slug…</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fallbackHint || "model slug"}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => { setCustom(false); onChange(""); }}>
            List
          </Button>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        {loading ? "Fetching available models…" : live ? "Live provider model list" : "Curated model list"} · empty = automatic
      </p>
    </div>
  );
}

export function AiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [keys, setKeys] = useState<Array<{
    id: string; provider: string; label: string; key_preview: string;
    status: string; last_used_at: string | null; last_error: string | null;
    model?: string | null; base_url?: string | null;
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

  const [form, setForm] = useState({
    provider: "groq" as Provider,
    api_key: "",
    model: "",
    label: "Default",
    base_url: "",
  });
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
  const isLocalOllama = form.provider === "ollama";

  async function saveKey() {
    const effectiveKey = form.api_key.trim() || (isLocalOllama ? "ollama" : "");
    if (!effectiveKey) return toast.error("Paste an API key first.");
    setSaving(true);
    try {
      const res = await fetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          api_key: effectiveKey,
          model: form.model || undefined,
          label: form.label,
          base_url: form.base_url || undefined,
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
    const effectiveKey = form.api_key.trim() || (isLocalOllama ? "ollama" : "");
    if (!effectiveKey) return toast.error("Paste an API key first.");
    setTesting(true);
    try {
      const res = await fetch("/api/ai/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          api_key: effectiveKey,
          model: form.model || undefined,
          base_url: form.base_url || undefined,
        }),
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
            Bring your own API key and choose your preferred models. Keys are encrypted at rest and never exposed to the client.
            Free-tier providers are prioritized when allowed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => {
                  const p = v as Provider;
                  setForm((f) => ({
                    ...f,
                    provider: p,
                    model: "",
                    base_url: p === "ollama_cloud" && !f.base_url ? "https://ollama.com/v1" : f.base_url,
                  }));
                }}
              >
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
                        {p.freeModel && <span className="text-xs text-emerald-600">Default: {p.freeModel}</span>}
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

            <div className="sm:col-span-2">
              <ModelSelect
                label="Model selection"
                value={form.model}
                provider={form.provider}
                apiKey={form.api_key}
                fallbackHint={providerInfo.freeModel || "auto"}
                onChange={(m) => setForm((f) => ({ ...f, model: m }))}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>API key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder={isLocalOllama ? "optional (local Ollama does not require a key)" : providerInfo.keyHint}
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" onClick={testKey} disabled={testing || (!form.api_key.trim() && !isLocalOllama)}>
                  <TestTube2 className="mr-2 h-4 w-4" /> {testing ? "Testing…" : "Test"}
                </Button>
              </div>
              {(form.provider === "custom" || form.provider === "ollama" || form.provider === "ollama_cloud") && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <Label className="text-xs text-slate-600">Base URL</Label>
                  <Input
                    value={form.base_url}
                    onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                    placeholder={
                      form.provider === "ollama"
                        ? "http://localhost:11434/v1"
                        : form.provider === "ollama_cloud"
                          ? "https://ollama.com/v1"
                          : "https://your-endpoint/v1"
                    }
                    className="font-mono text-xs"
                  />
                </div>
              )}
              {providerInfo.url && (
                <a href={providerInfo.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Get a key from {providerInfo.label} →
                </a>
              )}
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <Button onClick={saveKey} disabled={saving || (!form.api_key.trim() && !isLocalOllama)}>
                {saving ? "Saving…" : "Save key"}
              </Button>
              {form.model ? (
                <span className="text-xs text-primary font-medium">Selected model: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{form.model}</code></span>
              ) : providerInfo.freeModel ? (
                <span className="text-xs text-emerald-600 font-medium">Default model: {providerInfo.freeModel}</span>
              ) : null}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium capitalize">{k.provider === "ollama_cloud" ? "Ollama Cloud" : k.provider}</span>
                        {k.model && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-700">
                            {k.model}
                          </span>
                        )}
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
                      <div className="font-mono text-xs text-slate-500 mt-0.5">
                        {k.key_preview}
                        {k.base_url && <span className="ml-2 text-slate-400 font-sans">({k.base_url})</span>}
                      </div>
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
            <ModelSelect
              label="Default model"
              value={prefs.default_model}
              provider={prefs.default_provider}
              fallbackHint={providerInfo.freeModel || "model slug"}
              onChange={(v) => setPrefs((p) => ({ ...p, default_model: v }))}
            />
            <ModelSelect
              label="Tier A (cheap / classify)"
              value={prefs.tier_a_model}
              provider={prefs.default_provider}
              fallbackHint={providerInfo.freeModel || "model slug"}
              onChange={(v) => setPrefs((p) => ({ ...p, tier_a_model: v }))}
            />
            <ModelSelect
              label="Tier B (standard tutor)"
              value={prefs.tier_b_model}
              provider={prefs.default_provider}
              fallbackHint={providerInfo.freeModel || "model slug"}
              onChange={(v) => setPrefs((p) => ({ ...p, tier_b_model: v }))}
            />
            <ModelSelect
              label="Tier C (reasoning / copilot)"
              value={prefs.tier_c_model}
              provider={prefs.default_provider}
              fallbackHint={providerInfo.freeModel || "model slug"}
              onChange={(v) => setPrefs((p) => ({ ...p, tier_c_model: v }))}
            />
          </div>

          <Separator />

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={prefs.prefer_free_tiers}
                onChange={(e) => setPrefs((p) => ({ ...p, prefer_free_tiers: e.target.checked }))}
              />
              Free-only mode — never call paid models
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.allow_free_fallbacks}
                onChange={(e) => setPrefs((p) => ({ ...p, allow_free_fallbacks: e.target.checked }))}
              />
              Automatic free-model fallback when a key/model fails
            </label>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <strong>Recommended free stack:</strong> Groq (Qwen/OSS) → Gemini free → OpenRouter gemma → Ollama Cloud / Local (₹0).
          </div>
          <p className="text-[11px] text-slate-400">
            Server default: FREE ONLY (AI_COST_MODE). Paid models run only with explicit server configuration
            (AI_COST_MODE=paid_allowed + ALLOW_PAID_FALLBACK=true) and the free-only toggle off. Max free-model
            rotations per request: AI_MAX_FALLBACKS (default 5).
          </p>

          <Button onClick={savePrefs} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
