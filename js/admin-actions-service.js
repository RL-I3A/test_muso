// Admin Actions Service (Web) - Parité avec Flutter AdminActionService
// Gère : ajustement score, ban / unban, quarantaine, (dé)blocage reports & votes, reset réputation, notes

(function(){
  if(!window.FirebaseServices){ console.warn('[AdminActionsService] FirebaseServices non initialisé'); }
  const FS = ()=>FirebaseServices.firestore;
  const COL = FirebaseServices?.collections || {};

  const ACTION_TYPES = {
    scoreAdjust: 'scoreAdjust',
    ban: 'ban',
    unban: 'unban',
    quarantine: 'quarantine',
    unquarantine: 'unquarantine',
    blockReports: 'blockReports',
    unblockReports: 'unblockReports',
    blockVotes: 'blockVotes',
    unblockVotes: 'unblockVotes',
    reset: 'reset',
    note: 'note'
  };

  function nowTs(){ return new Date(); }
  function serverTs(){ return FirebaseServices.timestamp(); }

  function requireAdmin(){
    if(!window.AdminAuth || !AdminAuth.currentUser || !AdminAuth.isAdmin){
      console.warn('[AdminActionsService] Permissions admin requises');
      return false;
    }
    return true;
  }

  async function fetchReputation(userId){
    try {
      const doc = await FS().collection(COL.userReputation).doc(userId).get();
      if(!doc.exists) return null;
      return doc.data();
    } catch(e){ console.error('[AdminActionsService] fetchReputation error', e); return null; }
  }

  async function updateReputation(userId, data){
    return FS().collection(COL.userReputation).doc(userId).set(data,{merge:true});
  }

  async function adjustScore(userId, scoreChange, reason){
    if(!requireAdmin()) return false;
    try {
      const rep = await fetchReputation(userId) || { score:100, reportCount:0, validatedReports:0, voteCount:0, restrictions:{} };
      const previousScore = rep.score || 100;
      const newScore = Math.max(0, previousScore + scoreChange);
      await updateReputation(userId, { score: newScore, updatedAt: serverTs() });
      await logAdminAction(ACTION_TYPES.scoreAdjust, userId, reason, { scoreChange, previousScore, newScore });
      toast('Score ajusté');
      return true;
    } catch(e){ console.error('adjustScore error', e); toastErr('Erreur ajustement score'); return false; }
  }

  function computeBannedUntil(durationHours){
    const d = new Date();
    d.setHours(d.getHours()+durationHours);
    return d;
  }

  async function banUser(userId, durationHours, reason){
    if(!requireAdmin()) return false;
    try {
      const bannedUntil = computeBannedUntil(durationHours);
      const isPermanent = durationHours >= (24*365*10); // > 10 ans
      const rep = await fetchReputation(userId) || { score:100, restrictions:{} };
      const prevScore = rep.score || 100;
      const penalty = isPermanent ? -100 : -50;
      const newScore = Math.max(0, prevScore + penalty);
      await updateReputation(userId, { score: newScore, 'restrictions.bannedUntil': bannedUntil, updatedAt: serverTs() });
      if(isPermanent){
        await setSuspicionLevel(userId, 5, 'Bannissement permanent: '+reason);
      }
      await logAdminAction(ACTION_TYPES.ban, userId, reason, { bannedUntil: bannedUntil.toISOString(), durationHours, isPermanent, previousScore: prevScore, newScore });
      toast('Utilisateur banni');
      return true;
    } catch(e){ console.error('banUser error', e); toastErr('Erreur bannissement'); return false; }
  }

  async function unbanUser(userId, reason){
    if(!requireAdmin()) return false;
    try {
      const rep = await fetchReputation(userId) || { score:100, restrictions:{} };
      const prevScore = rep.score || 100;
      const bonus = 25;
      const newScore = Math.min(100, prevScore + bonus);
      await updateReputation(userId, { score: newScore, 'restrictions.bannedUntil': null, updatedAt: serverTs() });
      await setSuspicionLevel(userId, 0, 'Débannissement: '+reason);
      await logAdminAction(ACTION_TYPES.unban, userId, reason, { previousScore: prevScore, newScore, clearedAntiMulticompte: true });
      toast('Utilisateur débanni');
      return true;
    } catch(e){ console.error('unbanUser error', e); toastErr('Erreur débannissement'); return false; }
  }

  async function quarantineUser(userId, reason){
    if(!requireAdmin()) return false;
    try {
      await setSuspicionLevel(userId, 3, 'Quarantaine: '+reason);
      await adjustScore(userId, -25, 'Quarantaine administrative');
      await logAdminAction(ACTION_TYPES.quarantine, userId, reason, {});
      toast('Utilisateur en quarantaine');
      return true;
    } catch(e){ console.error('quarantineUser error', e); toastErr('Erreur quarantaine'); return false; }
  }

  async function unquarantineUser(userId, reason){
    if(!requireAdmin()) return false;
    try {
      await setSuspicionLevel(userId, 0, 'Sortie quarantaine: '+reason);
      await logAdminAction(ACTION_TYPES.unquarantine, userId, reason, {});
      toast('Quarantaine retirée');
      return true;
    } catch(e){ console.error('unquarantineUser error', e); toastErr('Erreur retrait quarantaine'); return false; }
  }

  async function blockReports(userId, reason){
    if(!requireAdmin()) return false;
    try {
      await updateReputation(userId, { 'restrictions.canReport': false });
      await logAdminAction(ACTION_TYPES.blockReports, userId, reason, {});
      toast('Signalements bloqués');
      return true;
    } catch(e){ console.error('blockReports error', e); toastErr('Erreur blocage signalements'); return false; }
  }
  async function unblockReports(userId, reason){
    if(!requireAdmin()) return false;
    try { await updateReputation(userId, { 'restrictions.canReport': true }); await logAdminAction(ACTION_TYPES.unblockReports, userId, reason, {}); toast('Signalements rétablis'); return true; } catch(e){ console.error('unblockReports error', e); toastErr('Erreur rétablissement'); return false; }
  }
  async function blockVotes(userId, reason){
    if(!requireAdmin()) return false;
    try { await updateReputation(userId, { 'restrictions.canVote': false }); await logAdminAction(ACTION_TYPES.blockVotes, userId, reason, {}); toast('Votes bloqués'); return true; } catch(e){ console.error('blockVotes error', e); toastErr('Erreur blocage votes'); return false; }
  }
  async function unblockVotes(userId, reason){
    if(!requireAdmin()) return false;
    try { await updateReputation(userId, { 'restrictions.canVote': true }); await logAdminAction(ACTION_TYPES.unblockVotes, userId, reason, {}); toast('Votes rétablis'); return true; } catch(e){ console.error('unblockVotes error', e); toastErr('Erreur rétablissement votes'); return false; }
  }

  async function resetReputation(userId, reason){
    if(!requireAdmin()) return false;
    try {
      const rep = await fetchReputation(userId) || { score:100, restrictions:{} };
      const previousScore = rep.score || 100;
      await updateReputation(userId, { score: 100, 'restrictions.bannedUntil': null, 'restrictions.canReport': true, 'restrictions.canVote': true, updatedAt: serverTs() });
      await setSuspicionLevel(userId, 0, 'Reset complet: '+reason);
      await logAdminAction(ACTION_TYPES.reset, userId, reason, { previousScore, newScore:100, clearedAntiMulticompte:true });
      toast('Réputation réinitialisée');
      return true;
    } catch(e){ console.error('resetReputation error', e); toastErr('Erreur reset'); return false; }
  }

  async function addAdminNote(userId, note, category){
    if(!requireAdmin()) return false;
    try {
      await FS().collection(COL.adminNotes).add({ userId, adminId: AdminAuth.currentUser.uid, note, category, timestamp: serverTs() });
      await logAdminAction(ACTION_TYPES.note, userId, 'Note: '+category, { length: note.length });
      toast('Note ajoutée');
      return true;
    } catch(e){ console.error('addAdminNote error', e); toastErr('Erreur note'); return false; }
  }

  async function setSuspicionLevel(userId, level, reason){
    try {
      await FS().collection(COL.suspiciousAccounts).doc(userId).set({ suspicionLevel: level, updatedAt: serverTs(), reasons: FirebaseServices.firestore.FieldValue.arrayUnion(reason), detectedAt: serverTs() }, { merge:true });
    } catch(e){ console.error('[AdminActionsService] setSuspicionLevel error', e); }
  }

  async function logAdminAction(actionType, userId, reason, metadata){
    try {
      await FS().collection(COL.adminActions).add({
        adminId: AdminAuth.currentUser.uid,
        userId: userId,
        actionType: actionType,
        reason: reason,
        metadata: metadata || {},
        timestamp: serverTs(),
        source: 'web_dashboard'
      });
    } catch(e){ console.error('[AdminActionsService] logAdminAction error', e); }
  }

  // ===== UI Helpers =====
  function toast(msg){ console.log('[AdminActions]', msg); notify(msg, 'success'); }
  function toastErr(msg){ console.warn('[AdminActions]', msg); notify(msg, 'error'); }
  function notify(message, type){
    if(!window.ModerationActions){ console.log(message); return; }
    window.ModerationActions.showNotification(message, type);
  }

  // ===== Public API =====
  window.AdminActionsService = {
    adjustScore, banUser, unbanUser, quarantineUser, unquarantineUser,
    blockReports, unblockReports, blockVotes, unblockVotes, resetReputation,
    addAdminNote, ACTION_TYPES
  };
})();
