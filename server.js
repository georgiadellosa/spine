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
app.use(express.static(path.join(__dirname, 'public')));

app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.__SPINE_CONFIG__ = ${JSON.stringify({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    appUrl: process.env.APP_URL || ''
  })};`);
});

app.post('/api/whisper', upload.single('audio'), async (req, res) => {
  if (!openai) return res.status(500).json({ error: 'OpenAI not configured' });
  if (!req.file) return res.status(400).json({ error: 'No audio file' });
  const tmpPath = `/tmp/spine-${Date.now()}.webm`;
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
      systemPrompt = `Parse this pasted text (often from a Claude conversation, plan, or list) into discrete brain-dump items. Skip preamble, headers, and meta-commentary — only extract concrete actions, concerns, or things to track. Return ONLY {"items":[{"text":"...","domain":"PhD|LLW|Family|Finance|Other"}]}.`;
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Spine listening on ${PORT}`));
