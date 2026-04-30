import { createSpineSheet } from '../google-sheets.js';
import { createSpineFolder } from '../google-drive.js';
import { createSpineCalendar, createRecurringRituals } from '../google-calendar.js';
import { setSheetId, setDriveFolderId, setCalendarId, setSetupComplete } from '../store.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large">${icon('layers', 64)}</div>
      <h1 style="font-size: 28px;">Setting up your Spine</h1>
      <p style="max-width: 320px;">Creating a spreadsheet, folder, and calendar in your Google account. About 10 seconds.</p>
      <div class="spinner"></div>
      <div id="status" class="muted" style="font-size: 13px; min-height: 18px;"></div>
    </div>
  `;
  const status = document.getElementById('status');
  try {
    status.textContent = 'Creating spreadsheet…';
    const sheetId = await createSpineSheet();
    setSheetId(sheetId);

    status.textContent = 'Creating Drive folder…';
    const folderId = await createSpineFolder();
    setDriveFolderId(folderId);

    status.textContent = 'Creating calendar…';
    const calId = await createSpineCalendar();
    setCalendarId(calId);

    status.textContent = 'Adding weekly rituals to your calendar…';
    await createRecurringRituals(calId);

    setSetupComplete();

    view.innerHTML = `
      <div class="center-screen">
        <div class="celebrate-check">${icon('check', 40)}</div>
        <h1>You're set up.</h1>
        <p style="max-width: 360px;">
          Your Spine spreadsheet, Drive folder, and Spine calendar are now in your Google account.
          You can open them anytime — they're yours.
        </p>
        <button class="btn" id="continue" style="max-width: 320px;">
          Start with morning check-in
          ${icon('arrow', 18)}
        </button>
      </div>
    `;
    document.getElementById('continue').addEventListener('click', () => navigate('morning'));
  } catch (err) {
    console.error('Setup failed', err);
    view.innerHTML = `
      <div class="center-screen">
        <h1>Setup hit a snag</h1>
        <div class="error" style="max-width: 360px;">${err.message}</div>
        <button class="btn btn-ghost" id="retry">Try again</button>
      </div>
    `;
    document.getElementById('retry').addEventListener('click', () => navigate('setup'));
  }
}
