import type { Lang } from "./kb/types";

const ROMAN_INDIAN =
  /\b(aahe|ahe|mala|maza|mazi|majh\w*|kay|nahi|nahin|mujhe|mera|meri|hai|hain|kya|kaise|kaisa|karu|karaycha|karaychi|kara|karna|pahije|chahiye|kuthe|kuthun|kahan|kidhar|aap|tumhi|konti|kaun|paise|milel|milega|milegi|sathi|tyasathi|liye|kasa|kashi|kase|ka|ki|ke|ko|se|mein|madhe|hota|hoti|zala|zali|hoil|bhi|pan|ani|aur)\b/gi;
const ROMAN_HINDI = /\b(mujhe|mera|meri|hai|hain|kya|kaise|kaisa|chahiye|kahan|kidhar|kaun|milega|milegi|liye|mein|bhi|aur|nahin|batao|bataiye|aap|mujhko)\b/gi;
const ROMAN_MARATHI = /\b(aahe|ahe|mala|maza|mazi|majh\w*|kay|karu|karaycha|karaychi|pahije|kuthe|kuthun|tumhi|konti|milel|sathi|tyasathi|kasa|kashi|kase|madhe|zala|zali|hoil|ani)\b/gi;
const ENGLISH = /\b(the|is|are|am|what|how|where|when|why|can|could|should|my|me|i|to|for|of|and|with|do|does|get|want|need|help|please)\b/gi;

/** Detect explicit language cues, including romanised Marathi and Hindi. */
export function detectLang(q: string, uiLang: Lang): Lang {
  if (/[ऀ-ॿ]/.test(q)) {
    if (/ळ|ॲ|तुम्हाला|कागदपत्र|सांगू|आहे|मला|माझ|तुम्ही|तुमच|काय|नाही|करू(?![ँं])|झालं|झाली|होतं|पाहिजे|कसं|कसा|कशी|आम्ही|आपल्या|केलं|कोणी|कुठे|मिळेल|सांगा|हवं|नको|त्यांच|आमच|करायच|कधी|येतंय|चालेल/.test(q)) return "mr";
    if (/है|हैं|हूँ|हूं|में|क्या|मुझे|मेरा|मेरी|नहीं|कैसे|कहाँ|कहां|रहा|रही|चाहिए|करें|मिलेगा|मिलेगी|यह|वह|किस|था|थी|गया|गई|बनाया|करना|होगा|सकती|सकता/.test(q)) return "hi";
    // No clear markers (e.g. a single word like "नमस्कार"): keep her chosen language.
    return uiLang === "en" ? "hi" : uiLang;
  }
  const indian = q.match(ROMAN_INDIAN)?.length ?? 0;
  const english = q.match(ENGLISH)?.length ?? 0;
  // Mixed text ("mala loan kuthun milel") has a few English nouns but Indian grammar words.
  if (english > indian) return "en";
  const hindi = q.match(ROMAN_HINDI)?.length ?? 0;
  const marathi = q.match(ROMAN_MARATHI)?.length ?? 0;
  return hindi > marathi ? "hi" : marathi > hindi ? "mr" : uiLang;
}

/** Short replies keep the conversation language; explicit requests take precedence. */
export function conversationLang(message: string, uiLang: Lang, history: {role: string; text: string}[]): Lang {
  if (/\b(in|speak|reply|answer)\s+(in\s+)?english\b|इंग्रजीत|अंग्रेज़ी में|अंग्रेजी में/i.test(message)) return "en";
  if (/\b(in|speak|reply|answer)\s+(in\s+)?marathi\b|मराठीत|मराठीमध्ये/i.test(message)) return "mr";
  if (/\b(in|speak|reply|answer)\s+(in\s+)?hindi\b|हिंदी में|हिन्दी में/i.test(message)) return "hi";
  const brief = /^(yes|no|ok|okay|thanks|thank you|sure|please|more|next|documents|fees|हो|होय|नाही|ठीक|हाँ|हां|नहीं|\d{1,3})[.!?। ]*$/i.test(message.trim());
  const previous = [...history].reverse().find(turn => turn.role === "assistant");
  return detectLang(message, brief && previous ? detectLang(previous.text, uiLang) : uiLang);
}
