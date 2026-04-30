import { createBudgetSheet } from '../google-sheets.js';
import { setSheetId, setSetupComplete } from '../store.js';
import { withFreshToken } from '../auth.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large" style="color: var(--gold);">${icon('coin', 64)}</div>
      <h1>Get started</h1>
      <p style="max-width: 360px;">Looking for an existing Pots spreadsheet in your Drive…</p>
      <div class="spinner"></div>
    </div>
  `;
  let existing = [];
  try { existing = await findExistingHandsSheets(); } catch {}

  if (existing.length === 1) {
    const found = existing[0];
    view.innerHTML = `
      <div class="center-screen">
        <div class="icon-large" style="color: var(--gold);">${icon('coin', 64)}</div>
        <h1>Found your Pots</h1>
        <p style="max-width: 360px;">There's already a "Hands" spreadsheet in your Drive (last modified ${formatDate(found.modifiedTime)}). Connect this browser to it?</p>
        <div style="max-width: 360px; width: 100%; display: flex; flex-direction: column; gap: 12px;">
          <button class="btn" id="auto-connect" style="background: var(--gold);">${icon('check', 18)} Connect to existing Pots</button>
          <button class="btn btn-ghost" id="new-setup">${icon('coin', 18)} No, set up a new one</button>
        </div>
      </div>
    `;
    document.getElementById('auto-connect').addEventListener('click', () => autoConnect(view, found));
    document.getElementById('new-setup').addEventListener('click', () => createNew(view));
    return;
  }
  if (existing.length > 1) {
    view.innerHTML = `
      <div class="center-screen">
        <div class="icon-large" style="color: var(--gold);">${icon('coin', 64)}</div>
        <h1>${existing.length} Pots sheets found</h1>
        <p style="max-width: 360px;">Pick the one to use, or create a fresh one.</p>
        <div style="max-width: 480px; width: 100%; display: flex; flex-direction: column; gap: 8px;">
          ${existing.map((s, i) => `
            <button class="btn btn-ghost" data-pick="${i}" style="text-align: left; justify-content: flex-start;">
              <div>
                <div style="font-weight: 500;">${escHtml(s.name)}</div>
                <div class="faint" style="font-size: 12px; margin-top: 2px;">last modified ${formatDate(s.modifiedTime)}</div>
              </div>
            </button>
          `).join('')}
          <button class="btn" id="new-setup" style="margin-top: 12px; background: var(--gold);">${icon('coin', 18)} Set up brand new Pots</button>
        </div>
      </div>
    `;
    view.querySelectorAll('button[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => autoConnect(view, existing[parseInt(btn.dataset.pick)]));
    });
    document.getElementById('new-setup').addEventListener('click', () => createNew(view));
    return;
  }

  // No existing Pots sheet — go straight to create
  await createNew(view);
}

async function createNew(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large" style="color: var(--gold);">${icon('coin', 64)}</div>
      <h1>Setting up Pots</h1>
      <p style="max-width: 320px;">Creating a Hands spreadsheet in your Google account, with sensible default categories. Takes a few seconds.</p>
      <div class="spinner"></div>
    </div>
  `;
  try {
    const sheetId = await createBudgetSheet();
    setSheetId(sheetId);
    setSetupComplete();
    // Fresh sheet — walk through onboarding (income, bills, debts, goals)
    navigate('onboarding');
  } catch (err) {
    showError(view, err.message);
  }
}

async function autoConnect(view, sheet) {
  view.innerHTML = `<div class="center-screen"><div class="spinner"></div><p class="muted">Connecting to ${escHtml(sheet.name)}…</p></div>`;
  try {
    setSheetId(sheet.id);
    setSetupComplete();
    showSuccess(view, 'Connected.', 'This browser is now linked to your existing Pots.');
  } catch (err) {
    showError(view, err.message);
  }
}

function showSuccess(view, title, body) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="celebrate-check" style="background: var(--gold); box-shadow: 0 8px 24px rgba(201, 152, 92, 0.3);">${icon('check', 40)}</div>
      <h1>${escHtml(title)}</h1>
      <p style="max-width: 360px;">${escHtml(body)}</p>
      <button class="btn" id="continue" style="max-width: 320px; background: var(--gold);">
        Open Money ${icon('arrow', 18)}
      </button>
    </div>
  `;
  document.getElementById('continue').addEventListener('click', () => navigate('home'));
}

function showError(view, message) {
  view.innerHTML = `
    <div class="center-screen">
      <h1>Setup hit a snag</h1>
      <div class="error" style="max-width: 360px;">${escHtml(message)}</div>
      <button class="btn btn-ghost" id="retry">Try again</button>
    </div>
  `;
  document.getElementById('retry').addEventListener('click', () => render(view));
}

async function findExistingHandsSheets() {
  return withFreshToken(async (token) => {
    const q = encodeURIComponent("(name='Hands' or name='Budget') and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
