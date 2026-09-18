import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptKey, fingerprintKey } from "@/lib/ai/crypto";
import { detectProviderFromKey, pickModel } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

// GET /api/ai/keys — list masked keys + preferences
export async function GET() {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  const [{ data: keys }, { data: prefs }] = await Promise.all([
    supabase.from("user_ai_keys").select("*").eq("user_id", context.user.id).order("created_at", { ascending: true }),
    supabase.from("user_ai_preferences").select("*").eq("user_id", context.user.id).maybeSingle(),
  ]);

  const masked = ((keys ?? []) as unknown as Array<Record<string, unknown>>).map((k) => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    status: k.status,
    last_used_at: k.last_used_at,
    last_error: k.last_error,
    created_at: k.created_at,
    key_preview: `${k.key_fingerprint}••••••••`,
  }));

  return NextResponse.json({
    keys: masked,
    preferences: prefs ?? {
      default_provider: "openrouter", default_model: "google/gemma-4-26b-a4b-it:free",
      tier_a_model: null, tier_b_model: null, tier_c_model: null,
      allow_free_fallbacks: true, prefer_free_tiers: true,
    },
  });
}

// POST /api/ai/keys — save/update a key, or update preferences only
// (prefs_only mode never touches the encrypted key — a prefs save used to
// overwrite encrypted_key with a masked preview string, corrupting the key).
export async function POST(request: Request) {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const {
    provider, api_key, label, base_url, prefs_only,
    model_override, tier_a_model, tier_b_model, tier_c_model, prefer_free_tiers,
  } = body as Record<string, unknown>;

  const isPrefsOnly = prefs_only === true || typeof api_key !== "string" || !api_key.trim();

  // ── Key upsert (skipped in prefs-only mode) ─────────────────────
  if (!isPrefsOnly) {
    if (typeof provider !== "string" || !provider) {
      return NextResponse.json({ error: "provider required with api_key" }, { status: 400 });
    }
    const plainKey = api_key as string;
    const encrypted = await encryptKey(plainKey);
    const fingerprint = fingerprintKey(plainKey);

    // If this provider already exists, keep only one active row per (user, provider, label).
    const { data: keyRow, error: keyErr } = await supabase
      .from("user_ai_keys")
      .upsert({
        user_id: context.user.id,
        provider: provider as string,
        label: (label as string) || "Default",
        encrypted_key: encrypted,
        key_fingerprint: fingerprint,
        status: "active",
        metadata: {
          detected: detectProviderFromKey(plainKey),
          ...(typeof base_url === "string" && base_url.trim() ? { base_url: (base_url as string).trim() } : {}),
        },
      }, { onConflict: "user_id,provider,label" })
      .select("id")
      .single();

    if (keyErr) return NextResponse.json({ error: keyErr.message }, { status: 500 });
    void keyRow;
  }

  // ── Preferences upsert (always) ─────────────────────────────────
  const prefsInput: {
    user_id: string;
    default_provider: string;
    prefer_free_tiers: boolean;
    allow_free_fallbacks: boolean;
    default_model?: string;
    tier_a_model?: string | null;
    tier_b_model?: string | null;
    tier_c_model?: string | null;
  } = {
    user_id: context.user.id,
    default_provider:
      typeof provider === "string" && provider
        ? provider
        : typeof body.default_provider === "string" && body.default_provider
          ? body.default_provider
          : "openrouter",
    prefer_free_tiers: (prefer_free_tiers as boolean | undefined) ?? true,
    allow_free_fallbacks: true,
    ...(isPrefsOnly
      ? typeof body.default_model === "string" && body.default_model
        ? { default_model: body.default_model as string }
        : {}
      : {
          default_model: pickModel(
            "B",
            detectProviderFromKey((api_key as string) || ""),
            (prefer_free_tiers as boolean) ?? true,
            (tier_b_model as string | null) || null,
            (model_override as string | null) || null,
          ),
        }),
    ...(tier_a_model !== undefined ? { tier_a_model: (tier_a_model as string | null) || null } : {}),
    ...(tier_b_model !== undefined ? { tier_b_model: (tier_b_model as string | null) || null } : {}),
    ...(tier_c_model !== undefined ? { tier_c_model: (tier_c_model as string | null) || null } : {}),
  };

  const { error: prefsErr } = await supabase
    .from("user_ai_preferences")
    .upsert(prefsInput, { onConflict: "user_id" });
  if (prefsErr) return NextResponse.json({ error: prefsErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, prefs_only: isPrefsOnly });
}
