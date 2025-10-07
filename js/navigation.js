// Navigation et gestion des vues détaillées pour le dashboard MUSO
// Réplique la structure de navigation de l'application mobile Flutter

class NavigationManager {
  constructor() {
    this.currentView = 'overview';
    this.viewHistory = [];
  }

  // Navigation vers les vues détaillées
  navigateToReports() {
    this.openDetailedView('reports-detailed-view.html', 'Signalements');
  }

  navigateToSuspiciousAccounts() {
    this.openDetailedView('suspicious-accounts-view.html', 'Comptes suspects');
  }

  navigateToBlockedAccounts() {
    this.openDetailedView('blocked-accounts-view.html', 'Comptes bloqués');
  }

  navigateToActiveUsers() {
    this.openDetailedView('active-users-view.html', 'Utilisateurs actifs');
  }

  navigateToAllUsers() {
    this.openDetailedView('all-users-view.html', 'Tous les utilisateurs');
  }

  navigateToAdminUsers() {
    this.openDetailedView('admin-users-view.html', 'Administrateurs');
  }

  openDetailedView(filename, title) {
    // Sauvegarder l'URL actuelle dans l'historique
    this.viewHistory.push(window.location.href);
    
    // Ouvrir la vue détaillée
    window.location.href = `views/${filename}`;
    
    console.log(`📱 Navigation vers: ${title}`);
  }

  goBack() {
    if (this.viewHistory.length > 0) {
      const previousUrl = this.viewHistory.pop();
      window.location.href = previousUrl;
    } else {
      window.location.href = 'index.html';
    }
  }
}

// Gestionnaire global de navigation
window.navigationManager = new NavigationManager();

// Fonction pour rendre les cartes métriques cliquables
function setupMetricCardNavigation() {
  // Carte Signalements
  const reportsCard = document.querySelector('[data-action="navigate-reports"]');
  if (reportsCard) {
    reportsCard.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigationManager.navigateToReports();
    });
  }

  // Carte Comptes suspects
  const suspiciousCard = document.querySelector('[data-action="navigate-suspicious"]');
  if (suspiciousCard) {
    suspiciousCard.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigationManager.navigateToSuspiciousAccounts();
    });
  }

  // Carte Utilisateurs actifs
  const activeUsersCard = document.querySelector('[data-action="navigate-active-users"]');
  if (activeUsersCard) {
    activeUsersCard.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigationManager.navigateToActiveUsers();
    });
  }

  // Carte Total utilisateurs
  const totalUsersCard = document.querySelector('[data-action="navigate-total-users"]');
  if (totalUsersCard) {
    totalUsersCard.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigationManager.navigateToAllUsers();
    });
  }

  // Carte Administrateurs
  const adminUsersCard = document.querySelector('[data-action="navigate-admin-users"]');
  if (adminUsersCard) {
    adminUsersCard.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigationManager.navigateToAdminUsers();
    });
  }

  // Carte Comptes bloqués
  const blockedAccountsCard = document.querySelector('[data-action="navigate-blocked-accounts"]');
  if (blockedAccountsCard) {
    blockedAccountsCard.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigationManager.navigateToBlockedAccounts();
    });
  }

  // Ajouter l'indicateur visuel de cliquabilité
  document.querySelectorAll('.metric-card.clickable').forEach(card => {
    card.style.cursor = 'pointer';
    card.style.transition = 'transform 0.2s, box-shadow 0.2s';
    
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '';
    });
  });

  console.log('✅ Navigation des cartes métriques configurée');
}

// Initialiser la navigation au chargement
document.addEventListener('DOMContentLoaded', () => {
  setupMetricCardNavigation();
});

// Export pour utilisation dans d'autres modules
window.setupMetricCardNavigation = setupMetricCardNavigation;
