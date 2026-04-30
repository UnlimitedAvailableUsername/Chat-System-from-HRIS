# Chat Support Playground

To our aspiring devs:

This is a small chat app — admins on one side, employees on the other, and messages go back and forth in real time. Nothing fancy, but everything works.

The fun part: we'd love for you to **make it smarter with AI**. Pick a provider you like (OpenAI, Claude, Gemini, kahit ano), and play around with bringing an AI assistant into the chat. Take it wherever feels interesting to you.

**Vibe-coding allowed.** Cursor, Copilot, ChatGPT, Claude — game lahat. Alam naman naming may AI na kayong kasama pang gawa, basta gawin niyo lang best niyo and kaya niyo explain later on.

---

## Getting set up

Should take ~15 minutes.

### 1. What you'll need

- Node.js 18+ and npm
- A free Supabase account (https://supabase.com — the free tier is plenty)

### 2. Grab the code

```bash
git clone <this-repo-url>
cd interview-chat-test
npm install
```

### 3. Spin up a Supabase project

1. Head to https://supabase.com/dashboard and create a new project (free tier is fine, takes about a minute to provision).
2. Once it's ready, open the **SQL Editor** in the left sidebar.
3. Open `supabase/migration.sql` from this repo, copy the whole thing, paste it into the editor, and hit **Run**.

That single SQL file does everything: creates the tables, enables realtime, sets up the `chat-attachments` storage bucket, creates the login RPCs, and seeds the test users below. You shouldn't need to click around the Supabase dashboard for anything else.

### 4. Drop in your credentials

```bash
cp .env.example .env.local
```

Grab your project URL and anon key from **Project Settings → API** in Supabase, paste them into `.env.local`.

### 5. Run it

```bash
npm run dev
```

Open http://localhost:5173. You'll land on a page asking *"Choose your destination"* with two cards — **Employee Login** and **Admin Login**. Both work with the seeded test users:

| Portal       | Username / SSS  | Password      |
| ------------ | --------------- | ------------- |
| Admin Login  | `admin`         | `admin123`    |
| Employee     | `01-1234567-8`  | `employee123` |
| Employee     | `02-2345678-9`  | `employee123` |

To see the chat in action: open two browser windows (one regular + one Incognito works best). Log in as the admin in one and as Juan or Maria in the other. Send a message and watch it pop up live on the other side. Does it work? Congrats, you've set it up properly.

---

## What's already there

- A landing page (`/`) with two portal cards leading to real login forms.
- An **Admin Portal** (`/admin/chat-inquiries`) with a sidebar shell and the full chat-inquiries page — list of conversations, message thread, employee profile drawer, mark-as-resolved, file attachments, per-admin unread tracking.
- An **Employee Portal** (`/employee/chat`) with a header + bottom-nav shell and a clean chat view, complete with a star-rating feedback card that pops up when a conversation winds down.
- Real-time messaging through Supabase Realtime — no polling, messages just appear.
- A small, readable codebase. You can skim the whole thing in a few minutes — start with `src/pages/ChatInquiries.tsx` (admin) and `src/pages/EmployeeChatSupport.tsx` (employee).

---

## The fun bit: add AI to the chat

Pick any AI provider. The general direction is: bring an AI assistant into the conversation in a way that feels natural and useful. Beyond that, bahala ka na — surprise us, or keep it simple, your call.

Some ideas in case you want a starting point (optional lang, mix and match or ignore):

- The AI chimes in when the admin is slow to reply
- Make AI messages look distinct from human ones
- Let the AI use the conversation history so it feels like it's actually following along
- The admin can take over, and the AI gets out of the way
- Hook it up to a little knowledge base or company FAQ
- An "AI is typing…" indicator
- Stream the response token by token

Walang checklist to tick — just take it in whatever direction feels good.

### One quick note on API keys

If you set the AI key as a `VITE_*` env var, it ends up in the browser bundle and anyone visiting the page can read it. Totally fine for a quick local prototype, but if you want to put a clean version in front of someone you'd usually proxy the call through a server (a Supabase Edge Function works nicely). Worth a thought.

---

## When you're ready to share

1. Fork or copy this repo into your own account on whatever you use — GitHub, GitLab, Bitbucket, kahit ano. Just make sure it's on a public host we can pull from.
2. Push your work there.
3. Send us the link.

A short note on what you tried and how you'd take it further is great — or a quick screen recording if that's easier than writing things up. Whatever's least hassle for you.

**One small but important thing:** if you change the database (new tables, columns, anything), please save the SQL in `supabase/` as a new file (e.g. `supabase/02_ai_features.sql`) and commit it. That way we can clone your repo, point it at our own Supabase project, and actually run what you built. Same idea kung may bagong env vars — update `.env.example` para alam namin.

Wag mo masyadong i-overthink. A few hours is plenty. Kung may rabbit hole na nakaka-curious, follow it; kung nag-stuck ka somewhere, sabihin mo lang kung saan ka tumigil — okay lang yun.

---

## Project layout

```
interview-chat-test/
├── supabase/
│   └── migration.sql              # Run this once in Supabase SQL Editor
├── src/
│   ├── components/
│   │   ├── Layout.tsx             # Admin shell (sidebar + outlet)
│   │   ├── Sidebar.tsx            # Admin sidebar
│   │   ├── EmployeeLayout.tsx     # Employee shell (header + bottom nav)
│   │   ├── LoginForm.tsx          # Admin login form
│   │   ├── ChatFeedbackCard.tsx   # Star-rating feedback widget
│   │   └── NotificationDialog.tsx # Reusable success/error dialog
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Admin session
│   │   └── EmployeeAuthContext.tsx# Employee session
│   ├── hooks/
│   │   ├── useChatNotifications.ts          # Admin unread count
│   │   └── useEmployeeChatNotifications.ts  # Employee unread count
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   └── permissions.ts         # ROLE_IDS + helper stubs
│   ├── pages/
│   │   ├── LandingPage.tsx        # / — portal picker
│   │   ├── EmployeeLogin.tsx      # /employee — employee login
│   │   ├── ChatInquiries.tsx      # /admin/chat-inquiries — admin chat dashboard
│   │   └── EmployeeChatSupport.tsx# /employee/chat — employee chat
│   ├── App.tsx                    # Routes
│   ├── main.tsx                   # Entry
│   └── index.css                  # Tailwind entry
├── .env.example
├── package.json
└── README.md
```

Stack: Vite + React 18 + TypeScript + Tailwind + Supabase + react-router-dom.

Enjoy! Kaya mo yan 💪
