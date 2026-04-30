import { createBudgetSheet } from '../google-sheets.js';
import { setSheetId, setSetupComplete } from '../store.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large" style="color: var(--gold);">${icon('coin', 64)}</div>
      <h1>Setting up Hands</h1>
      <p style="max-width: 320px;">Creating a Hands spreadsheet in your Google account, with sensible default categories. Takes a few seconds.</p>
      <div class="spinner"></div>
      <div id="status" class="muted" style="font-size: 13px; min-height: 18px;"></div>
    </div>
  `;
  const status = document.getElementById('status');
  try {
    status.textContent = 'Creating spreadsheet…';
    const sheetId = await createBudgetSheet();
    setSheetId(sheetId);
    setSetupComplete();

    view.innerHTML = `
      <div class="center-screen">
        <div class="celebrate-check" style="background: var(--gold); box-shadow: 0 8px 24px rgba(201, 152, 92, 0.3);">${icon('check', 40)}</div>
        <h1>You're set up.</h1>
        <p style="max-width: 360px;">Your Hands spreadsheet is in your Google Drive. Add a few transactions and the dashboard fills in.</p>
        <button class="btn" id="continue" style="max-width: 320px; background: var(--gold);">
          Open Money ${icon('arrow', 18)}
        </button>
      </div>
    `;
    document.getElementById('continue').addEventListener('click', () => navigate('money'));
  } catch (err) {
    view.innerHTML = `
      <div class="center-screen">
        <h1>Setup hit a snag</h1>
        <div class="error" style="max-width: 360px;">${err.message}</div>
        <button class="btn btn-ghost" id="retry">Try again</button>
      </div>
    `;
    document.getElementById('retry').addEventListener('click', () => render(view));
  }
}
