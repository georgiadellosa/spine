import { icon } from './icons.js';

const VIEWS = {
  login: () => import('./views/login.js'),
  setup: () => import('./views/setup.js'),
  onboarding: () => import('./views/onboarding.js'),
  money: () => import('./views/money.js'),
  transactions: () => import('./views/transactions.js'),
  categories: () => import('./views/categories.js'),
  bills: () => import('./views/bills.js'),
  accounts: () => import('./views/accounts.js'),
  debts: () => import('./views/debts.js'),
  settings: () => import('./views/settings.js')
};

const NAV = [
  { route: 'money', label: 'Money', icon: 'coin' },
  { route: 'transactions', label: 'Txns', icon: 'doIt' },
  { route: 'debts', label: 'Debts', icon: 'flame' },
  { route: 'bills', label: 'Bills', icon: 'bill' },
  { route: 'settings', label: 'More', icon: 'more' }
];
const NAV_ROUTES = NAV.map(n => n.route);

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
}

export function initRouter() {
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(n => `
    <a href="#/${n.route}" data-route="${n.route}">
      ${icon(n.icon, 22)}
      <span>${n.label}</span>
    </a>
  `).join('');

  window.addEventListener('hashchange', () => {
    const route = location.hash.replace('#/', '') || 'money';
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
