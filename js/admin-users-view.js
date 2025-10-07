// Admin Users View Logic
let allAdmins = [];
let filteredAdmins = [];
let currentPage = 1;
const itemsPerPage = 20;
let selectedAdmin = null;

// Load admin users from Firebase
async function loadAdmins() {
    console.log('🔍 Loading administrators...');
    const loadingSpinner = document.getElementById('loading-spinner');
    const adminsList = document.getElementById('admins-list');
    const emptyState = document.getElementById('empty-state');
    
    loadingSpinner.style.display = 'block';
    adminsList.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        const db = firebase.firestore();
        
        // Get users where isAdmin = true
        const snapshot = await db.collection('users')
            .where('isAdmin', '==', true)
            .get();
        
        console.log(`✅ Found ${snapshot.size} administrators`);
        
        allAdmins = [];
        for (const doc of snapshot.docs) {
            const userData = doc.data();
            
            // Get reputation data if available
            let reputationData = null;
            try {
                const reputationDoc = await db.collection('user_reputation').doc(doc.id).get();
                if (reputationDoc.exists) {
                    reputationData = reputationDoc.data();
                }
            } catch (error) {
                console.log('❌ Error fetching reputation:', error);
            }
            
            // Get recent activity count
            let activityCount = 0;
            try {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const actionsSnapshot = await db.collection('user_actions_log')
                    .where('userId', '==', doc.id)
                    .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(yesterday))
                    .get();
                activityCount = actionsSnapshot.size;
            } catch (error) {
                console.log('❌ Error fetching activity:', error);
            }
            
            allAdmins.push({
                userId: doc.id,
                username: userData.username || 'Admin',
                email: userData.email || 'N/A',
                profilePicture: userData.profilePicture || null,
                createdAt: userData.createdAt?.toDate() || new Date(),
                lastLogin: userData.lastLogin?.toDate() || null,
                adminSince: userData.adminSince?.toDate() || userData.createdAt?.toDate() || new Date(),
                // Reputation & activity
                reputationScore: reputationData?.reputationScore || 100,
                activityCount24h: activityCount,
                totalReports: reputationData?.totalReports || 0,
                    moderationActions: reputationData?.moderationActions || 0,
                    lastActiveAt: reputationData?.lastActiveAt?.toDate?.() || userData.lastActiveAt?.toDate?.() || null,
                    isOnline: userData.isOnline === true || reputationData?.isOnline === true || false
            });
        }
        
        // Sort by admin since (oldest first)
        allAdmins.sort((a, b) => a.adminSince - b.adminSince);
        
        console.log(`✅ Loaded ${allAdmins.length} administrators with details`);
        filteredAdmins = [...allAdmins];
        
    updateStats();
    renderAdminSummary();
        renderAdmins();
        
        loadingSpinner.style.display = 'none';
        if (filteredAdmins.length === 0) {
            emptyState.style.display = 'block';
        } else {
            adminsList.style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ Error loading administrators:', error);
        loadingSpinner.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    filteredAdmins = allAdmins.filter(admin => {
        const matchesSearch = searchTerm === '' || 
            admin.userId.toLowerCase().includes(searchTerm) ||
            admin.username.toLowerCase().includes(searchTerm) ||
            admin.email.toLowerCase().includes(searchTerm);
        
        return matchesSearch;
    });
    
    console.log(`🔍 Filtered: ${filteredAdmins.length} admins`);
    currentPage = 1;
    updateStats();
    renderAdmins();
}

// Update statistics
function updateStats() {
    document.getElementById('total-admins').textContent = allAdmins.length;
    document.getElementById('filtered-admins').textContent = filteredAdmins.length;
    
    const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage) || 1;
    document.getElementById('current-page-info').textContent = `${currentPage}/${totalPages}`;
}

// Build header summary like mobile (active 30j, actions traitées, en ligne)
function renderAdminSummary() {
        const container = document.getElementById('admin-summary');
        if (!container) return;
        const active30 = allAdmins.filter(a => {
                if (!a.lastLogin) return false; const diff=(Date.now()-a.lastLogin.getTime())/86400000; return diff<=30; }).length;
        const actions24 = allAdmins.reduce((acc,a)=>acc + (a.activityCount24h||0),0);
        // online heuristic: lastLogin within 5 minutes (placeholder until real presence)
        // Online detection: prefer lastActiveAt (from reputation doc) then lastLogin; also count explicit isOnline flag
        const online = allAdmins.filter(a => {
            if(a.isOnline === true) return true;
            const refTime = a.lastActiveAt || a.lastLogin; if(!refTime) return false; return (Date.now()-refTime.getTime())/60000 <=5; }).length;
        container.innerHTML = `
            <div class="admin-stats-row">
                <div class="admin-stat-card success"><span class="material-icons">trending_up</span><div><strong>${active30}</strong><br><span>Actifs (30j)</span></div></div>
                <div class="admin-stat-card primary"><span class="material-icons">history</span><div><strong>${actions24}</strong><br><span>Actions 24h</span></div></div>
                <div class="admin-stat-card purple"><span class="material-icons">podcasts</span><div><strong>${online}</strong><br><span>En ligne</span></div></div>
            </div>`;
}

// Render admins
function renderAdmins() {
    const adminsList = document.getElementById('admins-list');
    const emptyState = document.getElementById('empty-state');
    
    if (filteredAdmins.length === 0) {
        adminsList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageAdmins = filteredAdmins.slice(startIndex, endIndex);
    
    adminsList.innerHTML = pageAdmins.map(admin => `
    <div class="entity-card">
            <div class="account-header">
                <div class="account-avatar">${admin.profilePicture?`<img src='${admin.profilePicture}' alt='${admin.username}'>`:`<span class='material-icons'>account_circle</span>`}</div>
                <div class="account-info">
                    <div class="account-name">${admin.username}</div>
                    <div class="account-id" style="margin-top:4px;">
                        <span class="chip admin"><span class='material-icons' style='font-size:14px;'>admin_panel_settings</span>Admin</span>
                        <span class="chip reputation-positive">Rep: ${admin.reputationScore}</span>
                        <span class="chip" style="opacity:.85;">24h: ${admin.activityCount24h}</span>
                    </div>
                </div>
                <div class="account-status chip admin" style="cursor:default;">Admin</div>
            </div>
            <div class="account-details">
                <div class="detail-item"><span class="material-icons">email</span><span>${admin.email}</span></div>
                <div class="detail-item"><span class="material-icons">verified</span><span>${formatDate(admin.adminSince)}</span></div>
                <div class="detail-item"><span class="material-icons">trending_up</span><span>${admin.activityCount24h} actions</span></div>
                <div class="detail-item"><span class="material-icons">star</span><span>Réputation: ${admin.reputationScore}</span></div>
                </div>
                <div class="account-actions-row single-action">
                    <button class="action-btn secondary" onclick="openProfileModal('${admin.userId}'); event.stopPropagation();"><span class="material-icons">person</span> Profil</button>
                </div>
        </div>`).join('');
    
    emptyState.style.display = 'none';
    adminsList.style.display = 'block';
    
    updatePaginationControls();
}

// ===== Modal Management & Pagination =====
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage) || 1;
    document.getElementById('pagination-info').textContent = `Page ${currentPage} / ${totalPages}`;
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderAdmins();
        updateStats();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderAdmins();
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
    console.log('🚀 Admin Users View initialized');
    loadAdmins();
});
