"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  DoorClosed,
  EyeOff,
  Footprints,
  Lightbulb,
  LocateFixed,
  MapPin,
  PenLine,
  ShieldAlert,
  Waves,
  type LucideIcon,
} from "lucide-react";
import LocalHelp from "@/components/LocalHelp";
import Leaf from "@/components/Leaf";
import { ShoreMap } from "@/components/PageArt";
import { useLang } from "@/lib/i18n";
import type { L } from "@/lib/kb";

type Report = {
  id: number;
  place: string;
  issue: string;
  time: string;
  note: string;
};

const issues: { id: string; icon: LucideIcon; label: L }[] = [
  {
    id: "light",
    icon: Lightbulb,
    label: {
      mr: "कमी उजेड / दिवे बंद",
      en: "Poor lighting",
      hi: "कम रोशनी / बत्ती बंद",
    },
  },
  {
    id: "isolated",
    icon: Footprints,
    label: {
      mr: "निर्जन रस्ता / जागा",
      en: "Isolated stretch",
      hi: "सुनसान रास्ता / जगह",
    },
  },
  {
    id: "harass",
    icon: ShieldAlert,
    label: {
      mr: "छेडछाड होणारी जागा",
      en: "Harassment hotspot",
      hi: "छेड़छाड़ वाली जगह",
    },
  },
  {
    id: "transport",
    icon: Bus,
    label: {
      mr: "असुरक्षित बस / रिक्षा थांबा",
      en: "Unsafe bus / auto stop",
      hi: "असुरक्षित बस / ऑटो स्टॉप",
    },
  },
  {
    id: "toilet",
    icon: DoorClosed,
    label: {
      mr: "महिलांसाठी शौचालय नाही",
      en: "No women's toilet",
      hi: "महिलाओं के लिए शौचालय नहीं",
    },
  },
  {
    id: "beach",
    icon: Waves,
    label: {
      mr: "किनाऱ्यावर असुरक्षित भाग",
      en: "Unsafe beach stretch",
      hi: "समुद्र तट पर असुरक्षित हिस्सा",
    },
  },
  { id: "other", icon: PenLine, label: { mr: "इतर", en: "Other", hi: "अन्य" } },
];

const times: { id: string; label: L }[] = [
  { id: "morning", label: { mr: "सकाळ", en: "Morning", hi: "सुबह" } },
  { id: "day", label: { mr: "दुपार", en: "Afternoon", hi: "दोपहर" } },
  { id: "evening", label: { mr: "संध्याकाळ", en: "Evening", hi: "शाम" } },
  { id: "night", label: { mr: "रात्र", en: "Night", hi: "रात" } },
];

const copy = {
  whatHappens: {
    mr: "तुमच्या माहितीचं काय होतं",
    en: "What happens to your report",
    hi: "आपकी जानकारी का क्या होता है",
  },
  steps: [
    {
      mr: "तुमच्या नावाशिवाय नोंद होते.",
      en: "It's recorded without your name.",
      hi: "बिना आपके नाम के दर्ज होती है।",
    },
    {
      mr: "एकाच जागेच्या तक्रारी एकत्र केल्या जातात, म्हणजे कुठे जास्त त्रास आहे ते दिसतं.",
      en: "Reports about the same place are grouped, so the worst spots stand out.",
      hi: "एक ही जगह की शिकायतें एक साथ रखी जाती हैं, ताकि सबसे ज़्यादा परेशानी वाली जगहें दिखें।",
    },
    {
      mr: "प्रत्यक्ष सुरुवातीनंतर त्या नगर परिषद आणि पोलिसांकडे पाठवल्या जातील.",
      en: "After launch, they'll go to the municipal council and the police.",
      hi: "शुरू होने के बाद ये नगर परिषद और पुलिस को भेजी जाएँगी।",
    },
  ] as L[],
  title: {
    mr: "AADHI TI — सुरक्षित श्रीवर्धन",
    en: "AADHI TI — Safe Shrivardhan",
    hi: "AADHI TI — सुरक्षित श्रीवर्धन",
  },
  body: {
    mr: "अंधार, निर्जन किंवा असुरक्षित वाटणाऱ्या जागांची (आणीबाणी नसलेली) माहिती द्या — म्हणजे स्थानिक प्रशासन त्या सुधारू शकेल.",
    en: "Tell us about places that feel dark, isolated or unsafe (non-emergency) — so the local administration can fix them.",
    hi: "अंधेरी, सुनसान या असुरक्षित लगने वाली जगहों (गैर-आपातकालीन) के बारे में बताइए — ताकि स्थानीय प्रशासन उन्हें सुधार सके।",
  },
  emergency: {
    mr: "हे आणीबाणीसाठी नाही. तुम्ही आत्ता धोक्यात असाल तर 112 ला कॉल करा.",
    en: "This is not for emergencies. If you're in danger now, call 112.",
    hi: "यह आपातकाल के लिए नहीं है। अभी खतरे में हैं तो 112 पर कॉल करें।",
  },
  place: { mr: "जागा", en: "Place", hi: "जगह" },
  placeHint: {
    mr: "उदा. जीवना बंदर रस्ता, ST स्टँडमागे",
    en: "e.g. road near the jetty, behind the ST stand",
    hi: "जैसे जेट्टी के पास की सड़क, ST स्टैंड के पीछे",
  },
  useLocation: {
    mr: "माझं location वापरा",
    en: "Use my location",
    hi: "मेरी location लें",
  },
  locating: { mr: "शोधत आहे…", en: "Locating…", hi: "ढूँढ रहे हैं…" },
  issue: {
    mr: "काय अडचण आहे?",
    en: "What's the problem?",
    hi: "क्या समस्या है?",
  },
  when: {
    mr: "कधी असुरक्षित वाटतं?",
    en: "When does it feel unsafe?",
    hi: "कब असुरक्षित लगता है?",
  },
  note: {
    mr: "थोडं अधिक सांगा (ऐच्छिक)",
    en: "Tell us a little more (optional)",
    hi: "थोड़ा और बताइए (वैकल्पिक)",
  },
  region: {
    mr: "श्रीवर्धन, रायगड",
    en: "Shrivardhan, Raigad",
    hi: "श्रीवर्धन, रायगढ़",
  },
  anon: {
    mr: "नाव न सांगता तक्रार — तुमची ओळख घेतली जात नाही.",
    en: "Anonymous — we don't collect your identity.",
    hi: "गुमनाम — आपकी पहचान नहीं ली जाती।",
  },
  submit: { mr: "माहिती पाठवा", en: "Submit report", hi: "जानकारी भेजें" },
  thanks: {
    mr: "धन्यवाद! तुमची माहिती नोंदवली.",
    en: "Thank you! Your report is recorded.",
    hi: "धन्यवाद! आपकी जानकारी दर्ज हुई।",
  },
  demo: {
    mr: "Demo: ही माहिती फक्त या पानावर दिसते, कुठेही पाठवलेली नाही. प्रत्यक्ष सुरुवातीनंतर ती नगर परिषद / पोलिसांकडे जाईल.",
    en: "Demo: this report only shows on this page and was not sent anywhere. After launch, reports would go to the municipal council / police.",
    hi: "डेमो: यह जानकारी सिर्फ़ इस पेज पर दिखती है, कहीं भेजी नहीं गई। शुरू होने के बाद यह नगर परिषद / पुलिस के पास जाएगी।",
  },
  yours: { mr: "तुमच्या नोंदी", en: "Your reports", hi: "आपकी रिपोर्ट" },
};

export default function SafeShrivardhan() {
  const { t } = useLang();
  const [place, setPlace] = useState("");
  const [issue, setIssue] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [sent, setSent] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        );
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place.trim() || !issue || !time) return;
    setReports((r) => [
      { id: Date.now(), place: place.trim(), issue, time, note: note.trim() },
      ...r,
    ]);
    setPlace("");
    setIssue(null);
    setTime(null);
    setNote("");
    setSent(true);
  };

  const label = <T extends { id: string; label: L }>(list: T[], id: string) =>
    t(list.find((x) => x.id === id)!.label);

  const toggleCls = (on: boolean) =>
    `${on ? "soft-chip-on" : "soft-chip"} justify-center`;

  return (
    <div className="pb-6">
      {/* Opening */}
      <section className="relative grid gap-8 overflow-hidden pt-8 pb-10 md:grid-cols-[1.25fr_1fr] md:items-center">
        <Leaf className="absolute -top-4 right-0 h-40 w-auto text-kokum-200 opacity-60 md:hidden" />
        <div className="relative min-w-0">
          <p className="text-sm font-semibold tracking-wide text-kokum-500">
            {t(copy.region)}
          </p>
          <h1 className="mt-3 font-serif text-[2.6rem] leading-[1.05] font-normal text-kokum-700 sm:text-[3.8rem]">
            {t(copy.title)}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            {t(copy.body)}
          </p>
        </div>
        <figure className="soft-card-pink w-full max-w-[16rem] justify-self-center overflow-hidden p-4 md:max-w-[18rem] md:justify-self-end">
          <ShoreMap />
        </figure>
      </section>

      <div className="grid gap-8 pt-4 lg:grid-cols-[1.7fr_1fr] lg:gap-12">
        {/* On phones the emergency note comes first; on desktop it sits beside the form. */}
        <aside className="space-y-6 lg:order-2">
          <a
            href="tel:112"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 font-bold text-red-700 transition hover:border-red-400"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-red-600">
              <AlertTriangle size={18} />
            </span>
            <span className="self-center">{t(copy.emergency)}</span>
          </a>
          <div className="soft-card hidden p-6 lg:block">
            <h2 className="font-serif text-2xl font-normal text-kokum-700">
              {t(copy.whatHappens)}
            </h2>
            <ol className="mt-5 space-y-4">
              {copy.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-kokum-50 font-serif text-lg text-kokum-600">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed text-ink">
                    {t(step)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="min-w-0 lg:order-1">
          <form onSubmit={submit} className="soft-card space-y-7 p-5 sm:p-7">
            <div>
              <label className="font-bold text-ink" htmlFor="place">
                {t(copy.place)}
              </label>
              <div className="mt-2 flex items-stretch gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-full border border-kokum-200 bg-white transition focus-within:border-kokum-500 focus-within:ring-4 focus-within:ring-kokum-100">
                  <MapPin
                    size={16}
                    className="ml-4 shrink-0 text-kokum-500"
                    aria-hidden
                  />
                  <input
                    id="place"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder={t(copy.placeHint)}
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-3 text-[16px] outline-none placeholder:text-ink-soft/60"
                  />
                </div>
                <button
                  type="button"
                  onClick={locate}
                  title={t(copy.useLocation)}
                  aria-label={t(copy.useLocation)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-kokum-50 px-3.5 text-sm font-bold text-kokum-700 transition hover:bg-kokum-100"
                >
                  <LocateFixed size={16} />{" "}
                  <span className="hidden sm:inline">
                    {locating ? t(copy.locating) : t(copy.useLocation)}
                  </span>
                </button>
              </div>
            </div>

            <fieldset>
              <legend className="font-bold text-ink">{t(copy.issue)}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {issues.map((i) => (
                  <button
                    type="button"
                    key={i.id}
                    aria-pressed={issue === i.id}
                    onClick={() => setIssue(i.id)}
                    className={toggleCls(issue === i.id)}
                  >
                    <i.icon size={15} className="shrink-0" aria-hidden />
                    {t(i.label)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-bold text-ink">{t(copy.when)}</legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {times.map((x) => (
                  <button
                    type="button"
                    key={x.id}
                    aria-pressed={time === x.id}
                    onClick={() => setTime(x.id)}
                    className={toggleCls(time === x.id)}
                  >
                    {t(x.label)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="font-bold text-ink" htmlFor="note">
                {t(copy.note)}
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-2 block w-full rounded-2xl border border-kokum-200 bg-white p-4 text-[16px] outline-none transition focus:border-kokum-500 focus:ring-4 focus:ring-kokum-100"
              />
            </div>

            <p className="flex items-center gap-2 rounded-full bg-kokum-50 px-4 py-2 text-sm text-ink-soft">
              <EyeOff size={14} className="shrink-0 text-kokum-500" />{" "}
              {t(copy.anon)}
            </p>

            <button
              type="submit"
              disabled={!place.trim() || !issue || !time}
              className="soft-btn w-full py-3.5"
            >
              {t(copy.submit)}
            </button>
          </form>

          {sent && (
            <div className="mt-8 animate-fade-up">
              <div className="rounded-2xl border border-leaf-100 bg-leaf-50 px-4 py-3.5">
                <p className="flex items-center gap-2 font-bold text-leaf-700">
                  <CheckCircle2 size={18} className="shrink-0" />{" "}
                  {t(copy.thanks)}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
                  {t(copy.demo)}
                </p>
              </div>
              <h2 className="mt-8 font-serif text-3xl font-normal text-kokum-700 sm:text-[2.2rem]">
                {t(copy.yours)}
              </h2>
              <ul className="mt-4 space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="soft-list-item items-start">
                    <span className="icon-circle">
                      <MapPin size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">
                        {label(issues, r.issue)} · {label(times, r.time)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[15px] break-words text-ink-soft">
                        <MapPin size={13} className="shrink-0" /> {r.place}
                      </p>
                      {r.note && (
                        <p className="mt-1.5 leading-relaxed text-ink">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <LocalHelp />
    </div>
  );
}
