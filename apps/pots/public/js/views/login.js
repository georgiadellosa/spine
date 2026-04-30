import { signIn } from '../auth.js';
import { navigate } from '../router.js';
import { getSheetId } from '../store.js';
import { icon } from '../icons.js';

export async function render(view) {
  view.innerHTML = `
    <div class="center-screen">
      <div class="icon-large" style="color: var(--gold);">${icon('coin', 72)}</div>
      <div class="wordmark" style="color: var(--gold); font-family: 'Iowan Old Style', 'Charter', 'Georgia', serif;">Pots</div>
      <p style="max-width: 320px; font-size: 16px;">Where the money actually goes. Honest, non-judgmental, your data.</p>
      <button class="btn" id="signin" style="max-width: 320px; background: var(--gold);">
        ${icon('google', 20)}
        Continue with Google
      </button>
      <p class="faint" style="max-width: 320px; line-height: 1.5;">
        Pots reads and writes only to your own Google Sheets and Drive.
        Your transactions never touch our server.
      </p>
    </div>
  `;
  document.getElementById('signin').addEventListener('click', async () => {
    try {
      await signIn();
      if (getSheetId()) navigate('home');
      else navigate('setup');
    } catch (err) {
      console.error('Sign-in failed', err);
      view.querySelector('.center-screen').insertAdjacentHTML('beforeend',
        `<div class="error" style="max-width: 320px;">Sign-in failed: ${err.message}</div>`);
    }
  });
}
