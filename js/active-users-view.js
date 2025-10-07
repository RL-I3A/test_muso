// Active Users View Logic - Enhanced with Flutter-style cards
let allActiveUsers = [];
let filteredActiveUsers = [];
let currentPage = 1;
const itemsPerPage = 20;
let selectedUser = null;
let currentActivityFilter = 'all';

// Enhanced user cache for performance
const userCache = new Map();

// Load active users from Firebase (last 24 hours)
async function loadActiveUsers() {
    console.log('🔍 Loading active users (last 24h)...');
    const loadingSpinner = document.getElementById('loading-spinner');
    const activeList = document.getElementById('active-list');
    const emptyState = document.getElementById('empty-state');
    
    loadingSpinner.style.display = 'block';
    activeList.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        const db = firebase.firestore();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Get user actions from last 24 hours with better error handling
        const actionsSnapshot = await db.collection('user_actions_log')
            .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(yesterday))
            .get();
        
        console.log(`✅ Found ${actionsSnapshot.size} actions in last 24h`);
        
        // Group actions by userId and count
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
        
        // Batch fetch user details for better performance
        const userIds = Array.from(userActivityMap.keys());
        const batchSize = 10;
        const userDetailsMap = new Map();
        
        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            const promises = batch.map(async (userId) => {
                // Check cache first
                if (userCache.has(userId)) {
                    return { id: userId, data: userCache.get(userId) };
                }
                
                try {
                    const userDoc = await db.collection('users').doc(userId).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    
                    // Cache the result
                    userCache.set(userId, userData);
                    
                    return { id: userId, data: userData };
                } catch (error) {
                    console.log(`❌ Error fetching user ${userId}:`, error);
                    return { id: userId, data: null };
                }
            });
            
            const results = await Promise.all(promises);
            results.forEach(result => {
                userDetailsMap.set(result.id, result.data);
            });
        }
        
        // Combine activity and user data
        allActiveUsers = Array.from(userActivityMap.values()).map(activity => {
            const userData = userDetailsMap.get(activity.userId) || {};
            return {
                ...activity,
                username: userData.username || 'Utilisateur inconnu',
                email: userData.email || 'N/A',
                profilePicture: userData.profilePicture || null,
                isAdmin: userData.isAdmin || false,
                createdAt: userData.createdAt?.toDate() || null,
                reputationScore: userData.reputationScore || 0
            };
        });
        
        // Sort by action count (most active first)
        allActiveUsers.sort((a, b) => b.actionCount - a.actionCount);
        
        console.log(`✅ Loaded ${allActiveUsers.length} active users with details`);
        filteredActiveUsers = [...allActiveUsers];
        
        updateStats();
        renderActiveUsers();
        
        loadingSpinner.style.display = 'none';
        if (filteredActiveUsers.length === 0) {
            emptyState.style.display = 'block';
        } else {
            activeList.style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ Error loading active users:', error);
        loadingSpinner.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// Set activity filter with enhanced UI
function setActivityFilter(filter) {
    currentActivityFilter = filter;
    
    // Update filter chip states
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
        if (chip.dataset.filter === filter) {
            chip.classList.add('active');
        }
    });
    
    applyFilters();
}

// Enhanced apply filters function
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    filteredActiveUsers = allActiveUsers.filter(user => {
        const matchesSearch = searchTerm === '' || 
            user.userId.toLowerCase().includes(searchTerm) ||
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm);
        
        let matchesActivity = true;
        if (currentActivityFilter === 'high') {
            matchesActivity = user.actionCount > 10;
        } else if (currentActivityFilter === 'medium') {
            matchesActivity = user.actionCount >= 5 && user.actionCount <= 10;
        } else if (currentActivityFilter === 'low') {
            matchesActivity = user.actionCount < 5;
        }
        
        return matchesSearch && matchesActivity;
    });
    
    console.log(`🔍 Filtered: ${filteredActiveUsers.length} users`);
    currentPage = 1;
    updateStats();
    renderActiveUsers();
    
    // Show/hide clear search button
    const clearBtn = document.getElementById('clear-search');
    const searchInput = document.getElementById('search-input');
    if (searchInput.value.length > 0) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
    }
}

// Clear search function
function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('clear-search').style.display = 'none';
    applyFilters();
}

// Update statistics
function updateStats() {
    document.getElementById('total-active').textContent = allActiveUsers.length;
    document.getElementById('filtered-active').textContent = filteredActiveUsers.length;
    
    const totalPages = Math.ceil(filteredActiveUsers.length / itemsPerPage) || 1;
    document.getElementById('current-page-info').textContent = `${currentPage}/${totalPages}`;
}

// Get activity level text
function getActivityLevel(count) {
    if (count > 10) return 'Très actif';
    if (count >= 5) return 'Actif';
    return 'Peu actif';
}

// Get activity level CSS class
function getActivityClass(count) {
    if (count > 10) return 'level-3'; // High activity
    if (count >= 5) return 'level-2'; // Medium activity
    return 'level-1'; // Low activity
}

// Format action type
function formatActionType(type) {
    const types = {
        'create_post': 'Publication créée',
        'create_comment': 'Commentaire ajouté',
        'create_report': 'Signalement créé',
        'join_event': 'Événement rejoint',
        'send_message': 'Message envoyé',
        'like': 'Like',
        'share': 'Partage',
        'login': 'Connexion',
        'profile_update': 'Profil mis à jour'
    };
    return types[type] || type;
}

// Enhanced rendering with new card system
function renderActiveUsers() {
    const activeList = document.getElementById('active-list');
    const emptyState = document.getElementById('empty-state');
    
    if (filteredActiveUsers.length === 0) {
        activeList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageUsers = filteredActiveUsers.slice(startIndex, endIndex);
    
    activeList.innerHTML = pageUsers.map(user => createEnhancedUserCard(user)).join('');
    
    emptyState.style.display = 'none';
    activeList.style.display = 'block';
    
    updatePaginationControls();
}

function createEnhancedUserCard(user) {
    const activityLevel = getActivityLevel(user.actionCount);
    const activityClass = getActivityClass(user.actionCount);
    const timestamp = formatDate(user.lastAction);
    const lastActionText = formatActionType(user.lastActionType);
    
    return `
        <div class="enhanced-card clickable" onclick="openProfileModal('${user.userId}')">
            <div class="card-header">
                <div class="card-avatar">
                    ${user.profilePicture ? 
                        `<img src="${user.profilePicture}" alt="${user.username}">` :
                        `<span class="material-icons">person</span>`
                    }
                </div>
                <div class="card-user-info">
                    <div class="card-username">${user.username}</div>
                    <div class="card-subtitle">${user.userId.substring(0, 8)}...</div>
                    <div class="card-chips">
                        ${user.isAdmin ? `<span class="chip admin"><span class="material-icons">admin_panel_settings</span>Admin</span>` : ''}
                        <span class="chip ${activityClass}">
                            <span class="material-icons">trending_up</span>
                            ${activityLevel}
                        </span>
                        <span class="chip reputation-neutral">
                            ${user.actionCount} actions
                        </span>
                    </div>
                </div>
                <div class="card-status ${activityClass}">
                    ${activityLevel}
                </div>
            </div>
            
            <div class="card-body">
                <div class="card-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${user.actionCount}</div>
                        <div class="metric-label">Actions 24h</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${user.reputationScore || 0}</div>
                        <div class="metric-label">Réputation</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${user.actions ? user.actions.length : 0}</div>
                        <div class="metric-label">Types diff.</div>
                    </div>
                </div>
                
                <div class="card-details">
                    <div class="detail-row">
                        <span class="material-icons">update</span>
                        <span class="detail-text"><strong>Dernière action:</strong> ${lastActionText}</span>
                    </div>
                    <div class="detail-row">
                        <span class="material-icons">schedule</span>
                        <span class="detail-text"><strong>Il y a:</strong> ${timestamp}</span>
                    </div>
                    ${user.email !== 'N/A' ? `
                        <div class="detail-row">
                            <span class="material-icons">email</span>
                            <span class="detail-text">${user.email}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-footer">
                <button class="card-action-btn" onclick="openProfileModal('${user.userId}'); event.stopPropagation();">
                    <span class="material-icons">person</span>
                    Profil
                </button>
            </div>
        </div>
    `;
}

// Enhanced pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredActiveUsers.length / itemsPerPage) || 1;
    const paginationContainer = document.getElementById('pagination-container');
    
    document.getElementById('current-page-info').textContent = `Page ${currentPage} / ${totalPages}`;
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
    
    // Show/hide pagination based on content
    if (filteredActiveUsers.length > itemsPerPage) {
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderActiveUsers();
        updateStats();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredActiveUsers.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderActiveUsers();
        updateStats();
    }
}

// Go back to dashboard
function goBack() {
    window.location.href = '../index.html';
}

// Utility: Format date
function formatDate(date) {
    if (!date) return 'N/A';
    if (typeof date === 'string') date = new Date(date);
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Active Users View initialized');
    loadActiveUsers();
});
