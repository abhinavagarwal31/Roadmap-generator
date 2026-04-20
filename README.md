# LumosPath

LumosPath is a skill-tree learning path visualizer with:

- Firebase Authentication (email/password)
- Firestore-backed topics/skills/progress
- AI-powered custom track generation through a backend API

## 1) Install and run

```bash
npm install
npm run dev
```

`npm run dev` starts both:

- Vite frontend
- Express backend (`server/index.js`)

## 2) Environment setup

Copy [.env.example](.env.example) to `.env` and fill values.

Required Firebase vars:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Required AI backend vars:

- `OPENAI_API_KEY` (server-side only)
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `API_PORT` (optional, default `8787`)

Optional frontend API var:

- `VITE_API_BASE_URL` (only needed when frontend/backend are on different domains)

## 3) Firebase setup (from your current screen)

If you are at the Firebase project home page:

1. Click **Add app**.
2. Choose **Web** (`</>` icon).
3. Register app name, for example `LumosPath Web`.
4. Skip Hosting for now (you can add later).
5. Copy Firebase config values into `.env`.

Then configure services:

1. Open **Authentication** → **Sign-in method**.
2. Enable **Email/Password**.
3. Open **Firestore Database** → **Create database**.
4. Start in test mode (development) or production mode (if you want strict rules now).

Recommended Firestore rules:

```txt
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

## 4) Verify setup

1. Start app with `npm run dev`.
2. Sign up from login page.
3. Confirm dashboard loads.
4. Open **Create AI Track** and generate a path.
5. Confirm custom track appears in dashboard and skill tree.

## Security note

OpenAI key is never entered in UI now. It is read only from backend environment (`OPENAI_API_KEY`).
