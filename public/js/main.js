import { initAuth, isAuthed } from './auth.js';
import { initRouter, navigate } from './router.js';
import { getSheetId } from './store.js';

async function bootstrap() {
  try {
    await initAuth();
  } catch (err) {
    console.error('Auth init failed', err);
    document.getElementById('view').innerHTML =
      `<div class="error">Auth setup failed: ${err.message}<br>Check that GOOGLE_CLIENT_ID is set on the server.</div>`;
    return;
  }
  initRouter();
  if (!isAuthed()) {
    navigate('login');
  } else if (!getSheetId()) {
    navigate('setup');
  } else {
    const route = location.hash.replace('#/', '') || 'morning';
    navigate(route);
  }
}

bootstrap();
