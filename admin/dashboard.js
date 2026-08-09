// Admin Dashboard Logic
// Manages order display, filtering, and status updates

let allOrders = [];
let filteredOrders = [];
let orderService = null;
let lastOrderCount = 0;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminPage);
} else {
    initializeAdminPage();
}

function initializeAdminPage() {
    bindAdminEvents();

    // Check authentication
    if (adminAuth.isAuthenticated) {
        showDashboard();
    } else {
        showLogin();
    }
}

function bindAdminEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = function(event) {
            event.preventDefault();
            handleLogin(event);
        };
    }

    document.removeEventListener('submit', handleAdminSubmitDelegation);
    document.addEventListener('submit', handleAdminSubmitDelegation);

    const refreshButton = document.getElementById('refresh-orders-btn');
    if (refreshButton) {
        refreshButton.removeEventListener('click', refreshOrders);
        refreshButton.addEventListener('click', refreshOrders);
    }

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
        logoutButton.addEventListener('click', handleLogout);
    }

    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.removeEventListener('change', applyFilters);
        statusFilter.addEventListener('change', applyFilters);
    }

    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
        typeFilter.removeEventListener('change', applyFilters);
        typeFilter.addEventListener('change', applyFilters);
    }

    const searchFilter = document.getElementById('search-filter');
    if (searchFilter) {
        searchFilter.removeEventListener('input', applyFilters);
        searchFilter.addEventListener('input', applyFilters);
    }
}

function handleAdminSubmitDelegation(event) {
    if (event.target && event.target.id === 'login-form') {
        handleLogin(event);
    }
}

function handleLogin(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const email = document.getElementById('email')?.value || '';
    const password = document.getElementById('password')?.value || '';

    const result = adminAuth.login(email, password);

    if (result.success) {
        showDashboard();
        return true;
    }

    alert(result.error);
    return false;
}

function handleLogout() {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        adminAuth.logout();
        showLogin();
        return true;
    }
    return false;
}

window.handleLogin = handleLogin;
window.handleLogout = handleLogout;

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Initialize order service
    orderService = window.getOrderService ? window.getOrderService() : null;

    // Load orders
    loadOrders();

    // Auto-refresh every 30 seconds
    setInterval(loadOrders, 30000);
}

function getLocalOrders() {
    try {
        const saved = localStorage.getItem('orders');
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to load orders from localStorage:', error);
        return [];
    }
}

async function loadOrders() {
    try {
        if (orderService && typeof orderService.getAllOrders === 'function') {
            allOrders = await orderService.getAllOrders();
        } else {
            allOrders = getLocalOrders();
        }

        allOrders = Array.isArray(allOrders) ? allOrders : [];
        filteredOrders = [...allOrders];

        // Check for new orders
        checkNewOrders();

        // Apply filters
        applyFilters();

        // Update stats
        updateStats();

        // Render orders
        renderOrders();
    } catch (error) {
        console.error('Failed to load orders:', error);
        allOrders = getLocalOrders();
        filteredOrders = [...allOrders];
        renderOrders();
    }
}

function checkNewOrders() {
    const currentCount = allOrders.length;

    if (lastOrderCount > 0 && currentCount > lastOrderCount) {
        // New order detected
        playNotificationSound();
    }

    lastOrderCount = currentCount;
}

function playNotificationSound() {
    const audio = document.getElementById('notification-sound');
    if (audio) {
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
}

function updateStats() {
    const today = new Date().setHours(0, 0, 0, 0);
    const todayOrders = allOrders.filter(o => o.timestamp >= today);

    const pending = todayOrders.filter(o => o.status === 'pending').length;
    const preparing = todayOrders.filter(o => o.status === 'preparing').length;
    const ready = todayOrders.filter(o => o.status === 'ready').length;
    const total = todayOrders.reduce((sum, o) => sum + o.total, 0);

    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-preparing').textContent = preparing;
    document.getElementById('stat-ready').textContent = ready;
    document.getElementById('stat-total').textContent = total + ' DA';
}

function applyFilters() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const searchQuery = document.getElementById('search-filter').value.toLowerCase();

    filteredOrders = allOrders.filter(order => {
        // Status filter
        if (statusFilter !== 'all' && order.status !== statusFilter) {
            return false;
        }

        // Type filter
        if (typeFilter !== 'all' && order.orderType !== typeFilter) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const matchId = order.orderId.toLowerCase().includes(searchQuery);
            const matchPhone = order.customer.phone.includes(searchQuery);
            if (!matchId && !matchPhone) {
                return false;
            }
        }

        return true;
    });

    renderOrders();
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    const noOrders = document.getElementById('no-orders');

    if (!container || !noOrders) return;

    if (filteredOrders.length === 0) {
        container.innerHTML = '';
        noOrders.style.display = 'block';
        return;
    }

    noOrders.style.display = 'none';
    container.innerHTML = '';

    filteredOrders.forEach(order => {
        const card = createOrderCard(order);
        container.appendChild(card);
    });
}

function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';

    // Highlight new orders
    if (order.status === 'pending') {
        card.classList.add('new');
    }

    const typeLabels = {
        'dine-in': 'Sur place',
        'delivery': 'Livraison',
        'takeaway': 'À emporter'
    };

    const statusLabels = {
        'pending': 'En attente',
        'preparing': 'En préparation',
        'ready': 'Prêt',
        'delivered': 'Livré',
        'cancelled': 'Annulé'
    };

    const timeStr = new Date(order.timestamp).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let customerInfo = `
        <p><strong>Nom:</strong> ${order.customer.name}</p>
        <p><strong>Tél:</strong> ${order.customer.phone}</p>
    `;

    if (order.orderType === 'delivery' && order.customer.address) {
        customerInfo += `<p><strong>Adresse:</strong> ${order.customer.address}</p>`;
    }

    if (order.orderType === 'dine-in' && order.tableNumber) {
        customerInfo += `<p><strong>Table:</strong> ${order.tableNumber}</p>`;
    }

    const itemsList = order.items.map(item => {
        const size = item.size ? ` (${item.size})` : '';
        const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
        return `
            <div class="order-item">
                <span>${item.name}${size}${qty}</span>
                <span>${item.price * item.quantity} DA</span>
            </div>
        `;
    }).join('');

    let statusButtons = '';
    if (order.status === 'pending') {
        statusButtons = `
            <button class="status-btn preparing" onclick="updateOrderStatus('${order.orderId}', 'preparing')">
                👨‍🍳 En préparation
            </button>
            <button class="status-btn cancel" onclick="updateOrderStatus('${order.orderId}', 'cancelled')">
                ❌ Annuler
            </button>
        `;
    } else if (order.status === 'preparing') {
        statusButtons = `
            <button class="status-btn ready" onclick="updateOrderStatus('${order.orderId}', 'ready')">
                ✅ Prêt
            </button>
        `;
    } else if (order.status === 'ready') {
        statusButtons = `
            <button class="status-btn ready" onclick="updateOrderStatus('${order.orderId}', 'delivered')">
                🚗 Livré
            </button>
        `;
    }

    card.innerHTML = `
        <div class="order-header">
            <div>
                <div class="order-id">${order.orderId}</div>
                <div class="order-time">${timeStr}</div>
            </div>
            <div>
                <span class="order-type-badge ${order.orderType}">${typeLabels[order.orderType]}</span>
            </div>
        </div>
        <div class="order-body">
            <div class="customer-info">
                ${customerInfo}
            </div>
            <div class="order-items">
                ${itemsList}
            </div>
            <div class="order-total">Total: ${order.total} DA</div>
        </div>
        <div class="order-footer">
            ${statusButtons}
        </div>
    `;

    return card;
}

async function updateOrderStatus(orderId, newStatus) {
    if (!orderService) return;

    try {
        const result = await orderService.updateOrderStatus(orderId, newStatus);

        if (result.success) {
            // Reload orders
            await loadOrders();

            // Show notification
            alert(`Commande ${orderId} mise à jour: ${newStatus}`);
        } else {
            alert('Erreur lors de la mise à jour');
        }
    } catch (error) {
        console.error('Update error:', error);
        alert('Erreur lors de la mise à jour');
    }
}

function refreshOrders() {
    loadOrders();
}

function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
}

// Export functions
if (typeof window !== 'undefined') {
    window.handleLogin = handleLogin;
    window.handleLogout = handleLogout;
    window.applyFilters = applyFilters;
    window.updateOrderStatus = updateOrderStatus;
    window.refreshOrders = refreshOrders;
    window.closeOrderModal = closeOrderModal;
    window.showLogin = showLogin;
    window.showDashboard = showDashboard;
}
