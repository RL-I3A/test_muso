// New modular reports view
import { db } from '../core/firebase.js';
import { formatDateSmart, escapeHtml, paginate, statusBadge } from '../core/ui-utils.js';
import { buildAndShowModal } from '../core/modal.js';
import { showUserProfile } from '../core/profile.js';

let allReports = [];
let filtered = [];
let page = 0;
const PER_PAGE = 25;
let statusFilter = 'all';
let currentReport = null;

const typeLabels = {
  'Retard': '⏱️ Retard',
  'Annulation': '🚫 Annulation',
  'Probleme_Vehicule': '🔧 Véhicule',
  'Surcharge': '👥 Surcharge',
  'Comportement_Conducteur': '⚠️ Conducteur',
  'Securite': '🛡️ Sécurité',
  'Proprete': '🧹 Propreté',
  'Acces_PMR': '♿ PMR',
  'Information_Voyageurs': 'ℹ️ Info',
  'Autre': '❓ Autre'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('📊 Reports view (modulaire) init');
  attachEvents();
  await loadReports();
}

// Back navigation compatibility (old goBack())
function goBack() {
  // Fallback to index
  window.location.href = '../index.html';
}

function attachEvents() {
  document.getElementById('search-input')?.addEventListener('input', applyFilters);
  document.querySelectorAll('[data-status-filter]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilter = btn.getAttribute('data-status-filter');
      document.querySelectorAll('[data-status-filter]').forEach(b=> b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
  document.getElementById('prev-page')?.addEventListener('click', ()=> { if(page>0){ page--; render(); }});
  document.getElementById('next-page')?.addEventListener('click', ()=> { const total = Math.ceil(filtered.length / PER_PAGE); if(page < total-1){ page++; render(); }});
}

async function loadReports() {
  const spinner = document.getElementById('loading-spinner');
  const listEl = document.getElementById('reports-list');
  const emptyEl = document.getElementById('empty-state');
  spinner.style.display = 'flex';
  listEl.style.display = 'none';
  emptyEl.style.display = 'none';
  try {
    const snap = await db.collection('report').orderBy('timestamp', 'desc').limit(500).get();
    allReports = snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate(), resolvedAt: d.data().resolvedAt?.toDate() }));
    console.log(`✅ ${allReports.length} reports loaded`);
    applyFilters();
  } catch(e) {
    console.error('❌ loadReports failed', e);
  } finally {
    spinner.style.display = 'none';
  }
}

function applyFilters() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  filtered = allReports.filter(r => {
    if (q) {
      const stop = (r.stopName||'').toLowerCase();
      if (!stop.includes(q) && !r.id.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'all') {
      if ((r.status || 'pending') !== statusFilter) return false;
    }
    return true;
  });
  filtered.sort((a,b)=> (b.timestamp||0) - (a.timestamp||0));
  page = 0;
  render();
  updateCounts();
}

// Legacy compatibility wrappers expected by old HTML attributes
function setStatusFilter(status) {
  statusFilter = status;
  document.querySelectorAll('[data-status]')?.forEach(b=> b.classList.remove('active'));
  // If old markup uses data-status instead of data-status-filter
  const btn = document.querySelector(`[data-status="${status}"]`);
  if (btn) btn.classList.add('active');
  applyFilters();
}

function previousPage() {
  if (page > 0) { page--; render(); updateCounts(); }
}

function nextPage() {
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  if (page < totalPages - 1) { page++; render(); updateCounts(); }
}

function updateCounts() {
  document.getElementById('total-reports')?.textContent = allReports.length;
  document.getElementById('filtered-reports')?.textContent = filtered.length;
  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  document.getElementById('current-page-info')?.textContent = `${page+1}/${totalPages}`;
  document.getElementById('pagination-info')?.textContent = `Page ${page+1} / ${totalPages}`;
  document.getElementById('prev-page').disabled = page === 0;
  document.getElementById('next-page').disabled = page >= totalPages-1;
}

function render() {
  const listEl = document.getElementById('reports-list');
  const emptyEl = document.getElementById('empty-state');
  if (!filtered.length) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    return;
  }
  const pageItems = paginate(filtered, page, PER_PAGE);
  listEl.innerHTML = pageItems.map(r => reportCard(r)).join('');
  listEl.style.display = 'grid';
  emptyEl.style.display = 'none';
}

function reportCard(r) {
  return `<div class="report-card" data-id="${r.id}" onclick="window.__reportsView.openDetails('${r.id}')">
    <div class="report-header">
      <span class="report-type">${typeLabels[r.type] || r.type || '❓'}</span>
      ${statusBadge(r.status || 'pending')}
    </div>
    <h3 class="report-stop">${escapeHtml(r.stopName || 'Arrêt inconnu')}</h3>
    <p class="report-desc">${escapeHtml((r.description||'').slice(0,140))}${r.description && r.description.length>140 ? '…':''}</p>
    <div class="report-meta">
      <span class="meta-item">${formatDateSmart(r.timestamp)}</span>
      <span class="meta-item">ID: ${r.id.substring(0,8)}…</span>
    </div>
  </div>`;
}

function openDetails(id) {
  currentReport = allReports.find(r => r.id === id);
  if (!currentReport) return;
  const r = currentReport;
  const body = `
    <div class='details-section'>
      <h3>${escapeHtml(r.stopName || 'Arrêt inconnu')}</h3>
      <div class='detail-row'><strong>Type:</strong> ${typeLabels[r.type] || r.type}</div>
      <div class='detail-row'><strong>Statut:</strong> ${statusBadge(r.status || 'pending')}</div>
      <div class='detail-row'><strong>Description:</strong><br>${escapeHtml(r.description || 'Aucune')}</div>
      <div class='detail-row'><strong>Utilisateur:</strong> ${r.userID || 'Anonyme'} ${r.userID ? `<button class='mini-btn' data-profile='${r.userID}'>Voir profil</button>`:''}</div>
      <div class='detail-row'><strong>Date:</strong> ${r.timestamp ? formatDateSmart(r.timestamp) : 'N/A'}</div>
      <div class='detail-row'><strong>ID:</strong> ${r.id}</div>
    </div>`;
  buildAndShowModal({
    id: 'report-details-modal',
    title: 'Détails signalement',
    bodyHtml: body,
    actions: [
      { id: 'confirm', label: 'Confirmer', icon: 'check', onClick: ()=>moderationAction('confirm') },
      { id: 'deny', label: 'Rejeter', icon: 'close', onClick: ()=>moderationAction('deny') },
      { id: 'delete', label: 'Supprimer', icon: 'delete', onClick: deleteReport },
      { id: 'close', label: 'Fermer', onClick: ()=>{} }
    ]
  });
  setTimeout(()=>{
    document.querySelector('[data-profile]')?.addEventListener('click', (e)=> {
      const uid = e.target.getAttribute('data-profile');
      showUserProfile(uid);
    });
  }, 50);
}

async function moderationAction(kind) {
  if (!currentReport) return;
  try {
    const ref = db.collection('report').doc(currentReport.id);
    if (kind === 'confirm') {
      await ref.update({ status: 'confirmed', resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } else if (kind === 'deny') {
      await ref.update({ status: 'denied', resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    await loadReports();
  } catch(e) {
    console.error('Action failed', e);
  }
}

async function deleteReport() {
  if (!currentReport) return;
  if (!confirm('Supprimer ce signalement ?')) return;
  try {
    await db.collection('report').doc(currentReport.id).delete();
    await loadReports();
  } catch(e) { console.error('Delete failed', e); }
}

// Expose for inline handlers
window.__reportsView = { openDetails };

// Expose legacy globals for existing inline handlers in HTML
window.goBack = goBack;
window.loadReports = loadReports;
window.applyFilters = applyFilters;
window.setStatusFilter = setStatusFilter;
window.previousPage = previousPage;
window.nextPage = nextPage;
