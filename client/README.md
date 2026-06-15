# FormPilot 🤖

A form autofill agent that reads your resume and fills web forms live, field by field — while you watch, pause, and steer it with natural language.

**Demo:** [Screen recording link — add yours here]  
**GitHub:** [Your repo link — add yours here]

---

## What It Does

1. Upload a PDF resume → AI extracts your details
2. Give it a form URL → it scrapes all the fields
3. Watch it fill the form live, field by field, in a real browser
4. Pause at any time, type instructions in plain English, then resume
5. It applies your corrections and carries on

---

## Local Setup (Step by Step)

### Prerequisites

- Node.js v18 or higher → [nodejs.org](https://nodejs.org)
- A free Groq API key → [console.groq.com](https://console.groq.com)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/formpilot.git
cd formpilot
```

### 2. Set up the backend

```bash
cd server
npm install
npx playwright install chromium
```

Create a `.env` file inside `/server`:

```
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
```

Start the server:

```bash
node index.js
```

### 3. Set up the frontend

Open a new terminal:

```bash
cd client
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Try it

1. Upload your resume PDF
2. The form URL is pre-filled with the Greenhouse target form
3. Click **Start Filling** and watch it go
4. Click **Pause** mid-fill, type an instruction like *"skip GitHub"* or *"set city to Manila"*, then click **Resume**

---

## Key Decisions and Why

### Groq + LLaMA 3.3 70B for AI
I chose Groq over OpenAI or Gemini for two reasons: it has a generous free tier (14,400 requests/day) and it's significantly faster than other providers for inference. LLaMA 3.3 70B handles both resume parsing and field mapping accurately, and follows JSON-only output instructions reliably which is critical for parsing.

### pdfjs-dist for PDF parsing
I started with `pdf-parse` but it has a broken CommonJS export on Windows (exports an object instead of a function). `pdfjs-dist` works reliably across platforms and gives page-by-page text extraction which preserves resume structure better.

### Playwright for browser automation
Playwright is the most reliable tool for controlling a real browser programmatically. I used `headless: false` so the user can watch the form being filled in real time — this is a core part of the experience. `domcontentloaded` is used instead of `networkidle` because Greenhouse's page never fully stops network activity, causing indefinite hangs.

### Server-Sent Events (SSE) for live updates
SSE is simpler than WebSockets for this use case — the data flow is one-directional (server → client). Every field fill emits an event that the React frontend listens to and uses to update the progress panel in real time.

### In-memory session state
A single session object in `sessionStore.js` holds the fill status, field list, and overrides. This is simple and fast for a single-user demo. The SSE client list is preserved across session resets so the frontend stays connected throughout the upload → start → fill lifecycle.

### 1-second delay before filling starts
After the `/start` route responds with the fill plan, there's a 1-second delay before `fillForm` begins emitting SSE events. This gives the React frontend time to render the field list and attach event listeners before the first `field_done` event fires.

### Context API vs Redux
Used React's built-in `useState` and `useEffect` — the state is simple enough that Redux or Zustand would be overkill. Keeping it simple made debugging faster.

---

## Tradeoffs

| Decision | What I chose | What I gave up |
|---|---|---|
| PDF parsing | pdfjs-dist (reliable cross-platform) | Slightly more complex than pdf-parse |
| AI provider | Groq (free, fast) | Less multimodal capability than Gemini |
| State storage | In-memory | Session lost on server restart |
| Browser mode | headless: false (visible) | Slightly slower than headless |
| SSE vs WebSocket | SSE (simpler) | Bidirectional communication |
| Single session | Simple in-memory | Can't support multiple users at once |

---

## Known Limitations

- **Single user only** — the in-memory session supports one fill at a time. A second user would overwrite the first session.
- **Country dropdown unfilled** — Greenhouse uses a custom React-rendered dropdown that doesn't respond to standard Playwright `selectOption`. It requires clicking and selecting from a custom list, which needs extra handling.
- **File upload skipped** — the resume file upload field is skipped. Attaching a file via Playwright requires a local file path, which adds complexity.
- **EEO fields always skipped** — gender, race, veteran status, and disability fields are never filled, as instructed. The user must fill these manually if they choose to.
- **Scanned PDF resumes won't work** — pdfjs-dist extracts text layer only. Image-based scanned PDFs return no text.
- **Session lost on refresh** — there's no persistence layer. Refreshing the page loses progress tracking (though the browser fill continues).
- **Single-page forms only** — multi-page or multi-step forms are not handled in this version.

---

## What I'd Do With More Time

1. **Fix the Country dropdown** — inspect Greenhouse's custom dropdown DOM and use Playwright's `click` + `locator` to select options from it properly.

2. **Persist sessions to disk** — save session state to a JSON file or SQLite so the user can refresh the page and resume tracking.

3. **Live browser screenshot stream** — pipe a Playwright screenshot every second to the frontend via SSE so the user sees a live video-like view of the browser, not just a field list.

4. **Confidence flagging** — when the AI is unsure about a field match (e.g. a field label with no clear resume equivalent), flag it in the UI and ask the user to confirm before filling.

5. **Multi-user support** — replace the single in-memory session with a session map keyed by session ID, stored in Redis.

6. **File upload support** — allow the user to specify a local resume path and attach it to the file upload field via Playwright.

7. **Multi-page form support** — detect "Next" buttons and navigate through multi-step forms automatically.

8. **Better error recovery** — if a field fill fails, retry with an alternative selector strategy before marking it as skipped.

---

## Project Structure

```
formpilot/
├── client/                  # React frontend
│   └── src/
│       ├── App.js           # Main component — chat panel + progress panel
│       └── App.css          # Styling
└── server/                  # Node.js + Express backend
    ├── index.js             # Routes: /upload /start /pause /resume /cancel /instruct /stream
    ├── pdfParser.js         # Extracts text from PDF → sends to Groq → returns profile JSON
    ├── formScraper.js       # Playwright scrapes form field labels, types, ids from URL
    ├── formFiller.js        # Playwright fills fields one by one, emits SSE events
    ├── instructionParser.js # Sends user instruction to Groq → returns field overrides JSON
    ├── sessionStore.js      # In-memory session state + SSE client list + emit helper
    └── .env                 # GROQ_API_KEY and PORT (not committed)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, plain CSS, EventSource (SSE) |
| Backend | Node.js, Express |
| Browser automation | Playwright (Chromium) |
| AI / LLM | Groq API — LLaMA 3.3 70B |
| PDF parsing | pdfjs-dist |
| File upload handling | Multer |

---

## Target Form

Built and tested against:  
**https://job-boards.greenhouse.io/thinkingmachines/jobs/5111543008**

This form was chosen because it contains the full range of field types: plain text, dropdowns, multi-select, file upload, URL fields, repeatable groups (Education), free-text areas, consent dropdowns, and optional EEO fields.

⚠️ The form is filled but never submitted.