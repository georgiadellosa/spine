import { icon } from './icons.js';

export function eventModal({ event = null, defaultStart, defaultEnd, defaultCalendarId, calendars = [] } = {}) {
  const isEdit = !!event;
  return new Promise((resolve) => {
    const start = event?.start || defaultStart || new Date();
    const end = event?.end || defaultEnd || new Date(new Date(start).getTime() + 60 * 60 * 1000);
    const currentCalId = event?.calendarId || defaultCalendarId || calendars[0]?.id;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card">
        <div class="row between mb-4">
          <h2 style="margin: 0;">${isEdit ? 'Edit event' : 'New event'}</h2>
          <button class="modal-close" id="ev-close">${icon('drop', 22)}</button>
        </div>
        <div class="field">
          <label>Title</label>
          <input type="text" id="ev-title" value="${escAttr(event?.title || '')}" placeholder="What's happening?" />
        </div>
        <div class="row" style="gap: 10px;">
          <div class="field" style="flex: 1; min-width: 0;">
            <label>Starts</label>
            <input type="datetime-local" id="ev-start" value="${formatLocal(start)}" />
          </div>
          <div class="field" style="flex: 1; min-width: 0;">
            <label>Ends</label>
            <input type="datetime-local" id="ev-end" value="${formatLocal(end)}" />
          </div>
        </div>
        <div class="field">
          <label>Calendar</label>
          <select id="ev-cal">
            ${calendars.map(c => `
              <option value="${escAttr(c.id)}" ${c.id === currentCalId ? 'selected' : ''}>
                ${escHtml(c.summary)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="row" style="gap: 10px; margin-top: 8px;">
          ${isEdit ? `<button class="row-icon-btn danger" id="ev-delete" style="width: 56px; height: 56px; border-radius: 14px;" title="Delete event">${icon('drop', 18)}</button>` : ''}
          <button class="btn btn-ghost" id="ev-cancel" style="flex: 1;">Cancel</button>
          <button class="btn" id="ev-save" style="flex: 1;">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.querySelector('#ev-title').focus(), 80);

    const onEsc = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onEsc);

    function done(result) {
      document.removeEventListener('keydown', onEsc);
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 180);
      resolve(result);
    }

    modal.querySelector('#ev-close').addEventListener('click', () => done(null));
    modal.querySelector('#ev-cancel').addEventListener('click', () => done(null));
    modal.querySelector('.modal-backdrop').addEventListener('click', () => done(null));
    if (isEdit) {
      modal.querySelector('#ev-delete').addEventListener('click', () => done({ delete: true }));
    }
    modal.querySelector('#ev-save').addEventListener('click', () => {
      const title = modal.querySelector('#ev-title').value.trim();
      if (!title) {
        modal.querySelector('#ev-title').focus();
        return;
      }
      const startVal = modal.querySelector('#ev-start').value;
      const endVal = modal.querySelector('#ev-end').value;
      done({
        title,
        start: new Date(startVal),
        end: new Date(endVal),
        calendarId: modal.querySelector('#ev-cal').value
      });
    });
  });
}

function formatLocal(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
