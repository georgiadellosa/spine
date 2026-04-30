export async function whisperTranscribe(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'memo.webm');
  const res = await fetch('/api/whisper', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Transcription failed');
  return res.json();
}

export async function parseBrainDump(text) {
  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Parse failed');
  return res.json();
}

export async function shrinkPriority(priority, capacity) {
  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'shrink-priority', priority, capacity, text: priority })
  });
  if (!res.ok) throw new Error('Parse failed');
  return res.json();
}

export async function ingestPaste(text) {
  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode: 'ingest-paste' })
  });
  if (!res.ok) throw new Error('Parse failed');
  return res.json();
}
