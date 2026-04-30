import { appendRow } from './google-sheets.js';
import { getSheetId, getDriveFolderId } from './store.js';
import { uploadAudioToDrive } from './google-drive.js';
import { whisperTranscribe } from './api.js';
import { icon } from './icons.js';

export function attachCaptureFab() {
  if (document.getElementById('capture-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'capture-fab';
  fab.setAttribute('aria-label', 'Quick capture');
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  document.body.appendChild(fab);
  fab.addEventListener('click', openCapture);
}

export function showFab(show) {
  const fab = document.getElementById('capture-fab');
  if (fab) fab.style.display = show ? 'flex' : 'none';
}

function openCapture() {
  if (document.getElementById('capture-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'capture-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="row between mb-3">
        <h2 style="margin: 0;">Quick capture</h2>
        <button class="modal-close" id="close-capture" aria-label="Close">${icon('drop', 22)}</button>
      </div>
      <p class="muted" style="font-size: 14px; margin-bottom: 12px;">
        Anything taking up space. Triage it later — it'll appear in Sunday Decision.
      </p>
      <textarea id="capture-text" placeholder="What just landed?" rows="3"></textarea>
      <div class="row between mt-3">
        <button class="mic-btn" id="capture-mic">${icon('mic', 16)} Voice</button>
        <button class="btn" id="capture-save" style="width: auto; padding: 0 24px;">Save</button>
      </div>
      <div id="capture-status" class="help mt-2"></div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('capture-text').focus(), 100);

  const close = () => modal.remove();
  document.getElementById('close-capture').addEventListener('click', close);
  modal.querySelector('.modal-backdrop').addEventListener('click', close);

  let mediaRecorder = null;
  let chunks = [];
  document.getElementById('capture-mic').addEventListener('click', async () => {
    const mic = document.getElementById('capture-mic');
    const status = document.getElementById('capture-status');
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      mic.innerHTML = `${icon('mic', 16)} Voice`;
      mic.classList.remove('recording');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        status.textContent = 'Transcribing…';
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const folderId = getDriveFolderId();
          if (folderId) {
            const fname = `capture-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
            await uploadAudioToDrive(folderId, blob, fname).catch(() => {});
          }
          const { transcript } = await whisperTranscribe(blob);
          document.getElementById('capture-text').value = transcript;
          status.textContent = 'Done — review and save.';
        } catch (err) {
          status.innerHTML = `<span class="error">${err.message}</span>`;
        }
      };
      mediaRecorder.start();
      mic.innerHTML = `${icon('stop', 16)} Stop`;
      mic.classList.add('recording');
      status.textContent = 'Recording…';
    } catch {
      status.innerHTML = `<span class="error">Mic permission denied</span>`;
    }
  });

  document.getElementById('capture-save').addEventListener('click', async () => {
    const text = document.getElementById('capture-text').value.trim();
    if (!text) return;
    const btn = document.getElementById('capture-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const sheetId = getSheetId();
      const today = new Date().toISOString().slice(0, 10);
      const id = `cap-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      await appendRow(sheetId, 'Triage', [
        id, today, text, '', 'Other', '', '', '', 'inbox', new Date().toISOString()
      ]);
      modal.querySelector('.modal-card').innerHTML = `
        <div class="center" style="padding: 28px 0;">
          <div class="celebrate-check" style="margin: 0 auto 14px;">${icon('check', 36)}</div>
          <p style="margin: 0; font-size: 16px;">Captured.</p>
          <p class="muted" style="margin: 8px 0 0; font-size: 13px;">It'll appear in Sunday Decision.</p>
        </div>
      `;
      setTimeout(close, 1400);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Save';
      document.getElementById('capture-status').innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}
