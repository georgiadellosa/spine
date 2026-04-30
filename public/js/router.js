const VIEWS = {
  login: () => import('./views/login.js'),
  setup: () => import('./views/setup.js'),
  morning: () => import('./views/morning.js'),
  evening: () => import('./views/evening.js')
};

const NAV_ROUTES = ['morning', 'evening', 'calendar', 'wins', 'settings'];

export async function navigate(name, params = {}) {
  const hash = `#/${name}`;
  if (location.hash !== hash) location.hash = hash;
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');
  const loader = VIEWS[name];
  if (!loader) {
    view.innerHTML = `<div class="error">Coming in Weekend 2 — "${name}" not built yet.</div>`;
    nav.hidden = !NAV_ROUTES.includes(name);
    return;
  }
  view.innerHTML = `<div class="center-screen"><div class="spinner"></div></div>`;
  try {
    const mod = await loader();
    await mod.render(view, params);
  } catch (err) {
    console.error('Route render failed', err);
    view.innerHTML = `<div class="error">Couldn't load this screen. ${err.message || ''}</div>`;
  }
  if (NAV_ROUTES.includes(name)) {
    nav.hidden = false;
    nav.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === name);
    });
  } else {
    nav.hidden = true;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', () => {
    const route = location.hash.replace('#/', '') || 'morning';
    navigate(route);
  });
  document.getElementById('nav').addEventListener('click', (e) => {
    const link = e.target.closest('a[data-route]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.route);
    }
  });
}
