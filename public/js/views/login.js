import { signIn } from '../auth.js';
import { navigate } from '../router.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large">${icon('leaf', 72)}</div>
      <div class="wordmark">Spine</div>
      <p style="max-width: 320px; font-size: 16px;">Daily anchor for the things that matter. One priority. One ritual at a time.</p>
      <button class="btn" id="signin" style="max-width: 320px;">
        ${icon('google', 20)}
        Continue with Google
      </button>
      <p class="faint" style="max-width: 320px; line-height: 1.5;">
        Spine reads and writes only to your own Google Sheets, Drive, and Calendar.
        Your content never touches our server.
      </p>
    </div>
  `;
  document.getElementById('signin').addEventListener('click', async () => {
    try {
      await signIn();
      if (getSheetId()) navigate('morning');
      else navigate('setup');
    } catch (err) {
      console.error('Sign-in failed', err);
      view.querySelector('.center-screen').insertAdjacentHTML('beforeend',
        `<div class="error" style="max-width: 320px;">Sign-in failed: ${err.message}</div>`);
    }
  });
}
