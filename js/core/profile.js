// Composant profil utilisateur unifié
// Usage: openProfileModal(userId, { showModerationButtons: true })
(function(){
	const cache = new Map();

	const ACTIONS = {
		QUARANTINE:'quarantine', UNQUARANTINE:'unquarantine',
		BAN_24:'ban24h', BAN_7:'ban7d', BAN_PERM:'banPermanent', UNBAN:'unban',
		BLOCK_REPORTS:'blockReports', UNBLOCK_REPORTS:'unblockReports',
		BLOCK_VOTES:'blockVotes', UNBLOCK_VOTES:'unblockVotes',
		FORCE_MOD:'forceModeration', REMOVE_MOD:'removeModeration',
		RESET_REP:'resetReputation', ADD_NOTE:'addNote'
	};

	async function fetchUser(userId){
		if(cache.has(userId)) return cache.get(userId);
		const firestore = firebase.firestore();
		const userDoc = await firestore.collection('users').doc(userId).get();
		if(!userDoc.exists) throw new Error('Utilisateur introuvable');
		const userData = userDoc.data();
		let reputation=null; let recentActions=[], adminActions=[], adminNotes=[];
		try { const repDoc = await firestore.collection('user_reputation').doc(userId).get(); if(repDoc.exists) reputation = repDoc.data(); } catch(e){ console.warn('Réputation indisponible', e); }
		try {
			const snap = await firestore.collection('user_actions_log').where('userId','==',userId).orderBy('timestamp','desc').limit(20).get();
			recentActions = snap.docs.map(d=>({id:d.id,...d.data()}));
		} catch(e){}
		try {
			const snap = await firestore.collection('admin_actions').where('targetId','==',userId).orderBy('timestamp','desc').limit(30).get();
			adminActions = snap.docs.map(d=>({id:d.id,...d.data()}));
		} catch(e){}
		try {
			const snap = await firestore.collection('admin_notes').where('userId','==',userId).orderBy('timestamp','desc').limit(15).get();
			adminNotes = snap.docs.map(d=>({id:d.id,...d.data()}));
		} catch(e){}
		const full = {userId,userData,reputation,recentActions,adminActions,adminNotes};
		cache.set(userId, full);
		return full;
	}

	function reputationColor(score){
		if(score == null) return '#ccc';
		return '#fff'; // actual background handled by gradient classes now
	}
	function formatRestriction(key){
		const map = {
			canReport:'Peut signaler',
			canComment:'Peut commenter',
			canPost:'Peut publier',
			canMessage:'Peut envoyer messages',
			canJoinEvents:'Peut rejoindre évènements',
			canVote:'Peut voter',
			reviewPending:'Modération requise',
			forceModeration:'Modération requise',
			needsModeration:'Modération requise',
			isBanned:'Banni',
			quarantine:'Quarantaine'
		};
		return map[key] || key;
	}
	function restrictionsList(rep){
		if(!rep?.restrictions){
			return `<div class="empty-card"><span class="material-icons">hourglass_empty</span>Aucune donnée</div>`;
		}
		const r = rep.restrictions; const keys = Object.keys(r).filter(k=>typeof r[k]==='boolean');
		if(!keys.length) return `<div class="empty-card"><span class="material-icons">hourglass_empty</span>Aucune donnée</div>`;
		return keys.map(k=>{
			const val = r[k];
			let allowed;
			if(k==='isBanned') { allowed = !val; } else { allowed = val===true; }
			const label = formatRestriction(k);
			const stateLabel = allowed? 'Oui' : 'Non';
			return `<div class="restriction-item ${allowed?'allowed':'blocked'}"><span class="material-icons" style="font-size:16px;">${allowed?'check_circle':'block'}</span>${label}: <strong class="yn ${allowed?'yes':'no'}">${stateLabel}</strong></div>`;
		}).join('');
	}
	function formatTs(ts){ if(!ts) return '—'; if(ts.toDate) ts=ts.toDate(); return new Date(ts).toLocaleString('fr-FR'); }
	function buildActivities(list){
		if(!list?.length) return '<div class="card empty-activity"><span class="material-icons" style="font-size:18px;opacity:.6;">history</span><span style="opacity:.7;">Aucune action récente</span></div>';
		return `<div class="card activity-card"><ul class="activity-list">${list.map(a=>`<li class="activity-row"><span class="act-type">${a.type||a.action||'action'}</span><span class="act-time">${formatTs(a.timestamp?.toDate?.()||a.timestamp)}</span></li>`).join('')}</ul></div>`;
	}
	function buildAdminHistory(actions=[], notes=[]){
		const actionsHtml = (actions||[]).length? actions.map(a=>`<div class="history-item"><span class="material-icons" style="font-size:16px;">gavel</span><strong>${a.action||a.type}</strong><span style="opacity:.6;">${formatTs(a.timestamp?.toDate?.()||a.timestamp)}</span></div>`).join('') : '';
		const notesHtml = (notes||[]).length? notes.map(n=>`<div class="history-item"><span class="material-icons" style="font-size:16px;">note</span><strong>${n.category||'note'}</strong><span>${n.note||''}</span><span style="opacity:.5;">${formatTs(n.timestamp?.toDate?.()||n.timestamp)}</span></div>`).join('') : '';
		return actionsHtml + notesHtml; // ne rien afficher si vide
	}
	function buildQuickActions(userId, rep, isAdmin){
		const r = rep?.restrictions||{}; 
		const blockedReports = r.canReport===false; 
		const blockedVotes = r.canVote===false; 
		const forced = r.reviewPending===true || r.forceModeration===true; 
		const fullyBanned = r.isBanned === true || (r.canPost===false && r.canComment===false && r.canReport===false && r.canMessage===false);
		const quarantined = r.quarantine === true;
		return `<div class="quick-actions-grid">
			<button class="action-btn ${quarantined?'secondary':'danger'}" data-profile-action="${quarantined?ACTIONS.UNQUARANTINE:ACTIONS.QUARANTINE}" data-user="${userId}">${quarantined?'Fin quarantaine':'Quarantaine'}</button>
			<button class="action-btn danger" data-profile-action="${ACTIONS.BAN_24}" data-user="${userId}">Bannir 24h</button>
			<button class="action-btn danger" data-profile-action="${ACTIONS.BAN_7}" data-user="${userId}">Bannir 7j</button>
			<button class="action-btn danger" data-profile-action="${ACTIONS.BAN_PERM}" data-user="${userId}">Bannissement permanent</button>
			${fullyBanned?`<button class="action-btn" data-profile-action="${ACTIONS.UNBAN}" data-user="${userId}">Débannir</button>`:''}
			<button class="action-btn ${blockedReports?'secondary':''}" data-profile-action="${blockedReports?ACTIONS.UNBLOCK_REPORTS:ACTIONS.BLOCK_REPORTS}" data-user="${userId}">${blockedReports?'Débloquer signalements':'Bloquer signalements'}</button>
			<button class="action-btn ${blockedVotes?'secondary':''}" data-profile-action="${blockedVotes?ACTIONS.UNBLOCK_VOTES:ACTIONS.BLOCK_VOTES}" data-user="${userId}">${blockedVotes?'Débloquer votes':'Bloquer votes'}</button>
			<button class="action-btn ${forced?'secondary':''}" data-profile-action="${forced?ACTIONS.REMOVE_MOD:ACTIONS.FORCE_MOD}" data-user="${userId}">${forced?'Retirer modération':'Forcer modération'}</button>
			<button class="action-btn" data-profile-action="${ACTIONS.RESET_REP}" data-user="${userId}">Réinitialiser réputation</button>
			<button class="action-btn" data-profile-action="${ACTIONS.ADD_NOTE}" data-user="${userId}">Ajouter une note</button>
			${isAdmin?`<button class="action-btn" data-profile-action="revoke" data-user="${userId}">Révoquer admin</button>`:''}
		</div>`;
	}
	function buildReputationPanel(reputation){
		// Normalisation des champs possibles (compat web/mobile / anciennes versions)
		const raw = reputation || {};
		const score = (raw.reputationScore ?? raw.score ?? raw.points ?? 0);
		// Certains schémas utilisent totalReports, d'autres reportsCreated / createdReports
		const stats = raw.stats || raw.reportStats || {};
		const created = (raw.totalReports ?? raw.reportsCreated ?? raw.createdReports ?? stats.total ?? stats.created ?? 0);
		const validated = (raw.reportsValidated ?? raw.validatedReports ?? raw.approvedReports ?? stats.validated ?? stats.approved ?? 0);
		const flagged = (raw.reportsFlagged ?? raw.flaggedReports ?? raw.reportedReports ?? stats.flagged ?? stats.reported ?? 0);
		const votes = (raw.votes ?? raw.voteCount ?? raw.totalVotes ?? stats.votes ?? stats.totalVotes ?? 0);
		let gradientClass = 'gradient-low';
		if(score >= 25) gradientClass='gradient-mid';
		if(score >= 60) gradientClass='gradient-high';
		if(score >= 100) gradientClass='gradient-top';
		return `<div class="reputation-panel">
			<div class="rep-score-tile ${gradientClass}"><span class="rep-points">${score}</span><span class="rep-label">points</span></div>
			<div class="rep-stats">
				<div class="rep-row"><span>Signalements créés</span><strong>${created}</strong></div>
				<div class="rep-row"><span>Signalements validés</span><strong>${validated}</strong></div>
				<div class="rep-row"><span>Signalements signalés</span><strong>${flagged}</strong></div>
				<div class="rep-row"><span>Votes</span><strong>${votes}</strong></div>
			</div>
		</div>`;
	}

	// Enhanced UI builder functions for Phase 2
	function buildEnhancedReputationPanel(reputation){
		// Normalisation des champs possibles (compat web/mobile / anciennes versions)
		const raw = reputation || {};
		const score = (raw.reputationScore ?? raw.score ?? raw.points ?? 0);
		const stats = raw.stats || raw.reportStats || {};
		const created = (raw.totalReports ?? raw.reportsCreated ?? raw.createdReports ?? stats.total ?? stats.created ?? 0);
		const validated = (raw.reportsValidated ?? raw.validatedReports ?? raw.approvedReports ?? stats.validated ?? stats.approved ?? 0);
		const flagged = (raw.reportsFlagged ?? raw.flaggedReports ?? raw.reportedReports ?? stats.flagged ?? stats.reported ?? 0);
		const votes = (raw.votes ?? raw.voteCount ?? raw.totalVotes ?? stats.votes ?? stats.totalVotes ?? 0);
		
		let levelClass = 'level-1';
		if(score >= 25) levelClass='level-2';
		if(score >= 60) levelClass='level-3';
		if(score >= 100) levelClass='level-4';
		if(score >= 200) levelClass='level-5';
		
		return `<div class="enhanced-card reputation-main-card">
			<div class="card-header">
				<h4><span class="material-icons">star</span>Réputation détaillée</h4>
			</div>
			<div class="card-body">
				<div class="reputation-score-section">
					<div class="reputation-score-tile ${levelClass}">
						<span class="score-value">${score}</span>
						<span class="score-label">points de réputation</span>
					</div>
				</div>
				<div class="reputation-stats-grid">
					<div class="reputation-stat">
						<span class="material-icons">report</span>
						<div class="stat-info">
							<span class="stat-value">${created}</span>
							<span class="stat-label">Signalements créés</span>
						</div>
					</div>
					<div class="reputation-stat">
						<span class="material-icons">verified</span>
						<div class="stat-info">
							<span class="stat-value">${validated}</span>
							<span class="stat-label">Signalements validés</span>
						</div>
					</div>
					<div class="reputation-stat">
						<span class="material-icons">flag</span>
						<div class="stat-info">
							<span class="stat-value">${flagged}</span>
							<span class="stat-label">Signalements signalés</span>
						</div>
					</div>
					<div class="reputation-stat">
						<span class="material-icons">how_to_vote</span>
						<div class="stat-info">
							<span class="stat-value">${votes}</span>
							<span class="stat-label">Votes émis</span>
						</div>
					</div>
				</div>
			</div>
		</div>`;
	}

	function buildEnhancedActivities(list){
		if(!list?.length) {
			return `<div class="empty-state">
				<span class="material-icons">history</span>
				<p>Aucune action récente</p>
			</div>`;
		}
		
		return `<div class="enhanced-activity-list">
			${list.map(activity => `
				<div class="activity-item">
					<span class="material-icons activity-icon">${getActivityIcon(activity.type || activity.action)}</span>
					<div class="activity-details">
						<span class="activity-type">${formatActivityType(activity.type || activity.action)}</span>
						<span class="activity-time">${formatTs(activity.timestamp?.toDate?.() || activity.timestamp)}</span>
					</div>
				</div>
			`).join('')}
		</div>`;
	}

	function buildEnhancedAdminPanel(userId, reputation, targetIsAdmin, adminActions, adminNotes){
		return `<div class="enhanced-card admin-panel-card">
			<div class="card-header">
				<h4><span class="material-icons">admin_panel_settings</span>Panneau d'administration</h4>
				<span class="chip admin">ADMIN</span>
			</div>
			<div class="card-body">
				<div class="admin-actions-section">
					<h5 class="section-title">Actions rapides</h5>
					<div class="enhanced-quick-actions">
						${buildEnhancedQuickActions(userId, reputation, targetIsAdmin)}
					</div>
				</div>
				<div class="admin-actions-section">
					<h5 class="section-title">Actions avancées</h5>
					<div class="enhanced-advanced-actions">
						<button class="enhanced-action-btn secondary" data-adv-action="adjust-score" data-user="${userId}">
							<span class="material-icons">tune</span>
							Ajuster le score
						</button>
						<button class="enhanced-action-btn secondary" data-adv-action="manage-restrictions" data-user="${userId}">
							<span class="material-icons">settings</span>
							Gérer les restrictions
						</button>
					</div>
				</div>
			</div>
		</div>
		${buildAdminHistoryCard(adminActions, adminNotes)}`;
	}

	function buildAdminHistoryCard(adminActions, adminNotes){
		const hasHistory = (adminActions?.length > 0) || (adminNotes?.length > 0);
		
		if (!hasHistory) {
			return `<div class="enhanced-card admin-history-card">
				<div class="card-header">
					<h4><span class="material-icons">history</span>Historique administratif</h4>
				</div>
				<div class="card-body">
					<div class="empty-state">
						<span class="material-icons">history</span>
						<p>Aucun historique administratif</p>
					</div>
				</div>
			</div>`;
		}

		return `<div class="enhanced-card admin-history-card">
			<div class="card-header">
				<h4><span class="material-icons">history</span>Historique administratif</h4>
			</div>
			<div class="card-body">
				<div class="admin-history-list">
					${(adminActions || []).map(action => `
						<div class="history-item admin-action">
							<span class="material-icons">gavel</span>
							<div class="history-details">
								<span class="history-action">${action.action || action.type}</span>
								<span class="history-time">${formatTs(action.timestamp?.toDate?.() || action.timestamp)}</span>
							</div>
						</div>
					`).join('')}
					${(adminNotes || []).map(note => `
						<div class="history-item admin-note">
							<span class="material-icons">note</span>
							<div class="history-details">
								<span class="history-action">${note.category || 'Note'}</span>
								<span class="history-content">${note.note || ''}</span>
								<span class="history-time">${formatTs(note.timestamp?.toDate?.() || note.timestamp)}</span>
							</div>
						</div>
					`).join('')}
				</div>
			</div>
		</div>`;
	}

	function buildEnhancedQuickActions(userId, reputation, targetIsAdmin){
		const r = reputation?.restrictions || {};
		const blockedReports = r.canReport === false;
		const blockedVotes = r.canVote === false;
		const forced = r.reviewPending === true || r.forceModeration === true;
		const fullyBanned = r.isBanned === true || (r.canPost === false && r.canComment === false && r.canReport === false && r.canMessage === false);
		const quarantined = r.quarantine === true;

		return `<div class="quick-actions-grid">
			<button class="enhanced-action-btn ${quarantined ? 'secondary' : 'danger'}" data-profile-action="${quarantined ? ACTIONS.UNQUARANTINE : ACTIONS.QUARANTINE}" data-user="${userId}">
				<span class="material-icons">${quarantined ? 'lock_open' : 'lock'}</span>
				${quarantined ? 'Fin quarantaine' : 'Quarantaine'}
			</button>
			<button class="enhanced-action-btn danger" data-profile-action="${ACTIONS.BAN_24}" data-user="${userId}">
				<span class="material-icons">schedule</span>
				Bannir 24h
			</button>
			<button class="enhanced-action-btn danger" data-profile-action="${ACTIONS.BAN_7}" data-user="${userId}">
				<span class="material-icons">event</span>
				Bannir 7j
			</button>
			<button class="enhanced-action-btn danger" data-profile-action="${ACTIONS.BAN_PERM}" data-user="${userId}">
				<span class="material-icons">block</span>
				Bannir définitivement
			</button>
			${fullyBanned ? `<button class="enhanced-action-btn success" data-profile-action="${ACTIONS.UNBAN}" data-user="${userId}">
				<span class="material-icons">lock_open</span>
				Débannir
			</button>` : ''}
			<button class="enhanced-action-btn ${blockedReports ? 'secondary' : 'warning'}" data-profile-action="${blockedReports ? ACTIONS.UNBLOCK_REPORTS : ACTIONS.BLOCK_REPORTS}" data-user="${userId}">
				<span class="material-icons">${blockedReports ? 'report' : 'report_off'}</span>
				${blockedReports ? 'Débloquer signalements' : 'Bloquer signalements'}
			</button>
			<button class="enhanced-action-btn ${blockedVotes ? 'secondary' : 'warning'}" data-profile-action="${blockedVotes ? ACTIONS.UNBLOCK_VOTES : ACTIONS.BLOCK_VOTES}" data-user="${userId}">
				<span class="material-icons">${blockedVotes ? 'how_to_vote' : 'vote_disabled'}</span>
				${blockedVotes ? 'Débloquer votes' : 'Bloquer votes'}
			</button>
			<button class="enhanced-action-btn ${forced ? 'secondary' : 'warning'}" data-profile-action="${forced ? ACTIONS.REMOVE_MOD : ACTIONS.FORCE_MOD}" data-user="${userId}">
				<span class="material-icons">${forced ? 'visibility_off' : 'visibility'}</span>
				${forced ? 'Retirer modération' : 'Forcer modération'}
			</button>
			<button class="enhanced-action-btn warning" data-profile-action="${ACTIONS.RESET_REP}" data-user="${userId}">
				<span class="material-icons">refresh</span>
				Réinitialiser réputation
			</button>
			<button class="enhanced-action-btn secondary" data-profile-action="${ACTIONS.ADD_NOTE}" data-user="${userId}">
				<span class="material-icons">note_add</span>
				Ajouter une note
			</button>
			${targetIsAdmin ? `<button class="enhanced-action-btn danger" data-profile-action="revoke" data-user="${userId}">
				<span class="material-icons">remove_moderator</span>
				Révoquer admin
			</button>` : ''}
		</div>`;
	}

	// Utility functions for enhanced UI
	function getActivityIcon(activityType) {
		const iconMap = {
			'report': 'report',
			'vote': 'how_to_vote',
			'comment': 'comment',
			'post': 'post_add',
			'message': 'message',
			'login': 'login',
			'logout': 'logout',
			'default': 'history'
		};
		return iconMap[activityType] || iconMap.default;
	}

	function formatActivityType(activityType) {
		const typeMap = {
			'report': 'Signalement',
			'vote': 'Vote',
			'comment': 'Commentaire',
			'post': 'Publication',
			'message': 'Message',
			'login': 'Connexion',
			'logout': 'Déconnexion'
		};
		return typeMap[activityType] || activityType || 'Action';
	}

	async function buildModal(data, options){
		const {userId,userData,reputation,recentActions,adminActions,adminNotes} = data;
		// Fallback complet du score
		const normalizedScore = (reputation?.reputationScore ?? reputation?.score ?? reputation?.points ?? 0);
		const repScore = normalizedScore;
		const repColor = reputationColor(normalizedScore);
		let totalReports = (reputation?.totalReports ?? reputation?.reportsCreated ?? reputation?.createdReports ?? reputation?.stats?.total ?? 0);
		let violationCount = (reputation?.violationCount ?? reputation?.violations ?? 0);
		const isBlocked = reputation?.restrictions?.canReport === false;
		const bannedUntil = reputation?.restrictions?.bannedUntil || reputation?.restrictions?.banUntil;
		const forced = reputation?.restrictions?.reviewPending || reputation?.restrictions?.forceModeration;
		const description = userData.description || userData.bio || '';
		// Détection viewer admin (utilisateur connecté)
		let viewerIsAdmin=false; try { const me = firebase.auth().currentUser; if(me){ const doc = await firebase.firestore().collection('users').doc(me.uid).get(); viewerIsAdmin = doc.exists && doc.data().isAdmin === true; } } catch(e){}
		const targetIsAdmin = userData.isAdmin === true;
		const showAdminPanel = viewerIsAdmin || targetIsAdmin || options?.showModerationButtons;
		// Recompute reports count si 0 et user a potentiellement des reports (sécurité)
		if(totalReports===0){
			try {
				const snap = await firebase.firestore().collection('report').where('userId','==',userId).limit(300).get();
				totalReports = snap.size;
				if(totalReports>0) violationCount = violationCount; // placeholder si on veut dériver plus tard
			} catch(e) { console.warn('Recompute reports échoué', e); }
		}
		// Préparer stats activité
		const activityCount = recentActions?.length || 0;
		let lastActivityLabel = '—';
		if(recentActions?.length){
			const latestTs = recentActions[0].timestamp?.toDate?.()||recentActions[0].timestamp;
			if(latestTs){
				const diffMs = Date.now() - new Date(latestTs).getTime();
				const diffHours = Math.floor(diffMs/3600000);
				if(diffHours<1) lastActivityLabel = "<1h"; else if(diffHours<24) lastActivityLabel = diffHours+"h"; else { const days=Math.floor(diffHours/24); lastActivityLabel = days+"j"; }
			}
		}
		const modal = document.createElement('div');
		modal.className='modal'; modal.style.display='flex';
		modal.innerHTML = `<div class="modal-content profile-modal enhanced-profile">
			<div class="modal-header">
				<h2><span class="material-icons" style="margin-right: 8px;">account_circle</span>Profil utilisateur</h2>
				<button class="close-btn" data-close-profile>
					<span class="material-icons">close</span>
				</button>
			</div>
			<div class="modal-body">
				<div class="enhanced-card profile-header-card">
					<div class="card-header">
						<div class="card-avatar">
							${userData.profilePicture||userData.profile_pic?`<img src="${userData.profilePicture||userData.profile_pic}" alt="${userData.username}">`:'<span class="material-icons">account_circle</span>'}
						</div>
						<div class="card-user-info">
							<h3 class="card-username">${userData.username||'Utilisateur'}</h3>
							<p class="card-user-id">${userId}</p>
							<div class="card-chips">
								${targetIsAdmin?'<span class="chip admin"><span class="material-icons">admin_panel_settings</span>Admin</span>':''}
								${isBlocked?'<span class="chip blocked"><span class="material-icons">block</span>Banni</span>':''}
								${forced?'<span class="chip level-3"><span class="material-icons">warning</span>Modération requise</span>':''}
							</div>
						</div>
					</div>
					${description?`<div class="card-body">
						<div class="user-description">
							<span class="material-icons">info</span>
							<div>${description}</div>
						</div>
					</div>`:''}
				</div>

				<div class="enhanced-tab-bar">
					<button class="enhanced-tab-btn active" data-tab="overview">
						<span class="material-icons">dashboard</span>
						Aperçu
					</button>
					<button class="enhanced-tab-btn" data-tab="reputation">
						<span class="material-icons">star</span>
						Réputation
					</button>
					<button class="enhanced-tab-btn" data-tab="restrictions">
						<span class="material-icons">block</span>
						Restrictions
					</button>
					<button class="enhanced-tab-btn" data-tab="activity">
						<span class="material-icons">history</span>
						Activité
					</button>
					<button class="enhanced-tab-btn" data-tab="admin">
						<span class="material-icons">admin_panel_settings</span>
						Administrateur
					</button>
				</div>

				<div class="enhanced-tab-panels">
					<div class="enhanced-tab-panel active" data-panel="overview">
						<div class="profile-cards-grid">
							<div class="enhanced-card profile-info-card">
								<div class="card-header">
									<h4><span class="material-icons">info</span>Informations</h4>
								</div>
								<div class="card-body">
									<div class="profile-info-grid">
										<div class="info-item">
											<span class="info-label">Email</span>
											<span class="info-value">${userData.email||'N/A'}</span>
										</div>
										<div class="info-item">
											<span class="info-label">Réputation</span>
											<span class="info-value reputation-score">${repScore}</span>
										</div>
										<div class="info-item">
											<span class="info-label">Signalements</span>
											<span class="info-value">${totalReports}</span>
										</div>
										<div class="info-item">
											<span class="info-label">Violations</span>
											<span class="info-value">${violationCount}</span>
										</div>
										<div class="info-item">
											<span class="info-label">Ban jusqu'à</span>
											<span class="info-value">${bannedUntil?formatTs(bannedUntil):'—'}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
						${forced?'<div class="enhanced-card warning-card"><div class="card-body"><span class="material-icons">warning</span>Modération requise (forcée)</div></div>':''}
					</div>

					<div class="enhanced-tab-panel" data-panel="reputation">
						${buildEnhancedReputationPanel(reputation)}
					</div>

					<div class="enhanced-tab-panel" data-panel="restrictions">
						<div class="enhanced-card restrictions-card">
							<div class="card-header">
								<h4><span class="material-icons">block</span>Restrictions actives</h4>
							</div>
							<div class="card-body">
								${restrictionsList(reputation)}
							</div>
						</div>
					</div>

					<div class="enhanced-tab-panel" data-panel="activity">
						<div class="activity-cards-grid">
							<div class="enhanced-card activity-stats-card">
								<div class="card-header">
									<h4><span class="material-icons">bar_chart</span>Statistiques d'activité</h4>
								</div>
								<div class="card-body">
									<div class="activity-stats-grid">
										<div class="activity-stat">
											<span class="material-icons">history</span>
											<div class="stat-info">
												<span class="stat-value">${activityCount}</span>
												<span class="stat-label">Actions récentes</span>
											</div>
										</div>
										<div class="activity-stat">
											<span class="material-icons">schedule</span>
											<div class="stat-info">
												<span class="stat-value">${lastActivityLabel}</span>
												<span class="stat-label">Dernière activité</span>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="enhanced-card activity-list-card">
								<div class="card-header">
									<h4><span class="material-icons">list</span>Actions récentes</h4>
								</div>
								<div class="card-body">
									${buildEnhancedActivities(recentActions)}
								</div>
							</div>
						</div>
					</div>

					<div class="enhanced-tab-panel" data-panel="admin">
						${showAdminPanel?buildEnhancedAdminPanel(userId,reputation,targetIsAdmin,adminActions,adminNotes):buildAdminHistoryCard(adminActions,adminNotes)}
					</div>
				</div>
			</div>
		</div>`;
		modal.addEventListener('click', e=>{ if(e.target===modal || e.target.hasAttribute('data-close-profile')) modal.remove(); });
		modal.addEventListener('click', e=>{
			const tabBtn = e.target.closest('.enhanced-tab-btn') || e.target.closest('.tab-btn'); 
			if(tabBtn){
				const tab = tabBtn.getAttribute('data-tab');
				modal.querySelectorAll('.enhanced-tab-btn, .tab-btn').forEach(b=>b.classList.toggle('active', b===tabBtn));
				modal.querySelectorAll('.enhanced-tab-panel, .tab-panel').forEach(p=>p.classList.toggle('active', p.getAttribute('data-panel')===tab));
			}
		});
		document.body.appendChild(modal);
	}

	async function handleModerationAction(e){
		// Advanced admin actions (score adjust / restrictions)
		const advBtn = e.target.closest('[data-adv-action]');
		if(advBtn){
			const action = advBtn.getAttribute('data-adv-action');
			const userId = advBtn.getAttribute('data-user');
			if(action==='adjust-score') return openAdjustScoreModal(userId);
			if(action==='manage-restrictions') return openRestrictionsModal(userId);
		}
		const btn = e.target.closest('[data-profile-action]');
		if(!btn) return;
		const action = btn.getAttribute('data-profile-action');
		const userId = btn.getAttribute('data-user');
		const firestore = firebase.firestore();
		try {
			const ref = firestore.collection('user_reputation').doc(userId);
			if(action===ACTIONS.QUARANTINE || action===ACTIONS.UNQUARANTINE){
				if(action===ACTIONS.QUARANTINE){
					if(!confirm("Mettre l’utilisateur en quarantaine (limitation publication/commentaire) ?")) return;
					await ref.set({ 'restrictions.quarantine': true, 'restrictions.canPost': false, 'restrictions.canComment': false }, {merge:true});
				} else {
					await ref.set({ 'restrictions.quarantine': false, 'restrictions.canPost': true, 'restrictions.canComment': true }, {merge:true});
				}
			} else if(action===ACTIONS.BAN_24 || action===ACTIONS.BAN_7 || action===ACTIONS.BAN_PERM){
				const hours = action===ACTIONS.BAN_24?24: action===ACTIONS.BAN_7?24*7: (24*365*10);
				if(!confirm('Confirmer bannissement '+(hours>=24*365?'permanent':hours+'h')+' ?')) return;
				const until = new Date(Date.now()+hours*3600000);
				await ref.set({restrictions:{canReport:false,canComment:false,canPost:false,canMessage:false,canJoinEvents:false,isBanned:true,bannedUntil: firebase.firestore.Timestamp.fromDate(until), reason:'Ban via dashboard', blockedAt: firebase.firestore.FieldValue.serverTimestamp()}, lastUpdated: firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
			} else if(action===ACTIONS.UNBAN){
				if(!confirm('Lever le bannissement ?')) return;
				await ref.set({ 'restrictions.isBanned':false, 'restrictions.bannedUntil': firebase.firestore.FieldValue.delete(), 'restrictions.canReport':true,'restrictions.canComment':true,'restrictions.canPost':true,'restrictions.canMessage':true,'restrictions.canJoinEvents':true,'restrictions.reason': firebase.firestore.FieldValue.delete()}, {merge:true});
			} else if(action===ACTIONS.BLOCK_REPORTS || action===ACTIONS.UNBLOCK_REPORTS){
				await ref.set({ 'restrictions.canReport': action===ACTIONS.UNBLOCK_REPORTS }, {merge:true});
			} else if(action===ACTIONS.BLOCK_VOTES || action===ACTIONS.UNBLOCK_VOTES){
				await ref.set({ 'restrictions.canVote': action===ACTIONS.UNBLOCK_VOTES }, {merge:true});
			} else if(action===ACTIONS.FORCE_MOD || action===ACTIONS.REMOVE_MOD){
				await ref.set({ 'restrictions.reviewPending': action===ACTIONS.FORCE_MOD }, {merge:true});
			} else if(action===ACTIONS.RESET_REP){
				if(!confirm('Réinitialiser la réputation ?')) return;
				await ref.set({ reputationScore:0, totalReports:0, violationCount:0, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
			} else if(action===ACTIONS.ADD_NOTE){
				const note = prompt('Texte de la note administrateur:');
				if(note && note.trim().length){
					const adminId = (firebase.auth().currentUser||{}).uid || 'admin';
					await firestore.collection('admin_notes').add({ userId, adminId, note: note.trim(), category:'note', timestamp: firebase.firestore.FieldValue.serverTimestamp() });
				}
			} else if(action==='revoke'){
				if(!confirm('Révoquer les droits administrateur ?')) return;
				await firestore.collection('users').doc(userId).update({isAdmin:false,adminRevokedAt: firebase.firestore.FieldValue.serverTimestamp()});
			}
			alert('Action effectuée');
			document.querySelectorAll('.modal').forEach(m=>m.remove());
			// Clear cache to reload fresh data
			cache.delete(userId);
			openProfileModal(userId,{showModerationButtons:true});
		} catch(err){ console.error('❌ Moderation action failed', err); alert('Erreur action modération'); }
	}
	document.addEventListener('click', handleModerationAction);

	async function openProfileModal(userId, options={}){
		try { const data = await fetchUser(userId); await buildModal(data, options);} catch(e){ console.error('❌ Profil introuvable', e); alert(e.message||'Profil introuvable'); }
	}
	window.openProfileModal = openProfileModal;

	// ===== Modales avancées =====
	async function openAdjustScoreModal(userId){
		let repDoc; try { repDoc = await firebase.firestore().collection('user_reputation').doc(userId).get(); } catch(e){}
		const current = repDoc?.data()?.reputationScore ?? 0;
		const modal = document.createElement('div');
		modal.className='modal';
		modal.innerHTML = `<div class="adjust-score-modal">
			<h2 class="adjust-score-header"><span class="material-icons" style="color:#bb86fc;">tune</span>Ajuster le score</h2>
			<div class="adjust-current">Score actuel: <strong>${current}</strong></div>
			<div class="adjust-buttons-grid">
				<button class="adjust-btn negative" data-delta="-50">-50</button>
				<button class="adjust-btn negative" data-delta="-25">-25</button>
				<button class="adjust-btn negative" data-delta="-10">-10</button>
				<button class="adjust-btn positive" data-delta="10">+10</button>
				<button class="adjust-btn positive" data-delta="25">+25</button>
				<button class="adjust-btn positive" data-delta="50">+50</button>
			</div>
			<textarea class="adjust-reason" placeholder="Raison (obligatoire)"></textarea>
			<div class="adjust-apply-row"><button class="btn-text" data-close-modal>Annuler</button><button class="btn-primary" disabled data-apply-score>Appliquer</button></div>
		</div>`;
		modal.addEventListener('click', ev=>{ if(ev.target===modal || ev.target.hasAttribute('data-close-modal')) modal.remove(); });
		const reasonEl = modal.querySelector('.adjust-reason');
		const applyBtn = modal.querySelector('[data-apply-score]');
		modal.querySelectorAll('.adjust-btn').forEach(btn=>btn.addEventListener('click',()=>{
			modal.querySelectorAll('.adjust-btn').forEach(b=>b.classList.remove('selected'));
			btn.classList.add('selected');
			applyBtn.dataset.delta = btn.getAttribute('data-delta');
			checkValidity();
		}));
		reasonEl.addEventListener('input', checkValidity);
		function checkValidity(){ applyBtn.disabled = !(applyBtn.dataset.delta && reasonEl.value.trim().length>2); }
		applyBtn.addEventListener('click', async ()=>{
			const delta = parseInt(applyBtn.dataset.delta,10)||0; const reason = reasonEl.value.trim();
			try {
				await firebase.firestore().collection('user_reputation').doc(userId).set({ reputationScore: firebase.firestore.FieldValue.increment(delta) }, {merge:true});
				await firebase.firestore().collection('admin_actions').add({ targetId:userId, action:'adjustScore', delta, reason, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
				modal.remove();
				cache.delete(userId); openProfileModal(userId,{showModerationButtons:true});
			} catch(err){ alert('Erreur ajustement score'); console.error(err); }
		});
		document.body.appendChild(modal);
	}

	async function openRestrictionsModal(userId){
		let repData={}; try { const doc=await firebase.firestore().collection('user_reputation').doc(userId).get(); if(doc.exists) repData=doc.data(); } catch(e){}
		const r = repData.restrictions||{};
		const modal = document.createElement('div'); modal.className='modal';
		modal.innerHTML = `<div class="restrictions-modal">
			<h2 style="margin:0; display:flex; gap:10px; align-items:center; font-size:22px;"><span class="material-icons" style="color:#bb86fc;">settings</span>Gérer restrictions</h2>
			<div class="restrictions-group">
				<div class="restriction-toggle-card" data-key="canReport">
					<div class="restriction-toggle-info"><strong>Bloquer signalements</strong><span>Empêche la création de nouveaux signalements</span></div>
					<label class="switch"><input type="checkbox" ${r.canReport===false?'':'checked'}><span class="slider round"></span></label>
				</div>
				<div class="restriction-toggle-card" data-key="canVote">
					<div class="restriction-toggle-info"><strong>Bloquer votes</strong><span>Empêche de voter sur les signalements</span></div>
					<label class="switch"><input type="checkbox" ${r.canVote===false?'':'checked'}><span class="slider round"></span></label>
				</div>
				<div class="restriction-toggle-card" data-key="reviewPending">
					<div class="restriction-toggle-info"><strong>Forcer modération</strong><span>Chaque action nécessitera un examen</span></div>
					<label class="switch"><input type="checkbox" ${r.reviewPending===true||r.forceModeration===true?'checked':''}><span class="slider round"></span></label>
				</div>
			</div>
			<div class="restrictions-footer"><button class="btn-text" data-close-modal>Fermer</button></div>
		</div>`;
		modal.addEventListener('click', ev=>{ if(ev.target===modal || ev.target.hasAttribute('data-close-modal')) modal.remove(); });
		modal.querySelectorAll('.restriction-toggle-card input').forEach(input=>{
			input.addEventListener('change', async ()=>{
				const card = input.closest('.restriction-toggle-card'); const key=card.dataset.key; const value=input.checked;
				try {
					const updates={};
					if(key==='reviewPending'){ updates['restrictions.reviewPending']=value; }
					else { updates[`restrictions.${key}`]=value; }
					await firebase.firestore().collection('user_reputation').doc(userId).set(updates,{merge:true});
					await firebase.firestore().collection('admin_actions').add({ targetId:userId, action:'toggleRestriction', key, value, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
					cache.delete(userId);
				} catch(err){ console.error(err); alert('Erreur mise à jour restriction'); }
			});
		});
		document.body.appendChild(modal);
	}
})();
