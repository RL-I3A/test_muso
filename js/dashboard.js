// Gestionnaire principal du dashboard MUSO Admin
// Réplique la logique des onglets Flutter et la gestion des données

class Dashboard {
  constructor() {
    this.currentTab = 'overview';
    this.data = {
      overview: {},
      moderation: [],
      antiMulticompte: [],
      stats: {}
    };
    this.filters = {
      moderation: { problematic: true, search: '' },
      antiMulticompte: { level: 0, search: '' }
    };
    this.pagination = {
      moderation: { page: 1, limit: 20 },
      antiMulticompte: { page: 1, limit: 20 }
    };
  }

  async initialize() {
    console.log('🚀 Initialisation Dashboard MUSO');
    
    this.setupTabNavigation();
    this.setupRefreshButton();
    this.setupFilters();
    this.setupSearch();
    // Placer placeholder alerte avant chargement pour éviter flash vide
    this.ensureSystemAlertPlaceholder();
    this.loadInitialData();
  }

  ensureSystemAlertPlaceholder() {
    try {
      const container = document.getElementById('system-alerts');
      if(!container) return;
      // Si aucune alerte custom n'a été injectée (texte, enfants ou data-alert) on place le placeholder
      const hasContent = Array.from(container.children).some(ch=>!ch.classList.contains('empty-alert')) || container.textContent.trim().length>0;
      if(!hasContent) {
        container.innerHTML = `<div class="empty-alert ok" data-alert-placeholder><span class="material-icons" style="font-size:18px;color:#4caf50;">check_circle</span><span style="color:#4caf50;font-weight:600;">Aucune alerte</span></div>`;
      }
    } catch(e){ console.warn('ensureSystemAlertPlaceholder failed', e); }
  }

  setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshCurrentTab();
      });
    }
  }

  refreshCurrentTab() {
    console.log('🔄 Rafraîchissement onglet:', this.currentTab);
    this.loadTabData(this.currentTab);
  }

  // ========== NAVIGATION ONGLETS ==========

  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Gérer les clics sur les cartes métriques
    document.querySelectorAll('.metric-card.clickable').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        this.handleMetricCardClick(action);
      });
    });

    // Gérer les clics sur les phases
    document.querySelectorAll('.phase-action').forEach(button => {
      button.addEventListener('click', () => {
        const phase = button.dataset.phase;
        this.switchTab(phase);
      });
    });
  }

  handleMetricCardClick(action) {
    switch (action) {
      case 'navigate-active-users':
        this.switchTab('moderation');
        break;
      case 'navigate-reports':
        this.switchTab('moderation');
        break;
      case 'navigate-suspicious':
        this.switchTab('anti-multicompte');
        break;
      case 'navigate-total-users':
        this.switchTab('moderation');
        break;
      case 'navigate-admin-users':
        this.switchTab('moderation');
        break;
      default:
        console.log('Action non implémentée:', action);
    }
  }

  switchTab(tabId) {
    if (this.currentTab === tabId) return;

    console.log('📑 Changement onglet:', tabId);
    this.currentTab = tabId;

    // Mettre à jour l'interface
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabId}-tab`);
    });

    // Charger les données de l'onglet si nécessaire
    this.loadTabData(tabId);
  }

  // ========== CHARGEMENT DES DONNÉES ==========

  async loadInitialData() {
    this.showLoading();
    
    try {
      // Charger les statistiques générales
      await this.loadStats();
      
      // Charger les données de l'onglet actuel
      await this.loadTabData(this.currentTab);
      
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      this.showError('Erreur lors du chargement des données');
    } finally {
      this.hideLoading();
    }
  }

  async loadTabData(tabId) {
    console.log('📊 Chargement données onglet:', tabId);

    switch (tabId) {
      case 'overview':
        await this.loadOverviewData();
        break;
      case 'moderation':
        await this.loadModerationData();
        break;
      case 'anti-multicompte':
        await this.loadAntiMulticompteData();
        break;
    }
  }

  async loadStats() {
    try {
      const statsPromises = [
        this.getCollectionCount(FirebaseServices.collections.users),
        this.getCollectionCount(FirebaseServices.collections.posts),
        this.getReportsCount('pending'),
        this.getBlockedUsersCount()
      ];

      const [totalUsers, totalPosts, pendingReports, blockedUsers] = await Promise.all(statsPromises);

      this.data.stats = {
        totalUsers,
        totalPosts,
        pendingReports,
        blockedUsers
      };

      this.updateStatsDisplay();
    } catch (error) {
      console.error('❌ Erreur chargement stats:', error);
    }
  }

  updateMetric(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.remove('loading', 'error');
      element.textContent = value != null ? value.toLocaleString() : '--';
    }
  }

  startOverviewMetricsLoading() {
    const metricIds = [
      'active-users-count',
      'reports-count',
      'suspicious-count',
      'blocked-actions-count',
      'total-users-count',
      'admin-users-count'
    ];
    metricIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.classList.add('loading');
      }
    });
  }

  finishOverviewMetricsLoading() {
    const metricIds = [
      'active-users-count',
      'reports-count',
      'suspicious-count',
      'blocked-actions-count',
      'total-users-count',
      'admin-users-count'
    ];
    metricIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('loading');
      }
    });
  }

  setMetricError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.remove('loading');
      el.classList.add('error');
      el.textContent = '!';
    }
  }

  async loadOverviewData() {
    this.startOverviewMetricsLoading();
    try {
      console.log('📊 Chargement données vue d\'ensemble...');
      const promises = [
        this.getActiveUsersCount().catch(() => { this.setMetricError('active-users-count'); return 0; }),
        this.getReportsCount().catch(() => { this.setMetricError('reports-count'); return 0; }),
        this.getSuspiciousAccountsCount().catch(() => { this.setMetricError('suspicious-count'); return 0; }),
        this.getBlockedActionsCount().catch(() => { this.setMetricError('blocked-actions-count'); return 0; }),
        this.getTotalUsersCount().catch(() => { this.setMetricError('total-users-count'); return 0; }),
        this.getAdminUsersCount().catch(() => { this.setMetricError('admin-users-count'); return 0; })
      ];

      const [
        activeUsers,
        reports,
        suspicious,
        blockedActions,
        totalUsers,
        adminUsers
      ] = await Promise.all(promises);

      this.updateMetric('active-users-count', activeUsers);
      this.updateMetric('reports-count', reports);
      this.updateMetric('suspicious-count', suspicious);
      this.updateMetric('blocked-actions-count', blockedActions);
      this.updateMetric('total-users-count', totalUsers);
      this.updateMetric('admin-users-count', adminUsers);
      this.updateLastUpdateTime();
      console.log('✅ Données vue d\'ensemble chargées');
    } catch (error) {
      console.error('❌ Erreur chargement vue d\'ensemble:', error);
      this.showError('Erreur lors du chargement des données');
    } finally {
      this.finishOverviewMetricsLoading();

      this.ensureSystemAlertPlaceholder();
    }
  }

  async loadModerationData() {
    try {
      console.log('🔨 Chargement données modération...');
      
      // Charger tous les utilisateurs disponibles
      let usersQuery = FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .limit(50);

      // Essayer d'ordonner par score si le champ existe
      try {
        usersQuery = usersQuery.orderBy('score', 'asc');
      } catch (orderError) {
        console.log('Champ score inexistant, ordre par défaut');
        usersQuery = FirebaseServices.firestore
          .collection(FirebaseServices.collections.users)
          .orderBy('createdAt', 'desc')
          .limit(50);
      }

      const snapshot = await usersQuery.get();
      let users = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Assigner des valeurs par défaut si les champs n'existent pas
          score: data.score || 100,
          reportCount: data.reportCount || 0,
          isBlocked: data.isBlocked || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastActivity: data.lastActivity?.toDate() || data.createdAt?.toDate() || new Date(),
          displayName: data.displayName || data.email?.split('@')[0] || 'Utilisateur sans nom',
          email: data.email || 'Email inconnu'
        };
      });

      // Si pas d'utilisateurs, créer quelques utilisateurs de test
      if (users.length === 0) {
        console.log('Aucun utilisateur trouvé, création d\'utilisateurs de test...');
        users = await this.createTestUsers();
      }

      this.renderModerationUsers(users);
      console.log('✅ Données modération chargées:', users.length, 'utilisateurs');
    } catch (error) {
      console.error('❌ Erreur chargement modération:', error);
      this.showError('Erreur lors du chargement des données de modération');
    }
  }

  async createTestUsers() {
    const testUsers = [
      {
        email: 'user1@test.com',
        displayName: 'Utilisateur Test 1',
        score: 45,
        reportCount: 3,
        isBlocked: false,
        createdAt: new Date(),
        lastActivity: new Date()
      },
      {
        email: 'user2@test.com',
        displayName: 'Utilisateur Test 2', 
        score: 25,
        reportCount: 7,
        isBlocked: true,
        createdAt: new Date(),
        lastActivity: new Date()
      },
      {
        email: 'user3@test.com',
        displayName: 'Utilisateur Test 3',
        score: 85,
        reportCount: 0,
        isBlocked: false,
        createdAt: new Date(),
        lastActivity: new Date()
      }
    ];

    // Sauvegarder dans Firebase pour usage futur
    try {
      const batch = FirebaseServices.firestore.batch();
      testUsers.forEach(user => {
        const docRef = FirebaseServices.firestore
          .collection(FirebaseServices.collections.users)
          .doc();
        batch.set(docRef, {
          ...user,
          uid: docRef.id,
          createdAt: FirebaseServices.timestamp(),
          lastActivity: FirebaseServices.timestamp()
        });
      });
      await batch.commit();
      console.log('✅ Utilisateurs de test créés dans Firebase');
    } catch (error) {
      console.warn('Impossible de créer les utilisateurs de test dans Firebase:', error);
    }

    return testUsers.map((user, index) => ({
      ...user,
      id: `test_user_${index + 1}`
    }));
  }

  async loadAntiMulticompteData() {
    try {
      console.log('🔐 Chargement données anti multi-comptes...');
      
      // Charger les comptes suspects (avec fallback si la collection n'existe pas)
      let suspiciousAccounts = [];
      try {
        const suspiciousQuery = FirebaseServices.firestore
          .collection(FirebaseServices.collections.suspiciousAccounts)
          .orderBy('suspiciousLevel', 'desc')
          .limit(50);

        const suspiciousSnapshot = await suspiciousQuery.get();
        suspiciousAccounts = suspiciousSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          detectedAt: doc.data().detectedAt?.toDate()
        }));
      } catch (suspiciousError) {
        console.warn('Collection suspicious_accounts inexistante, création de données de test');
        // Créer quelques données de test
        suspiciousAccounts = await this.createTestSuspiciousAccounts();
      }

      // Charger les appareils avec plusieurs comptes
      let suspiciousDevices = [];
      try {
        const devicesQuery = FirebaseServices.firestore
          .collection(FirebaseServices.collections.deviceRegistrations)
          .orderBy('accountsCount', 'desc')
          .where('accountsCount', '>=', 2)
          .limit(50);

        const devicesSnapshot = await devicesQuery.get();
        suspiciousDevices = devicesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastActivity: doc.data().lastActivity?.toDate()
        }));
      } catch (devicesError) {
        console.warn('Collection device_registrations avec multi-comptes inexistante, création de données de test');
        suspiciousDevices = await this.createTestSuspiciousDevices();
      }

      this.renderSuspiciousAccounts(suspiciousAccounts);
      this.renderSuspiciousDevices(suspiciousDevices);
      
      console.log('✅ Données anti multi-comptes chargées');
    } catch (error) {
      console.error('❌ Erreur chargement anti multi-comptes:', error);
      this.showError('Erreur lors du chargement des données anti multi-comptes');
    }
  }

  async createTestSuspiciousAccounts() {
    // Créer quelques comptes suspects de test dans Firebase
    const testAccounts = [
      {
        email: 'suspect1@test.com',
        displayName: 'Utilisateur Suspect 1',
        suspiciousLevel: 4,
        reasons: ['Création rapide de comptes', 'Activité suspecte'],
        detectedAt: new Date()
      },
      {
        email: 'suspect2@test.com', 
        displayName: 'Utilisateur Suspect 2',
        suspiciousLevel: 3,
        reasons: ['Même appareil que d\'autres comptes'],
        detectedAt: new Date()
      }
    ];

    // Sauvegarder dans Firebase pour usage futur
    try {
      const batch = FirebaseServices.firestore.batch();
      testAccounts.forEach(account => {
        const docRef = FirebaseServices.firestore
          .collection(FirebaseServices.collections.suspiciousAccounts)
          .doc();
        batch.set(docRef, {
          ...account,
          detectedAt: FirebaseServices.timestamp()
        });
      });
      await batch.commit();
      console.log('✅ Comptes suspects de test créés dans Firebase');
    } catch (error) {
      console.warn('Impossible de créer les comptes de test dans Firebase:', error);
    }

    return testAccounts;
  }

  async createTestSuspiciousDevices() {
    const testDevices = [
      {
        deviceId: 'DEVICE123456789ABC',
        platform: 'Android',
        model: 'Samsung Galaxy S21',
        accountsCount: 5,
        lastActivity: new Date()
      },
      {
        deviceId: 'DEVICE987654321XYZ',
        platform: 'iOS', 
        model: 'iPhone 13',
        accountsCount: 3,
        lastActivity: new Date()
      }
    ];

    // Sauvegarder dans Firebase pour usage futur
    try {
      const batch = FirebaseServices.firestore.batch();
      testDevices.forEach(device => {
        const docRef = FirebaseServices.firestore
          .collection(FirebaseServices.collections.deviceRegistrations)
          .doc();
        batch.set(docRef, {
          ...device,
          lastActivity: FirebaseServices.timestamp()
        });
      });
      await batch.commit();
      console.log('✅ Appareils suspects de test créés dans Firebase');
    } catch (error) {
      console.warn('Impossible de créer les appareils de test dans Firebase:', error);
    }

    return testDevices;
  }

  async loadPosts() {
    try {
      const { hidden, search } = this.filters.posts;
      const { page, limit } = this.pagination.posts;

      let query = FirebaseServices.firestore
        .collection(FirebaseServices.collections.posts)
        .orderBy('createdAt', 'desc');

      // Filtrer par statut de masquage
      if (hidden === 'hidden') {
        query = query.where('isHidden', '==', true);
      } else if (hidden === 'visible') {
        query = query.where('isHidden', '==', false);
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      let posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        moderatedAt: doc.data().moderatedAt?.toDate()
      }));

      // Charger les informations des auteurs
      posts = await Promise.all(posts.map(async (post) => {
        if (post.authorId) {
          try {
            const authorDoc = await FirebaseServices.firestore
              .collection(FirebaseServices.collections.users)
              .doc(post.authorId)
              .get();
            
            if (authorDoc.exists) {
              post.author = authorDoc.data();
            }
          } catch (error) {
            console.error('Erreur chargement auteur:', error);
          }
        }
        return post;
      }));

      // Filtrer par recherche
      this.data.posts = search ? 
        posts.filter(post => 
          post.title?.toLowerCase().includes(search.toLowerCase()) ||
          post.content?.toLowerCase().includes(search.toLowerCase()) ||
          post.author?.displayName?.toLowerCase().includes(search.toLowerCase())
        ) : posts;

      this.renderPosts();
    } catch (error) {
      console.error('❌ Erreur chargement publications:', error);
      this.showError('Erreur lors du chargement des publications');
    }
  }

  async loadReports() {
    try {
      const { status, search } = this.filters.reports;
      const { page, limit } = this.pagination.reports;

      let query = FirebaseServices.firestore
        .collection('report')  // Corrigé: utilise 'report' directement
        .orderBy('timestamp', 'desc');  // Corrigé: utilise 'timestamp' au lieu de 'createdAt'

      // Filtrer par statut
      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      query = query.limit(limit);

      const snapshot = await query.get();
      let reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate()
      }));

      // Charger les informations complémentaires
      reports = await Promise.all(reports.map(async (report) => {
        const promises = [];

        // Charger l'utilisateur qui a signalé
        if (report.reporterId) {
          promises.push(
            FirebaseServices.firestore
              .collection(FirebaseServices.collections.users)
              .doc(report.reporterId)
              .get()
              .then(doc => doc.exists ? { reporter: doc.data() } : {})
              .catch(() => ({}))
          );
        }

        // Charger l'élément signalé (utilisateur ou publication)
        if (report.targetType === 'user' && report.targetId) {
          promises.push(
            FirebaseServices.firestore
              .collection(FirebaseServices.collections.users)
              .doc(report.targetId)
              .get()
              .then(doc => doc.exists ? { targetUser: doc.data() } : {})
              .catch(() => ({}))
          );
        } else if (report.targetType === 'post' && report.targetId) {
          promises.push(
            FirebaseServices.firestore
              .collection(FirebaseServices.collections.posts)
              .doc(report.targetId)
              .get()
              .then(doc => doc.exists ? { targetPost: doc.data() } : {})
              .catch(() => ({}))
          );
        }

        const results = await Promise.all(promises);
        return Object.assign(report, ...results);
      }));

      // Filtrer par recherche
      this.data.reports = search ? 
        reports.filter(report => 
          report.reason?.toLowerCase().includes(search.toLowerCase()) ||
          report.description?.toLowerCase().includes(search.toLowerCase()) ||
          report.reporter?.displayName?.toLowerCase().includes(search.toLowerCase())
        ) : reports;

      this.renderReports();
    } catch (error) {
      console.error('❌ Erreur chargement signalements:', error);
      this.showError('Erreur lors du chargement des signalements');
    }
  }

  // ========== RENDU INTERFACE ==========

  renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;

    if (this.data.users.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun utilisateur trouvé</div>';
      return;
    }

    container.innerHTML = this.data.users.map(user => `
      <div class="user-card ${user.isBlocked ? 'blocked' : ''}">
        <div class="user-avatar">
          <img src="${user.photoURL || 'img/default-avatar.svg'}" alt="Avatar" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='img/default-avatar.svg';}" />
          ${user.isBlocked ? '<span class="blocked-badge">Bloqué</span>' : ''}
        </div>
        <div class="user-info">
          <h3>${user.displayName || 'Utilisateur sans nom'}</h3>
          <p class="user-email">${user.email}</p>
          <p class="user-meta">
            Inscrit le ${user.createdAt ? this.formatDate(user.createdAt) : 'Date inconnue'}
            ${user.isBlocked ? `<br>Bloqué le ${this.formatDate(user.blockedAt)}` : ''}
          </p>
          ${user.blockReason ? `<p class="block-reason">Raison: ${user.blockReason}</p>` : ''}
        </div>
        <div class="user-actions">
          ${user.isBlocked ? 
            `<button class="btn-success" onclick="window.ModerationActions.unblockUser('${user.id}')">
              <span class="material-icons">lock_open</span> Débloquer
            </button>` :
            `<button class="btn-warning" onclick="this.showBlockModal('${user.id}')">
              <span class="material-icons">block</span> Bloquer
            </button>`
          }
          <button class="btn-danger" onclick="window.ModerationActions.deleteUser('${user.id}')">
            <span class="material-icons">delete</span> Supprimer
          </button>
        </div>
      </div>
    `).join('');
  }

  renderPosts() {
    const container = document.getElementById('posts-list');
    if (!container) return;

    if (this.data.posts.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune publication trouvée</div>';
      return;
    }

    container.innerHTML = this.data.posts.map(post => `
      <div class="post-card ${post.isHidden ? 'hidden' : ''}">
        <div class="post-header">
          <div class="post-author">
            <img src="${post.author?.photoURL || 'img/default-avatar.svg'}" alt="Avatar" class="author-avatar" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='img/default-avatar.svg';}" />
            <div>
              <h4>${post.author?.displayName || 'Utilisateur inconnu'}</h4>
              <p class="post-date">${this.formatDate(post.createdAt)}</p>
            </div>
          </div>
          ${post.isHidden ? '<span class="hidden-badge">Masqué</span>' : ''}
        </div>
        
        <div class="post-content">
          <h3>${post.title || 'Publication sans titre'}</h3>
          <p>${post.content ? this.truncateText(post.content, 200) : 'Contenu non disponible'}</p>
          
          ${post.location ? `
            <div class="post-location">
              <span class="material-icons">location_on</span>
              ${post.location.address || `${post.location.latitude}, ${post.location.longitude}`}
            </div>
          ` : ''}
          
          ${post.mediaUrls && post.mediaUrls.length > 0 ? `
            <div class="post-media">
              <span class="material-icons">image</span>
              ${post.mediaUrls.length} média(s)
            </div>
          ` : ''}
        </div>
        
        <div class="post-stats">
          <span><span class="material-icons">favorite</span> ${post.likesCount || 0}</span>
          <span><span class="material-icons">comment</span> ${post.commentsCount || 0}</span>
          <span><span class="material-icons">share</span> ${post.sharesCount || 0}</span>
        </div>
        
        ${post.moderatedAt ? `
          <div class="moderation-info">
            Modéré le ${this.formatDate(post.moderatedAt)} - ${post.moderationAction}
            ${post.moderationReason ? `<br>Raison: ${post.moderationReason}` : ''}
          </div>
        ` : ''}
        
        <div class="post-actions">
          ${post.isHidden ? 
            `<button class="btn-success" onclick="window.ModerationActions.moderatePost('${post.id}', 'show', 'Affichage autorisé')">
              <span class="material-icons">visibility</span> Afficher
            </button>` :
            `<button class="btn-warning" onclick="this.showModerationModal('${post.id}', 'hide')">
              <span class="material-icons">visibility_off</span> Masquer
            </button>`
          }
          <button class="btn-danger" onclick="window.ModerationActions.deletePost('${post.id}')">
            <span class="material-icons">delete</span> Supprimer
          </button>
        </div>
      </div>
    `).join('');
  }

  renderReports() {
    const container = document.getElementById('reports-list');
    if (!container) return;

    if (this.data.reports.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun signalement trouvé</div>';
      return;
    }

    container.innerHTML = this.data.reports.map(report => `
      <div class="report-card status-${report.status}">
        <div class="report-header">
          <div class="report-type">
            <span class="material-icons">
              ${report.targetType === 'user' ? 'person' : 'article'}
            </span>
            <span>${report.targetType === 'user' ? 'Utilisateur' : 'Publication'} signalé(e)</span>
          </div>
          <span class="report-status status-${report.status}">${this.getStatusLabel(report.status)}</span>
        </div>
        
        <div class="report-content">
          <div class="report-reason">
            <strong>Motif:</strong> ${report.reason}
          </div>
          ${report.description ? `
            <div class="report-description">
              <strong>Description:</strong> ${report.description}
            </div>
          ` : ''}
          
          <div class="report-target">
            <strong>Élément signalé:</strong>
            ${report.targetUser ? 
              `Utilisateur: ${report.targetUser.displayName} (${report.targetUser.email})` :
              report.targetPost ?
              `Publication: "${report.targetPost.title || 'Sans titre'}"` :
              `ID: ${report.targetId}`
            }
          </div>
          
          <div class="report-reporter">
            <strong>Signalé par:</strong>
            ${report.reporter ? 
              `${report.reporter.displayName} (${report.reporter.email})` :
              'Utilisateur inconnu'
            }
          </div>
          
          <div class="report-date">
            <strong>Date:</strong> ${this.formatDate(report.createdAt)}
          </div>
          
          ${report.resolvedAt ? `
            <div class="report-resolution">
              <strong>Résolu le:</strong> ${this.formatDate(report.resolvedAt)}
              ${report.resolution ? `<br><strong>Résolution:</strong> ${report.resolution}` : ''}
            </div>
          ` : ''}
        </div>
        
        ${report.status === 'pending' ? `
          <div class="report-actions">
            <button class="btn-success" onclick="this.showResolutionModal('${report.id}')">
              <span class="material-icons">check</span> Résoudre
            </button>
            <button class="btn-secondary" onclick="this.showDismissModal('${report.id}')">
              <span class="material-icons">close</span> Rejeter
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // ========== MÉTHODES UTILITAIRES ==========

  updateStatsDisplay() {
    const stats = this.data.stats;
    
    document.getElementById('total-users-count').textContent = stats.totalUsers || 0;
    document.getElementById('total-posts-count').textContent = stats.totalPosts || 0;
    document.getElementById('pending-reports-count').textContent = stats.pendingReports || 0;
    document.getElementById('blocked-users-count').textContent = stats.blockedUsers || 0;
  }

  async getCollectionCount(collection) {
    try {
      const snapshot = await FirebaseServices.firestore.collection(collection).get();
      return snapshot.size;
    } catch (error) {
      console.error(`Erreur comptage ${collection}:`, error);
      return 0;
    }
  }

  async getActiveUsersCount() {
    try {
      console.log('🔍 Checking active users...');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Vérifier d'abord si la collection existe
      const testQuery = await FirebaseServices.firestore
        .collection('user_actions_log')
        .limit(1)
        .get();
      
      if (testQuery.empty) {
        console.warn('⚠️ user_actions_log collection is empty');
        return 0;
      }
      
      // Récupérer toutes les actions depuis hier
      const activeUsers = await FirebaseServices.firestore
        .collection('user_actions_log')
        .where('timestamp', '>', firebase.firestore.Timestamp.fromDate(yesterday))
        .get();
      
      // Compter les utilisateurs uniques
      const uniqueUsers = new Set();
      activeUsers.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
          uniqueUsers.add(data.userId);
        }
      });
      
      console.log('✅ Active users found:', uniqueUsers.size, 'from', activeUsers.size, 'actions');
      return uniqueUsers.size;
    } catch (error) {
      console.error('❌ Error in getActiveUsersCount:', error);
      return 0;
    }
  }

  async getSuspiciousAccountsCount() {
    try {
      console.log('🔍 Checking suspicious accounts...');
      const snapshot = await FirebaseServices.firestore
        .collection('suspicious_accounts')
        .where('suspicionLevel', '>=', 2)
        .get();
      console.log('✅ Suspicious accounts found:', snapshot.size);
      return snapshot.size;
    } catch (error) {
      console.warn('❌ Error in getSuspiciousAccountsCount:', error);
      return 0;
    }
  }

  async getBlockedActionsCount() {
    try {
      console.log('🔍 Checking blocked accounts (comptes bloqués)...');
      
      // Méthode similaire à l'application mobile : compter les utilisateurs avec restrictions
      const restrictedUsers = await FirebaseServices.firestore
        .collection('user_reputation')
        .where('restrictions.canReport', '==', false)
        .get();
      
      console.log('✅ Blocked accounts (comptes bloqués):', restrictedUsers.size);
      return restrictedUsers.size;
    } catch (error) {
      console.warn('❌ Error in getBlockedActionsCount (comptes bloqués):', error);
      return 0;
    }
  }

  async getTotalUsersCount() {
    return this.getCollectionCount(FirebaseServices.collections.users);
  }

  async getAdminUsersCount() {
    try {
      const snapshot = await FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .where('isAdmin', '==', true)
        .get();
      return snapshot.size;
    } catch (error) {
      console.error('Erreur comptage admins:', error);
      return 0;
    }
  }

  async getReportsCount(status) {
    try {
      console.log('🔍 Checking reports...');
      
      // Si on veut les reports des dernières 24h (comme dans l'app mobile)
      if (!status) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        try {
          // Récupérer tous les signalements de la collection 'report'
          const reports = await FirebaseServices.firestore
            .collection('report')
            .get();
          
          // Filtrer côté client par timestamp des dernières 24h
          let count = 0;
          reports.docs.forEach(doc => {
            const data = doc.data();
            let timestamp;
            
            try {
              if (data.timestamp && data.timestamp.toDate) {
                timestamp = data.timestamp.toDate();
              } else if (data.createdAt && data.createdAt.toDate) {
                timestamp = data.createdAt.toDate();
              } else {
                return; // Ignorer si pas de timestamp valide
              }
              
              if (timestamp > yesterday) {
                count++;
              }
            } catch (e) {
              // Ignorer les documents avec des timestamps invalides
            }
          });
          
          console.log('✅ Reports found (last 24h):', count, 'from', reports.size, 'total');
          return count;
        } catch (directError) {
          console.warn('⚠️ Error in direct reports query:', directError);
          
          // Fallback vers user_actions_log (comme dans l'app mobile)
          const reports = await FirebaseServices.firestore
            .collection('user_actions_log')
            .where('action', '==', 'report')
            .get();
          
          let count = 0;
          reports.docs.forEach(doc => {
            const data = doc.data();
            if (data.timestamp && data.timestamp.toDate) {
              const timestamp = data.timestamp.toDate();
              if (timestamp > yesterday) {
                count++;
              }
            }
          });
          
          console.log('✅ Fallback reports found:', count);
          return count;
        }
      } else {
        // Si on veut filtrer par status
        const snapshot = await FirebaseServices.firestore
          .collection('report')
          .where('status', '==', status)
          .get();
        console.log('✅ Reports with status', status, ':', snapshot.size);
        return snapshot.size;
      }
    } catch (error) {
      console.error('❌ Error in getReportsCount:', error);
      return 0;
    }
  }

  async getBlockedUsersCount() {
    try {
      const snapshot = await FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .where('isBlocked', '==', true)
        .get();
      return snapshot.size;
    } catch (error) {
      console.error('Erreur comptage utilisateurs bloqués:', error);
      return 0;
    }
  }

  setupFilters() {
    // Filtres utilisateurs
    const userBlockedFilter = document.getElementById('user-blocked-filter');
    if (userBlockedFilter) {
      userBlockedFilter.addEventListener('change', (e) => {
        this.filters.users.blocked = e.target.value;
        this.loadUsers();
      });
    }

    // Filtres publications
    const postHiddenFilter = document.getElementById('post-hidden-filter');
    if (postHiddenFilter) {
      postHiddenFilter.addEventListener('change', (e) => {
        this.filters.posts.hidden = e.target.value;
        this.loadPosts();
      });
    }

    // Filtres signalements
    const reportStatusFilter = document.getElementById('report-status-filter');
    if (reportStatusFilter) {
      reportStatusFilter.addEventListener('change', (e) => {
        this.filters.reports.status = e.target.value;
        this.loadReports();
      });
    }
  }

  setupSearch() {
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(input => {
      input.addEventListener('input', this.debounce((e) => {
        const tabType = e.target.dataset.tab;
        this.filters[tabType].search = e.target.value;
        this.loadTabData(tabType);
      }, 300));
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  formatDate(date) {
    if (!date) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getStatusLabel(status) {
    const labels = {
      'pending': 'En attente',
      'resolved': 'Résolu',
      'dismissed': 'Rejeté'
    };
    return labels[status] || status;
  }

  showLoading() {
    const el = document.getElementById('main-loading');
    if (el) el.style.display = 'block';
  }

  hideLoading() {
    const el = document.getElementById('main-loading');
    if (el) el.style.display = 'none';
  }

  showError(message) {
    console.error('❌ Erreur:', message);
    // Afficher une notification d'erreur simple
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    console.log('✅ Succès:', message);
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Créer une notification simple
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 16px;
      border-radius: 4px;
      z-index: 1000;
      max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  updateLastUpdateTime() {
    const element = document.getElementById('last-update-time');
    if (element) {
      const now = new Date();
      element.textContent = now.toLocaleTimeString('fr-FR');
    }
  }

  renderModerationUsers(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
      <tr>
        <td>
          <div class="user-cell">
            <img src="${user.photoURL || 'img/default-avatar.svg'}" alt="Avatar" class="user-avatar-small" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='img/default-avatar.svg';}" />
            <div>
              <div class="user-name">${user.displayName || 'Sans nom'}</div>
              <div class="user-email">${user.email || 'Email inconnu'}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="score-badge ${user.score < 50 ? 'low' : user.score < 80 ? 'medium' : 'high'}">
            ${user.score || 100}
          </span>
        </td>
        <td>${user.reportCount || 0}</td>
        <td>
          <span class="status-badge ${user.isBlocked ? 'blocked' : 'active'}">
            ${user.isBlocked ? 'Bloqué' : 'Actif'}
          </span>
        </td>
        <td>${this.formatDate(user.lastActivity)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-sm btn-primary" onclick="window.Dashboard.showUserProfile('${user.id}')">
              <span class="material-icons">visibility</span>
            </button>
            ${user.isBlocked ? 
              `<button class="btn-sm btn-success" onclick="window.ModerationActions.unblockUser('${user.id}')">
                <span class="material-icons">lock_open</span>
              </button>` :
              `<button class="btn-sm btn-warning" onclick="window.ModerationActions.blockUser('${user.id}', 'Blocage depuis dashboard admin')">
                <span class="material-icons">block</span>
              </button>`
            }
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderSuspiciousAccounts(accounts) {
    const tbody = document.getElementById('suspicious-accounts-body');
    if (!tbody) return;

    tbody.innerHTML = accounts.map(account => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-name">${account.displayName || 'Sans nom'}</div>
            <div class="user-email">${account.email || 'Email inconnu'}</div>
          </div>
        </td>
        <td>
          <span class="suspicion-level level-${account.suspiciousLevel}">
            Niveau ${account.suspiciousLevel}
          </span>
        </td>
        <td>
          <div class="reasons-list">
            ${(account.reasons || []).join(', ')}
          </div>
        </td>
        <td>${this.formatDate(account.detectedAt)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-sm btn-primary" onclick="this.reviewSuspiciousAccount('${account.id}')">
              Examiner
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderSuspiciousDevices(devices) {
    const tbody = document.getElementById('devices-body');
    if (!tbody) return;

    tbody.innerHTML = devices.map(device => `
      <tr>
        <td class="device-id">${device.deviceId ? device.deviceId.substring(0, 12) + '...' : 'ID inconnu'}</td>
        <td>${device.platform || 'Inconnue'}</td>
        <td>${device.model || 'Inconnu'}</td>
        <td>
          <span class="account-count ${device.accountsCount >= 5 ? 'high' : device.accountsCount >= 3 ? 'medium' : 'low'}">
            ${device.accountsCount}
          </span>
        </td>
        <td>${this.formatDate(device.lastActivity)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-sm btn-primary" onclick="this.showDeviceDetails('${device.id}')">
              Détails
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Placeholder methods pour les actions
  showUserProfile(userId) {
    console.log('Affichage profil utilisateur:', userId);
    this.showNotification('Fonction en cours de développement', 'info');
  }

  showModerationActions(userId) {
    console.log('Actions modération pour:', userId);
    this.showNotification('Panel d\'actions en cours de développement', 'info');
  }

  reviewSuspiciousAccount(accountId) {
    console.log('Examen compte suspect:', accountId);
    this.showNotification('Fonction d\'examen en cours de développement', 'info');
  }

  showDeviceDetails(deviceId) {
    console.log('Détails appareil:', deviceId);
    this.showNotification('Détails appareil en cours de développement', 'info');
  }

  // Méthodes de rafraîchissement
  refreshOverview() {
    this.loadOverviewData();
  }

  refreshModeration() {
    this.loadModerationData();
  }

  refreshAntiMulticompte() {
    this.loadAntiMulticompteData();
  }
}

// Initialiser le dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.Dashboard = new Dashboard();
});