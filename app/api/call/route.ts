import { requireAuth } from "@/lib/server/auth";
import { answerQuestion, cleanHistory, AGES } from '@/lib/server/answer';
import { transcribe } from '@/lib/server/transcribe';
import { rateLimited } from '@/lib/server/rateLimit';
import { SAFETY_SCRIPTS, safetyRule } from '@/lib/safetyScripts';
import { detectLang } from '@/lib/detectLang';
import type { AgeGroup, Lang } from '@/lib/kb';

export const maxDuration = 60;
export async function POST(req: Request) {
  const denied = await requireAuth(); if (denied) return denied;
  if (await rateLimited(req, 'call', 20)) return Response.json({error:'rate'}, {status:429});
  if (!process.env.GEMINI_API_KEY) return Response.json({error:'unavailable'}, {status:503});
  if (Number(req.headers.get('content-length')) > 4_000_000) return Response.json({error:'size'}, {status:413});
  try {
    const form = await req.formData();
    const audio = form.get('audio');
    let message = String(form.get('message') || '').trim();
    if (audio instanceof File) {
      if (!audio.size || audio.size > 3_500_000) return Response.json({error:'size'}, {status:413});
      if (!/^audio\/(webm|mp4|ogg|wav|mpeg)(;|$)/.test(audio.type)) return Response.json({error:'format'}, {status:415});
      message = await transcribe(await audio.arrayBuffer(), audio.type) || '';
    }
    if (!message || message.length > 800) return Response.json({error:'unclear'}, {status:422});
    const uiLang: Lang = form.get('lang') === 'en' ? 'en' : form.get('lang') === 'hi' ? 'hi' : 'mr';
    const lang = detectLang(message, uiLang);
    const rawAge = form.get('age') as AgeGroup;
    const age = AGES.includes(rawAge) ? rawAge : null;
    const id = safetyRule(message);
    if (id) {
      const script = SAFETY_SCRIPTS[id];
      const text = script.text[lang] || script.text.en!;
      return Response.json({message, reply:[text.ack, ...text.a, text.n, text.fu].filter(Boolean).join(' '), lang, emergency:true});
    }
    const out = await answerQuestion({message, uiLang, age, history:cleanHistory(JSON.parse(String(form.get('history') || '[]'))), callVoice:form.get('voice') === 'male' ? 'male' : 'female'});
    if (!out) return Response.json({error:'unavailable'}, {status:502});
    return Response.json({message, reply:[out.understand, ...out.answer, out.safetyCheck, out.nextStep].filter(Boolean).join(' '), lang:out.lang, emergency:out.risk === 'P0' || out.risk === 'P1'});
  } catch {
    return Response.json({error:'unavailable'}, {status:502});
  }
}
