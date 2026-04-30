import { appendRow } from '../google-sheets.js';
import { getSheetId, setLastCheckin } from '../store.js';

export async function render(view) {
  view.innerHTML = `
    <h1>Welcome back.</h1>
    <p>It's been a few days. That's okay. Nothing's broken.</p>

    <div class="field">
      <label>What's the smallest possible thing right now?</label>
      <input type="text" id="small" placeholder="One thing. Anything counts." />
    </div>

    <button class="btn" id="go">That's today</button>
    <div id="msg"></div>

    <p class="muted" style="margin-top: 24px; font-size: 13px;">
      No backfill, no streak penalty. We pick up from here.
    </p>
  `;
  document.getElementById('go').addEventListener('click', async () => {
    const small = document.getElementById('small').value.trim();
    if (!small) {
      document.getElementById('msg').innerHTML = `<div class="error">Type one thing</div>`;
      return;
    }
    try {
      const sheetId = getSheetId();
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      await appendRow(sheetId, 'Daily Check-in', [
        today, 'Solo Day', 1, '', small, '', '', '', '', now
      ]);
      setLastCheckin(today);
      view.innerHTML = `
        <div class="center-screen">
          <h1>${escHtml(small)}</h1>
          <p class="muted">That's the only thing on the list. Anything else is bonus.</p>
        </div>
      `;
    } catch (err) {
      document.getElementById('msg').innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
