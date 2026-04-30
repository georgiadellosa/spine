import { withFreshToken } from './auth.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export async function createSpineFolder() {
  return withFreshToken(async (token) => {
    const res = await fetch(`${API}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Spine', mimeType: 'application/vnd.google-apps.folder' })
    });
    if (!res.ok) throw new Error(`Drive folder: ${await res.text()}`);
    const folder = await res.json();
    const subfolders = ['voice-memos', 'weekly-closes', 'attachments'];
    await Promise.all(subfolders.map(name =>
      fetch(`${API}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [folder.id] })
      })
    ));
    return folder.id;
  });
}

export async function uploadAudioToDrive(folderId, audioBlob, filename) {
  return withFreshToken(async (token) => {
    const metadata = { name: filename, parents: [folderId] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', audioBlob);
    const res = await fetch(UPLOAD_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    if (!res.ok) throw new Error(`Drive upload: ${await res.text()}`);
    const file = await res.json();
    return `https://drive.google.com/file/d/${file.id}/view`;
  });
}
