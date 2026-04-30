import { initAuth, isAuthed } from './auth.js';
import { initRouter, navigate } from './router.js';
import { getSheetId, getLastCheckin } from './store.js';

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
    return;
  }
  if (!getSheetId()) {
    navigate('setup');
    return;
  }

  // If hash already points somewhere, go there
  const hashRoute = location.hash.replace('#/', '');
  if (hashRoute && hashRoute !== 'login' && hashRoute !== 'setup') {
    navigate(hashRoute);
    return;
  }

  // Recovery mode — 4+ days since last check-in
  const last = getLastCheckin();
  if (last) {
    const daysAgo = Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo >= 4) {
      navigate('recovery');
      return;
    }
  }

  navigate('morning');
}

bootstrap();
