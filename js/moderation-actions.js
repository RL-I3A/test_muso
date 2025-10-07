// Actions de modération pour MUSO Admin Dashboard
// Réplique exacte des actions Flutter AdminActionService

class ModerationActions {
  constructor() {
    this.isProcessing = false;
  }

  // ========== GESTION UTILISATEURS ==========

  async blockUser(userId, reason = 'Violation des conditions d\'utilisation') {
    if (!this.canPerformAction()) return false;

    try {
      this.setProcessing(true, 'Blocage de l\'utilisateur...');
      console.log('🚫 Blocage utilisateur:', userId);

      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .doc(userId)
        .update({
          isBlocked: true,
          blockedAt: FirebaseServices.timestamp(),
          blockReason: reason
        });

      await this.logAction('block_user', userId, { reason });
      this.showSuccess('Utilisateur bloqué avec succès');
      
      // Actualiser la liste des utilisateurs
      if (window.Dashboard) {
        window.Dashboard.refreshUsers();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur blocage utilisateur:', error);
      this.showError('Erreur lors du blocage');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  async unblockUser(userId) {
    if (!this.canPerformAction()) return false;

    try {
      this.setProcessing(true, 'Déblocage de l\'utilisateur...');
      console.log('✅ Déblocage utilisateur:', userId);

      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .doc(userId)
        .update({
          isBlocked: false,
          unblockedAt: FirebaseServices.timestamp(),
          blockReason: null
        });

      await this.logAction('unblock_user', userId);
      this.showSuccess('Utilisateur débloqué avec succès');
      
      if (window.Dashboard) {
        window.Dashboard.refreshUsers();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur déblocage utilisateur:', error);
      this.showError('Erreur lors du déblocage');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  async deleteUser(userId) {
    if (!this.canPerformAction()) return false;
    
    const confirmed = await this.confirmAction(
      'Supprimer l\'utilisateur',
      'Cette action est irréversible. L\'utilisateur et toutes ses données seront supprimés définitivement.'
    );
    
    if (!confirmed) return false;

    try {
      this.setProcessing(true, 'Suppression de l\'utilisateur...');
      console.log('🗑️ Suppression utilisateur:', userId);

      // Supprimer les publications de l'utilisateur
      const userPostsQuery = await FirebaseServices.firestore
        .collection(FirebaseServices.collections.posts)
        .where('authorId', '==', userId)
        .get();

      const batch = FirebaseServices.firestore.batch();
      
      userPostsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Supprimer l'utilisateur
      const userRef = FirebaseServices.firestore
        .collection(FirebaseServices.collections.users)
        .doc(userId);
      batch.delete(userRef);

      await batch.commit();
      await this.logAction('delete_user', userId);
      
      this.showSuccess('Utilisateur supprimé avec succès');
      
      if (window.Dashboard) {
        window.Dashboard.refreshUsers();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression utilisateur:', error);
      this.showError('Erreur lors de la suppression');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  // ========== GESTION PUBLICATIONS ==========

  async deletePost(postId) {
    if (!this.canPerformAction()) return false;
    
    const confirmed = await this.confirmAction(
      'Supprimer la publication',
      'Cette action est irréversible. La publication sera supprimée définitivement.'
    );
    
    if (!confirmed) return false;

    try {
      this.setProcessing(true, 'Suppression de la publication...');
      console.log('🗑️ Suppression publication:', postId);

      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.posts)
        .doc(postId)
        .delete();

      await this.logAction('delete_post', postId);
      this.showSuccess('Publication supprimée avec succès');
      
      if (window.Dashboard) {
        window.Dashboard.refreshPosts();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression publication:', error);
      this.showError('Erreur lors de la suppression');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  async moderatePost(postId, action, reason) {
    if (!this.canPerformAction()) return false;

    try {
      this.setProcessing(true, 'Modération en cours...');
      console.log('⚖️ Modération publication:', postId, action);

      const updateData = {
        moderatedAt: FirebaseServices.timestamp(),
        moderationAction: action,
        moderationReason: reason,
        moderatedBy: window.AdminAuth.currentUser.uid
      };

      if (action === 'hide') {
        updateData.isHidden = true;
      } else if (action === 'show') {
        updateData.isHidden = false;
      }

      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.posts)
        .doc(postId)
        .update(updateData);

      await this.logAction('moderate_post', postId, { action, reason });
      this.showSuccess(`Publication ${action === 'hide' ? 'masquée' : 'affichée'} avec succès`);
      
      if (window.Dashboard) {
        window.Dashboard.refreshPosts();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur modération publication:', error);
      this.showError('Erreur lors de la modération');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  // ========== GESTION SIGNALEMENTS ==========

  async resolveReport(reportId, action, resolution) {
    if (!this.canPerformAction()) return false;

    try {
      this.setProcessing(true, 'Traitement du signalement...');
      console.log('✅ Résolution signalement:', reportId, action);

      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.reports)
        .doc(reportId)
        .update({
          status: 'resolved',
          resolvedAt: FirebaseServices.timestamp(),
          resolvedBy: window.AdminAuth.currentUser.uid,
          resolution: resolution,
          action: action
        });

      await this.logAction('resolve_report', reportId, { action, resolution });
      this.showSuccess('Signalement traité avec succès');
      
      if (window.Dashboard) {
        window.Dashboard.refreshReports();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur résolution signalement:', error);
      this.showError('Erreur lors du traitement');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  async dismissReport(reportId, reason) {
    if (!this.canPerformAction()) return false;

    try {
      this.setProcessing(true, 'Rejet du signalement...');
      console.log('❌ Rejet signalement:', reportId);

      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.reports)
        .doc(reportId)
        .update({
          status: 'dismissed',
          dismissedAt: FirebaseServices.timestamp(),
          dismissedBy: window.AdminAuth.currentUser.uid,
          dismissReason: reason
        });

      await this.logAction('dismiss_report', reportId, { reason });
      this.showSuccess('Signalement rejeté');
      
      if (window.Dashboard) {
        window.Dashboard.refreshReports();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur rejet signalement:', error);
      this.showError('Erreur lors du rejet');
      return false;
    } finally {
      this.setProcessing(false);
    }
  }

  // ========== MÉTHODES UTILITAIRES ==========

  canPerformAction() {
    if (this.isProcessing) {
      this.showWarning('Une action est déjà en cours...');
      return false;
    }

    if (!window.AdminAuth || !window.AdminAuth.currentUser || !window.AdminAuth.isAdmin) {
      this.showError('Permissions administrateur requises');
      return false;
    }

    return true;
  }

  setProcessing(processing, message = '') {
    this.isProcessing = processing;
    
    // Mettre à jour l'interface
    const processingOverlay = document.getElementById('processing-overlay');
    const processingMessage = document.getElementById('processing-message');
    
    if (processingOverlay) {
      processingOverlay.style.display = processing ? 'flex' : 'none';
    }
    
    if (processingMessage && message) {
      processingMessage.textContent = message;
    }
  }

  async logAction(action, targetId, metadata = {}) {
    if (!window.AdminAuth || !window.AdminAuth.currentUser) return;

    try {
      await FirebaseServices.firestore
        .collection(FirebaseServices.collections.adminActions)
        .add({
          adminId: window.AdminAuth.currentUser.uid,
          adminEmail: window.AdminAuth.currentUser.email,
          action: action,
          targetId: targetId,
          metadata: metadata,
          timestamp: FirebaseServices.timestamp(),
          userAgent: navigator.userAgent,
          source: 'web_dashboard'
        });
    } catch (error) {
      console.error('❌ Erreur logging action:', error);
    }
  }

  async confirmAction(title, message) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'confirmation-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="modal-actions">
            <button class="btn-secondary" onclick="this.closest('.confirmation-modal').remove(); window.tempResolve(false)">Annuler</button>
            <button class="btn-danger" onclick="this.closest('.confirmation-modal').remove(); window.tempResolve(true)">Confirmer</button>
          </div>
        </div>
      `;
      
      // Stockage temporaire pour la résolution
      window.tempResolve = resolve;
      
      document.body.appendChild(modal);
      
      // Fermer avec Escape
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', handleEscape);
          resolve(false);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showWarning(message) {
    this.showNotification(message, 'warning');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span class="material-icons">
        ${type === 'success' ? 'check_circle' : 
          type === 'error' ? 'error' : 
          type === 'warning' ? 'warning' : 'info'}
      </span>
      <span>${message}</span>
      <button onclick="this.parentElement.remove()" class="notification-close">
        <span class="material-icons">close</span>
      </button>
    `;
    
    document.body.appendChild(notification);
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialiser les actions de modération
document.addEventListener('DOMContentLoaded', () => {
  window.ModerationActions = new ModerationActions();
});