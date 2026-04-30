import { signOut } from '../auth.js';
import { clearAll, getSheetId, getDriveFolderId } from '../store.js';
import { navigate } from '../router.js';

export async function render(view) {
  view.innerHTML = `
    <h1>More</h1>

    <div class="card">
      <h2 style="margin-top: 0;">Rituals</h2>
      <p style="margin-bottom: 8px;"><a href="#/sunday" style="color: var(--accent); font-weight: 500;">Sunday Decision →</a></p>
      <p style="margin-bottom: 8px;"><a href="#/friday" style="color: var(--accent); font-weight: 500;">Friday Close →</a></p>
      <p style="margin-bottom: 0;"><a href="#/quarterly" style="color: var(--accent); font-weight: 500;">Quarterly Spine →</a></p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Your data</h2>
      <p class="muted" style="font-size: 13px;">Everything lives in your Google account.</p>
      <p style="margin-bottom: 6px;"><a href="https://docs.google.com/spreadsheets/d/${getSheetId()}" target="_blank" style="color: var(--accent);">Open spreadsheet ↗</a></p>
      <p style="margin-bottom: 6px;"><a href="https://drive.google.com/drive/folders/${getDriveFolderId()}" target="_blank" style="color: var(--accent);">Open Drive folder ↗</a></p>
      <p style="margin-bottom: 0;"><a href="https://calendar.google.com/calendar/u/0/r" target="_blank" style="color: var(--accent);">Open Google Calendar ↗</a></p>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Stop / Start / Keep</h2>
      <p class="muted" style="font-size: 13px;">From the master plan. Reviewed Friday.</p>
      <p style="font-weight: 500; margin: 12px 0 6px;">STOP</p>
      <ul class="muted" style="margin: 0 0 12px 20px; font-size: 14px;">
        <li>Starting new app projects</li>
        <li>Designing four products simultaneously</li>
        <li>Holding deadlines in your head — they live in Spine</li>
        <li>Building skills/plugins faster than you use them</li>
        <li>ConnectWell decisions in isolation</li>
      </ul>
      <p style="font-weight: 500; margin: 12px 0 6px;">START</p>
      <ul class="muted" style="margin: 0 0 12px 20px; font-size: 14px;">
        <li>Friday close, 20 min</li>
        <li>Sunday decision, 30 min</li>
        <li>Quarterly "what dies" review</li>
        <li>Using the ND scheduler on yourself daily</li>
        <li>One commercial finish line for G-HAMR</li>
      </ul>
      <p style="font-weight: 500; margin: 12px 0 6px;">KEEP</p>
      <ul class="muted" style="margin: 0 0 0 20px; font-size: 14px;">
        <li>PhD as the spine</li>
        <li>ConnectWell engagement</li>
        <li>Co-regulation-first parenting</li>
        <li>georgia-context + skills layer</li>
        <li>R + lavaan as analytical home</li>
      </ul>
    </div>

    <div class="card">
      <h2 style="margin-top: 0;">Account</h2>
      <button class="btn btn-ghost" id="signout">Sign out</button>
      <p class="muted" style="font-size: 12px; margin-top: 12px;">Sign out doesn't delete your data — it stays in your Google account. To wipe Spine, delete the Spine spreadsheet, Drive folder, and calendar manually.</p>
    </div>
  `;
  document.getElementById('signout').addEventListener('click', () => {
    if (!confirm('Sign out?')) return;
    signOut();
    clearAll();
    navigate('login');
  });
}
