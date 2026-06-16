// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { generateText } = require('ai');
const { groq } = require('@ai-sdk/groq');

const { extractProfileFromPDF } = require('./pdfParser');
const { scrapeFormFields } = require('./formScraper');
const { fillForm } = require('./formFiller');
const { parseInstruction } = require('./instructionParser');
const { getSession, resetSession, emit } = require('./sessionStore');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// SSE stream endpoint
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const session = getSession();
  session.sseClients.push(res);

  req.on('close', () => {
    session.sseClients = session.sseClients.filter(c => c !== res);
  });
});

// Upload PDF
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const profile = await extractProfileFromPDF(req.file.buffer);
    // Reset ONLY profile and fields, keep SSE clients
    const session = getSession();
    session.profile = profile;
    session.fields = [];
    session.overrides = {};
    session.status = 'idle';
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start filling
// Start filling
app.post('/start', async (req, res) => {
  const { url } = req.body;
  const session = getSession();
  const profile = session.profile;

  if (!profile) return res.status(400).json({ error: 'Upload a resume first' });
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    const formFields = await scrapeFormFields(url);

    const prompt = `Given this candidate profile:
${JSON.stringify(profile, null, 2)}

And these form fields:
${JSON.stringify(formFields, null, 2)}

Create a fill plan. Return ONLY a JSON array:
[{"fieldLabel": "First Name", "value": "John", "type": "text", "id": "field_id", "name": "field_name"}]

Rules:
- Match fields intelligently even if wording differs
- NEVER fill EEO fields (gender, race, veteran, disability) — set value to "SKIP"
- For dropdowns, value must exactly match one of the available options
- Return ONLY JSON, no explanation, no markdown`;

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt,
    });

    const clean = text.replace(/```json|```/g, '').trim();
    const fillPlan = JSON.parse(clean);

    // Set session state BEFORE responding
    session.status = 'running';
    session.fields = fillPlan.map(f => ({ ...f, status: 'queued' }));
    session.overrides = {};

    // Respond to frontend first
    res.json({ success: true, fillPlan });

    // Small delay so frontend SSE is ready before events start firing
    await new Promise(r => setTimeout(r, 1000));

    // Start filling in background
    fillForm(url, fillPlan).catch(console.error);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause
app.post('/pause', (req, res) => {
  getSession().status = 'paused';
  emit({ type: 'paused' });
  res.json({ success: true });
});

// Resume
app.post('/resume', (req, res) => {
  getSession().status = 'running';
  emit({ type: 'resumed' });
  res.json({ success: true });
});

// Cancel
app.post('/cancel', (req, res) => {
  getSession().status = 'cancelled';
  res.json({ success: true });
});

// Natural language instruction
app.post('/instruct', async (req, res) => {
  const { message } = req.body;
  const session = getSession();

  if (!message) return res.status(400).json({ error: 'No message provided' });

  try {
    const overrides = await parseInstruction(message, session.fields);
    overrides.forEach(({ fieldLabel, newValue }) => {
      session.overrides[fieldLabel] = newValue;
    });

    const reply = `Got it! I'll apply: ${overrides.map(o => `${o.fieldLabel} → ${o.newValue}`).join(', ')}`;
    emit({ type: 'agent_message', text: reply });
    res.json({ success: true, overrides, reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
