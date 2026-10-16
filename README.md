# AADHI TI AI — तिच्या प्रत्येक प्रश्नासाठी

A Women's Information & Support Assistant for Shrivardhan, in **Marathi, English and Hindi**.
Next.js 15 (App Router) + Tailwind CSS v4. Server routes provide AI, voice, verified login and WhatsApp integration; saved information is governed by the app’s consent settings.

## Pages

| Route | What it does |
|---|---|
| `/` | Positioning, the 8-button menu, Understand → Answer → Next step, knowledge universe, 5 intents, age journeys, SOS & helplines |
| `/chat` | ASK AADHI TI — age picker (girl 10–18 / 18+ / 30+ / 40+ / 50+), 8 category buttons, "I don't know what to do" free-text flow, voice input, read-aloud. Deep links: `?topic=<id>`, `?cat=<id>` |
| `/call` | AI safety call and fake incoming call, spoken in the selected language |
| `/everyday` | What's in my kitchen, today's menu, weekly planner, shopping list (WhatsApp share), self-care, kids, outings around Shrivardhan |
| `/schemes` | Government schemes labelled *official / being drafted / general guidance*, plus the Income Finder |
| `/safe-shrivardhan` | Report non-emergency unsafe locations (demo — nothing is sent) |
| `/awareness` | Searchable knowledge hub of every topic + quiz |

## Knowledge base

`lib/kb/` — ~120 topics, each with `understand`, `answer[]`, `next`, `actions`, an intent (learn/check/find/act/connect), and flags for emergency, sensitive (medical/legal/crisis/child) and age groups.

- `safety.ts`, `rights.ts` (+ wellbeing), `health.ts` (+ family), `growth.ts` (career + income), `girls.ts`
- `index.ts` — the 8 adult and 8 girl categories, and the free-text matcher (`understand()`), which handles Devanagari, romanised Marathi/Hindi and everyday phrasing

The knowledge base grounds AI answers; fixed safety responses and escalation rules remain separate.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Repositories

The public website stays here. Staff UI and admin API are independent sibling repositories; see [repository setup](docs/admin-dashboard.md).
