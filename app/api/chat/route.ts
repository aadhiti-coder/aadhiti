import { requireAuth } from "@/lib/server/auth";
import { SAFETY_SCRIPTS, safetyRule } from "@/lib/safetyScripts";
import { detectLang } from "@/lib/detectLang";
// AI answers for the website chat. The engine lives in lib/server/answer.ts (shared with WhatsApp).
import type { AgeGroup, Lang } from "@/lib/kb";
import { rateLimited } from "@/lib/server/rateLimit";
import { AGES, MAX_CHARS, answerQuestion, cleanHistory } from "@/lib/server/answer";

export async function POST(req: Request) {
  let input: { message?: unknown; lang?: unknown; age?: unknown; history?: unknown; profile?: unknown };
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const uiLang: Lang = input.lang === "en" || input.lang === "hi" ? input.lang : "mr";
  const age = AGES.includes(input.age as AgeGroup) ? (input.age as AgeGroup) : null;
  if (!message || message.length > MAX_CHARS) return Response.json({ error: "Message must be 1–800 characters" }, { status: 400 });

  // Emergency guidance must also work for direct API users and during AI outages.
  const rule = safetyRule(message);
  if (rule) {
    const script = SAFETY_SCRIPTS[rule];
    const lang = detectLang(message, uiLang);
    const text = script.text[lang] ?? script.text.mr!;
    return Response.json({ intent: "ACT", risk: script.risk, understand: text.ack,
      answer: text.a, safetyCheck: text.fu, nextStep: text.n, options: [],
      helplines: script.hl, module: "safety", source: "AADHI TI safety guidance",
      verify: "", lang, topicId: null });
  }
  const denied = await requireAuth(); if (denied) return denied;
  if (await rateLimited(req, "chat", 20)) return Response.json({ error: "Too many requests" }, { status: 429 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "AI is not configured" }, { status: 503 });

  const out = await answerQuestion({ message, uiLang, age, history: cleanHistory(input.history), profile: input.profile });
  return out ? Response.json(out) : Response.json({ error: "AI unavailable" }, { status: 502 });
}
