// WhatsApp menus for the AADHI TI bot: language choice, main menu, topic lists, schemes and helplines.
// Everything a menu opens is reviewed content (knowledge base, schemes registry, helpline list) — no AI.
// WhatsApp limits: 3 buttons (20 chars each), list rows ≤ 10 (title 24, description 72 chars).
import { leaderNames } from "@/lib/leader";
import { helplines } from "@/lib/data";
import {
  adultCategories,
  getTopic,
  girlCategories,
  type Lang,
  type Topic,
} from "@/lib/kb";
import { SCHEMES } from "@/lib/schemes";

const t3 = (lang: Lang, mr: string, hi: string, en: string) =>
  lang === "en" ? en : lang === "hi" ? hi : mr;
const cut = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
const firstSentence = (s: string) => s.split(/(?<=[.।?!])\s/)[0];

export const SITE_URL =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://aadhiti.vercel.app");

/** A menu we sent, so a tap (by title) or a typed number can be matched back to an option id. */
export type Offered = { ids: string[]; titles: string[] };

export type ButtonsMenu = {
  kind: "buttons";
  body: string;
  footer?: string;
  buttons: { id: string; title: string }[];
};
export type ListMenu = {
  kind: "list";
  header?: string;
  body: string;
  footer?: string;
  button: string;
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[];
};
export type Menu = ButtonsMenu | ListMenu;

export function offeredOf(menu: Menu): Offered {
  const opts =
    menu.kind === "buttons"
      ? menu.buttons
      : menu.sections.flatMap((s) => s.rows);
  return { ids: opts.map((o) => o.id), titles: opts.map((o) => o.title.slice(0, menu.kind === "buttons" ? 20 : 24)) };
}

/** Plain numbered text, used if WhatsApp interactive messages can't be sent. */
export function menuAsText(menu: Menu, lang: Lang): string {
  const opts =
    menu.kind === "buttons"
      ? menu.buttons
      : menu.sections.flatMap((s) => s.rows);
  const lines = opts.map(
    (o, i) =>
      `${i + 1}. ${o.title.slice(0, menu.kind === "buttons" ? 20 : 24)}${"description" in o && o.description ? ` — ${o.description}` : ""}`,
  );
  return [
    menu.kind === "list" && menu.header ? `*${menu.header}*` : "",
    menu.body,
    lines.join("\n"),
    t3(
      lang,
      "_क्रमांक लिहून उत्तर द्या._",
      "_नंबर लिखकर जवाब दें।_",
      "_Reply with a number._",
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------- language ----------

export function languageMenu(): ButtonsMenu {
  return {
    kind: "buttons",
    body:
      "नमस्कार! *आधी ती (AADHI TI)* मध्ये स्वागत. तुमची भाषा निवडा.\n" +
      "नमस्ते! आपकी भाषा चुनें।\n" +
      "Hello! Please choose your language.\n\n" +
      `_${leaderNames.full.mr} यांचा उपक्रम · An initiative of ${leaderNames.full.en}_\n\n` +
      "_धोका असेल तर आत्ता 112 · Emergency: 112_",
    buttons: [
      { id: "lang:mr", title: "मराठी" },
      { id: "lang:hi", title: "हिंदी" },
      { id: "lang:en", title: "English" },
    ],
  };
}

// ---------- main menu ----------

const MAIN: {
  id: string;
  title: [string, string, string];
  desc: [string, string, string];
}[] = [
  {
    id: "cat:safety",
    title: ["सुरक्षा", "सुरक्षा", "Safety"],
    desc: [
      "आणीबाणी, पाठलाग, प्रवास, सायबर",
      "आपातकाल, पीछा, यात्रा, साइबर",
      "Emergency, stalking, travel, cyber",
    ],
  },
  {
    id: "cat:health",
    title: ["आरोग्य", "सेहत", "Health"],
    desc: [
      "पाळी, गर्भारपण, PCOS, थायरॉईड",
      "पीरियड्स, गर्भावस्था, PCOS, थायरॉइड",
      "Periods, pregnancy, PCOS, thyroid",
    ],
  },
  {
    id: "schemes",
    title: ["सरकारी योजना", "सरकारी योजनाएँ", "Government schemes"],
    desc: [
      "लाडकी बहीण, मातृत्व, मुलींसाठी, कर्ज",
      "लाडकी बहीण, मातृत्व, बेटियों के लिए, लोन",
      "Ladki Bahin, maternity, daughters, loans",
    ],
  },
  {
    id: "cat:skills",
    title: ["कौशल्य व कमाई", "कौशल और कमाई", "Skills & earning"],
    desc: [
      "प्रशिक्षण, नोकरी, व्यवसाय, बचत गट",
      "ट्रेनिंग, नौकरी, व्यवसाय, बचत समूह",
      "Training, jobs, business, savings groups",
    ],
  },
  {
    id: "cat:rights",
    title: ["कायदा व हक्क", "कानून और अधिकार", "Rights & law"],
    desc: [
      "घरगुती हिंसा, कामावर छळ, मालमत्ता",
      "घरेलू हिंसा, काम पर उत्पीड़न, संपत्ति",
      "Domestic violence, workplace, property",
    ],
  },
  {
    id: "cat:mind",
    title: ["मनाचं आरोग्य", "मन की सेहत", "Wellbeing"],
    desc: [
      "ताण, चिंता, एकटेपणा, समुपदेशन",
      "तनाव, चिंता, अकेलापन, काउंसलिंग",
      "Stress, anxiety, loneliness, counselling",
    ],
  },
  {
    id: "cat:girls",
    title: [
      "मुलींसाठी (10–18)",
      "लड़कियों के लिए (10–18)",
      "For girls (10–18)",
    ],
    desc: [
      "शाळा, शरीरातले बदल, ऑनलाइन सुरक्षा",
      "स्कूल, शरीर के बदलाव, ऑनलाइन सुरक्षा",
      "School, body changes, online safety",
    ],
  },
  {
    id: "person",
    title: ["व्यक्तीशी बोला", "किसी व्यक्ति से बात", "Talk to a person"],
    desc: [
      "प्रशिक्षित व्यक्तीशी जोडणी, तुमच्या परवानगीने",
      "प्रशिक्षित व्यक्ति से जुड़ें, आपकी मर्ज़ी से",
      "Connect with a trained person, with your consent",
    ],
  },
  {
    id: "helplines",
    title: ["मदत क्रमांक", "हेल्पलाइन नंबर", "Helpline numbers"],
    desc: [
      "112, 1091, 181, 1098 — सगळे मोफत",
      "112, 1091, 181, 1098 — सभी मुफ़्त",
      "112, 1091, 181, 1098 — all free",
    ],
  },
  {
    id: "language",
    title: ["भाषा बदला", "भाषा बदलें", "Change language"],
    desc: [
      "मराठी · हिंदी · English",
      "मराठी · हिंदी · English",
      "मराठी · हिंदी · English",
    ],
  },
];

const pick = (lang: Lang, v: [string, string, string]) =>
  lang === "en" ? v[2] : lang === "hi" ? v[1] : v[0];

export function mainMenu(lang: Lang): ListMenu {
  return {
    kind: "list",
    header: t3(
      lang,
      "आधी ती · मुख्य मेनू",
      "आधी ती · मुख्य मेनू",
      "AADHI TI · Main menu",
    ),
    body: t3(
      lang,
      "विषय निवडा, किंवा तुमचा प्रश्न थेट तुमच्या शब्दांत लिहा.",
      "विषय चुनें, या अपना सवाल सीधे अपने शब्दों में लिखें।",
      "Choose a topic, or simply type your question in your own words.",
    ),
    footer: t3(
      lang,
      "धोका असेल तर आत्ता 112",
      "खतरा हो तो अभी 112",
      "In danger? Call 112 now",
    ),
    button: t3(lang, "विषय पाहा", "विषय देखें", "See topics"),
    sections: [
      {
        title: t3(lang, "विषय", "विषय", "Topics"),
        rows: [...MAIN.filter(m => ["cat:safety","schemes","cat:skills","person","language"].includes(m.id)), {id:"voice", title:["उत्तराचा प्रकार","जवाब का तरीका","Reply preference"] as [string,string,string],desc:["मजकूर, आवाज किंवा दोन्ही","लिखित, आवाज़ या दोनों","Text, audio or both"] as [string,string,string]}, {id:"reminders",title:["स्मरणपत्रं","रिमाइंडर","Reminders"] as [string,string,string],desc:["तुमच्या संमतीनेच","केवल आपकी सहमति से","Only with your consent"] as [string,string,string]}].map((m) => ({
          id: m.id,
          title: cut(pick(lang, m.title), 24),
          description: cut(pick(lang, m.desc), 72),
        })),
      },
    ],
  };
}

// ---------- topic lists ----------

const CATEGORY_TOPICS: Record<string, () => string[]> = {
  safety: () => topicsOf(["safety"]),
  g_digital: () => topicsOf(["g_digital"]),
  health: () => topicsOf(["health"]),
  skills: () =>
    topicsOf(["career", "income"]).filter(
      (id) => !["ladki_bahin", "schemes_overview", "scheme_apply"].includes(id),
    ),
  rights: () => topicsOf(["rights"]),
  mind: () => topicsOf(["mind"]),
  girls: () =>
    topicsOf(["g_safety", "g_growing", "g_boundaries", "g_digital", "g_mind"]),
};

function topicsOf(catIds: string[]) {
  const cats = [...adultCategories, ...girlCategories].filter((c) =>
    catIds.includes(c.id),
  );
  // Age "journey" overviews are long reads; the website covers them better than a WhatsApp list.
  const perGroup = cats
    .flatMap((c) => c.groups)
    .map((g) =>
      g.topics.filter((id) => getTopic(id) && !id.startsWith("journey_")),
    );
  // Take a few from each group in turn so the list covers the whole subject.
  const out: string[] = [];
  const longest = Math.max(0, ...perGroup.map((g) => g.length));
  for (let round = 0; round < longest; round++)
    for (const g of perGroup)
      if (g[round] && !out.includes(g[round])) out.push(g[round]);
  return out;
}

/** Up to 10 topics, preferring ones whose title fits WhatsApp's 24-character row limit in her language. */
function fitTopics(ids: string[], lang: Lang) {
  const fits = ids.filter((id) => getTopic(id)!.title[lang].length <= 24);
  const rest = ids.filter((id) => !fits.includes(id));
  return [...fits, ...rest].slice(0, 10);
}

export function categoryMenu(cat: string, lang: Lang): ListMenu | null {
  const all = CATEGORY_TOPICS[cat]?.();
  const ids = all ? fitTopics(all, lang) : undefined;
  const main = MAIN.find((m) => m.id === `cat:${cat}`);
  if (!ids?.length || !main) return null;
  return {
    kind: "list",
    header: cut(pick(lang, main.title), 60),
    body: t3(
      lang,
      "कोणत्या विषयावर माहिती हवी आहे?",
      "किस बारे में जानकारी चाहिए?",
      "What would you like to know about?",
    ),
    footer: t3(
      lang,
      "किंवा तुमचा प्रश्न लिहा",
      "या अपना सवाल लिखें",
      "Or type your own question",
    ),
    button: t3(lang, "विषय निवडा", "विषय चुनें", "Choose"),
    sections: [
      {
        title: cut(pick(lang, main.title), 24),
        rows: ids.map((id) => {
          const tp = getTopic(id)!;
          return {
            id: `topic:${id}`,
            title: cut(tp.title[lang], 24),
            description: cut(firstSentence(tp.understand[lang]), 72),
          };
        }),
      },
    ],
  };
}

// ---------- schemes ----------

const SCHEME_SHORT: Record<string, [string, string, string]> = {
  "ladki-bahin": ["लाडकी बहीण योजना", "लाडकी बहीण योजना", "Ladki Bahin"],
  lekladki: ["लेक लाडकी योजना", "लेक लाडकी योजना", "Lek Ladki"],
  pmmvy: ["मातृ वंदना (PMMVY)", "मातृ वंदना (PMMVY)", "PM Matru Vandana"],
  sukanya: ["सुकन्या समृद्धी", "सुकन्या समृद्धि", "Sukanya Samriddhi"],
  "single-women": ["एकल महिलांसाठी", "एकल महिलाओं के लिए", "For single women"],
  mavim: ["माविम बचत गट", "माविम बचत समूह", "MAVIM self-help groups"],
  mudra: ["मुद्रा कर्ज", "मुद्रा लोन", "MUDRA loan"],
  vishwakarma: ["PM विश्वकर्मा", "PM विश्वकर्मा", "PM Vishwakarma"],
  pmkvy: [
    "कौशल्य प्रशिक्षण (PMKVY)",
    "कौशल प्रशिक्षण (PMKVY)",
    "Skill training (PMKVY)",
  ],
};

export function schemesMenu(lang: Lang): ListMenu {
  const finder = {
    id: "finder",
    title: t3(
      lang,
      "माझ्यासाठी योजना तपासा",
      "मेरे लिए योजना जाँचें",
      "Check schemes for me",
    ),
    description: t3(
      lang,
      "6 सोपे प्रश्न, तुम्हाला लागू योजना",
      "6 आसान सवाल, आप पर लागू योजनाएँ",
      "6 quick questions, schemes that fit you",
    ),
  };
  const rows = Object.keys(SCHEME_SHORT)
    .map((id) => SCHEMES.find((s) => s.id === id))
    .filter((s): s is (typeof SCHEMES)[number] => !!s)
    .map((s) => ({
      id: `scheme:${s.id}`,
      title: cut(pick(lang, SCHEME_SHORT[s.id]), 24),
      description: cut(s.benefit[lang], 72),
    }));
  return {
    kind: "list",
    header: t3(lang, "सरकारी योजना", "सरकारी योजनाएँ", "Government schemes"),
    body: t3(
      lang,
      `योजना निवडा. तुमच्यासाठी कोणत्या योजना लागू होतात ते इथे तपासा: ${SITE_URL}/schemes`,
      `योजना चुनें। आप पर कौन-सी योजनाएँ लागू होती हैं, यहाँ जाँचें: ${SITE_URL}/schemes`,
      `Choose a scheme. Check which schemes fit you here: ${SITE_URL}/schemes`,
    ),
    footer: t3(
      lang,
      "कोणालाही पैसे देऊ नका",
      "किसी को पैसे न दें",
      "Never pay an agent",
    ),
    button: t3(lang, "योजना पाहा", "योजनाएँ देखें", "Ask about financial security"),
    sections: [
      {
        title: t3(lang, "योजना", "योजनाएँ", "Schemes"),
        rows: [finder, ...rows],
      },
    ],
  };
}

export function schemeMessage(id: string, lang: Lang): string | null {
  const s = SCHEMES.find((x) => x.id === id);
  if (!s) return null;
  const status =
    s.status === "official"
      ? t3(
          lang,
          `अधिकृत माहिती, तपासले ${s.lastChecked}`,
          `आधिकारिक जानकारी, जाँचा ${s.lastChecked}`,
          `Official information, checked ${s.lastChecked}`,
        )
      : t3(
          lang,
          "ही माहिती पुन्हा तपासून घ्या",
          "यह जानकारी फिर से जाँच लें",
          "Please re-check this information",
        );
  return [
    `*${s.name[lang]}*`,
    s.what[lang],
    `*${t3(lang, "कोणासाठी", "किसके लिए", "Who can apply")}:*\n${s.who[lang].map((w) => `• ${w}`).join("\n")}`,
    `*${t3(lang, "लाभ", "लाभ", "Benefit")}:* ${s.benefit[lang]}`,
    `*${t3(lang, "अर्ज कसा करायचा", "आवेदन कैसे करें", "How to apply")}:*\n${s.apply[lang].map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
    s.caution
      ? `*${t3(lang, "लक्षात ठेवा", "ध्यान रखें", "Note")}:* ${s.caution[lang]}`
      : "",
    `${t3(lang, "कार्यालय", "कार्यालय", "Office")}: ${s.office[lang]}\n${s.url}`,
    `_${status}_`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------- helplines ----------

export function helplinesMessage(lang: Lang): string {
  return [
    `*${t3(lang, "महत्त्वाचे मदत क्रमांक (सगळे मोफत)", "ज़रूरी हेल्पलाइन नंबर (सभी मुफ़्त)", "Important helplines (all free)")}*`,
    helplines
      .map((h) => `*${h.number}* — ${h.name[lang]}\n${h.desc[lang]}`)
      .join("\n\n"),
    t3(
      lang,
      "_हे नंबर आत्ताच फोनमध्ये save करून ठेवा._",
      "_ये नंबर अभी फ़ोन में save कर लें।_",
      "_Save these numbers in your phone now._",
    ),
  ].join("\n\n");
}

/** A reviewed topic by id (menu taps). */
export const topicById = (id: string): Topic | undefined => getTopic(id);

/** Short line under answers: how to get back to the menu. */
export const menuHint = (lang: Lang) =>
  t3(
    lang,
    "_मेनूसाठी *menu* लिहा · भाषा बदलण्यासाठी *language*_",
    "_मेनू के लिए *menu* लिखें · भाषा बदलने के लिए *language*_",
    "_Type *menu* for topics · *language* to change language_",
  );

// ---------- talk to a person ----------

/** Asks for consent before a person can read her chat. */
export function handoffConsentMenu(lang: Lang): ButtonsMenu {
  return {
    kind: "buttons",
    body: t3(
      lang,
      "आधी ती च्या प्रशिक्षित टीममधली एक व्यक्ती तुमचे संदेश वाचून इथेच WhatsApp वर उत्तर देईल. त्यांना तुमचा नंबर आणि हे संभाषण दिसेल. संमतीनंतरचे जास्तीत जास्त १०० सहाय्य संदेश आणि नंबर कर्मचारी डॅशबोर्डमध्ये ३० दिवस जतन होतील. menu लिहिल्यावर नवीन संदेश जतन होणे थांबेल.\n\nउत्तर यायला थोडा वेळ लागू शकतो. लगेच बोलायचं असेल तर *181* (महिला हेल्पलाइन, 24 तास, मोफत) वर कॉल करा. धोका असेल तर *112*.\n\nजोडून देऊ का?",
      "आधी ती की प्रशिक्षित टीम का एक व्यक्ति आपके संदेश पढ़कर यहीं WhatsApp पर जवाब देगा। उन्हें आपका नंबर और यह बातचीत दिखेगी। सहमति के बाद के अधिकतम १०० सहायता संदेश और नंबर कर्मचारी डैशबोर्ड में ३० दिन रखे जाएँगे। menu लिखने पर नए संदेश सहेजना बंद होगा।\n\nजवाब आने में थोड़ा समय लग सकता है। अभी बात करनी हो तो *181* (महिला हेल्पलाइन, 24 घंटे, मुफ़्त) पर कॉल करें। खतरा हो तो *112*।\n\nक्या जोड़ दें?",
      "A person from AADHI TI's trained team will read your messages and reply here on WhatsApp. They will see your number and this chat. Up to 100 support messages after consent and your number will be kept in the staff dashboard for 30 days. Type menu to stop saving new messages.\n\nA reply may take a little time. To talk right now, call *181* (women's helpline, 24 hours, free). In danger? Call *112*.\n\nShall I connect you?",
    ),
    buttons: [
      {
        id: "handoff:yes",
        title: t3(lang, "हो, जोडून द्या", "हाँ, जोड़ दें", "Yes, connect me"),
      },
      { id: "handoff:no", title: t3(lang, "नाही, नको", "नहीं", "No, thanks") },
    ],
  };
}
