import { createSpineSheet } from '../google-sheets.js';
import { createSpineFolder } from '../google-drive.js';
import { createSpineCalendar, createRecurringRituals } from '../google-calendar.js';
import { setSheetId, setDriveFolderId, setCalendarId, setSetupComplete } from '../store.js';
import { navigate } from '../router.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <h1>Setting up</h1>
      <p>Creating your Spine spreadsheet, Drive folder, and calendar.<br>About 10 seconds.</p>
      <div class="spinner"></div>
      <div id="status" class="muted"></div>
    </div>
  `;
  const status = document.getElementById('status');
  try {
    status.textContent = 'Creating spreadsheet...';
    const sheetId = await createSpineSheet();
    setSheetId(sheetId);

    status.textContent = 'Creating Drive folder...';
    const folderId = await createSpineFolder();
    setDriveFolderId(folderId);

    status.textContent = 'Creating calendar...';
    const calId = await createSpineCalendar();
    setCalendarId(calId);

    status.textContent = 'Adding recurring rituals...';
    await createRecurringRituals(calId);

    setSetupComplete();

    view.innerHTML = `
      <div class="center-screen">
        <h1>You're set up.</h1>
        <p>Your Spine sheet, folder, and calendar are now in your Google account.</p>
        <button class="btn" id="continue">Start with morning check-in</button>
      </div>
    `;
    document.getElementById('continue').addEventListener('click', () => navigate('morning'));
  } catch (err) {
    console.error('Setup failed', err);
    view.innerHTML = `
      <div class="center-screen">
        <h1>Setup hit an error</h1>
        <div class="error">${err.message}</div>
        <button class="btn btn-ghost" id="retry">Try again</button>
      </div>
    `;
    document.getElementById('retry').addEventListener('click', () => navigate('setup'));
  }
}
