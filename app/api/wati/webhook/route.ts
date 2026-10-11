import { aboutIntent, aboutAnswer } from "@/lib/about";
// WhatsApp via WATI: receives "Message Received" webhooks and replies with AADHI TI's answers.
// Set this URL in WATI → Webhooks (event: Message Received):
//   https://<your-domain>/api/wati/webhook?token=<WATI_WEBHOOK_SECRET>
// WATI retries any non-200 response (up to 144 times), so we acknowledge at once, drop duplicates,
// and do the slow work (AI + sending) after the response.
import { after } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ChatTurn } from "@/lib/ai";
import { conversationLang, detectLang } from "@/lib/detectLang";
import { understand, type Lang } from "@/lib/kb";
import { safetyRule } from "@/lib/safetyScripts";
import { answerQuestion } from "@/lib/server/answer";
import { bump, getJSON, setJSON, setOnce, withLock } from "@/lib/server/store";
import {
  getMedia,
  handToHuman,
  handoffConfigured,
  sendFile,
  sendFileUrl,
  sendInteractive,
  sendText,
  watiConfigured,
} from "@/lib/server/wati";
import { transcribe } from "@/lib/server/transcribe";
import { synthesize } from "@/lib/server/tts";
import {
  applyAnswer,
  finderResult,
  nextQuestion,
  type FinderState,
} from "@/lib/server/waFinder";
import { hasAbuse } from "@/lib/server/langGuard";
import {
  categoryMenu,
  handoffConsentMenu,
  helplinesMessage,
  languageMenu,
  mainMenu,
  menuAsText,
  menuHint,
  offeredOf,
  schemeMessage,
  schemesMenu,
  SITE_URL,
  topicById,
  type Menu,
  type Offered,
} from "@/lib/server/waMenu";
import {
  aiMessage,
  calmMessage,
  handoffDeclinedMessage,
  handoffDoneMessage,
  shareLocationMessage,
  handoffResumedMessage,
  handoffUnavailableMessage,
  spokenText,
  voiceUnclearMessage,
  scriptMessage,
  slowDownMessage,
  textOnlyMessage,
  topicMessage,
  unknownMessage,
  welcomeMessage,
} from "@/lib/server/whatsappText";

import { modeMenu, guidedMenu, feedbackMenu, recordMetric, say, type ReplyMode } from "@/lib/server/waExperience";
import { handleFeatureChoice } from "@/lib/server/waFeatureChoices";
import { stopReminders } from "@/lib/server/waReminders";
import { supportAvailable } from "@/lib/server/waSupport";
export const maxDuration = 120;

type WatiMessage = {
  id?: string;
  whatsappMessageId?: string;
  conversationId?: string;
  waId?: string;
  text?: string | null;
  type?: string;
  owner?: boolean;
  operatorEmail?: string;
  eventType?: string;
  listReply?: { title?: string } | null;
  buttonReply?: { text?: string } | null;
  interactiveButtonReply?: { title?: string } | null;
};

type UserState = {
  mode?: ReplyMode;
  lastTopic?: string;
  feedbackPending?: boolean;
  handoffStatus?: "pending" | "accepted" | "on-the-way";
  lang: Lang | null;
  history: ChatTurn[];
  offered?: Offered | null;
  /** Scheme check answers in progress. */
  finder?: FinderState | null;
  /** While a person from the team is handling the chat (ms timestamp), the bot stays quiet. */
  humanUntil?: number;
};

const DAY = 24 * 60 * 60;
const MAX_PER_HOUR = 30;

const ok = (status = "ok") => Response.json({ status });

function authorized(req: Request) {
  const secret = process.env.WATI_WEBHOOK_SECRET ?? "";
  const given =
    new URL(req.url).searchParams.get("token") ??
    req.headers.get("x-webhook-token") ??
    "";
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// Phone numbers are never stored as keys; only a salted hash.
const userKey = (waId: string) =>
  createHash("sha256")
    .update(`aadhi:${process.env.WATI_WEBHOOK_SECRET}:${waId}`)
    .digest("hex")
    .slice(0, 32);

const GREETING =
  /^(hi+|hel+o+|hey+|hlo|namaste|namaskar|start|menu|help|नमस्कार|नमस्ते|राम राम|जय महाराष्ट्र|मदत|मेनू)[\s!.,।]*(\s+[^\s]+){0,2}[\s!.,।]*$/i;

const LANG_WORDS: Record<string, Lang> = {
  english: "en",
  marathi: "mr",
  मराठी: "mr",
  hindi: "hi",
  हिंदी: "hi",
  हिन्दी: "hi",
};

export async function GET() {
  // Lets you check the route is deployed; reveals nothing else.
  return ok("AADHI TI WhatsApp webhook");
}

export async function POST(req: Request) {
  if (!process.env.WATI_WEBHOOK_SECRET || !watiConfigured())
    return Response.json(
      { error: "WhatsApp is not configured" },
      { status: 503 },
    );
  if (!authorized(req))
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  let msg: WatiMessage;
  try {
    msg = await req.json();
  } catch {
    return ok("ignored"); // malformed: acknowledge so WATI doesn't retry it
  }

  // Explicit staff acceptance, never inferred from assignment or a bot message.
  if (msg.eventType === "sessionMessageSent_v2" && msg.owner === true && msg.waId && ["#accept", "#on-the-way"].includes(msg.text?.trim() ?? "")) {
    const staff=(process.env.WATI_SUPPORT_OPERATOR_EMAILS??"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(staff.includes((msg.operatorEmail??"").toLowerCase())) after(()=>withLock(`wati:user:${userKey(msg.waId!)}`,async()=>{
      const key=`wati:user:${userKey(msg.waId!)}`;
      const state=await getJSON<UserState>(key);
      if (msg.text?.trim() === "#on-the-way") {
        // Only a human operator can confirm physical assistance, after accepting this request.
        if (state?.handoffStatus !== "accepted" || (state.humanUntil ?? 0) <= Date.now()) return;
        await setJSON(key, {...state, handoffStatus: "on-the-way", humanUntil: Date.now()+DAY*1000}, DAY);
        await sendText(msg.conversationId || msg.waId!, say(state.lang ?? "mr",
          "Your support person has confirmed that staff are on the way to help you. Stay in touch with them here for arrival details. If you are in immediate danger, call 112 now; do not wait for their arrival.",
          "तुमच्या सहाय्यकाने कर्मचारी तुमच्या मदतीसाठी येत असल्याची पुष्टी केली आहे. ते कधी पोहोचतील यासाठी त्यांच्याशी इथे संपर्कात राहा. तातडीचा धोका असल्यास त्यांच्या येण्याची वाट न पाहता आत्ताच 112 वर कॉल करा.",
          "आपके सहायक ने पुष्टि की है कि कर्मचारी आपकी मदद के लिए आ रहे हैं। उनके पहुँचने की जानकारी के लिए यहाँ संपर्क में रहें। तत्काल खतरे में उनके आने का इंतज़ार न करें; अभी 112 पर कॉल करें।"));
        return;
      }
      if(state?.handoffStatus!=="pending")return;
      await setJSON(key,{...state,handoffStatus:"accepted",humanUntil:Date.now()+DAY*1000},DAY);
      const l=state.lang??"mr";
      await sendText(msg.conversationId||msg.waId!,say(l,"A support person has accepted your request and is handling this chat. Type menu to return to the bot.","सहाय्यक व्यक्तीने तुमची विनंती स्वीकारली आहे आणि हा संवाद हाताळत आहे. बॉटसाठी menu लिहा.","सहायक ने आपका अनुरोध स्वीकार कर लिया है और यह चैट संभाल रहा है। बॉट के लिए menu लिखें।"));
    }));
    return ok("staff acknowledgement");
  }
  // Only incoming customer messages; never our own replies (owner: true).
  if (msg.eventType !== "message" || msg.owner === true || !msg.waId)
    return ok("ignored");

  const messageId = msg.whatsappMessageId || msg.id;
  if (!messageId) return ok("ignored");
  try {
    if (!(await setOnce(`wati:seen:${messageId}`, 2 * DAY)))
      return ok("duplicate");
  } catch (e) {
    console.error(
      "WATI dedupe store failed",
      e instanceof Error ? e.message : "",
    );
  }

  after(() =>
    withLock(`wati:user:${userKey(msg.waId!)}`, () => handle(msg)).catch((e) =>
      console.error("WATI handler failed", e instanceof Error ? e.message : ""),
    ),
  );
  return ok();
}

const MENU_WORDS =
  /^(menu|main menu|मेनू|मेन्यू|मुख्य मेनू|0|options?|topics?|विषय|bot)[\s!.,।]*$/i;
const LANGUAGE_WORDS =
  /^(language|lang|bhasha|भाषा|change language|भाषा बदला|भाषा बदलें)[\s!.,।]*$/i;
const HELPLINE_WORDS =
  /^(helplines?|helpline numbers?|numbers?|हेल्पलाइन|हेल्पलाईन|नंबर|मदत क्रमांक|क्रमांक)[\s!.,।]*$/i;
const FINDER_WORDS =
  /^(scheme check|check schemes?|schemes? for me|eligibility|पात्रता|योजना तपासा|माझ्यासाठी योजना|योजना जाँचें|मेरे लिए योजना)[\s!.,।?]*$/i;
const PERSON_WORDS =
  /(talk to (a )?(person|human|someone|counsell?or)|real person|counsell?or|व्यक्तीशी बोल|माणसाशी बोल|कोणाशी तरी बोल|समुपदेशक|किसी (व्यक्ति|इंसान|से) (से )?बात|इंसान से बात|काउंसलर)/i;

// "about", her name, or "who made this app" → her photo, credit and initiatives.
const HANDOFF_HOURS = 24;

const norm = (s: string) =>
  s.trim().toLowerCase().replace(/…$/, "").replace(/\s+/g, " ");

/** Matches a tap (row/button title) or a typed number against the menu we last sent. */
function chosen(
  text: string,
  offered: Offered | null | undefined,
): string | null {
  if (!offered) return null;
  const n = Number(text.trim());
  if (Number.isInteger(n) && n >= 1 && n <= offered.ids.length)
    return offered.ids[n - 1];
  const i = offered.titles.findIndex((t) => norm(t) === norm(text));
  return i >= 0 ? offered.ids[i] : null;
}

async function handle(msg: WatiMessage) {
  const waId = msg.waId!;
  const target = msg.conversationId || waId;
  const key = userKey(waId);
  const saved = await getJSON<UserState>(`wati:user:${key}`).catch(() => null);
  const state: UserState = {
    mode: saved?.mode,
    lastTopic: saved?.lastTopic,
    feedbackPending: saved?.feedbackPending,
    handoffStatus: saved?.handoffStatus,
    lang: saved?.lang ?? null,
    history: saved?.history ?? [],
    offered: saved?.offered ?? null,
    finder: saved?.finder ?? null,
    humanUntil: saved?.humanUntil ?? 0,
  };
  const prefs = await getJSON<{mode:ReplyMode;lang:Lang}>(`wati:preferences:${key}`);
  state.mode = prefs?.mode ?? state.mode;
  state.lang = state.lang ?? prefs?.lang ?? null;
  let uiLang: Lang = state.lang ?? "mr";
  const save = (patch: Partial<UserState>) => {
    Object.assign(state, patch);
    return setJSON(`wati:user:${key}`, state, DAY).catch(() => {});
  };

  // Sends a menu as WhatsApp buttons/list, or numbered text if interactive messages fail; remembers what was offered.
  const offer = async (
    menu: Menu,
    lang: Lang,
    patch: Partial<UserState> = {},
  ) => {
    if (!(await sendInteractive(target, menu)))
      await sendText(target, menuAsText(menu, lang));
    await save({ ...patch, offered: offeredOf(menu) });
  };

  // A brief spoken introduction after language selection; honour text-only preferences.
  const welcome = async (lang: Lang) => {
    await sendText(target, welcomeMessage(lang));
    if (state.mode === "text") return;
    const introduction = say(lang,
      "Welcome to Aadhi Ti. I am your AI assistant. I can help with safety information, schemes and skills. Type your question or send a voice note. What would you like help with today?",
      "आधी ती मध्ये तुमचं स्वागत आहे. मी तुमची एआय सहाय्यक आहे. सुरक्षितता, योजना आणि कौशल्यांविषयी माहिती देण्यासाठी मी मदत करू शकते. तुमचा प्रश्न लिहा किंवा व्हॉइस मेसेज पाठवा. आज तुम्हाला कशासाठी मदत हवी आहे?",
      "आधी ती में आपका स्वागत है। मैं आपकी एआई सहायक हूँ। मैं सुरक्षा, योजनाओं और कौशल की जानकारी देने में मदद कर सकती हूँ। अपना सवाल लिखें या वॉइस मैसेज भेजें। आज आपको किस बारे में मदद चाहिए?");
    const audio = await synthesize(introduction, lang, "female").catch(() => null);
    if (audio) await sendFile(target, audio, "aadhi-ti-welcome.mp3", "audio/mpeg").catch(() => false);
  };

  // Native location stays in the WATI conversation for staff; never send coordinates to AI.
  if (msg.type === "location") {
    const active = Boolean(state.handoffStatus && (state.humanUntil ?? 0) > Date.now());
    await sendText(target, active ? say(uiLang,
      "Your location message was received in this chat. Staff still need to confirm they have reviewed it and arrange any visit with you. If you are in immediate danger, call 112 without waiting.",
      "या चॅटमध्ये तुमचा स्थानाचा संदेश मिळाला आहे. सहाय्यकाने तो पाहिल्याची पुष्टी करून तुमच्याशी भेट ठरवणे आवश्यक आहे. तातडीचा धोका असल्यास वाट न पाहता 112 वर कॉल करा.",
      "इस चैट में आपका स्थान वाला संदेश मिला है। सहायक को इसे देखने की पुष्टि करके आपसे मुलाकात तय करनी होगी। तत्काल खतरे में इंतज़ार किए बिना 112 पर कॉल करें।") : say(uiLang,
      "Your location message was received, but there is no active staff handoff. Type Talk to someone to request support. Sharing a location does not dispatch help. For immediate danger, call 112.",
      "तुमचा स्थानाचा संदेश मिळाला, पण सहाय्यकाकडे सक्रिय विनंती नाही. मदतीची विनंती करण्यासाठी Talk to someone लिहा. स्थान पाठवल्याने मदत पथक पाठवले जात नाही. तातडीच्या धोक्यात 112 वर कॉल करा.",
      "आपका स्थान वाला संदेश मिला, लेकिन सहायता टीम को कोई सक्रिय अनुरोध नहीं है। सहायता माँगने के लिए Talk to someone लिखें। स्थान भेजने से सहायता दल रवाना नहीं होता। तत्काल खतरे में 112 पर कॉल करें।"));
    return;
  }

  // ---- what did she say? (typed, tapped, or a voice note) ----
  const isVoice = msg.type === "voice" || msg.type === "audio";
  let text: string;
  if (isVoice) {
    const media = await getMedia([msg.id, msg.whatsappMessageId]);
    const heard = media ? await transcribe(media.data, media.type).catch(()=>null) : null;
    if (!heard) {
      await sendText(target, voiceUnclearMessage(uiLang));
      return;
    }
    text = heard;
  } else {
    const raw =
      msg.type === "text"
        ? msg.text
        : msg.listReply?.title ||
          msg.buttonReply?.text ||
          msg.interactiveButtonReply?.title ||
          (msg.type === "interactive" || msg.type === "button"
            ? msg.text
            : null);
    text = (raw ?? "").trim().slice(0, 800);
  }
  if (!text) {
    await sendText(target, textOnlyMessage(uiLang));
    return;
  }

  uiLang = conversationLang(text, uiLang, state.history);
  if (state.lang && state.lang !== uiLang) await save({lang: uiLang});

  // Reply directly, without echoing the voice-note transcript.
  const reply = async (body: string, speak: string[], lang: Lang) => {
    const mode = state.mode ?? (isVoice ? "both" : "text");
    if(mode !== "audio") await sendText(
      target,
      body,
    );
    if (mode !== "text") {
      const audio = await synthesize(spokenText(speak), lang, "female").catch(()=>null);
      const sent = audio ? await sendFile(target, audio, "aadhi-ti.mp3", "audio/mpeg").catch(()=>false) : false;
      if(!sent && mode === "audio") await sendText(target,body);
    }
  };

  if (/^(stop|unsubscribe|थांबा|बंद|रोकें)$/i.test(text)) {
    await stopReminders(key);
    await sendText(target,say(uiLang,"Pending reminders cancelled. You can still ask for help.","प्रलंबित स्मरणपत्रं रद्द केली. तुम्ही मदत मागू शकता.","लंबित रिमाइंडर रद्द हुए। आप मदद माँग सकती हैं।"));
    return save({offered:null});
  }
  if (/^(voice settings|audio settings)$/i.test(text)) return offer(modeMenu(uiLang),uiLang);
  if (/^(reminders|स्मरणपत्रं|रिमाइंडर)$/i.test(text)) return handleChoice("reminders");

  // 1. Danger first, always (even while a person is handling the chat): approved scripts, never AI.
  const rule = safetyRule(text);
  if (rule) {
    const lang = conversationLang(text, uiLang, state.history);
    const script = scriptMessage(rule, lang);
    if(state.mode === "audio") await sendText(target,script);
    await reply(script, [script.split("\n\n").slice(0, 3).join(" ")], lang);
    await save({
      lang,
      offered: null,
      finder: null,
      history: remember(state.history, text, script),
    });
    return;
  }

  // Per-number limit protects the AI budget; tell her once, then stay quiet for the hour.
  const count = await bump(`wati:rate:${key}`, 60 * 60).catch(() => 0);
  if (count > MAX_PER_HOUR) {
    if (count === MAX_PER_HOUR + 1)
      await sendText(target, slowDownMessage(uiLang));
    return;
  }

  const preferenceChoice=chosen(text,state.offered);
  if(preferenceChoice?.startsWith("mode:"))return handleChoice(preferenceChoice);

  // 2. A person from the team is handling this chat: stay quiet unless she asks for the bot again.
  if (state.humanUntil && state.humanUntil > Date.now()) {
    if (/^(location|share location|send location|लोकेशन|स्थान|माझे स्थान|मेरा स्थान)[.!?]*$/i.test(text)) {
      await sendText(target, shareLocationMessage(uiLang));
      return;
    }
    if (MENU_WORDS.test(text)) {
      await sendText(target, handoffResumedMessage(uiLang));
      await save({ humanUntil: 0, handoffStatus: undefined });
      return offer(mainMenu(uiLang), uiLang);
    }
    return;
  }

  // 3. A tap or number from the menu we just sent.
  const pickId = chosen(text, state.offered);
  if (pickId) return handleChoice(pickId);

  // 4. Commands, in any of the three languages.
  const switchTo = LANG_WORDS[norm(text)];
  if (switchTo) return handleChoice(`lang:${switchTo}`);
  if (LANGUAGE_WORDS.test(text)) return offer(languageMenu(), uiLang);
  if (MENU_WORDS.test(text))
    return offer(mainMenu(uiLang), uiLang, { finder: null });
  if (HELPLINE_WORDS.test(text)) return handleChoice("helplines");
  if (FINDER_WORDS.test(text)) return handleChoice("finder");
  if (PERSON_WORDS.test(text)) return handleChoice("person");
  const identity = aboutIntent(text);
  if (identity) return handleChoice(identity === "person" ? "about-person" : "about");

  // 5. Greetings: new women choose a language first; others get the welcome and the menu.
  const local = understand(text, null);
  if (local.kind === "greeting" || GREETING.test(text)) {
    if (!state.lang) return offer(languageMenu(), uiLang);
    await welcome(state.lang);
    return offer(mainMenu(state.lang), state.lang);
  }

  // 6. Her own question: AI grounded in reviewed content, with memory; reviewed answer if AI fails.
  let lang = conversationLang(text, uiLang, state.history);
  let body: string;
  let speak: string[];
  let summary: string;
  const ai = await answerQuestion({
    message: text,
    uiLang: lang,
    age: null,
    history: state.history,
  });
  if (ai) {
    lang = ai.lang;
    body = aiMessage(ai);
    speak = [...ai.answer, ai.nextStep];
    summary = speak.join(" ");
  } else if (local.kind === "topic") {
    await recordMetric("unanswered",local.topic.id,"ai-unavailable");
    body = topicMessage(local.topic, lang);
    speak = [local.topic.understand[lang], local.topic.next[lang]];
    summary = local.topic.understand[lang];
  } else {
    await recordMetric("unanswered","unmatched","ai-unavailable");
    body = hasAbuse(text) ? calmMessage(lang) : unknownMessage(lang);
    speak = [body];
    summary = "Asked her to say more";
  }
  await reply(`${body}\n\n${menuHint(lang)}`, speak, lang);

  if(state.mode === "audio" && ai?.references?.length)await sendText(target,ai.references.map(r=>`${r.title}\n${r.url}`).join("\n\n"));
  const firstTime = !state.lang;
  await save({
    lang,
    lastTopic: ai?.topicId ?? (local.kind === "topic" ? local.topic.id : "general"),
    feedbackPending: true,
    offered: null,
    finder: null,
    history: remember(state.history, text, summary),
  });
  // First message was a real question: answer it, then offer the language choice once.
  if (firstTime) await offer(languageMenu(), lang);
  else if(ai?.risk === "P3") await offer(feedbackMenu(lang),lang);

  async function handleChoice(id: string) {
    const lang = id.startsWith("lang:") ? (id.slice(5) as Lang) : uiLang;
    if(await handleFeatureChoice(id,{lang,key,waId,target,state,save,offer:(menu)=>offer(menu,lang)}))return;
    const guided=guidedMenu(id,lang);
    if(guided)return offer(guided,lang);
    if (id.startsWith("lang:")) {
      await welcome(lang);
      await save({lang});
      if(state.mode)await setJSON(`wati:preferences:${key}`,{mode:state.mode,lang},90*DAY);
      return offer(mainMenu(lang),lang);
    }
    if (id === "language") return offer(languageMenu(), lang);
    if (id === "helplines") {
      await sendText(target, `${helplinesMessage(lang)}\n\n${menuHint(lang)}`);
      return save({ offered: null });
    }
    if (id === "schemes") return offer(schemesMenu(lang), lang);

    if (id === "about" || id === "about-person") {
      const answer = aboutAnswer(id === "about-person" ? "person" : "service", lang);
      await reply(aiMessage(answer), answer.answer, lang);
      return save({ lang, offered: null, history: remember(state.history, text, answer.answer.join(" ")) });
    }

    // Talk to a person: consent first.
    if (id === "person") {
      if (!handoffConfigured()) {
        await sendText(
          target,
          `${handoffUnavailableMessage(lang)}\n\n${menuHint(lang)}`,
        );
        return save({ offered: null });
      }
      await sendText(target,await supportAvailable()?say(lang,"The support desk reports staff available now. Acceptance is not yet confirmed.","सहाय्य कक्षाने कर्मचारी उपलब्ध असल्याचं कळवलं आहे. विनंती अजून स्वीकारलेली नाही.","सहायता डेस्क ने कर्मचारी उपलब्ध होने की सूचना दी है। अनुरोध अभी स्वीकार नहीं हुआ।"):say(lang,"Live availability is unconfirmed. You may request a person, but there may be a wait.","आत्ताची उपलब्धता निश्चित नाही. विनंती करता येईल, पण वाट पाहावी लागू शकते.","अभी उपलब्धता की पुष्टि नहीं है। अनुरोध कर सकती हैं, लेकिन इंतज़ार हो सकता है।"));
      return offer(handoffConsentMenu(lang), lang);
    }
    if (id === "handoff:yes") {
      const done = await handToHuman(target, waId);
      await sendText(
        target,
        done ? `${handoffDoneMessage(lang)}\n\n${shareLocationMessage(lang)}` : handoffUnavailableMessage(lang),
      );
      return save({
        offered: null,
        handoffStatus: done ? "pending" : undefined,
        humanUntil: done ? Date.now() + HANDOFF_HOURS * 3600 * 1000 : 0,
      });
    }
    if (id === "handoff:no") {
      await sendText(target, handoffDeclinedMessage(lang));
      return save({ offered: null });
    }

    // Scheme check: six tap questions, then the website's eligibility rules.
    if (id === "finder" || id.startsWith("f:")) {
      const answers =
        id === "finder" ? {} : applyAnswer(state.finder ?? {}, id);
      const q = nextQuestion(answers, lang);
      if (q) return offer(q, lang, { finder: answers });
      const result = finderResult(answers, lang);
      await sendText(target, result.text);
      if (result.menu) return offer(result.menu, lang, { finder: null });
      await sendText(target, menuHint(lang));
      return save({ finder: null, offered: null });
    }

    if (id.startsWith("cat:")) {
      const menu = categoryMenu(id.slice(4), lang);
      return menu ? offer(menu, lang) : offer(mainMenu(lang), lang);
    }
    if (id.startsWith("topic:")) {
      const topic = topicById(id.slice(6));
      if (topic) {
        await reply(
          `${topicMessage(topic, lang)}\n\n${menuHint(lang)}`,
          [
            topic.understand[lang],
            ...topic.answer.map((x) => x[lang]),
            topic.next[lang],
          ],
          lang,
        );
        return save({
          offered: null,
          history: remember(
            state.history,
            topic.title[lang],
            topic.understand[lang],
          ),
        });
      }
    }
    if (id.startsWith("scheme:")) {
      const msgText = schemeMessage(id.slice(7), lang);
      if (msgText) {
        await reply(`${msgText}\n\n${menuHint(lang)}`,[msgText],lang);
        await save({history:remember(state.history,text,msgText)});
        return offer({kind:"buttons",body:say(lang,"What would help next?","पुढे काय हवं?","आगे क्या चाहिए?"),buttons:[{id:`docs:${id.slice(7)}`,title:say(lang,"Document checklist","कागदपत्रांची यादी","दस्तावेज़ सूची")},{id:"finder",title:say(lang,"Check eligibility","पात्रता तपासा","पात्रता जाँचें")},{id:"menu",title:say(lang,"Main menu","मुख्य मेनू","मुख्य मेनू")}]},lang);
      }
    }
    return offer(mainMenu(lang), lang);
  }
}

function remember(
  history: ChatTurn[],
  user: string,
  assistant: string,
): ChatTurn[] {
  return [
    ...history,
    { role: "user" as const, text: user },
    { role: "assistant" as const, text: assistant.slice(0, 600) },
  ].slice(-12);
}
