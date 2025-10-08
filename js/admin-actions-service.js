// Admin Actions Service - Web version mirroring Flutter AdminActionService logic
// Centralise toutes les actions administrateur avec vérifications permissions & logs cohérents.

// Attendre que Firebase soit prêt
window.addEventListener('DOMContentLoaded', function() {
  console.log('🔧 AdminActionsService loading...');
  
  // Vérifier que Firebase est disponible
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase not available, retrying...');
    setTimeout(() => initAdminActionsService(), 100);
    return;
  }
  
  initAdminActionsService();
});

function initAdminActionsService() {
  const firestore = firebase.firestore();
  const auth = firebase.auth();

  // Mapping des types d'actions pour cohérence multi-plateforme
  const ACTION_TYPES = {
    SCORE_ADJUST: 'scoreAdjust',
    BAN: 'ban',
    UNBAN: 'unban',
    QUARANTINE: 'quarantine',
    UNQUARANTINE: 'unquarantine',
    BLOCK_REPORTS: 'blockReports',
    UNBLOCK_REPORTS: 'unblockReports',
    BLOCK_VOTES: 'blockVotes',
    UNBLOCK_VOTES: 'unblockVotes',
    RESET: 'reset',
    NOTE: 'note'
  };

  async function isCurrentUserAdmin(){
    try {
      const user = auth.currentUser; if(!user) return false;
      const snap = await firestore.collection('users').doc(user.uid).get();
      return snap.exists && snap.data().isAdmin === true;
    } catch(e){ console.warn('isCurrentUserAdmin error', e); return false; }
  }

  async function logAdminAction({adminId, targetUserId, actionType, reason, metadata}){
    try {
      await firestore.collection('admin_actions').add({
        userId: targetUserId, // Alignement mobile: champ 'userId'
        adminId,
        actionType, // Enum string
        reason,
        metadata: metadata || {},
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e){ console.error('logAdminAction failed', e); }
  }

  async function adjustUserScore({userId, scoreChange, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    const repRef = firestore.collection('user_reputation').doc(userId);
    await repRef.set({ reputationScore: firebase.firestore.FieldValue.increment(scoreChange) }, {merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.SCORE_ADJUST, reason, metadata:{scoreChange}});
  }

  async function banUser({userId, hours, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    const until = new Date(Date.now()+hours*3600000);
    const isPermanent = hours >= 24*365*10; // >10 ans
    const repRef = firestore.collection('user_reputation').doc(userId);
    await repRef.set({
      restrictions:{
        canReport:false, canComment:false, canPost:false, canMessage:false, canJoinEvents:false,
        isBanned:true, bannedUntil: firebase.firestore.Timestamp.fromDate(until), reason: reason || 'Bannissement',
      },
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    // Pénalité score
    await repRef.set({ reputationScore: firebase.firestore.FieldValue.increment(isPermanent? -100 : -50) }, {merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.BAN, reason, metadata:{durationHours: hours, bannedUntil: until.toISOString(), isPermanent}});
  }

  async function unbanUser({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    const repRef = firestore.collection('user_reputation').doc(userId);
    await repRef.set({
      'restrictions.isBanned': false,
      'restrictions.bannedUntil': firebase.firestore.FieldValue.delete(),
      'restrictions.canReport': true,
      'restrictions.canComment': true,
      'restrictions.canPost': true,
      'restrictions.canMessage': true,
      'restrictions.canJoinEvents': true,
    }, {merge:true});
    // Bonus score léger
    await repRef.set({ reputationScore: firebase.firestore.FieldValue.increment(25) }, {merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.UNBAN, reason, metadata:{scoreBonus:25}});
  }

  async function quarantineUser({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    const repRef = firestore.collection('user_reputation').doc(userId);
    await repRef.set({
      'restrictions.quarantine': true,
      'restrictions.canPost': false,
      'restrictions.canComment': false,
    }, {merge:true});
    await repRef.set({ reputationScore: firebase.firestore.FieldValue.increment(-25) }, {merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.QUARANTINE, reason});
  }

  async function unquarantineUser({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    const repRef = firestore.collection('user_reputation').doc(userId);
    await repRef.set({
      'restrictions.quarantine': false,
      'restrictions.canPost': true,
      'restrictions.canComment': true,
    }, {merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.UNQUARANTINE, reason});
  }

  async function blockUserReports({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    await firestore.collection('user_reputation').doc(userId).set({'restrictions.canReport': false},{merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.BLOCK_REPORTS, reason});
  }
  async function unblockUserReports({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    await firestore.collection('user_reputation').doc(userId).set({'restrictions.canReport': true},{merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.UNBLOCK_REPORTS, reason});
  }
  async function blockUserVotes({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    await firestore.collection('user_reputation').doc(userId).set({'restrictions.canVote': false},{merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.BLOCK_VOTES, reason});
  }
  async function unblockUserVotes({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    await firestore.collection('user_reputation').doc(userId).set({'restrictions.canVote': true},{merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.UNBLOCK_VOTES, reason});
  }

  async function resetUserReputation({userId, reason}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    const repRef = firestore.collection('user_reputation').doc(userId);
    // Reset valeurs basiques (adapter selon schéma backend si différent)
    await repRef.set({
      reputationScore: 100,
      restrictions: {
        canReport: true, canVote: true, canPost: true, canComment: true, canMessage:true, canJoinEvents:true,
        reviewPending: false, forceModeration:false, isBanned:false, quarantine:false
      }
    }, {merge:true});
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.RESET, reason});
  }

  async function addAdminNote({userId, note, category='note'}){
    const admin = auth.currentUser; if(!admin) throw new Error('Non authentifié');
    if(!(await isCurrentUserAdmin())) throw new Error('Permission refusée');
    await firestore.collection('admin_notes').add({
      userId, adminId: admin.uid, note, category,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await logAdminAction({adminId:admin.uid, targetUserId:userId, actionType: ACTION_TYPES.NOTE, reason: `Note ajoutée: ${category}`, metadata:{length: note.length}});
  }

  // Expose API globalement
  window.AdminActionsService = {
    ACTION_TYPES,
    adjustUserScore,
    banUser, unbanUser,
    quarantineUser, unquarantineUser,
    blockUserReports, unblockUserReports,
    blockUserVotes, unblockUserVotes,
    resetUserReputation,
    addAdminNote
  };
  
  console.log('✅ AdminActionsService loaded successfully');
  console.log('Available actions:', Object.keys(window.AdminActionsService));
}
