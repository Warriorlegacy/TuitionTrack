// BYOK encryption: AES-GCM with a server-side key.
// Key source: AI_KEY_ENC_KEY env var (32 bytes base64). Server-side only.
// Never expose encrypted_key or the encryption key to the client.

import { createHash } from "node:crypto";

let cachedKey: CryptoKey | null = null;

function getRawKey(): string {
  const raw = process.env.AI_KEY_ENC_KEY;
  if (!raw) throw new Error("AI_KEY_ENC_KEY is not set");
  return raw;
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = getRawKey();
  const bytes = Uint8Array.from(Buffer.from(raw, "base64"));
  cachedKey = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

export async function encryptKey(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return Buffer.from(combined).toString("base64");
}

export async function decryptKey(ciphertext: string): Promise<string> {
  const key = await getKey();
  const raw = Uint8Array.from(Buffer.from(ciphertext, "base64"));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

export function fingerprintKey(plaintext: string): string {
  // SHA-256 of the raw key, first 12 hex chars — deterministic per key, never reversible.
  return createHash("sha256").update(plaintext, "utf8").digest("hex").slice(0, 12);
}
