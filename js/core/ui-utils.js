// UI utility helpers (format, badges, pagination)

export function formatDateSmart(date) {
  if (!date) return 'N/A';
  if (typeof date === 'string') date = new Date(date);
  const now = new Date();
  const diff = now - date;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  if (h < 24) return `Il y a ${h}h`;
  if (d < 7) return `Il y a ${d}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(str='') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function paginate(array, page, perPage) {
  const start = page * perPage;
  return array.slice(start, start + perPage);
}

export function statusBadge(status) {
  const map = { pending: 'En attente', confirmed: 'Confirmé', denied: 'Rejeté' };
  return `<span class="report-status ${status || 'pending'}">${map[status] || 'En attente'}</span>`;
}

export function chip(label, active=false) {
  return `<button class="filter-btn ${active ? 'active':''}" data-chip="${label}">${label}</button>`;
}
