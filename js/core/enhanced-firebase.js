// Enhanced Firebase Service with caching and batch operations
// Inspired by Flutter implementation patterns

class EnhancedFirebaseService {
  constructor() {
    this.userCache = new Map();
    this.reputationCache = new Map();
    this.cacheTimestamp = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    this.db = firebase.firestore();
  }

  // Check if cache is still valid
  isCacheValid(key) {
    const timestamp = this.cacheTimestamp.get(key);
    if (!timestamp) return false;
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  // Batch fetch user data with caching
  async batchFetchUsers(userIds) {
    const result = new Map();
    const toFetch = [];

    // Check cache first
    for (const userId of userIds) {
      if (this.userCache.has(userId) && this.isCacheValid(`user_${userId}`)) {
        result.set(userId, this.userCache.get(userId));
      } else {
        toFetch.push(userId);
      }
    }

    // Batch fetch remaining users
    if (toFetch.length > 0) {
      const batchSize = 10; // Firestore limit for 'in' queries is 30, we use 10 for safety
      
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        
        try {
          const snapshot = await this.db
            .collection('users')
            .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
            .get();

          snapshot.forEach(doc => {
            const userData = doc.data();
            this.userCache.set(doc.id, userData);
            this.cacheTimestamp.set(`user_${doc.id}`, Date.now());
            result.set(doc.id, userData);
          });

          // Add null entries for users that don't exist
          batch.forEach(userId => {
            if (!result.has(userId)) {
              this.userCache.set(userId, null);
              this.cacheTimestamp.set(`user_${userId}`, Date.now());
              result.set(userId, null);
            }
          });
        } catch (error) {
          console.error('Error batch fetching users:', error);
          // Add null entries for failed fetches
          batch.forEach(userId => {
            if (!result.has(userId)) {
              result.set(userId, null);
            }
          });
        }
      }
    }

    return result;
  }

  // Batch fetch user reputation data
  async batchFetchReputations(userIds) {
    const result = new Map();
    const toFetch = [];

    // Check cache first
    for (const userId of userIds) {
      if (this.reputationCache.has(userId) && this.isCacheValid(`reputation_${userId}`)) {
        result.set(userId, this.reputationCache.get(userId));
      } else {
        toFetch.push(userId);
      }
    }

    // Batch fetch remaining reputations
    if (toFetch.length > 0) {
      const batchSize = 10;
      
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        
        try {
          const snapshot = await this.db
            .collection('user_reputation')
            .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
            .get();

          snapshot.forEach(doc => {
            const reputationData = doc.data();
            this.reputationCache.set(doc.id, reputationData);
            this.cacheTimestamp.set(`reputation_${doc.id}`, Date.now());
            result.set(doc.id, reputationData);
          });

          // Add null entries for users that don't have reputation data
          batch.forEach(userId => {
            if (!result.has(userId)) {
              this.reputationCache.set(userId, null);
              this.cacheTimestamp.set(`reputation_${userId}`, Date.now());
              result.set(userId, null);
            }
          });
        } catch (error) {
          console.error('Error batch fetching reputations:', error);
          batch.forEach(userId => {
            if (!result.has(userId)) {
              result.set(userId, null);
            }
          });
        }
      }
    }

    return result;
  }

  // Enhanced active users loading
  async loadActiveUsers(hoursBack = 24) {
    try {
      console.log(`🔍 Loading active users (last ${hoursBack}h)...`);
      
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      // Get user actions from specified time period
      const actionsSnapshot = await this.db
        .collection('user_actions_log')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(cutoffTime))
        .get();

      console.log(`✅ Found ${actionsSnapshot.size} actions in last ${hoursBack}h`);

      // Group actions by userId
      const userActivityMap = new Map();
      
      actionsSnapshot.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        
        if (!userId) return;

        if (!userActivityMap.has(userId)) {
          userActivityMap.set(userId, {
            userId: userId,
            actionCount: 0,
            lastAction: data.timestamp?.toDate() || new Date(),
            lastActionType: data.actionType || 'unknown',
            actions: []
          });
        }

        const userActivity = userActivityMap.get(userId);
        userActivity.actionCount++;
        userActivity.actions.push({
          type: data.actionType || 'unknown',
          timestamp: data.timestamp?.toDate() || new Date(),
          details: data.details || {}
        });

        // Update last action if this is more recent
        if (data.timestamp && data.timestamp.toDate() > userActivity.lastAction) {
          userActivity.lastAction = data.timestamp.toDate();
          userActivity.lastActionType = data.actionType || 'unknown';
        }
      });

      console.log(`✅ Found ${userActivityMap.size} unique active users`);

      // Batch fetch user details
      const userIds = Array.from(userActivityMap.keys());
      const [userDetailsMap, reputationMap] = await Promise.all([
        this.batchFetchUsers(userIds),
        this.batchFetchReputations(userIds)
      ]);

      // Combine activity and user data
      const activeUsers = Array.from(userActivityMap.values()).map(activity => {
        const userData = userDetailsMap.get(activity.userId) || {};
        const reputationData = reputationMap.get(activity.userId) || {};
        
        return {
          ...activity,
          username: userData.username || 'Utilisateur inconnu',
          email: userData.email || 'N/A',
          profilePicture: userData.profilePicture || null,
          isAdmin: userData.isAdmin || false,
          createdAt: userData.createdAt?.toDate() || null,
          reputationScore: reputationData.reputationScore || 0,
          isBlocked: reputationData.restrictions?.canReport === false || false
        };
      });

      // Sort by action count (most active first)
      activeUsers.sort((a, b) => b.actionCount - a.actionCount);

      console.log(`✅ Enhanced active users loaded: ${activeUsers.length}`);
      return activeUsers;

    } catch (error) {
      console.error('❌ Error loading active users:', error);
      throw error;
    }
  }

  // Enhanced suspicious accounts loading
  async loadSuspiciousAccounts() {
    try {
      console.log('🔍 Loading suspicious accounts...');

      const snapshot = await this.db
        .collection('suspicious_accounts')
        .get();

      console.log(`✅ Found ${snapshot.docs.length} suspicious account documents`);

      // Extract user IDs for batch fetching
      const userIds = snapshot.docs.map(doc => doc.id);
      const userDetailsMap = await this.batchFetchUsers(userIds);

      // Process accounts with user details
      const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        const userData = userDetailsMap.get(doc.id) || {};

        return {
          id: doc.id,
          userId: doc.id,
          displayName: userData.username || userData.displayName || null,
          profilePicture: userData.profilePicture || null,
          ...data,
          detectedAt: data.detectedAt?.toDate() || new Date()
        };
      });

      // Sort by detection date (newest first)
      accounts.sort((a, b) => b.detectedAt - a.detectedAt);

      console.log(`✅ Enhanced suspicious accounts loaded: ${accounts.length}`);
      return accounts;

    } catch (error) {
      console.error('❌ Error loading suspicious accounts:', error);
      throw error;
    }
  }

  // Enhanced reports loading
  async loadReports(limit = 200) {
    try {
      console.log('🔍 Loading reports...');

      const snapshot = await this.db
        .collection('report')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      console.log(`✅ Found ${snapshot.docs.length} reports`);

      const reports = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || null,
          resolvedAt: data.resolvedAt?.toDate() || null
        };
      });

      console.log(`✅ Enhanced reports loaded: ${reports.length}`);
      return reports;

    } catch (error) {
      console.error('❌ Error loading reports:', error);
      throw error;
    }
  }

  // Enhanced blocked accounts loading
  async loadBlockedAccounts() {
    try {
      console.log('🔍 Loading blocked accounts...');

      const snapshot = await this.db
        .collection('user_reputation')
        .where('restrictions.canReport', '==', false)
        .get();

      console.log(`✅ Found ${snapshot.docs.length} blocked accounts`);

      // Extract user IDs for batch fetching
      const userIds = snapshot.docs.map(doc => doc.id);
      const userDetailsMap = await this.batchFetchUsers(userIds);

      // Process blocked accounts with user details
      const blockedAccounts = snapshot.docs.map(doc => {
        const data = doc.data();
        const userData = userDetailsMap.get(doc.id) || {};

        return {
          userId: doc.id,
          restrictions: data.restrictions || {},
          reputationScore: data.reputationScore || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          blockReason: data.restrictions?.reason || 'Non spécifié',
          blockedAt: data.restrictions?.blockedAt?.toDate() || data.lastUpdated?.toDate() || new Date(),
          // User details
          username: userData.username || 'Utilisateur inconnu',
          email: userData.email || 'N/A',
          profilePicture: userData.profilePicture || null,
          totalReports: data.totalReports || 0,
          violationCount: data.violationCount || 0
        };
      });

      console.log(`✅ Enhanced blocked accounts loaded: ${blockedAccounts.length}`);
      return blockedAccounts;

    } catch (error) {
      console.error('❌ Error loading blocked accounts:', error);
      throw error;
    }
  }

  // Load all users with their reputation data
  async loadAllUsers() {
    console.log('🔍 Loading all users...');
    
    try {
      // Get all users
      const usersSnapshot = await this.db.collection('users').get();
      console.log(`✅ Found ${usersSnapshot.size} users`);
      
      // Get user reputation data
      const reputationSnapshot = await this.db.collection('user_reputation').get();
      const reputationMap = new Map();
      reputationSnapshot.forEach(doc => {
        reputationMap.set(doc.id, doc.data());
      });
      
      const allUsers = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const reputation = reputationMap.get(doc.id);
        
        allUsers.push({
          userId: doc.id,
          username: userData.username || 'Utilisateur inconnu',
          email: userData.email || 'N/A',
          profilePicture: userData.profilePicture || null,
          isAdmin: userData.isAdmin || false,
          createdAt: userData.createdAt?.toDate() || new Date(),
          lastLogin: userData.lastLogin?.toDate() || null,
          // Reputation data
          reputationScore: reputation?.reputationScore || 0,
          isBlocked: reputation?.restrictions?.canReport === false || false,
          restrictions: reputation?.restrictions || {},
          totalReports: reputation?.totalReports || 0,
          violationCount: reputation?.violationCount || 0
        });
      });
      
      // Sort by creation date (newest first)
      allUsers.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log(`✅ Loaded ${allUsers.length} users with reputation data`);
      return allUsers;
      
    } catch (error) {
      console.error('❌ Error loading all users:', error);
      throw error;
    }
  }

  // Clear cache (useful for forced refresh)
  clearCache() {
    this.userCache.clear();
    this.reputationCache.clear();
    this.cacheTimestamp.clear();
    console.log('🧹 Cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      users: this.userCache.size,
      reputations: this.reputationCache.size,
      timestamps: this.cacheTimestamp.size
    };
  }
}

// Create global instance
window.EnhancedFirebaseService = EnhancedFirebaseService;