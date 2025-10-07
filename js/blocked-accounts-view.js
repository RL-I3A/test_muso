// Blocked Accounts View Logic
let allBlockedAccounts = [];
let filteredBlockedAccounts = [];
let currentPage = 1;
const itemsPerPage = 20;
let selectedAccount = null;

// Load blocked accounts from Firebase
async function loadBlockedAccounts() {
    console.log('🔍 Loading blocked accounts...');
    const loadingSpinner = document.getElementById('loading-spinner');
    const blockedList = document.getElementById('blocked-list');
    const emptyState = document.getElementById('empty-state');
    
    loadingSpinner.style.display = 'block';
    blockedList.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('user_reputation')
            .where('restrictions.canReport', '==', false)
            .get();
        
        console.log(`✅ Found ${snapshot.size} blocked accounts`);
        
        allBlockedAccounts = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Get additional user details
            let userDetails = null;
            try {
                const userDoc = await db.collection('users').doc(doc.id).get();
                if (userDoc.exists) {
                    userDetails = userDoc.data();
                }
            } catch (error) {
                console.log('❌ Error fetching user details:', error);
            }
            
            allBlockedAccounts.push({
                userId: doc.id,
                restrictions: data.restrictions || {},
                reputationScore: data.reputationScore || 0,
                lastUpdated: data.lastUpdated?.toDate() || new Date(),
                blockReason: data.restrictions?.reason || 'Non spécifié',
                blockedAt: data.restrictions?.blockedAt?.toDate() || data.lastUpdated?.toDate() || new Date(),
                // User details
                username: userDetails?.username || 'Utilisateur inconnu',
                email: userDetails?.email || 'N/A',
                profilePicture: userDetails?.profilePicture || null,
                totalReports: data.totalReports || 0,
                violationCount: data.violationCount || 0
            });
        }
        
        console.log(`✅ Loaded ${allBlockedAccounts.length} blocked accounts with details`);
        filteredBlockedAccounts = [...allBlockedAccounts];
        
    updateStats();
    renderBlockedSummary();
        renderBlockedAccounts();
        
        loadingSpinner.style.display = 'none';
        if (filteredBlockedAccounts.length === 0) {
            emptyState.style.display = 'block';
        } else {
            blockedList.style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ Error loading blocked accounts:', error);
        loadingSpinner.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    filteredBlockedAccounts = allBlockedAccounts.filter(account => {
        const matchesSearch = searchTerm === '' || 
            account.userId.toLowerCase().includes(searchTerm) ||
            account.username.toLowerCase().includes(searchTerm);
        
        return matchesSearch;
    });
    
    console.log(`🔍 Filtered: ${filteredBlockedAccounts.length} accounts`);
    currentPage = 1;
    updateStats();
    renderBlockedAccounts();
}

// Update statistics
function updateStats() {
    document.getElementById('total-blocked').textContent = allBlockedAccounts.length;
    document.getElementById('filtered-blocked').textContent = filteredBlockedAccounts.length;
    
    const totalPages = Math.ceil(filteredBlockedAccounts.length / itemsPerPage) || 1;
    document.getElementById('current-page-info').textContent = `${currentPage}/${totalPages}`;
}

// Build summary (counts per restriction type like mobile design)
function renderBlockedSummary() {
    const container = document.getElementById('blocked-summary');
    if (!container) return; // only if markup present
    // We interpret specific flags; if field absent we do NOT count it to avoid inflation
    const reportsBlocked = allBlockedAccounts.filter(a => a.restrictions?.canReport === false).length;
    const votesBlocked = allBlockedAccounts.filter(a => a.restrictions?.canVote === false).length;
    const banned = allBlockedAccounts.filter(a => a.restrictions?.isBanned === true || (a.restrictions?.canPost === false && a.restrictions?.canComment === false && a.restrictions?.canReport === false)).length;
    const underModeration = allBlockedAccounts.filter(a => a.restrictions?.reviewPending === true || a.restrictions?.underReview === true).length;
    container.innerHTML = `
        <div class="blocked-stats-row">
            <div class="blocked-stat-card danger">
                <span class="material-icons">gavel</span>
                <div><strong>${banned}</strong> Bannis</div>
            </div>
            <div class="blocked-stat-card warn">
                <span class="material-icons">visibility_off</span>
                <div><strong>${reportsBlocked}</strong> Signalements bloqués</div>
            </div>
            <div class="blocked-stat-card neutral">
                <span class="material-icons">how_to_vote</span>
                <div><strong>${votesBlocked}</strong> Votes bloqués</div>
            </div>
            <div class="blocked-stat-card info">
                <span class="material-icons">visibility</span>
                <div><strong>${underModeration}</strong> En modération</div>
            </div>
        </div>`;
}

// Render blocked accounts
function renderBlockedAccounts() {
    const blockedList = document.getElementById('blocked-list');
    const emptyState = document.getElementById('empty-state');
    
    if (filteredBlockedAccounts.length === 0) {
        blockedList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageAccounts = filteredBlockedAccounts.slice(startIndex, endIndex);
    
    blockedList.innerHTML = pageAccounts.map(account => createEnhancedBlockedCard(account)).join('');
    
    emptyState.style.display = 'none';
    blockedList.style.display = 'block';
    
    updatePaginationControls();
}

// Create enhanced card for blocked accounts
function createEnhancedBlockedCard(account) {
    const reputationLevel = getReputationLevel(account.reputationScore);
    
    return `
        <div class="enhanced-card blocked-account-card" onclick="openProfileModal('${account.userId}')">
            <div class="card-header">
                <div class="card-avatar">
                    ${account.profilePicture ? 
                        `<img src="${account.profilePicture}" alt="${account.username}">` : 
                        '<span class="material-icons">account_circle</span>'
                    }
                </div>
                <div class="card-user-info">
                    <h3 class="card-username">${account.username}</h3>
                    <p class="card-user-id">${account.userId}</p>
                    <div class="card-chips">
                        <span class="chip blocked">
                            <span class="material-icons">block</span>
                            Bloqué
                        </span>
                        <span class="chip ${reputationLevel}">
                            <span class="material-icons">star</span>
                            ${account.reputationScore}
                        </span>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="block-reason">
                    <span class="material-icons">report_problem</span>
                    <span>${account.blockReason}</span>
                </div>
                <div class="card-metrics">
                    <div class="metric">
                        <span class="metric-value">${account.totalReports || 0}</span>
                        <span class="metric-label">Signalements</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${account.violationCount || 0}</span>
                        <span class="metric-label">Violations</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${formatDate(account.blockedAt)}</span>
                        <span class="metric-label">Bloqué le</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${formatDate(account.lastUpdated)}</span>
                        <span class="metric-label">Dernière maj</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="action-btn primary" onclick="openProfileModal('${account.userId}'); event.stopPropagation();">
                    <span class="material-icons">person</span>
                    Voir profil
                </button>
                <button class="action-btn warning" onclick="handleUnblockAccount('${account.userId}'); event.stopPropagation();">
                    <span class="material-icons">lock_open</span>
                    Débloquer
                </button>
            </div>
        </div>
    `;
}

// Get reputation level class
function getReputationLevel(score) {
    if (score < 0) return 'level-1';
    if (score < 25) return 'level-2';
    if (score < 60) return 'level-3';
    if (score < 100) return 'level-4';
    return 'level-5';
}

// Handle unblock account action
function handleUnblockAccount(userId) {
    if (confirm('Êtes-vous sûr de vouloir débloquer cet utilisateur ?')) {
        openProfileModal(userId, { tab: 'admin', showModerationButtons: true });
    }
}

// ===== Pagination Controls =====
function updatePaginationControls() {
    const totalPages = Math.ceil(filteredBlockedAccounts.length / itemsPerPage) || 1;
    document.getElementById('pagination-info').textContent = `Page ${currentPage} / ${totalPages}`;
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderBlockedAccounts();
        updateStats();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredBlockedAccounts.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderBlockedAccounts();
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
    console.log('🚀 Blocked Accounts View initialized');
    loadBlockedAccounts();
});
