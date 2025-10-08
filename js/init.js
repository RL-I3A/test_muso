// Initialisation et vérification des services
window.MUSO = window.MUSO || {};

// Flag pour savoir si les services sont prêts
window.MUSO.servicesReady = false;

// File d'attente pour les actions en attente
window.MUSO.pendingActions = [];

// Fonction pour exécuter une action quand les services sont prêts
window.MUSO.executeWhenReady = function(action) {
  if (window.MUSO.servicesReady) {
    action();
  } else {
    window.MUSO.pendingActions.push(action);
  }
};

// Vérification périodique des services
function checkServices() {
  const hasFirebase = typeof firebase !== 'undefined';
  const hasFirebaseServices = typeof window.FirebaseServices !== 'undefined';
  const hasAdminActions = typeof window.AdminActionsService !== 'undefined';
  const hasProfileModal = typeof window.openProfileModal !== 'undefined';
  
  console.log('🔍 Checking services:', {
    firebase: hasFirebase,
    firebaseServices: hasFirebaseServices,
    adminActions: hasAdminActions,
    profileModal: hasProfileModal
  });
  
  if (hasFirebase && hasFirebaseServices && hasAdminActions) {
    window.MUSO.servicesReady = true;
    console.log('✅ All services ready!');
    
    // Exécuter les actions en attente
    window.MUSO.pendingActions.forEach(action => {
      try {
        action();
      } catch (e) {
        console.error('❌ Error executing pending action:', e);
      }
    });
    window.MUSO.pendingActions = [];
    
    return true;
  }
  
  return false;
}

// Vérifier toutes les 100ms jusqu'à ce que tout soit prêt
const checkInterval = setInterval(() => {
  if (checkServices()) {
    clearInterval(checkInterval);
  }
}, 100);

// Timeout de sécurité
setTimeout(() => {
  if (!window.MUSO.servicesReady) {
    console.error('❌ Services not ready after 10 seconds');
    clearInterval(checkInterval);
  }
}, 10000);

console.log('🚀 MUSO Services initialization started');