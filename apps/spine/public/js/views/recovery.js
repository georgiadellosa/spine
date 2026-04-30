import { appendRow } from '../google-sheets.js';
import { getSheetId, setLastCheckin } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large warm">${icon('leaf', 64)}</div>
      <h1>Welcome back.</h1>
      <p style="max-width: 360px;">It's been a few days. Nothing's broken. Let's pick back up gently.</p>

      <div class="field" style="max-width: 360px; width: 100%;">
        <label>What's the smallest possible thing right now?</label>
        <input type="text" id="small" placeholder="Anything counts. Even tiny." autofocus />
      </div>

      <button class="btn btn-warm" id="go" style="max-width: 360px;">That's today</button>
      <div id="msg" style="max-width: 360px; width: 100%;"></div>

      <p class="faint mt-5" style="max-width: 320px; line-height: 1.5;">
        No backfill. No streak penalty. We're not measuring missed days, we're just starting from here.
      </p>
    </div>
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
          <div class="celebrate-check">${icon('check', 40)}</div>
          <div class="priority-card" style="max-width: 360px;">
            <div class="domain">Today</div>
            <div class="text">${escHtml(small)}</div>
          </div>
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
