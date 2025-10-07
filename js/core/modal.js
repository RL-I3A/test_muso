// Generic modal open/close

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

export function buildAndShowModal({ id, title, bodyHtml, actions=[] }) {
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement('div');
    container.id = id;
    container.className = 'modal';
    document.body.appendChild(container);
  }
  container.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="close-btn" data-close>
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions">
        ${actions.map(a => `<button class="action-btn" data-action="${a.id}">${a.icon ? `<span class='material-icons'>${a.icon}</span>`:''}${a.label}</button>`).join('')}
      </div>
    </div>`;
  container.style.display = 'flex';
  container.querySelector('[data-close]')?.addEventListener('click', ()=> closeModal(id));
  actions.forEach(a => {
    container.querySelector(`[data-action="${a.id}"]`)?.addEventListener('click', a.onClick);
  });
}
