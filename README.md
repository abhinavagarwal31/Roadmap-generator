# LumosPath

> **An AI-powered learning path visualizer** that turns any topic into a personalized, interactive skill tree — so learners always know what to study next and can track their progress across sessions.

---

## Problem Statement

Most learners struggle not with motivation, but with **direction**. Online resources are abundant, yet it's hard to know:

- Where to start for a given topic
- What to learn next once you've grasped the basics
- How to measure your actual progress

LumosPath solves this by letting learners **generate adaptive roadmaps through an AI assessment**, visualize those roadmaps as an **interactive skill tree graph**, and **track completion** persistently across sessions — giving every learner a concrete, personalized curriculum instead of a pile of random tutorials.

---

## Features

| Feature | Description |
|---|---|
| 🤖 **AI-Adaptive Roadmaps** | Describe a topic → take a quiz → get a skill tree calibrated to your current level (beginner / intermediate / advanced) |
| 🌳 **Interactive Skill Tree** | React Flow graph with locked / unlocked / completed node states and prerequisite chains |
| 📊 **Progress Tracking** | Mark topics complete; progress persists to Firestore (cross-device) with localStorage fallback |
| 🔐 **Firebase Auth** | Email / password sign-up and login; demo mode for testing without credentials |
| 👤 **Profile & AI Motivation** | Personalized AI study message based on your completion stats; editable focus area and study goal |
| ☀️🌙 **Dark / Light Mode** | App-wide theme toggle, persisted across sessions |
| 💾 **Persistent Custom Tracks** | AI-generated tracks saved to Firestore under `users/{uid}/customTracks` and synced on every login |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · React Router v6 |
| Styling | Tailwind CSS v3 |
| Graph | React Flow |
| Backend | Node.js · Express (local dev) / Vercel Serverless Functions (production) |
| AI | OpenAI API (`gpt-4o-mini` by default) |
| Auth & DB | Firebase Authentication · Cloud Firestore |
| State | React Context · Custom hooks (`useProgress`) |

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

**Required Firebase vars** (from your Firebase project settings):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

**AI backend vars** (server-side only, never exposed to the browser):

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini   # optional, defaults to gpt-4o-mini
API_PORT=8787               # optional, defaults to 8787
```

**Demo mode** (run the UI without a real Firebase project):

```
VITE_ENABLE_DEMO_MODE=true
```

> ⚠️ Keep `VITE_ENABLE_DEMO_MODE=false` in production unless you want anonymous access.

### 3. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) → create or open a project.
2. **Add a Web app** → copy the config values into `.env`.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Enable **Firestore Database** → start in test mode (or use the rules below).

**Recommended Firestore security rules:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /skills/{skillId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /topics/{topicId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Run locally

```bash
npm run dev
```

`npm run dev` starts both:
- Vite frontend (default: `http://localhost:5173`)
- Express AI backend (`http://localhost:8787`)

### 5. Verify setup

1. Sign up from the login page.
2. Confirm the dashboard loads.
3. Open **+ Create AI Track**, enter a topic, complete the assessment quiz, and generate a path.
4. Confirm the custom track appears on the dashboard and in the skill tree.

---

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import into [Vercel](https://vercel.com).
3. Add all `VITE_FIREBASE_*` vars and `OPENAI_API_KEY` in **Project Settings → Environment Variables**.
4. The `vercel.json` routes `/api/*` to the Vercel serverless functions in `api/`.

---

## Security Notes

- The OpenAI key is **never** exposed to the browser — it is read only from `OPENAI_API_KEY` on the server.
- CORS is restricted to `ALLOWED_ORIGIN` (defaults to `http://localhost:5173`). Set this env var in production to your deployed frontend URL.
