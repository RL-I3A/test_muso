// Gestionnaire d'authentification pour MUSO Admin Dashboard
// Identique à la logique Flutter AdminPermissions

class AdminAuth {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.isLoading = true;
    
    // Sécurité
    this.loginAttempts = 0;
    this.isLockedOut = false;
    this.sessionStartTime = Date.now();
    
    this.initializeAuth();
    this.initializeSecurity();
  }

  async initializeAuth() {
    try {
      console.log('🔧 Initialisation de l\'authentification Firebase...');
      
      // Vérifier que Firebase est bien chargé
      if (!FirebaseServices || !FirebaseServices.auth) {
        throw new Error('Firebase n\'est pas correctement initialisé');
      }
      
      // Écouter les changements d'état d'authentification
      FirebaseServices.auth.onAuthStateChanged(async (user) => {
        console.log('🔄 Changement d\'état auth:', user ? `Utilisateur connecté: ${user.email}` : 'Aucun utilisateur');
        
        if (user) {
          this.currentUser = user;
          await this.checkAdminPermissions(user.uid);
        } else {
          this.currentUser = null;
          this.isAdmin = false;
          this.showLoginScreen();
        }
        this.isLoading = false;
        this.updateUI();
      });
    } catch (error) {
      console.error('❌ Erreur initialisation auth:', error);
      this.isLoading = false;
      this.showLoginScreen();
      this.showLoginError('Erreur d\'initialisation. Rechargez la page.');
    }
  }

  async checkAdminPermissions(userId) {
    try {
      console.log('🔍 Vérification permissions admin pour:', userId);
      
      // Vérification dans la liste blanche (sécurité côté client)
      const userEmail = this.currentUser?.email;
      if (!FirebaseServices.adminSecurity.authorizedAdmins.includes(userEmail)) {
        console.log('❌ Email non autorisé dans la liste blanche:', userEmail);
        this.isAdmin = false;
        this.logSecurityEvent('unauthorized_email_attempt', { email: userEmail });
        return;
      }
      
      // Vérifier d'abord si le document existe
      const userDoc = await FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .doc(userId)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        this.isAdmin = userData.isAdmin === true;
        
        if (this.isAdmin) {
          console.log('✅ Permissions admin confirmées via document existant');
          await this.logAdminAction('dashboard_access', 'admin_main_dashboard');
          this.logSecurityEvent('admin_login_success', { email: userEmail });
        } else {
          console.log('❌ Permissions admin refusées - isAdmin=false');
          this.logSecurityEvent('admin_permission_denied', { email: userEmail });
        }
      } else {
        // Document n'existe pas - créer un document admin pour les emails autorisés
        console.log('📝 Document utilisateur inexistant, création pour admin autorisé');
        
        try {
          await FirebaseServices.firestore
            .collection(FirebaseServices.collections.users)
            .doc(userId)
            .set({
              uid: userId,
              email: userEmail,
              displayName: userEmail.split('@')[0],
              isAdmin: true,
              createdAt: FirebaseServices.timestamp(),
              lastActivity: FirebaseServices.timestamp(),
              score: 100,
              isBlocked: false
            });
          
          this.isAdmin = true;
          console.log('✅ Document admin créé et permissions accordées');
          await this.logAdminAction('dashboard_access', 'admin_main_dashboard');
          this.logSecurityEvent('admin_account_created', { email: userEmail });
        } catch (createError) {
          console.error('❌ Erreur création document admin:', createError);
          this.isAdmin = false;
          this.logSecurityEvent('admin_creation_failed', { email: userEmail, error: createError.message });
        }
      }
    } catch (error) {
      console.error('❌ Erreur vérification permissions:', error);
      this.isAdmin = false;
      this.logSecurityEvent('permission_check_error', { error: error.message });
    }
  }

  async signInWithEmail(email, password) {
    try {
      // Vérifier si le compte est verrouillé
      if (this.isLockedOut) {
        this.showLoginError('Compte temporairement verrouillé. Réessayez plus tard.');
        return;
      }

      // Vérifier la liste blanche avant même de tenter la connexion
      if (!FirebaseServices.adminSecurity.authorizedAdmins.includes(email)) {
        this.handleFailedLogin('Email non autorisé');
        this.logSecurityEvent('unauthorized_login_attempt', { email });
        return;
      }
      
      console.log('🔐 Connexion email en cours...');
      this.showLoading('Connexion en cours...');
      
      const result = await FirebaseServices.auth.signInWithEmailAndPassword(email, password);
      console.log('✅ Connexion email réussie:', result.user.email);
      
      // Réinitialiser les tentatives de connexion en cas de succès
      this.loginAttempts = 0;
      // Ne pas appeler d'autres méthodes ici, onAuthStateChanged s'en charge
      
    } catch (error) {
      console.error('❌ Erreur connexion email:', error);
      this.handleFailedLogin(this.getErrorMessage(error));
      this.logSecurityEvent('login_failure', { email, error: error.code });
    }
  }

  async signOut() {
    try {
      console.log('🚪 Déconnexion...');
      await FirebaseServices.auth.signOut();
      console.log('✅ Déconnection réussie');
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
    }
  }

  async logAdminAction(action, targetId, metadata = {}) {
    if (!this.currentUser || !this.isAdmin) return;

    try {
      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.adminActions)
        .add({
          adminId: this.currentUser.uid,
          action: action,
          targetId: targetId,
          metadata: metadata,
          timestamp: FirebaseServices.timestamp()
        });
      
      console.log('📝 Action admin loggée:', action);
    } catch (error) {
      console.error('❌ Erreur logging action admin:', error);
    }
  }

  updateUI() {
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const accessDeniedScreen = document.getElementById('access-denied-screen');
    const mainDashboard = document.getElementById('main-dashboard');

    // Masquer tous les écrans
    [loadingScreen, loginScreen, accessDeniedScreen, mainDashboard].forEach(screen => {
      if (screen) screen.style.display = 'none';
    });

    if (this.isLoading) {
      if (loadingScreen) loadingScreen.style.display = 'flex';
      return;
    }

    if (!this.currentUser) {
      this.showLoginScreen();
      return;
    }

    if (!this.isAdmin) {
      this.showAccessDeniedScreen();
      return;
    }

    // Utilisateur admin connecté
    this.showDashboard();
  }

  showLoading(message = 'Chargement...') {
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = message;
    
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('access-denied-screen').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'none';
  }

  showLoginScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('access-denied-screen').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'none';
  }

  showAccessDeniedScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('access-denied-screen').style.display = 'flex';
    document.getElementById('main-dashboard').style.display = 'none';
  }

  showDashboard() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('access-denied-screen').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'block';
    
    // Initialiser les données du dashboard
    if (window.Dashboard) {
      window.Dashboard.initialize();
    }
    
    // Mettre à jour les infos utilisateur
    this.updateUserInfo();
  }

  updateUserInfo() {
    if (!this.currentUser) return;

    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');

    if (userAvatar && this.currentUser.photoURL) {
      userAvatar.src = this.currentUser.photoURL;
    }

    if (userName) {
      userName.textContent = this.currentUser.displayName || this.currentUser.email;
    }
  }

  showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      
      // Masquer l'erreur après 5 secondes
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }

  getErrorMessage(error) {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Aucun compte trouvé avec cet email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/invalid-email':
        return 'Format d\'email invalide';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Veuillez réessayer plus tard';
      case 'auth/network-request-failed':
        return 'Erreur réseau. Vérifiez votre connexion internet';
      case 'auth/popup-closed-by-user':
        return 'Connexion annulée par l\'utilisateur';
      case 'auth/popup-blocked':
        return 'Pop-up bloquée. Veuillez autoriser les pop-ups pour ce site';
      default:
        console.error('Code d\'erreur Firebase non géré:', error.code, error.message);
        return `Erreur de connexion: ${error.message}`;
    }
  }

  // === MÉTHODES DE SÉCURITÉ ===

  initializeSecurity() {
    // Vérifier périodiquement la session
    setInterval(() => {
      this.checkSessionTimeout();
    }, 60000); // Chaque minute

    // Nettoyer le localStorage au démarrage
    this.cleanupSecurityStorage();
  }

  handleFailedLogin(errorMessage) {
    this.loginAttempts++;
    this.showLoginScreen();
    
    if (this.loginAttempts >= FirebaseServices.adminSecurity.maxLoginAttempts) {
      this.lockAccount();
      this.showLoginError(`Trop de tentatives échouées. Compte verrouillé pendant 15 minutes.`);
    } else {
      const remaining = FirebaseServices.adminSecurity.maxLoginAttempts - this.loginAttempts;
      this.showLoginError(`${errorMessage}. ${remaining} tentative(s) restante(s).`);
    }
  }

  lockAccount() {
    this.isLockedOut = true;
    const lockoutEnd = Date.now() + FirebaseServices.adminSecurity.lockoutDuration;
    localStorage.setItem('adminLockout', lockoutEnd.toString());
    
    setTimeout(() => {
      this.unlockAccount();
    }, FirebaseServices.adminSecurity.lockoutDuration);
  }

  unlockAccount() {
    this.isLockedOut = false;
    this.loginAttempts = 0;
    localStorage.removeItem('adminLockout');
    console.log('🔓 Compte déverrouillé');
  }

  checkSessionTimeout() {
    if (!this.currentUser) return;
    
    const sessionDuration = Date.now() - this.sessionStartTime;
    if (sessionDuration > FirebaseServices.adminSecurity.sessionTimeout) {
      console.log('⏰ Session expirée');
      this.signOut();
      this.showLoginError('Session expirée pour des raisons de sécurité');
    }
  }

  cleanupSecurityStorage() {
    const lockoutEnd = localStorage.getItem('adminLockout');
    if (lockoutEnd && Date.now() > parseInt(lockoutEnd)) {
      this.unlockAccount();
    } else if (lockoutEnd) {
      this.isLockedOut = true;
      const remaining = parseInt(lockoutEnd) - Date.now();
      setTimeout(() => this.unlockAccount(), remaining);
    }
  }

  logSecurityEvent(eventType, data = {}) {
    if (!FirebaseServices.adminSecurity.logSecurityEvents) return;
    
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ip: 'client-side', // Côté client, on ne peut pas récupérer la vraie IP
      ...data
    };
    
    console.log('🔒 Événement sécurité:', event);
    
    // Optionnel : sauver dans Firestore pour audit
    try {
      FirebaseServices.firestore
        .collection('security_logs')
        .add(event)
        .catch(err => console.warn('Impossible de logger l\'événement:', err));
    } catch (error) {
      // Ignorer les erreurs de log pour ne pas casser l'app
    }
  }
}

// Initialiser l'authentification quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initialisation MUSO Admin Dashboard');
  
  // Créer l'instance d'authentification
  window.AdminAuth = new AdminAuth();

  // Gestionnaires d'événements
  const emailSignInBtn = document.getElementById('email-signin-btn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const logoutBtn = document.getElementById('logout-btn');
  const headerLogoutBtn = document.getElementById('header-logout-btn');

  if (emailSignInBtn) {
    emailSignInBtn.addEventListener('click', () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      if (!email || !password) {
        window.AdminAuth.showLoginError('Veuillez saisir votre email et mot de passe');
        return;
      }
      
      window.AdminAuth.signInWithEmail(email, password);
    });
  }

  // Permettre la connexion avec Entrée
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        emailSignInBtn.click();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.AdminAuth.signOut();
    });
  }

  if (headerLogoutBtn) {
    headerLogoutBtn.addEventListener('click', () => {
      window.AdminAuth.signOut();
    });
  }
});