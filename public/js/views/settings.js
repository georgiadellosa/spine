import { signOut } from '../auth.js';
import { clearAll, getSheetId, getDriveFolderId } from '../store.js';
import { navigate } from '../router.js';
import { appendRow } from '../google-sheets.js';
import { ingestPaste } from '../api.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <h1>More</h1>
    <p class="subtitle">Rituals, your data, and the master plan.</p>

    <div class="card">
      <div class="eyebrow mb-3">Rituals</div>
      <a href="#/sunday" class="link" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--sand);">
        <span>${icon('refresh', 16)} Sunday Decision</span>
        ${icon('arrow', 16)}
      </a>
      <a href="#/friday" class="link" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--sand);">
        <span>${icon('check', 16)} Friday Close</span>
        ${icon('arrow', 16)}
      </a>
      <a href="#/quarterly" class="link" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--sand);">
        <span>${icon('layers', 16)} Quarterly Spine</span>
        ${icon('arrow', 16)}
      </a>
      <a href="#/patterns" class="link" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
        <span>${icon('sparkle', 16)} Patterns</span>
        ${icon('arrow', 16)}
      </a>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Paste from Claude</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">
        Paste a Claude conversation or any structured-ish text. The AI will parse it into items and add them to your brain dump for triage.
      </p>
      <textarea id="paste-text" placeholder="Paste a brain dump, plan, or list from Claude..."></textarea>
      <button class="btn btn-ghost mt-3" id="paste-btn">${icon('paste', 16)} Ingest into brain dump</button>
      <div id="paste-msg"></div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Your data</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">Everything lives in your Google account.</p>
      <div class="stack-2">
        <a href="https://docs.google.com/spreadsheets/d/${getSheetId()}" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px;">
          ${icon('open', 14)} Open Spine spreadsheet
        </a>
        <a href="https://drive.google.com/drive/folders/${getDriveFolderId()}" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px;">
          ${icon('open', 14)} Open Drive folder
        </a>
        <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" class="link" style="display: flex; align-items: center; gap: 8px;">
          ${icon('open', 14)} Open Google Calendar
        </a>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Stop / Start / Keep</div>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">From the master plan. Reviewed Friday.</p>
      <p style="font-weight: 600; margin: 12px 0 6px; color: var(--terracotta); font-size: 13px; letter-spacing: 0.05em;">STOP</p>
      <ul style="margin: 0 0 16px 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>Starting new app projects</li>
        <li>Designing four products simultaneously</li>
        <li>Holding deadlines in your head — they live in Spine</li>
        <li>Building skills/plugins faster than you use them</li>
        <li>ConnectWell decisions in isolation</li>
      </ul>
      <p style="font-weight: 600; margin: 12px 0 6px; color: var(--gold); font-size: 13px; letter-spacing: 0.05em;">START</p>
      <ul style="margin: 0 0 16px 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>Friday close, 20 min</li>
        <li>Sunday decision, 30 min</li>
        <li>Quarterly "what dies" review</li>
        <li>Using the ND scheduler on yourself daily</li>
        <li>One commercial finish line for G-HAMR</li>
      </ul>
      <p style="font-weight: 600; margin: 12px 0 6px; color: var(--sage); font-size: 13px; letter-spacing: 0.05em;">KEEP</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: var(--ink-soft); line-height: 1.6;">
        <li>PhD as the spine</li>
        <li>ConnectWell engagement</li>
        <li>Co-regulation-first parenting</li>
        <li>georgia-context + skills layer</li>
        <li>R + lavaan as analytical home</li>
      </ul>
    </div>

    <div class="card">
      <div class="eyebrow mb-3">Account</div>
      <button class="btn btn-ghost" id="signout">${icon('signOut', 16)} Sign out</button>
      <p class="faint mt-3" style="line-height: 1.5;">
        Sign-out doesn't delete anything — your data stays in your Google account. To wipe Spine, delete the Spine spreadsheet, Drive folder, and calendar manually.
      </p>
    </div>
  `;

  document.getElementById('signout').addEventListener('click', () => {
    if (!confirm('Sign out?')) return;
    signOut();
    clearAll();
    navigate('login');
  });

  document.getElementById('paste-btn').addEventListener('click', async () => {
    const text = document.getElementById('paste-text').value.trim();
    const msg = document.getElementById('paste-msg');
    if (!text) {
      msg.innerHTML = `<div class="error">Paste something first</div>`;
      return;
    }
    const btn = document.getElementById('paste-btn');
    btn.disabled = true;
    btn.textContent = 'Parsing…';
    try {
      const result = await ingestPaste(text);
      const items = result.items || [];
      const sheetId = getSheetId();
      const today = new Date().toISOString().slice(0, 10);
      await appendRow(sheetId, 'Brain Dumps', [today, text, JSON.stringify(items), 'Pasted', '']);
      msg.innerHTML = `<div class="success">Parsed ${items.length} item${items.length !== 1 ? 's' : ''}. Now <a href="#/sunday" class="link">run Sunday Decision</a> to triage them.</div>`;
      document.getElementById('paste-text').value = '';
    } catch (err) {
      msg.innerHTML = `<div class="error">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('paste', 16)} Ingest into brain dump`;
    }
  });
}
