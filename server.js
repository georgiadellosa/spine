require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(express.json({ limit: '5mb' }));

// Hostname → app routing
// Maps body-part subdomain → app directory name.
// (Body parts are hands/head/heart/hearth; apps within them are Pots/Untangle/Tend/TwoNests.)
function appForHost(host) {
  if (!host) return 'spine';
  const h = host.toLowerCase();
  if (h.startsWith('hands.') || h.startsWith('pots.')) return 'pots';
  if (h.startsWith('head.') || h.startsWith('untangle.')) return 'head';
  if (h.startsWith('heart.') || h.startsWith('tend.')) return 'heart';
  if (h.startsWith('hearth.') || h.startsWith('twonests.')) return 'hearth';
  return 'spine';
}

// Per-app config endpoint
app.get('/config.js', (req, res) => {
  const target = appForHost(req.hostname);
  res.type('application/javascript');
  if (target === 'pots') {
    res.send(`window.__POTS_CONFIG__ = ${JSON.stringify({
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      appUrl: process.env.POTS_APP_URL || `https://hands.thewebbybrain.com`
    })};`);
  } else {
    res.send(`window.__SPINE_CONFIG__ = ${JSON.stringify({
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      appUrl: process.env.SPINE_APP_URL || `https://spine.thewebbybrain.com`
    })};`);
  }
});

// Shared API: Whisper transcription (used by Spine)
app.post('/api/whisper', upload.single('audio'), async (req, res) => {
  if (!openai) return res.status(500).json({ error: 'OpenAI not configured' });
  if (!req.file) return res.status(400).json({ error: 'No audio file' });
  const tmpPath = `/tmp/wb-${Date.now()}.webm`;
  try {
    fs.writeFileSync(tmpPath, req.file.buffer);
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1'
    });
    res.json({ transcript: result.text });
  } catch (err) {
    console.error('whisper', err);
    res.status(500).json({ error: 'Transcription failed' });
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

// Shared API: brain-dump / shrink-priority / paste-ingest (used by Spine)
app.post('/api/parse', async (req, res) => {
  if (!openai) return res.status(500).json({ error: 'OpenAI not configured' });
  const { text, mode, capacity, priority } = req.body;
  if (!text && mode !== 'shrink-priority') return res.status(400).json({ error: 'No text' });
  try {
    let systemPrompt, userContent;
    if (mode === 'shrink-priority') {
      systemPrompt = `Given a priority and a capacity tier 1-5, return ONLY {"smaller_version":"..."}. Lower capacity = smaller action. Tier 1 = "open the document and read 1 paragraph" small. Tier 2 = 15 minutes. Tier 5 = full normal version. Be concrete and warm.`;
      userContent = `Priority: ${priority}\nCapacity: ${capacity}`;
    } else if (mode === 'ingest-paste') {
      systemPrompt = `Parse this pasted text into discrete brain-dump items. Skip preamble, headers, meta-commentary — only extract concrete actions, concerns, or things to track. Return ONLY {"items":[{"text":"...","domain":"PhD|LLW|Family|Finance|Other"}]}.`;
      userContent = text;
    } else {
      systemPrompt = `Parse the following brain dump into discrete items. Return ONLY {"items":[{"text":"...","domain":"PhD|LLW|Family|Finance|Other"}]}. Each item is one action or concern. Infer domain from context. Keep items short and concrete.`;
      userContent = text;
    }
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' }
    });
    res.json(JSON.parse(result.choices[0].message.content));
  } catch (err) {
    console.error('parse', err);
    res.status(500).json({ error: 'Parse failed' });
  }
});

// Shared API: CSV parsing (used by Hands)
app.post('/api/parse-csv', async (req, res) => {
  if (!openai) return res.status(500).json({ error: 'OpenAI not configured' });
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'No CSV' });
  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Parse this bank-statement CSV into transactions. Return ONLY {"transactions":[{"date":"YYYY-MM-DD","amount":<number, negative for expense>,"description":"...","suggested_category":"..."}]}. Skip header rows. Infer category from description (e.g. "Coles" → "Groceries", "Netflix" → "Subscriptions").` },
        { role: 'user', content: csv.slice(0, 50000) }
      ],
      response_format: { type: 'json_object' }
    });
    res.json(JSON.parse(result.choices[0].message.content));
  } catch (err) {
    console.error('csv', err);
    res.status(500).json({ error: 'Parse failed' });
  }
});

// Static file serving — picks the right app based on hostname
app.use((req, res, next) => {
  const target = appForHost(req.hostname);
  const dir = path.join(__dirname, 'apps', target, 'public');
  express.static(dir)(req, res, next);
});

// SPA fallback per app
app.get('*', (req, res) => {
  const target = appForHost(req.hostname);
  const indexPath = path.join(__dirname, 'apps', target, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`No app configured for hostname ${req.hostname}`);
  }
});

app.listen(PORT, () => console.log(`webbybrain serving on ${PORT}`));
