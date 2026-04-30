import { icon } from './icons.js';
import { attachCaptureFab, showFab } from './capture.js';

const VIEWS = {
  login: () => import('./views/login.js'),
  setup: () => import('./views/setup.js'),
  morning: () => import('./views/morning.js'),
  evening: () => import('./views/evening.js'),
  sunday: () => import('./views/sunday.js'),
  friday: () => import('./views/friday.js'),
  calendar: () => import('./views/calendar.js'),
  wins: () => import('./views/wins.js'),
  patterns: () => import('./views/patterns.js'),
  settings: () => import('./views/settings.js'),
  quarterly: () => import('./views/quarterly.js'),
  recovery: () => import('./views/recovery.js'),
  inbox: () => import('./views/inbox.js'),
  parking: () => import('./views/parking.js'),
  data: () => import('./views/data.js'),
  'brain-dumps': () => import('./views/brain-dumps.js'),
  money: () => import('./views/money.js')
};

const NAV = [
  { route: 'morning', label: 'Today', icon: 'sun' },
  { route: 'evening', label: 'Evening', icon: 'moon' },
  { route: 'money', label: 'Money', icon: 'coin' },
  { route: 'wins', label: 'Wins', icon: 'sparkle' },
  { route: 'settings', label: 'More', icon: 'more' }
];
const NAV_ROUTES = NAV.map(n => n.route);
const FAB_ROUTES = [...NAV_ROUTES, 'evening', 'patterns', 'inbox', 'parking', 'data', 'quarterly', 'friday', 'brain-dumps'];

export async function navigate(name, params = {}) {
  const hash = `#/${name}`;
  if (location.hash !== hash) location.hash = hash;
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');
  const loader = VIEWS[name];
  if (!loader) {
    view.innerHTML = `<div class="error">No view "${name}"</div>`;
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
  nav.hidden = !NAV_ROUTES.includes(name);
  if (!nav.hidden) {
    nav.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.dataset.route === name);
    });
  }
  showFab(FAB_ROUTES.includes(name));
}

export function initRouter() {
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(n => `
    <a href="#/${n.route}" data-route="${n.route}">
      ${icon(n.icon, 22)}
      <span>${n.label}</span>
    </a>
  `).join('');

  attachCaptureFab();

  window.addEventListener('hashchange', () => {
    const route = location.hash.replace('#/', '') || 'morning';
    navigate(route);
  });
  nav.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-route]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.route);
    }
  });
}
