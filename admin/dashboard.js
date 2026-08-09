// Admin Dashboard Logic
// Sortable/paginated orders table (M1), order-details modal with status
// workflow (M2), CSV export / print / pagination (M3), tri-lingual UI (M5).
//
// NOTE: the whole file is an IIFE so no top-level binding can collide with the
// globals in js/order-service.js / js/firebase-config.js (the classic-script
// global-collision bug that broke this dashboard before). The only globals we
// create are the deliberate window.* exports at the bottom.
(function () {
    'use strict';

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------
    var allOrders = [];
    var filteredOrders = [];
    var adminOrderService = null;   // set lazily from window.getOrderService()
    var lastOrderCount = 0;
    var ordersUnsubscribe = null;   // active Firestore real-time listener handle

    // Table state
    var sortKey = 'timestamp';
    var sortDir = 'desc';
    var currentPage = 1;
    var pageSize = 25;

    // Modal state
    var activeModalOrderId = null;
    var lastFocusedElement = null;

    // Last status banner state (so it can be re-translated on admin:i18n)
    var lastStatus = null; // { type: 'ok'|'warn'|'noAccess'|'error', count, message }

    // ---------------------------------------------------------------------
    // i18n helpers — delegate to window.adminI18n with inline fallbacks so the
    // dashboard still renders if i18n.js failed to load.
    // ---------------------------------------------------------------------
    function t(key, vars) {
        return window.adminI18n ? window.adminI18n.t(key, vars) : key;
    }

    function escapeHtml(str) {
        return window.adminI18n ? window.adminI18n.escapeHtml(str) : defaultEscapeHtml(str);
    }

    function defaultEscapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateTime(ms) {
        return window.adminI18n ? window.adminI18n.formatDateTime(ms) : (ms ? new Date(ms).toLocaleString() : '—');
    }

    function formatCurrency(n) {
        return window.adminI18n ? window.adminI18n.formatCurrency(n) : ((Number(n) || 0) + ' DA');
    }

    function statusLabel(status) {
        return window.adminI18n ? window.adminI18n.statusLabel(status) : status;
    }

    function typeLabel(type) {
        return window.adminI18n ? window.adminI18n.typeLabel(type) : type;
    }

    // Prices/totals must never let a NaN or string leak into a cell.
    function safeNumber(v) {
        var n = Number(v);
        return isNaN(n) ? 0 : n;
    }

    // Reuse the shared normalization exported by js/order-service.js
    // (window.orderTimestampMs), with an inline fallback so the dashboard still
    // works even if that script failed to load.
    function orderTimestampMs(order) {
        if (typeof window.orderTimestampMs === 'function') {
            return window.orderTimestampMs(order);
        }
        var ts = order && order.timestamp;
        if (typeof ts === 'number') return ts;
        if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts === 'string') {
            var n = Date.parse(ts);
            return isNaN(n) ? 0 : n;
        }
        return 0;
    }

    // ---------------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAdminPage);
    } else {
        initializeAdminPage();
    }

    function initializeAdminPage() {
        bindAdminEvents();

        // Stop the Firestore listener when the page is left, so a hidden tab
        // never keeps pushing updates.
        window.addEventListener('beforeunload', stopListening);

        // Re-render dynamic content when the language changes (no page reload).
        window.addEventListener('admin:i18n', onI18nChanged);

        // Single source of truth: onAuthStateChanged drives login vs dashboard.
        if (window.adminAuth && typeof window.adminAuth.onAuthChange === 'function') {
            window.adminAuth.onAuthChange(handleAuthChange);
        } else {
            console.error('[admin] adminAuth not available');
            showLogin();
        }
    }

    function onI18nChanged() {
        updateLoginHint();
        // Re-render dynamic content whenever the dashboard is the active view.
        // Keying on visibility (not on auth state) keeps this correct even when
        // the dashboard is mounted via a non-auth path during testing.
        var dashboard = document.getElementById('dashboard');
        var dashboardVisible = dashboard && getComputedStyle(dashboard).display !== 'none';
        if (dashboardVisible) {
            updateStats();
            applyFilters(); // re-renders table + pagination with translated labels
            if (activeModalOrderId) renderOrderModal();
        }
        if (lastStatus) {
            showDataStatus(lastStatus.type, lastStatus.count, lastStatus.message);
        }
    }

    // Called by the auth layer whenever the sign-in state changes (including
    // once at boot, replaying the current state).
    function handleAuthChange(user) {
        if (user) {
            showDashboard();
            startListening();
            loadOrders(); // initial prime; sets lastOrderCount baseline so no beep on first load
        } else {
            stopListening();
            allOrders = [];
            filteredOrders = [];
            closeOrderModal();
            showLogin();
        }
    }

    function bindAdminEvents() {
        var loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        var refreshButton = document.getElementById('refresh-orders-btn');
        if (refreshButton) {
            refreshButton.addEventListener('click', refreshOrders);
        }

        var logoutButton = document.getElementById('logout-btn');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        var statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', applyFilters);
        }

        var typeFilter = document.getElementById('type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', applyFilters);
        }

        var searchFilter = document.getElementById('search-filter');
        if (searchFilter) {
            searchFilter.addEventListener('input', applyFilters);
        }

        var pageSizeSelect = document.getElementById('page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', function (event) {
                pageSize = Number(event.target.value) || 25;
                currentPage = 1;
                renderTable();
            });
        }

        var prevPageBtn = document.getElementById('prev-page');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function () {
                if (currentPage > 1) { currentPage--; renderTable(); }
            });
        }

        var nextPageBtn = document.getElementById('next-page');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function () {
                var maxPage = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
                if (currentPage < maxPage) { currentPage++; renderTable(); }
            });
        }

        var exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportCSV);
        }

        var printBtn = document.getElementById('print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', function () { window.print(); });
        }

        // Delegated row click (View button bubbles to the same handler).
        var tbody = document.getElementById('orders-tbody');
        if (tbody) {
            tbody.addEventListener('click', function (event) {
                var row = event.target && event.target.closest
                    ? event.target.closest('tr[data-order-id]')
                    : null;
                if (row) openOrderModal(row.getAttribute('data-order-id'));
            });
        }

        // Delegated column-header sort.
        var thead = document.querySelector('#orders-table thead');
        if (thead) {
            thead.addEventListener('click', function (event) {
                var th = event.target && event.target.closest
                    ? event.target.closest('th[data-sort-key]')
                    : null;
                if (!th) return;
                var key = th.getAttribute('data-sort-key');
                if (sortKey === key) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortKey = key;
                    sortDir = (key === 'timestamp') ? 'desc' : 'asc';
                }
                currentPage = 1;
                applyFilters();
            });
        }

        // Delegated modal interactions: backdrop click, × close, status buttons.
        var modal = document.getElementById('order-modal');
        if (modal) {
            modal.addEventListener('click', function (event) {
                if (event.target === modal) {
                    closeOrderModal();
                    return;
                }
                var btn = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
                if (!btn) return;
                var action = btn.getAttribute('data-action');
                if (action === 'close') {
                    closeOrderModal();
                } else if (action === 'status' && activeModalOrderId) {
                    updateOrderStatus(activeModalOrderId, btn.getAttribute('data-status'));
                }
            });
        }

        // Escape closes the modal.
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && activeModalOrderId) {
                closeOrderModal();
            }
        });
    }

    // ---------------------------------------------------------------------
    // Auth UI
    // ---------------------------------------------------------------------
    function handleLogin(event) {
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        var emailInput = document.getElementById('email');
        var passwordInput = document.getElementById('password');
        var errorEl = document.getElementById('login-error');
        var btn = document.querySelector('#login-form button[type="submit"]');

        var email = (emailInput && emailInput.value ? emailInput.value : '').trim();
        var password = passwordInput ? passwordInput.value : '';

        if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
        if (btn) { btn.disabled = true; }

        window.adminAuth.login(email, password)
            .then(function () {
                // Success: onAuthStateChanged → handleAuthChange(user) shows the dashboard.
            })
            .catch(function (error) {
                if (btn) { btn.disabled = false; }
                var key = window.adminAuth.loginErrorKey(error);
                var message = t(key);
                if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
            });

        return false;
    }

    function handleLogout() {
        if (!confirm(t('logout.confirm'))) {
            return false;
        }
        // onAuthStateChanged(null) → handleAuthChange(null) shows the login
        // screen and stops the listener.
        window.adminAuth.logout().catch(function (error) {
            console.error('Logout error:', error);
        });
        return true;
    }

    function showLogin() {
        var loginScreen = document.getElementById('login-screen');
        var dashboard = document.getElementById('dashboard');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (dashboard) dashboard.style.display = 'none';
        updateLoginHint();
    }

    function showDashboard() {
        var loginScreen = document.getElementById('login-screen');
        var dashboard = document.getElementById('dashboard');
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';

        // Initialize order service
        adminOrderService = window.getOrderService ? window.getOrderService() : null;

        if (!adminOrderService || !adminOrderService.useFirebase) {
            showDataStatus('warn');
            loadOrders(); // local fallback
            return;
        }

        // Load once, then subscribe to real-time updates from Firestore
        loadOrders();
        startListening();
    }

    function updateLoginHint() {
        var hint = document.getElementById('login-hint');
        if (!hint) return;
        var email = (window.adminAuth && window.adminAuth.ADMIN_EMAIL_DISPLAY) || '';
        hint.textContent = t('login.hint') + (email ? ' ' + email : '');
    }

    // ---------------------------------------------------------------------
    // Firestore real-time listener
    // ---------------------------------------------------------------------
    function startListening() {
        if (!adminOrderService || typeof adminOrderService.listenToOrders !== 'function') return;

        if (ordersUnsubscribe) {
            ordersUnsubscribe();
            ordersUnsubscribe = null;
        }

        ordersUnsubscribe = adminOrderService.listenToOrders(
            function (orders) {
                allOrders = Array.isArray(orders) ? orders : [];
                console.log('[Admin] Real-time orders update:', allOrders.length);
                showDataStatus('ok', allOrders.length);
                refreshFromData();
            },
            handleListenError
        );
    }

    // Stop the real-time listener (logout, page unload). Prevents permission-denied
    // error spam after the admin signs out while the listener is still active.
    function stopListening() {
        if (ordersUnsubscribe) {
            ordersUnsubscribe();
            ordersUnsubscribe = null;
        }
    }

    function handleListenError(error) {
        console.error('Firestore real-time listener error:', error);

        if (window.isPermissionDenied ? window.isPermissionDenied(error) : false) {
            // Never fall back to local storage on a permissions error — surface it.
            showDataStatus('noAccess');
            return;
        }

        var message = window.getFirebaseErrorMessage
            ? window.getFirebaseErrorMessage(error)
            : (error && error.message ? error.message : 'Unknown error');
        showDataStatus('error', null, message);
        // Fall back to a one-off fetch so the table still updates on refresh
        loadOrders();
    }

    // ---------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------
    function getLocalOrders() {
        try {
            var saved = localStorage.getItem('orders');
            var parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to load orders from localStorage:', error);
            return [];
        }
    }

    async function loadOrders() {
        try {
            if (adminOrderService && typeof adminOrderService.getAllOrders === 'function') {
                allOrders = await adminOrderService.getAllOrders();
            } else {
                allOrders = getLocalOrders();
            }

            allOrders = Array.isArray(allOrders) ? allOrders : [];
            console.log('[Admin] Orders loaded:', allOrders.length);
            // Only claim a Firestore connection when we actually used Firestore;
            // otherwise keep the "local orders only" warning shown by showDashboard.
            if (adminOrderService && adminOrderService.useFirebase) {
                showDataStatus('ok', allOrders.length);
            }
            refreshFromData();
        } catch (error) {
            console.error('Failed to load orders:', error);

            // A permissions error must never fall back to local storage: the admin
            // needs to know they are not authorized, not see stale local data.
            if (window.isPermissionDenied && window.isPermissionDenied(error)) {
                showDataStatus('noAccess');
                return;
            }

            showDataStatus('error', null, (error && error.message) || 'Unknown error');
            allOrders = getLocalOrders();
            refreshFromData();
        }
    }

    // Shared rendering path used by both the initial fetch and real-time updates
    function refreshFromData() {
        allOrders = Array.isArray(allOrders) ? allOrders : [];

        checkNewOrders();
        updateStats();
        applyFilters();

        // Keep an open modal in sync with live status changes.
        if (activeModalOrderId) renderOrderModal();
    }

    // ---------------------------------------------------------------------
    // Status banner
    // ---------------------------------------------------------------------
    function showDataStatus(type, count, message) {
        lastStatus = { type: type, count: count, message: message };
        var el = document.getElementById('data-status');
        if (!el) return;

        var text;
        if (type === 'ok') {
            text = t('status.connecting', { count: count !== undefined ? count : allOrders.length });
        } else if (type === 'warn') {
            text = t('status.warn');
        } else if (type === 'noAccess') {
            text = t('status.noAccess');
        } else {
            text = t('status.error', { message: message || '—' });
        }

        var styles = {
            ok:    { background: '#E8F5E9', color: '#2E7D32', borderColor: '#A5D6A7' },
            warn:  { background: '#FFF8E1', color: '#8A6D00', borderColor: '#FFE082' },
            error: { background: '#FFEBEE', color: '#C62828', borderColor: '#EF9A9A' },
            noAccess: { background: '#FFEBEE', color: '#C62828', borderColor: '#EF9A9A' }
        };
        var s = styles[type] || styles.warn;

        el.style.display = 'block';
        el.style.background = s.background;
        el.style.color = s.color;
        el.style.border = '1px solid ' + s.borderColor;
        el.style.padding = '12px 16px';
        el.style.borderRadius = '8px';
        el.style.fontSize = '14px';
        el.style.fontWeight = '600';
        el.style.marginBottom = '16px';
        el.textContent = text;
    }

    // ---------------------------------------------------------------------
    // New-order notification (beep + count)
    // ---------------------------------------------------------------------
    function checkNewOrders() {
        var currentCount = allOrders.length;

        if (lastOrderCount > 0 && currentCount > lastOrderCount) {
            // New order detected
            playNotificationSound();
        }

        lastOrderCount = currentCount;
    }

    function playNotificationSound() {
        var audio = document.getElementById('notification-sound');
        if (audio) {
            audio.play().catch(function (e) { console.log('Audio play failed:', e); });
        }
    }

    // ---------------------------------------------------------------------
    // Stats
    // ---------------------------------------------------------------------
    function updateStats() {
        var today = new Date().setHours(0, 0, 0, 0);
        var todayOrders = allOrders.filter(function (o) { return orderTimestampMs(o) >= today; });

        var pending = todayOrders.filter(function (o) { return o.status === 'pending'; }).length;
        var preparing = todayOrders.filter(function (o) { return o.status === 'preparing'; }).length;
        var ready = todayOrders.filter(function (o) { return o.status === 'ready'; }).length;
        var total = todayOrders.reduce(function (sum, o) { return sum + safeNumber(o.total); }, 0);

        var pendingEl = document.getElementById('stat-pending');
        var preparingEl = document.getElementById('stat-preparing');
        var readyEl = document.getElementById('stat-ready');
        var totalEl = document.getElementById('stat-total');
        if (pendingEl) pendingEl.textContent = pending;
        if (preparingEl) preparingEl.textContent = preparing;
        if (readyEl) readyEl.textContent = ready;
        if (totalEl) totalEl.textContent = formatCurrency(total);
    }

    // ---------------------------------------------------------------------
    // Filtering + sorting + pagination
    // ---------------------------------------------------------------------
    function applyFilters() {
        var statusFilterEl = document.getElementById('status-filter');
        var typeFilterEl = document.getElementById('type-filter');
        var searchFilterEl = document.getElementById('search-filter');

        var statusFilter = statusFilterEl ? statusFilterEl.value : 'all';
        var typeFilter = typeFilterEl ? typeFilterEl.value : 'all';
        var searchQuery = (searchFilterEl ? searchFilterEl.value : '').toLowerCase();

        filteredOrders = allOrders.filter(function (order) {
            // A single malformed order must never break the whole list.
            try {
                if (statusFilter !== 'all' && (order.status || '') !== statusFilter) {
                    return false;
                }

                if (typeFilter !== 'all' && (order.orderType || '') !== typeFilter) {
                    return false;
                }

                if (searchQuery) {
                    var orderId = (order.orderId || '').toLowerCase();
                    var phone = ((order.customer && order.customer.phone) || '').toLowerCase();
                    var name = ((order.customer && order.customer.name) || '').toLowerCase();
                    if (orderId.indexOf(searchQuery) === -1 &&
                        phone.indexOf(searchQuery) === -1 &&
                        name.indexOf(searchQuery) === -1) {
                        return false;
                    }
                }

                return true;
            } catch (error) {
                console.error('[Admin] filter error for order:', order, error);
                return false;
            }
        });

        sortOrders();
        clampPage();
        updateSortIndicators();
        renderTable();
        updatePaginationInfo();
    }

    function sortOrders() {
        filteredOrders.sort(function (a, b) {
            var av, bv;
            switch (sortKey) {
                case 'orderId':
                    av = (a.orderId || '').toLowerCase();
                    bv = (b.orderId || '').toLowerCase();
                    break;
                case 'timestamp':
                    av = orderTimestampMs(a);
                    bv = orderTimestampMs(b);
                    break;
                case 'customer':
                    av = ((a.customer && a.customer.name) || '').toLowerCase();
                    bv = ((b.customer && b.customer.name) || '').toLowerCase();
                    break;
                case 'items':
                    av = (a.items || []).length;
                    bv = (b.items || []).length;
                    break;
                case 'type':
                    av = (a.orderType || '');
                    bv = (b.orderType || '');
                    break;
                case 'total':
                    av = safeNumber(a.total);
                    bv = safeNumber(b.total);
                    break;
                case 'status':
                    av = (a.status || '');
                    bv = (b.status || '');
                    break;
                default:
                    av = orderTimestampMs(a);
                    bv = orderTimestampMs(b);
            }
            var cmp = av < bv ? -1 : (av > bv ? 1 : 0);
            return cmp * (sortDir === 'asc' ? 1 : -1);
        });
    }

    function clampPage() {
        var maxPage = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
        if (currentPage > maxPage) currentPage = maxPage;
    }

    function updateSortIndicators() {
        var headers = document.querySelectorAll('#orders-table thead th[data-sort-key]');
        for (var i = 0; i < headers.length; i++) {
            var key = headers[i].getAttribute('data-sort-key');
            headers[i].classList.remove('sort-asc', 'sort-desc');
            headers[i].removeAttribute('aria-sort');
            if (key === sortKey) {
                headers[i].classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
                headers[i].setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
            }
        }
    }

    function updatePaginationInfo() {
        var maxPage = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

        var pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            pageInfo.textContent = t('pagination.page', { current: currentPage, total: maxPage });
        }

        var prevBtn = document.getElementById('prev-page');
        var nextBtn = document.getElementById('next-page');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= maxPage;
    }

    function renderTable() {
        var tbody = document.getElementById('orders-tbody');
        if (!tbody) return;

        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">' + escapeHtml(t('table.empty')) + '</td></tr>';
            updatePaginationInfo();
            return;
        }

        var start = (currentPage - 1) * pageSize;
        var pageOrders = filteredOrders.slice(start, start + pageSize);
        var html = '';

        for (var i = 0; i < pageOrders.length; i++) {
            var order = pageOrders[i];
            var customer = (order.customer && order.customer.name) || '';
            var phone = (order.customer && order.customer.phone) || '';
            var itemsCount = (order.items || []).length;
            var isNew = order.status === 'pending';

            html += '<tr data-order-id="' + escapeHtml(order.orderId) + '"' + (isNew ? ' class="new"' : '') + '>';
            html += '<td class="order-id-cell">' + escapeHtml(order.orderId) + '</td>';
            html += '<td>' + escapeHtml(formatDateTime(orderTimestampMs(order))) + '</td>';
            html += '<td>' + escapeHtml(customer);
            if (phone) {
                html += '<br><small class="cell-phone">' + escapeHtml(phone) + '</small>';
            }
            html += '</td>';
            html += '<td>' + escapeHtml(t('table.itemsSummary', { count: itemsCount })) + '</td>';
            html += '<td><span class="order-type-badge ' + escapeHtml(order.orderType) + '">' +
                escapeHtml(typeLabel(order.orderType)) + '</span></td>';
            html += '<td>' + escapeHtml(formatCurrency(order.total)) + '</td>';
            html += '<td><span class="status-badge ' + escapeHtml(order.status) + '">' +
                escapeHtml(statusLabel(order.status)) + '</span></td>';
            html += '<td><button type="button" class="btn-view" data-action="view">' +
                escapeHtml(t('table.view')) + '</button></td>';
            html += '</tr>';
        }

        tbody.innerHTML = html;
        updatePaginationInfo();
    }

    // ---------------------------------------------------------------------
    // Order details modal
    // ---------------------------------------------------------------------
    function openOrderModal(orderId) {
        var order = allOrders.find(function (o) { return o.orderId === orderId; });
        if (!order) return;

        activeModalOrderId = orderId;
        lastFocusedElement = document.activeElement;

        var modal = document.getElementById('order-modal');
        if (modal) modal.style.display = 'flex';

        renderOrderModal();

        var closeBtn = modal && modal.querySelector('.modal-close');
        if (closeBtn && closeBtn.focus) closeBtn.focus();
    }

    function closeOrderModal() {
        var modal = document.getElementById('order-modal');
        if (modal) modal.style.display = 'none';
        activeModalOrderId = null;

        if (lastFocusedElement && lastFocusedElement.focus) {
            try { lastFocusedElement.focus(); } catch (e) { /* element removed */ }
        }
        lastFocusedElement = null;
    }

    function renderOrderModal() {
        var details = document.getElementById('order-details');
        if (!details) return;

        var order = activeModalOrderId
            ? allOrders.find(function (o) { return o.orderId === activeModalOrderId; })
            : null;

        if (!order) {
            details.innerHTML = '<p>' + escapeHtml(t('modal.notFound')) + '</p>';
            return;
        }

        var cust = order.customer || {};

        // Itemized lines
        var itemsHtml = '';
        var items = order.items || [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var size = item.size ? ' <small class="item-size">(' + escapeHtml(item.size) + ')</small>' : '';
            var qty = safeNumber(item.quantity);
            var qtyText = qty > 1 ? ' <span class="item-qty">×' + qty + '</span>' : '';
            var notes = item.notes ? '<span class="item-note">' + escapeHtml(item.notes) + '</span>' : '';
            var lineTotal = safeNumber(item.price) * qty;
            itemsHtml += '<div class="modal-item">' +
                '<div><span class="item-name">' + escapeHtml(item.name) + '</span>' + size + qtyText + notes + '</div>' +
                '<span class="item-price">' + escapeHtml(formatCurrency(lineTotal)) + '</span>' +
                '</div>';
        }

        // Customer / address / table / pickup block
        var customerHtml = '';
        customerHtml += '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.name')) + '</span>' +
            '<span class="detail-value">' + escapeHtml(cust.name || '—') + '</span></div>';
        customerHtml += '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.phone')) + '</span>' +
            '<span class="detail-value">' + escapeHtml(cust.phone || '—') + '</span></div>';
        if (order.orderType === 'delivery') {
            customerHtml += '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.address')) + '</span>' +
                '<span class="detail-value">' + escapeHtml(cust.address || '—') + '</span></div>';
        } else if (order.orderType === 'dine-in') {
            customerHtml += '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.table')) + '</span>' +
                '<span class="detail-value">' + escapeHtml(order.tableNumber != null ? String(order.tableNumber) : '—') + '</span></div>';
        } else if (order.orderType === 'takeaway') {
            customerHtml += '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.pickup')) + '</span>' +
                '<span class="detail-value">' + escapeHtml(order.pickupTime || '—') + '</span></div>';
        }

        // Status workflow buttons
        var statusHtml = '';
        if (order.status === 'pending') {
            statusHtml = '<button type="button" class="status-action-btn preparing" data-action="status" data-status="preparing">' +
                escapeHtml(t('action.markPreparing')) + '</button>' +
                '<button type="button" class="status-action-btn cancel" data-action="status" data-status="cancelled">' +
                escapeHtml(t('action.cancel')) + '</button>';
        } else if (order.status === 'preparing') {
            statusHtml = '<button type="button" class="status-action-btn ready" data-action="status" data-status="ready">' +
                escapeHtml(t('action.markReady')) + '</button>';
        } else if (order.status === 'ready') {
            statusHtml = '<button type="button" class="status-action-btn delivered" data-action="status" data-status="delivered">' +
                escapeHtml(t('action.markDelivered')) + '</button>';
        }

        var paymentMethod = order.paymentMethod ? t('payment.' + order.paymentMethod) : '—';
        var paymentStatus = order.paymentStatus ? t('payment.' + order.paymentStatus) : '—';

        var html = '';
        html += '<div class="modal-header">' +
            '<div>' +
                '<div class="modal-id">' + escapeHtml(order.orderId) + '</div>' +
                '<div class="modal-time">' + escapeHtml(formatDateTime(orderTimestampMs(order))) + '</div>' +
            '</div>' +
            '<span class="order-type-badge ' + escapeHtml(order.orderType) + '">' +
                escapeHtml(typeLabel(order.orderType)) + '</span>' +
            '</div>';

        html += '<div class="modal-section"><h3>' + escapeHtml(t('modal.customer')) + '</h3>' + customerHtml + '</div>';

        html += '<div class="modal-section"><h3>' + escapeHtml(t('modal.items')) + '</h3>' + itemsHtml +
            '<div class="totals-block">' +
                '<div class="total-line"><span>' + escapeHtml(t('modal.subtotal')) + '</span><span>' +
                    escapeHtml(formatCurrency(order.subtotal)) + '</span></div>' +
                '<div class="total-line"><span>' + escapeHtml(t('modal.deliveryFee')) + '</span><span>' +
                    escapeHtml(formatCurrency(order.deliveryFee)) + '</span></div>' +
                '<div class="total-line grand"><span>' + escapeHtml(t('modal.total')) + '</span><span>' +
                    escapeHtml(formatCurrency(order.total)) + '</span></div>' +
            '</div></div>';

        html += '<div class="modal-section"><h3>' + escapeHtml(t('modal.payment')) + '</h3>' +
            '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.paymentMethod')) + '</span>' +
            '<span class="detail-value">' + escapeHtml(paymentMethod) + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">' + escapeHtml(t('modal.paymentStatus')) + '</span>' +
            '<span class="detail-value">' + escapeHtml(paymentStatus) + '</span></div>' +
            '</div>';

        html += '<div class="modal-section"><h3>' + escapeHtml(t('modal.instructions')) + '</h3>' +
            '<p>' + escapeHtml(order.specialInstructions || t('modal.noInstructions')) + '</p></div>';

        if (statusHtml) {
            html += '<div class="status-actions">' + statusHtml + '</div>';
        }

        details.innerHTML = html;
    }

    async function updateOrderStatus(orderId, newStatus) {
        if (!adminOrderService) return;

        // Disable the action buttons while the update is in flight.
        var buttons = document.querySelectorAll('#order-modal .status-action-btn');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = true;
        }

        try {
            var result = await adminOrderService.updateOrderStatus(orderId, newStatus);

            if (result && result.success) {
                // The real-time listener refreshes the table + modal automatically.
                // Without a listener, do a one-off fetch so the UI still updates.
                if (!ordersUnsubscribe) {
                    loadOrders();
                }
            } else {
                showDataStatus('error', null, (result && result.error) || 'Order update failed');
                reenableStatusButtons();
            }
        } catch (error) {
            console.error('Update error:', error);
            showDataStatus('error', null, (error && error.message) || 'Order update failed');
            reenableStatusButtons();
        }
    }

    function reenableStatusButtons() {
        var buttons = document.querySelectorAll('#order-modal .status-action-btn');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = false;
        }
    }

    // ---------------------------------------------------------------------
    // CSV export (M3)
    // ---------------------------------------------------------------------
    function csvCell(v) {
        if (v == null) v = '';
        v = String(v);
        var needsQuote = v.indexOf(',') >= 0 || v.indexOf('"') >= 0 ||
            v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0 ||
            v.charAt(0) === ' ' || v.charAt(v.length - 1) === ' ';
        if (needsQuote) {
            return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
    }

    function exportCSV() {
        if (filteredOrders.length === 0) return;

        var rows = [];
        rows.push([
            csvCell(t('table.orderId')),
            csvCell(t('table.date')),
            csvCell(t('table.customer')),
            csvCell(t('table.phone')),
            csvCell(t('table.type')),
            csvCell(t('table.items')),
            csvCell(t('table.total')),
            csvCell(t('table.status'))
        ].join(','));

        for (var i = 0; i < filteredOrders.length; i++) {
            var o = filteredOrders[i];
            var cust = o.customer || {};
            rows.push([
                csvCell(o.orderId),
                csvCell(formatDateTime(orderTimestampMs(o))),
                csvCell(cust.name),
                csvCell(cust.phone),
                csvCell(typeLabel(o.orderType)),
                csvCell(String((o.items || []).length)),
                csvCell(String(safeNumber(o.total))),
                csvCell(statusLabel(o.status))
            ].join(','));
        }

        var csv = rows.join('\r\n');

        // Filename from local time: orders-YYYYMMDD-HHmm.csv
        var now = new Date();
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        var stamp = now.getFullYear().toString() +
            pad(now.getMonth() + 1) + pad(now.getDate()) + '-' +
            pad(now.getHours()) + pad(now.getMinutes());

        // BOM so Excel opens UTF-8 accents/Arabic correctly.
        var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'orders-' + stamp + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function refreshOrders() {
        loadOrders();
    }

    // Keep the deliberate window.* exports the existing pages/HTML depend on.
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
})();
