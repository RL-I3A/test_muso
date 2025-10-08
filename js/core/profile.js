// Composant profil utilisateur unifié
// Usage: openProfileModal(userId, { showModerationButtons: true })

// Attendre que tous les services soient chargés
function waitForServices() {
  return new Promise((resolve) => {
    function check() {
      if (typeof AdminActionsService !== 'undefined' && typeof firebase !== 'undefined') {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    }
    check();
  });
}

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
			// Support ancien champ targetId et nouveau champ userId
			const q1 = firestore.collection('admin_actions').where('targetId','==',userId).orderBy('timestamp','desc').limit(30);
			const q2 = firestore.collection('admin_actions').where('userId','==',userId).orderBy('timestamp','desc').limit(30);
			let results = [];
			try { const s1 = await q1.get(); results = results.concat(s1.docs); } catch(_){ }
			try { const s2 = await q2.get(); results = results.concat(s2.docs); } catch(_){ }
			// dédoublonner par id
			const uniq = {}; results.forEach(d=>{ uniq[d.id]=d; });
			adminActions = Object.values(uniq).map(d=>({id:d.id,...d.data()})).sort((a,b)=> (b.timestamp?.toMillis?.()||0)-(a.timestamp?.toMillis?.()||0));
		} catch(e){ console.warn('Admin actions load failed', e); }
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
		const actionsHtml = (actions||[]).length? actions.map(a=>`<div class="history-item"><span class="material-icons" style="font-size:16px;">gavel</span><strong>${a.actionType||a.action||a.type||'action'}</strong><span style="opacity:.6;">${formatTs(a.timestamp?.toDate?.()||a.timestamp)}</span></div>`).join('') : '';
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
		modal.innerHTML = `<div class="modal-content profile-modal">
			<div class="modal-header"><h2>Profil utilisateur</h2><button class="close-btn" data-close-profile>Fermer</button></div>
			<div class="modal-body">
				<div class="profile-header">
					<div class="avatar">${userData.profilePicture||userData.profile_pic?`<img src="${userData.profilePicture||userData.profile_pic}" alt="${userData.username}">`:'<span class="material-icons">account_circle</span>'}</div>
					<div class="identity"><h2>${userData.username||'Utilisateur'}</h2><code>${userId}</code><div class="chips">${targetIsAdmin?'<span class="chip admin">Admin</span>':''}${isBlocked?'<span class="chip blocked">Banni</span>':''}${forced?'<span class="chip suspicious-medium">Modération requise</span>':''}</div>${description?`<div class="user-description"><span class="material-icons" style="font-size:16px;opacity:.7;">info</span><div>${description}</div></div>`:''}</div>
				</div>
				<div class="tab-bar">
					<button class="tab-btn active" data-tab="overview">Aperçu</button>
					<button class="tab-btn" data-tab="restrictions">Restrictions</button>
					<button class="tab-btn" data-tab="activity">Activité</button>
					<button class="tab-btn" data-tab="admin">Administrateur</button>
				</div>
				<div class="tab-panels">
					<div class="tab-panel active" data-panel="overview">
						<div class="profile-grid">
							<div class="item"><label>Email</label><span class="value">${userData.email||'N/A'}</span></div>
							<div class="item"><label>Réputation</label><span class="value" style="color:${repColor}">${repScore}</span></div>
							<div class="item"><label>Signalements</label><span class="value">${totalReports}</span></div>
							<div class="item"><label>Violations</label><span class="value">${violationCount}</span></div>
							<div class="item"><label>Ban jusqu'à</label><span class="value">${bannedUntil?formatTs(bannedUntil):'—'}</span></div>
						</div>
						${buildReputationPanel(reputation)}
						${forced?'<div class="restriction-item" style="margin-top:12px;">Modération requise (forcée)</div>':''}
						${showAdminPanel?`<div class="admin-actions-wrapper" style="display:block;">
							<div class="admin-actions-card">
								<h3><span class="material-icons" style="font-size:22px;color:#bb86fc;">admin_panel_settings</span> Actions administrateur <span class="admin-badge">ADMIN</span></h3>
								<div class="quick-actions-category-label">Actions rapides</div>
								${buildQuickActions(userId,reputation,targetIsAdmin)}
								<div class="quick-actions-category-label" style="margin-top:22px;">Actions avancées</div>
								<div class="advanced-actions-row">
									<button class="advanced-btn" data-adv-action="adjust-score" data-user="${userId}"><span class="material-icons">tune</span>Ajuster le score</button>
									<button class="advanced-btn" data-adv-action="manage-restrictions" data-user="${userId}"><span class="material-icons">settings</span>Gérer les restrictions</button>
								</div>
							</div>
						</div>`:''}
					</div>
					<div class="tab-panel" data-panel="restrictions">${restrictionsList(reputation)}</div>
					<div class="tab-panel" data-panel="activity">
						<div class="activity-stats-grid">
							<div class="activity-stat-card recent"><div class="icon"><span class="material-icons">history</span></div><div class="value">${activityCount}</div><div class="label">Actions récentes</div></div>
							<div class="activity-stat-card last"><div class="icon"><span class="material-icons">schedule</span></div><div class="value">${lastActivityLabel}</div><div class="label">Dernière activité</div></div>
						</div>
						${buildActivities(recentActions)}
					</div>
					<div class="tab-panel" data-panel="admin">${buildAdminHistory(adminActions,adminNotes)}</div>
				</div>
			</div>
		</div>`;
		modal.addEventListener('click', e=>{ if(e.target===modal || e.target.hasAttribute('data-close-profile')) modal.remove(); });
		modal.addEventListener('click', e=>{
			const tabBtn = e.target.closest('.tab-btn'); if(tabBtn){
				const tab = tabBtn.getAttribute('data-tab');
				modal.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b===tabBtn));
				modal.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.getAttribute('data-panel')===tab));
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
		
		// Exécuter quand les services sont prêts
		window.MUSO.executeWhenReady(async () => {
			try {
			let reason = '';
			// Map actions vers service
			if(action===ACTIONS.QUARANTINE){
				if(!confirm("Mettre l’utilisateur en quarantaine ?")) return; reason = prompt('Raison quarantaine:')||'Quarantaine';
				await AdminActionsService.quarantineUser({userId, reason});
			} else if(action===ACTIONS.UNQUARANTINE){
				reason = prompt('Raison fin quarantaine:')||'Fin quarantaine';
				await AdminActionsService.unquarantineUser({userId, reason});
			} else if([ACTIONS.BAN_24,ACTIONS.BAN_7,ACTIONS.BAN_PERM].includes(action)){
				const hours = action===ACTIONS.BAN_24?24: action===ACTIONS.BAN_7?24*7:24*365*10;
				if(!confirm('Confirmer bannissement '+(hours>=24*365?'permanent':hours+'h')+' ?')) return;
				reason = prompt('Raison bannissement:')||'Bannissement';
				await AdminActionsService.banUser({userId, hours, reason});
			} else if(action===ACTIONS.UNBAN){
				if(!confirm('Lever le bannissement ?')) return; reason = prompt('Raison débannissement:')||'Débannissement';
				await AdminActionsService.unbanUser({userId, reason});
			} else if(action===ACTIONS.BLOCK_REPORTS){
				reason = prompt('Raison blocage signalements:')||'Blocage signalements';
				await AdminActionsService.blockUserReports({userId, reason});
			} else if(action===ACTIONS.UNBLOCK_REPORTS){
				reason = prompt('Raison déblocage signalements:')||'Déblocage signalements';
				await AdminActionsService.unblockUserReports({userId, reason});
			} else if(action===ACTIONS.BLOCK_VOTES){
				reason = prompt('Raison blocage votes:')||'Blocage votes';
				await AdminActionsService.blockUserVotes({userId, reason});
			} else if(action===ACTIONS.UNBLOCK_VOTES){
				reason = prompt('Raison déblocage votes:')||'Déblocage votes';
				await AdminActionsService.unblockUserVotes({userId, reason});
			} else if(action===ACTIONS.RESET_REP){
				if(!confirm('Réinitialiser la réputation ?')) return; reason = prompt('Raison reset:')||'Reset';
				await AdminActionsService.resetUserReputation({userId, reason});
			} else if(action===ACTIONS.ADD_NOTE){
				const note = prompt('Texte de la note administrateur:'); if(!note||!note.trim()) return;
				await AdminActionsService.addAdminNote({userId, note: note.trim(), category:'note'});
			} else if(action==='revoke'){
				if(!confirm('Révoquer droits administrateur ?')) return;
				await firebase.firestore().collection('users').doc(userId).update({isAdmin:false, adminRevokedAt: firebase.firestore.FieldValue.serverTimestamp()});
				await firebase.firestore().collection('admin_actions').add({userId, adminId:(firebase.auth().currentUser||{}).uid, actionType:'revokeAdmin', reason:'Révocation', timestamp: firebase.firestore.FieldValue.serverTimestamp()});
			}
			alert('Action effectuée');
			// Refresh modal
			document.querySelectorAll('.modal').forEach(m=>m.remove());
			cache.delete(userId);
			openProfileModal(userId,{showModerationButtons:true});
		} catch(err){ console.error('❌ Action admin échouée', err); alert(err.message||'Erreur action admin'); }
		});
	}
	document.addEventListener('click', handleModerationAction);

	async function openProfileModal(userId, options={}){
		try { const data = await fetchUser(userId); await buildModal(data, options);} catch(e){ console.error('❌ Profil introuvable', e); alert(e.message||'Profil introuvable'); }
	}
	window.openProfileModal = openProfileModal;

	// ===== Modales avancées =====
	async function openAdjustScoreModal(userId){
		await waitForServices();
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
			
			window.MUSO.executeWhenReady(async () => {
				try {
					await AdminActionsService.adjustUserScore({userId, scoreChange: delta, reason});
					modal.remove(); cache.delete(userId); openProfileModal(userId,{showModerationButtons:true});
				} catch(err){ alert('Erreur ajustement score: ' + err.message); console.error(err); }
			});
		});
		document.body.appendChild(modal);
	}

	async function openRestrictionsModal(userId){
		await waitForServices();
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
				
				window.MUSO.executeWhenReady(async () => {
					try {
						if(key==='canReport'){
							await (value? AdminActionsService.unblockUserReports({userId, reason:'Toggle depuis restrictions'}) : AdminActionsService.blockUserReports({userId, reason:'Toggle depuis restrictions'}));
						} else if(key==='canVote') {
							await (value? AdminActionsService.unblockUserVotes({userId, reason:'Toggle depuis restrictions'}) : AdminActionsService.blockUserVotes({userId, reason:'Toggle depuis restrictions'}));
						} else if(key==='reviewPending') {
							await firebase.firestore().collection('user_reputation').doc(userId).set({'restrictions.reviewPending': value},{merge:true});
							await firebase.firestore().collection('admin_actions').add({userId, adminId:(firebase.auth().currentUser||{}).uid, actionType:'toggleModeration', reason: value?'Forcer modération':'Retirer modération', metadata:{reviewPending:value}, timestamp: firebase.firestore.FieldValue.serverTimestamp()});
						}
						cache.delete(userId);
					} catch(err){ console.error(err); alert('Erreur mise à jour restriction: ' + err.message); }
				});
			});
		});
		document.body.appendChild(modal);
	}
})();
