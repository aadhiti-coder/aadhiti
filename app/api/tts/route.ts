import { requireAuth } from "@/lib/server/auth";
// Text-to-speech for the call bot. The engine lives in lib/server/tts.ts (shared with WhatsApp).
import type { Lang } from "@/lib/kb";
import { rateLimited } from "@/lib/server/rateLimit";
import { TTS_MAX_CHARS, synthesize, ttsConfigured } from "@/lib/server/tts";

const LANGS = new Set(["mr", "hi", "en"]);

export async function POST(req: Request) {
  const denied = await requireAuth(); if (denied) return denied;
  if (!ttsConfigured()) return Response.json({ error: "Voice is not configured" }, { status: 503 });
  if (await rateLimited(req, "tts", 40)) return Response.json({ error: "Too many requests" }, { status: 429 });

  let body: { text?: unknown; lang?: unknown; voice?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const lang = (typeof body.lang === "string" && LANGS.has(body.lang) ? body.lang : "hi") as Lang;
  if (!text || text.length > TTS_MAX_CHARS) return Response.json({ error: "Text must be 1–500 characters" }, { status: 400 });

  // Don't leak provider details to the browser; the client falls back to the device voice.
  const buf = await synthesize(text, lang, body.voice === "male" ? "male" : "female");
  if (!buf) return Response.json({ error: "Voice unavailable" }, { status: 502 });
  return new Response(buf, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
}
