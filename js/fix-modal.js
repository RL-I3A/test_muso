// Script de correction pour fermer tous les modals et restaurer le dashboard
console.log('🔧 Fixing modal issues...');

// Forcer la fermeture de tous les modals
function closeAllModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (modal) {
      modal.style.display = 'none';
      modal.remove();
    }
  });
  
  // Supprimer tous les modals créés dynamiquement
  const dynamicModals = document.querySelectorAll('[class*="modal"]');
  dynamicModals.forEach(modal => {
    if (modal.style.display === 'flex' || modal.style.display === 'block') {
      modal.style.display = 'none';
    }
  });
  
  console.log('✅ All modals closed');
}

// Restaurer le dashboard principal
function restoreDashboard() {
  const dashboard = document.getElementById('main-dashboard');
  const loadingScreen = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const accessDenied = document.getElementById('access-denied-screen');
  
  if (dashboard) {
    dashboard.style.display = 'block';
    console.log('✅ Dashboard restored');
  }
  
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  if (loginScreen) {
    loginScreen.style.display = 'none';
  }
  
  if (accessDenied) {
    accessDenied.style.display = 'none';
  }
}

// Nettoyer le body des modals orphelins
function cleanupOrphanModals() {
  const body = document.body;
  const children = Array.from(body.children);
  
  children.forEach(child => {
    if (child.classList.contains('modal') || 
        child.style.position === 'fixed' ||
        child.style.zIndex > 1000) {
      child.remove();
      console.log('🗑️ Removed orphan modal');
    }
  });
}

// Exécuter le fix
function fixModalIssues() {
  closeAllModals();
  cleanupOrphanModals();
  restoreDashboard();
  
  // Réinitialiser le body overflow
  document.body.style.overflow = '';
  
  console.log('✅ Modal fix complete - Dashboard should be visible now');
}

// Auto-exécution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fixModalIssues);
} else {
  fixModalIssues();
}

// Exposer globalement pour usage manuel
window.fixModalIssues = fixModalIssues;