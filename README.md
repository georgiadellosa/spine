# Spine

Personal-use daily-driver app on top of Google Sheets, Drive, and Calendar. Solo only.

## What works in v0.1 (Weekend 1)

- Sign in with Google
- First-run creates: Spine spreadsheet (9 tabs), Drive folder, dedicated Spine calendar with recurring rituals
- **Morning check-in** — capacity, day type, priority, free time, save → creates a calendar block
- **Evening close** — outcome, win log, optional voice dump (Whisper transcribed, saved to Drive)

## Local dev

```bash
npm install
cp .env.example .env
# fill in OPENAI_API_KEY, GOOGLE_CLIENT_ID, APP_URL
npm run dev
```

Visit http://localhost:3000

## Render deploy

- Build command: `npm install`
- Start command: `node server.js`
- Env vars: `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `APP_URL`

## Google Cloud setup (one time)

1. Enable APIs: Sheets, Drive, Calendar
2. OAuth consent screen → External, Testing mode, add yourself as test user
3. Create OAuth Web Client ID
   - Authorised JS origins: `http://localhost:3000`, your prod URL
4. Copy Client ID into env

## Coming in Weekend 2

- Sunday Decision (brain dump → triage → pick three)
- Calendar view with FullCalendar

## Coming in Weekend 3

- Drag priorities to calendar blocks
- Friday Close
- Recovery mode + auto-rollover
- Patterns view
