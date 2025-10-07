// Gestion de la vue détaillée des signalements
// Réplique la logique de l'application mobile Flutter

let allReports = [];
let filteredReports = [];
let currentPage = 0;
const reportsPerPage = 25;
let currentStatusFilter = 'all';
let currentReport = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 Initialisation de la vue Signalements');
  loadReports();
});

// Navigation
function goBack() {
  window.location.href = '../index.html';
}

// Chargement des signalements
async function loadReports() {
  console.log('🔍 Chargement des signalements...');
  
  const spinner = document.getElementById('loading-spinner');
  const reportsList = document.getElementById('reports-list');
  const emptyState = document.getElementById('empty-state');
  
  spinner.style.display = 'flex';
  reportsList.style.display = 'none';
  emptyState.style.display = 'none';
  
  try {
    const snapshot = await FirebaseServices.firestore
      .collection('report')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
    
    allReports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
      resolvedAt: doc.data().resolvedAt?.toDate()
    }));
    
    console.log(`✅ ${allReports.length} signalements chargés`);
    
    applyFilters();
    updateCounts();
    renderReports();
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement:', error);
    showError('Erreur lors du chargement des signalements');
  } finally {
    spinner.style.display = 'none';
  }
}

// Filtres
function applyFilters() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  
  filteredReports = allReports.filter(report => {
    // Filtre par recherche
    if (searchQuery) {
      const stopName = (report.stopName || '').toLowerCase();
      const reportId = (report.id || '').toLowerCase();
      if (!stopName.includes(searchQuery) && !reportId.includes(searchQuery)) {
        return false;
      }
    }
    
    // Filtre par statut
    if (currentStatusFilter !== 'all') {
      const status = report.status || 'pending';
      if (status !== currentStatusFilter) {
        return false;
      }
    }
    
    return true;
  });
  
  // Trier par date (plus récents en premier)
  filteredReports.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return b.timestamp - a.timestamp;
  });
  
  currentPage = 0;
  renderReports();
  updateStats();
}

function setStatusFilter(status) {
  currentStatusFilter = status;
  
  // Mettre à jour les boutons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    }
  });
  
  applyFilters();
}

// Mise à jour des compteurs
function updateCounts() {
  const counts = {
    all: allReports.length,
    pending: allReports.filter(r => (r.status || 'pending') === 'pending').length,
    confirmed: allReports.filter(r => r.status === 'confirmed').length,
    denied: allReports.filter(r => r.status === 'denied').length
  };
  
  Object.keys(counts).forEach(key => {
    const countEl = document.getElementById(`count-${key}`);
    if (countEl) countEl.textContent = counts[key];
  });
  
  document.getElementById('total-reports').textContent = allReports.length;
}

function updateStats() {
  document.getElementById('filtered-reports').textContent = filteredReports.length;
  
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  const currentPageNum = currentPage + 1;
  
  document.getElementById('current-page-info').textContent = `${currentPageNum}/${totalPages || 1}`;
  document.getElementById('pagination-info').textContent = `Page ${currentPageNum} / ${totalPages || 1}`;
  
  // Boutons pagination
  document.getElementById('prev-page').disabled = currentPage === 0;
  document.getElementById('next-page').disabled = currentPage >= totalPages - 1 || totalPages === 0;
}

// Rendu des signalements
function renderReports() {
  const reportsList = document.getElementById('reports-list');
  const emptyState = document.getElementById('empty-state');
  
  if (filteredReports.length === 0) {
    reportsList.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }
  
  reportsList.style.display = 'flex';
  emptyState.style.display = 'none';
  
  const start = currentPage * reportsPerPage;
  const end = start + reportsPerPage;
  const pageReports = filteredReports.slice(start, end);
  
  reportsList.innerHTML = pageReports.map(report => createReportCard(report)).join('');
  
  updateStats();
}

function createReportCard(report) {
  const status = report.status || 'pending';
  const statusText = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    denied: 'Rejeté'
  }[status] || 'En attente';
  
  const typeText = getReportTypeText(report.type);
  const timestamp = formatDate(report.timestamp);
  
  return `
    <div class="enhanced-card clickable" onclick="showReportDetails('${report.id}')">
      <div class="card-header">
        <div class="card-avatar">
          <span class="material-icons">report_problem</span>
        </div>
        <div class="card-user-info">
          <div class="card-username">${report.stopName || 'Arrêt inconnu'}</div>
          <div class="card-subtitle">${report.id.substring(0, 8)}...</div>
          <div class="card-chips">
            <span class="chip ${status}">
              <span class="material-icons">${status === 'confirmed' ? 'check_circle' : status === 'denied' ? 'cancel' : 'schedule'}</span>
              ${statusText}
            </span>
            <span class="chip reputation-neutral">${typeText}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${report.userID ? `<button class="card-action-btn" onclick="openProfileModal('${report.userID}'); event.stopPropagation();"><span class="material-icons">person</span></button>` : ''}
          <div class="card-status ${status}">
            ${statusText}
          </div>
        </div>
      </div>
      
      ${report.description ? `
        <div class="card-body">
          <div class="card-details">
            <div class="detail-row">
              <span class="material-icons">description</span>
              <span class="detail-text">${escapeHtml(report.description)}</span>
            </div>
            <div class="detail-row">
              <span class="material-icons">person</span>
              <span class="detail-text"><strong>Utilisateur:</strong> ${report.userID ? report.userID.substring(0, 8) + '...' : 'Anonyme'}</span>
            </div>
            <div class="detail-row">
              <span class="material-icons">schedule</span>
              <span class="detail-text"><strong>Signalé:</strong> ${timestamp}</span>
            </div>
          </div>
        </div>
      ` : `
        <div class="card-body">
          <div class="card-details">
            <div class="detail-row">
              <span class="material-icons">person</span>
              <span class="detail-text"><strong>Utilisateur:</strong> ${report.userID ? report.userID.substring(0, 8) + '...' : 'Anonyme'}</span>
            </div>
            <div class="detail-row">
              <span class="material-icons">schedule</span>
              <span class="detail-text"><strong>Signalé:</strong> ${timestamp}</span>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

function getReportTypeText(type) {
  const types = {
    'Retard': '⏱️ Retard',
    'Annulation': '🚫 Annulation',
    'Probleme_Vehicule': '🔧 Problème véhicule',
    'Surcharge': '👥 Surcharge',
    'Comportement_Conducteur': '⚠️ Comportement conducteur',
    'Securite': '🛡️ Sécurité',
    'Proprete': '🧹 Propreté',
    'Acces_PMR': '♿ Accès PMR',
    'Information_Voyageurs': 'ℹ️ Information',
    'Autre': '❓ Autre'
  };
  return types[type] || type || '❓ Autre';
}

function formatDate(date) {
  if (!date) return 'Date inconnue';
  
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Pagination
function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    renderReports();
  }
}

function nextPage() {
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  if (currentPage < totalPages - 1) {
    currentPage++;
    renderReports();
  }
}

// Modal de détails
function showReportDetails(reportId) {
  currentReport = allReports.find(r => r.id === reportId);
  if (!currentReport) return;
  
  const modal = document.getElementById('report-modal');
  const modalBody = document.getElementById('modal-body');
  
  const status = currentReport.status || 'pending';
  const statusText = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    denied: 'Rejeté'
  }[status] || 'En attente';
  
  modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">📍 Arrêt</h3>
        <p style="font-size: 18px; color: #fff;">${currentReport.stopName || 'Arrêt inconnu'}</p>
      </div>
      
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">🏷️ Type</h3>
        <p style="color: #ccc;">${getReportTypeText(currentReport.type)}</p>
      </div>
      
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">📝 Description</h3>
        <p style="color: #ccc; line-height: 1.6;">${currentReport.description || 'Aucune description'}</p>
      </div>
      
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">📊 Statut</h3>
        <span class="report-status ${status}">${statusText}</span>
      </div>
      
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">👤 Utilisateur</h3>
        <div style="display: flex; align-items: center; gap: 12px;">
          <p style="color: #ccc; font-family: monospace; margin: 0;">${currentReport.userID || 'Anonyme'}</p>
          ${currentReport.userID ? `
            <button onclick="openProfileModal('${currentReport.userID}', { showModerationButtons: true })" 
                    style="background: rgba(187, 134, 252, 0.1); 
                           border: 1px solid rgba(187, 134, 252, 0.3); 
                           color: #bb86fc; 
                           padding: 6px 12px; 
                           border-radius: 6px; 
                           cursor: pointer; 
                           display: flex; 
                           align-items: center; 
                           gap: 4px;
                           font-size: 14px;
                           transition: all 0.2s;">
              <span class="material-icons" style="font-size: 18px;">person</span>
              Voir profil
            </button>
          ` : ''}
        </div>
      </div>
      
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">🕐 Date</h3>
        <p style="color: #ccc;">${currentReport.timestamp ? currentReport.timestamp.toLocaleString('fr-FR') : 'Date inconnue'}</p>
      </div>
      
      <div>
        <h3 style="color: #bb86fc; margin-bottom: 8px;">🔑 ID du signalement</h3>
        <p style="color: #ccc; font-family: monospace; word-break: break-all;">${currentReport.id}</p>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('report-modal').style.display = 'none';
  currentReport = null;
}

async function deleteReport() {
  if (!currentReport) return;
  
  if (!confirm(`Voulez-vous vraiment supprimer ce signalement ?\n\nArrêt: ${currentReport.stopName}\nType: ${getReportTypeText(currentReport.type)}`)) {
    return;
  }
  
  try {
    await FirebaseServices.firestore
      .collection('report')
      .doc(currentReport.id)
      .delete();
    
    console.log('✅ Signalement supprimé:', currentReport.id);
    closeModal();
    loadReports();
    
    showSuccess('Signalement supprimé avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    showError('Erreur lors de la suppression du signalement');
  }
}

// View user profile from report
// (Profil modal centralisé via openProfileModal dans core/profile.js)

// Notifications
function showSuccess(message) {
  // TODO: Implémenter un système de toast/notification
  alert(message);
}

function showError(message) {
  // TODO: Implémenter un système de toast/notification
  alert(message);
}

// Fermer modal en cliquant à l'extérieur
document.addEventListener('click', (e) => {
  const modal = document.getElementById('report-modal');
  if (e.target === modal) {
    closeModal();
  }
});
