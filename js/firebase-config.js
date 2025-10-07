// Configuration Firebase pour MUSO Moderation Dashboard
// IMPORTANT: Remplacez par vos vraies clés Firebase

// Configuration Firebase Web officielle pour MUSO Admin Dashboard
const firebaseConfig = {
  apiKey: "AIzaSyDiYXKGJq54SWejzY21zOhedLy8686QYnw",
  authDomain: "akha-448719.firebaseapp.com",
  projectId: "akha-448719",
  storageBucket: "akha-448719.firebasestorage.app",
  messagingSenderId: "321126205819",
  appId: "1:321126205819:web:6dabb5d90937ab901695de",
  measurementId: "G-625N87KHYC"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);

// Services Firebase
const auth = firebase.auth();
const firestore = firebase.firestore();

// Configuration d'authentification par email/mot de passe
// Pas besoin de provider supplémentaire pour email/password

// Configuration Firestore pour développement local (optionnel)
if (window.location.hostname === 'localhost') {
  console.log('🔧 Mode développement détecté');
  // Décommentez si vous utilisez l'émulateur Firestore
  // firestore.useEmulator('localhost', 8080);
}

// Configuration de sécurité pour l'interface web admin
const ADMIN_SECURITY = {
  // Liste blanche des emails administrateurs autorisés
  authorizedAdmins: [
    'bledofamille@hotmail.com'
    // Ajoutez d'autres admins ici si nécessaire
  ],
  
  // Vérification de sécurité renforcée
  maxLoginAttempts: 7,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  sessionTimeout: 2 * 60 * 60 * 1000, // 2 heures
  
  // Log des accès pour audit
  logSecurityEvents: true
};

// Export des services pour les autres modules
window.FirebaseServices = {
  auth,
  firestore,
  adminSecurity: ADMIN_SECURITY,
  
  // Collections utilisées dans l'application MUSO
  collections: {
    users: 'users',
    adminActions: 'admin_actions',
    suspiciousAccounts: 'suspicious_accounts',
    deviceRegistrations: 'device_registrations',
    userReputation: 'user_reputation',
    userActionsLog: 'user_actions_log',
    adminNotes: 'admin_notes',
    reports: 'report',  // Corrigé : 'report' au lieu de 'reports'
    reportFlags: 'report_flags'
  },
  
  // Utilitaires de timestamp
  timestamp: firebase.firestore.FieldValue.serverTimestamp,
  
  // Configuration des requêtes
  queryConfig: {
    defaultLimit: 20,
    maxRetries: 3,
    timeout: 15000
  }
};