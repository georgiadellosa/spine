import { signIn } from '../auth.js';
import { navigate } from '../router.js';
import { getSheetId } from '../store.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <h1>Spine</h1>
      <p>Daily anchor for the things that matter.</p>
      <button class="btn" id="signin">Sign in with Google</button>
      <p class="muted" style="font-size: 13px; max-width: 320px;">
        Spine reads and writes only to your own Google Sheets, Drive, and Calendar.
        Nothing about your content is stored on the server.
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
        `<div class="error">Sign-in failed: ${err.message}</div>`);
    }
  });
}
