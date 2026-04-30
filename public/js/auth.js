const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar'
].join(' ');

let tokenClient = null;
let accessToken = null;
let expiresAt = 0;
let pendingResolvers = [];
let inFlight = false;

export async function initAuth() {
  await new Promise(resolve => {
    const check = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
  const cfg = window.__SPINE_CONFIG__ || {};
  if (!cfg.googleClientId) {
    throw new Error('GOOGLE_CLIENT_ID not set on server');
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: cfg.googleClientId,
    scope: SCOPES,
    callback: (response) => {
      inFlight = false;
      const resolvers = pendingResolvers;
      pendingResolvers = [];
      if (response.error) {
        const error = new Error(response.error_description || response.error);
        resolvers.forEach(({ reject }) => reject(error));
      } else {
        accessToken = response.access_token;
        expiresAt = Date.now() + (response.expires_in || 3600) * 1000 - 60000;
        resolvers.forEach(({ resolve }) => resolve(accessToken));
      }
    }
  });
}

export function isAuthed() {
  return Boolean(accessToken) && Date.now() < expiresAt;
}

export function signIn() {
  return requestToken({ prompt: '' });
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  expiresAt = 0;
}

function requestToken({ prompt = '' } = {}) {
  return new Promise((resolve, reject) => {
    pendingResolvers.push({ resolve, reject });
    if (!inFlight) {
      inFlight = true;
      tokenClient.requestAccessToken({ prompt });
    }
  });
}

export async function getAccessToken() {
  if (isAuthed()) return accessToken;
  return requestToken({ prompt: '' });
}

export async function withFreshToken(fn) {
  const token = await getAccessToken();
  return fn(token);
}
