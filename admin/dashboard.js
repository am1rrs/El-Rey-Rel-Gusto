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

    // Filter state (centralized — read by applyFilters, written by collectFilterControls)
    var FILTERS_STORAGE_KEY = 'adminFilters';
    var searchDebounceTimer = null;

    function defaultFilterState() {
        return {
            statuses: [],      // [] = all; array of selected status values
            type: 'all',
            search: '',
            dateRange: 'today', // today | week | month | custom
            dateFrom: '',
            dateTo: '',
            paymentStatus: 'all',
            paymentMethod: 'all'
        };
    }

    var filterState = defaultFilterState();

    // View / sidebar / theme state (dashboard redesign)
    var currentView = 'overview';              // 'overview' | 'orders'
    var sidebarOpen = true;
    var darkMode = false;
    var THEME_KEY = 'adminTheme';
    var SIDEBAR_KEY = 'adminSidebar';

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

    // ---------------------------------------------------------------------
    // Filter helpers
    // ---------------------------------------------------------------------
    function collectFilterControls() {
        // Status checkboxes
        var checkboxes = document.querySelectorAll('.status-checkbox');
        var selectedStatuses = [];
        for (var i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked) {
                selectedStatuses.push(checkboxes[i].value);
            }
        }
        filterState.statuses = selectedStatuses;

        // Type
        var typeEl = document.getElementById('type-filter');
        filterState.type = typeEl ? typeEl.value : 'all';

        // Search
        var searchEl = document.getElementById('search-filter');
        filterState.search = searchEl ? searchEl.value : '';

        // Date range
        var dateFilterEl = document.getElementById('date-filter');
        filterState.dateRange = dateFilterEl ? dateFilterEl.value : 'today';
        var dateFromEl = document.getElementById('date-from');
        var dateToEl = document.getElementById('date-to');
        filterState.dateFrom = dateFromEl ? dateFromEl.value : '';
        filterState.dateTo = dateToEl ? dateToEl.value : '';

        // Custom date range visibility
        var customRangeEl = document.getElementById('custom-date-range');
        if (customRangeEl) {
            customRangeEl.hidden = filterState.dateRange !== 'custom';
        }

        // Payment status
        var paymentStatusEl = document.getElementById('payment-status-filter');
        filterState.paymentStatus = paymentStatusEl ? paymentStatusEl.value : 'all';

        // Payment method
        var paymentMethodEl = document.getElementById('payment-method-filter');
        filterState.paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'all';
    }

    function syncFilterControls() {
        // Status checkboxes
        var checkboxes = document.querySelectorAll('.status-checkbox');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = filterState.statuses.indexOf(checkboxes[i].value) >= 0;
        }

        // Type
        var typeEl = document.getElementById('type-filter');
        if (typeEl) typeEl.value = filterState.type;

        // Search
        var searchEl = document.getElementById('search-filter');
        if (searchEl) searchEl.value = filterState.search;

        // Date range
        var dateFilterEl = document.getElementById('date-filter');
        if (dateFilterEl) dateFilterEl.value = filterState.dateRange;
        var dateFromEl = document.getElementById('date-from');
        var dateToEl = document.getElementById('date-to');
        if (dateFromEl) dateFromEl.value = filterState.dateFrom;
        if (dateToEl) dateToEl.value = filterState.dateTo;

        // Custom date range visibility
        var customRangeEl = document.getElementById('custom-date-range');
        if (customRangeEl) {
            customRangeEl.hidden = filterState.dateRange !== 'custom';
        }

        // Payment status
        var paymentStatusEl = document.getElementById('payment-status-filter');
        if (paymentStatusEl) paymentStatusEl.value = filterState.paymentStatus;

        // Payment method
        var paymentMethodEl = document.getElementById('payment-method-filter');
        if (paymentMethodEl) paymentMethodEl.value = filterState.paymentMethod;
    }

    function saveFilters() {
        try {
            localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ v: 1, state: filterState }));
        } catch (e) { /* private mode */ }
    }

    function loadFilters() {
        try {
            var saved = localStorage.getItem(FILTERS_STORAGE_KEY);
            if (!saved) return;
            var parsed = JSON.parse(saved);
            if (parsed && parsed.state) {
                var s = parsed.state;
                filterState.statuses = Array.isArray(s.statuses) ? s.statuses : [];
                filterState.type = s.type || 'all';
                filterState.search = s.search || '';
                filterState.dateRange = s.dateRange || 'today';
                filterState.dateFrom = s.dateFrom || '';
                filterState.dateTo = s.dateTo || '';
                filterState.paymentStatus = s.paymentStatus || 'all';
                filterState.paymentMethod = s.paymentMethod || 'all';
            }
        } catch (e) { /* ignore corrupted data */ }
    }

    function resetFilters() {
        filterState = defaultFilterState();
        syncFilterControls();
        applyFilters();
        saveFilters();
        updateFilterUI();
    }

    function isFilterActive() {
        return filterState.statuses.length > 0 ||
            filterState.type !== 'all' ||
            filterState.search !== '' ||
            filterState.dateRange !== 'today' ||
            filterState.paymentStatus !== 'all' ||
            filterState.paymentMethod !== 'all';
    }

    function updateFilterUI() {
        var clearBtn = document.getElementById('clear-filters-btn');
        if (clearBtn) {
            clearBtn.hidden = !isFilterActive();
        }

        var resultsEl = document.getElementById('results-count');
        if (resultsEl) {
            resultsEl.textContent = t('filters.resultsCount', {
                count: filteredOrders.length,
                total: allOrders.length
            });
        }

        // Update stat cards active state
        var statCards = document.querySelectorAll('.stat-card[data-status]');
        for (var i = 0; i < statCards.length; i++) {
            var status = statCards[i].getAttribute('data-status');
            var isActive = filterState.statuses.length === 1 && filterState.statuses[0] === status;
            statCards[i].classList.toggle('active', isActive);
        }
    }

    // Toggle the status filter from a stat card: tapping the active card again
    // clears the status filter (shows all).
    function toggleStatusFilter(status) {
        if (filterState.statuses.length === 1 && filterState.statuses[0] === status) {
            filterState.statuses = [];
        } else {
            filterState.statuses = [status];
        }
        syncFilterControls();
        applyFilters();
        saveFilters();
    }

    // ---------------------------------------------------------------------
    // Arabic text normalization for search
    // ---------------------------------------------------------------------
    function normalizeArabic(str) {
        return String(str == null ? '' : str)
            .replace(/[أإآ]/g, 'ا')
            .toLowerCase();
    }

    // ---------------------------------------------------------------------
    // Date range helpers
    // ---------------------------------------------------------------------
    function dateRangeStart(range) {
        var now = new Date();
        var y = now.getFullYear();
        var m = now.getMonth();
        var d = now.getDate();

        if (range === 'today') {
            return new Date(y, m, d).getTime();
        } else if (range === 'week') {
            // Week starts on Monday (ISO)
            var day = now.getDay();
            var diff = (day === 0 ? 6 : day - 1); // days since Monday
            return new Date(y, m, d - diff).getTime();
        } else if (range === 'month') {
            return new Date(y, m, 1).getTime();
        }
        return 0; // custom or unknown
    }

    function dateRangeEnd(range) {
        if (range === 'custom') {
            var toEl = document.getElementById('date-to');
            var toVal = toEl ? toEl.value : '';
            if (toVal) {
                return new Date(toVal + 'T23:59:59.999').getTime();
            }
            return Date.now() + 86400000; // no end date: include the future
        }
        // End of the current day (today / week / month share the same ceiling).
        var now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - 1;
    }

    function customDateFromMs() {
        var fromEl = document.getElementById('date-from');
        var fromVal = fromEl ? fromEl.value : '';
        return fromVal ? new Date(fromVal + 'T00:00:00').getTime() : 0;
    }

    function customDateToMs() {
        var toEl = document.getElementById('date-to');
        var toVal = toEl ? toEl.value : '';
        return toVal ? new Date(toVal + 'T23:59:59.999').getTime() : Date.now() + 86400000;
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
    // Dark mode
    // ---------------------------------------------------------------------
    function setDarkMode(on) {
        darkMode = !!on;
        var root = document.documentElement;
        root.classList.toggle('dark', darkMode);
        try { localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light'); } catch (e) { /* private mode */ }
        updateDarkToggleIcon();
    }

    function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
        if (saved === 'dark' || saved === 'light') {
            darkMode = saved === 'dark';
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            darkMode = true;
        } else {
            darkMode = false;
        }
        setDarkMode(darkMode);
    }

    function updateDarkToggleIcon() {
        var btn = document.getElementById('dark-toggle');
        if (!btn) return;
        var sun = btn.querySelector('.icon-sun');
        var moon = btn.querySelector('.icon-moon');
        if (sun) sun.style.display = darkMode ? 'inline-block' : 'none';
        if (moon) moon.style.display = darkMode ? 'none' : 'inline-block';
        btn.setAttribute('aria-label', t(darkMode ? 'header.lightMode' : 'header.darkMode'));
        btn.setAttribute('title', t(darkMode ? 'header.lightMode' : 'header.darkMode'));
    }

    // ---------------------------------------------------------------------
    // Collapsible sidebar
    // ---------------------------------------------------------------------
    function initSidebar() {
        var saved = null;
        try { saved = localStorage.getItem(SIDEBAR_KEY); } catch (e) { /* private mode */ }
        sidebarOpen = saved !== 'collapsed';
        applySidebarState();
    }

    function applySidebarState() {
        var shell = document.getElementById('app-shell');
        if (shell) shell.classList.toggle('sidebar-collapsed', !sidebarOpen);
        var toggle = document.getElementById('sidebar-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', sidebarOpen ? 'true' : 'false');
        updateSidebarToggleIcon();
    }

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
        try { localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? 'open' : 'collapsed'); } catch (e) { /* private mode */ }
        applySidebarState();
    }

    function updateSidebarToggleIcon() {
        var toggle = document.getElementById('sidebar-toggle');
        if (!toggle) return;
        var svg = toggle.querySelector('svg');
        if (!svg) return;
        // The sidebar sits on the inline-start edge (right in RTL). Flip the
        // chevron so it always points back toward the expanded edge.
        var rtl = document.documentElement.dir === 'rtl';
        var angle = rtl ? (sidebarOpen ? 0 : 180) : (sidebarOpen ? 180 : 0);
        svg.style.transform = 'rotate(' + angle + 'deg)';
    }

    // ---------------------------------------------------------------------
    // View switching (overview <-> orders)
    // ---------------------------------------------------------------------
    function updatePageTitle() {
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = t('view.' + currentView);
    }

    function switchView(view) {
        if (view !== 'orders' && view !== 'overview' && view !== 'menu' && view !== 'qr') view = 'overview';
        currentView = view;

        var overviewView = document.getElementById('view-overview');
        var ordersView = document.getElementById('view-orders');
        var menuView = document.getElementById('view-menu');
        var qrView = document.getElementById('view-qr');
        if (overviewView) overviewView.classList.toggle('active', view === 'overview');
        if (ordersView) ordersView.classList.toggle('active', view === 'orders');
        if (menuView) menuView.classList.toggle('active', view === 'menu');
        if (qrView) qrView.classList.toggle('active', view === 'qr');

        var navItems = document.querySelectorAll('.nav-item[data-view]');
        for (var i = 0; i < navItems.length; i++) {
            var active = navItems[i].getAttribute('data-view') === view;
            navItems[i].classList.toggle('active', active);
            if (active) {
                navItems[i].setAttribute('aria-current', 'page');
            } else {
                navItems[i].removeAttribute('aria-current');
            }
        }

        updatePageTitle();

        if (view === 'orders') {
            applyFilters();
        } else if (view === 'menu') {
            if (window.menuManager && typeof window.menuManager.refresh === 'function') {
                window.menuManager.refresh();
            }
        } else if (view === 'qr') {
            if (window.qrTool && typeof window.qrTool.refresh === 'function') {
                window.qrTool.refresh();
            }
        } else {
            renderOverview();
        }
    }

    // ---------------------------------------------------------------------
    // Overview: recent activity + quick stats (built from real order data)
    // ---------------------------------------------------------------------
    function activityIconFor(order) {
        var status = order.status || '';
        switch (status) {
            case 'pending': return '🛎️';
            case 'preparing': return '👨‍🍳';
            case 'ready': return '✅';
            case 'delivered': return '📦';
            case 'cancelled': return '✖️';
            default: return '🛒';
        }
    }

    function activityTextFor(order) {
        var itemsCount = (order.items || []).length;
        return t('activity.orderPlaced', {
            id: (order.orderId || ''),
            items: t('table.itemsSummary', { count: itemsCount })
        });
    }

    function activityMetaFor(order) {
        var parts = [typeLabel(order.orderType)];
        if (order.orderType === 'dine-in' && order.tableNumber != null) {
            parts.push(t('modal.table') + ' #' + order.tableNumber);
        }
        var cust = order.customer || {};
        if (order.orderType === 'delivery') {
            parts.push(cust.address || cust.phone || t('modal.name'));
        } else if (order.orderType === 'takeaway' && order.pickupTime) {
            parts.push(order.pickupTime);
        }
        return parts.join(' · ');
    }

    function activityTimeFor(order) {
        return formatDateTime(orderTimestampMs(order));
    }

    function renderOverview() {
        var activityEl = document.getElementById('overview-activity');
        var quickEl = document.getElementById('overview-quick-stats');
        if (!activityEl && !quickEl) return;

        var todayStart = new Date().setHours(0, 0, 0, 0);
        var todayOrders = (allOrders || []).filter(function (o) {
            return orderTimestampMs(o) >= todayStart;
        });
        // Most recent first
        todayOrders = todayOrders.slice().sort(function (a, b) {
            return orderTimestampMs(b) - orderTimestampMs(a);
        });

        // Recent activity: last 6 orders of the day.
        if (activityEl) {
            if (todayOrders.length === 0) {
                activityEl.innerHTML = '<div class="overview-empty">' + escapeHtml(t('overview.empty')) + '</div>';
            } else {
                var html = '<div class="activity-list">';
                var recent = todayOrders.slice(0, 6);
                for (var i = 0; i < recent.length; i++) {
                    var o = recent[i];
                    html += '<div class="activity-item">' +
                        '<span class="activity-icon ' + escapeHtml(o.status || '') + '">' + activityIconFor(o) + '</span>' +
                        '<div class="activity-body">' +
                            '<div class="activity-text">' + escapeHtml(activityTextFor(o)) + '</div>' +
                            '<div class="activity-meta">' + escapeHtml(activityMetaFor(o)) + '</div>' +
                        '</div>' +
                        '<span class="activity-time">' + escapeHtml(activityTimeFor(o)) + '</span>' +
                        '</div>';
                }
                html += '</div>';
                activityEl.innerHTML = html;
            }
        }

        // Quick stats for today.
        if (quickEl) {
            var confirmed = todayOrders.filter(function (o) {
                return o.status !== 'pending' && o.status !== 'cancelled';
            });
            var avg = 0;
            if (confirmed.length > 0) {
                var sum = confirmed.reduce(function (s, o) { return s + safeNumber(o.total); }, 0);
                avg = Math.round(sum / confirmed.length);
            }
            var counts = { 'dine-in': 0, delivery: 0, takeaway: 0 };
            todayOrders.forEach(function (o) {
                if (counts[o.orderType] !== undefined) counts[o.orderType]++;
            });

            var q = '<div class="quick-stat"><span class="quick-label">' + escapeHtml(t('quick.ordersToday')) + '</span><span class="quick-value">' + todayOrders.length + '</span></div>' +
                '<div class="quick-stat"><span class="quick-label">' + escapeHtml(t('quick.avgConfirmed')) + '</span><span class="quick-value">' + escapeHtml(formatCurrency(avg)) + '</span></div>' +
                '<div class="quick-stat"><span class="quick-label">' + escapeHtml(t('quick.dineIn')) + '</span><span class="quick-value">' + counts['dine-in'] + '</span></div>' +
                '<div class="quick-stat"><span class="quick-label">' + escapeHtml(t('quick.delivery')) + '</span><span class="quick-value">' + counts.delivery + '</span></div>' +
                '<div class="quick-stat"><span class="quick-label">' + escapeHtml(t('quick.takeaway')) + '</span><span class="quick-value">' + counts.takeaway + '</span></div>';
            quickEl.innerHTML = q;
        }

        // Analytics panels (7-day revenue + top sellers). No-op when the
        // containers are absent, so dashboard.js stays safe without the new HTML.
        renderAnalytics();
    }

    // ---------------------------------------------------------------------
    // Analytics: 7-day revenue trend + top selling items (pure CSS, no libs)
    // ---------------------------------------------------------------------
    function renderAnalytics() {
        var revEl = document.getElementById('analytics-revenue');
        var topEl = document.getElementById('analytics-top-items');
        if (!revEl && !topEl) return;

        var lang = window.adminI18n && window.adminI18n.getLang ? window.adminI18n.getLang() : 'fr';
        var locale = window.adminI18n && window.adminI18n.localeFor ? window.adminI18n.localeFor(lang) : lang;

        // Confirmed orders only — same definition as the daily-total stat
        // (statuses except pending/cancelled).
        var confirmed = (allOrders || []).filter(function (o) {
            return o.status !== 'pending' && o.status !== 'cancelled';
        });

        // ---- 7-day revenue trend ----
        if (revEl) {
            var buckets = [];
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            for (var i = 6; i >= 0; i--) {
                var d = new Date(today.getTime() - i * 86400000);
                d.setHours(0, 0, 0, 0);
                buckets.push({ start: d.getTime(), label: dayLabelFor(d, locale), total: 0 });
            }
            confirmed.forEach(function (o) {
                var ms = orderTimestampMs(o);
                for (var b = 0; b < buckets.length; b++) {
                    var next = (b < buckets.length - 1) ? buckets[b + 1].start : buckets[b].start + 86400000;
                    if (ms >= buckets[b].start && ms < next) {
                        buckets[b].total += safeNumber(o.total);
                        break;
                    }
                }
            });

            var maxTotal = 0;
            for (var m = 0; m < buckets.length; m++) {
                if (buckets[m].total > maxTotal) maxTotal = buckets[m].total;
            }

            if (maxTotal <= 0) {
                revEl.innerHTML = '<div class="analytics-empty">' + escapeHtml(t('analytics.empty')) + '</div>';
            } else {
                var bars = '<div class="revenue-chart">';
                for (var c = 0; c < buckets.length; c++) {
                    var pct = Math.max(4, Math.round((buckets[c].total / maxTotal) * 100));
                    var isToday = c === buckets.length - 1;
                    bars += '<div class="revenue-bar-col">' +
                        '<div class="revenue-bar-track">' +
                            '<div class="revenue-bar' + (isToday ? ' today' : '') + '" style="height:' + pct + '%" title="' + escapeHtml(formatCurrency(buckets[c].total)) + '"></div>' +
                        '</div>' +
                        '<span class="revenue-bar-value">' + escapeHtml(formatCurrency(buckets[c].total)) + '</span>' +
                        '<span class="revenue-bar-label">' + escapeHtml(buckets[c].label) + '</span>' +
                        '</div>';
                }
                bars += '</div>';
                revEl.innerHTML = bars;
            }
        }

        // ---- Top 5 selling items (by quantity) ----
        if (topEl) {
            var tally = {};
            confirmed.forEach(function (o) {
                (o.items || []).forEach(function (item) {
                    if (!item || !item.name) return;
                    var qty = safeNumber(item.quantity);
                    if (qty < 1) qty = 1;
                    tally[item.name] = (tally[item.name] || 0) + qty;
                });
            });

            var entries = Object.keys(tally).map(function (name) {
                return { name: name, qty: tally[name] };
            });
            entries.sort(function (a, b) { return b.qty - a.qty; });
            entries = entries.slice(0, 5);

            if (entries.length === 0) {
                topEl.innerHTML = '<div class="analytics-empty">' + escapeHtml(t('analytics.noItems')) + '</div>';
            } else {
                var maxQty = entries[0].qty;
                var list = '<ol class="top-items">';
                for (var e = 0; e < entries.length; e++) {
                    var qpct = Math.round((entries[e].qty / maxQty) * 100);
                    list += '<li class="top-item">' +
                        '<span class="top-item-rank">' + (e + 1) + '</span>' +
                        '<div class="top-item-body">' +
                            '<div class="top-item-row">' +
                                '<span class="top-item-name">' + escapeHtml(entries[e].name) + '</span>' +
                                '<span class="top-item-qty">×' + entries[e].qty + '</span>' +
                            '</div>' +
                            '<div class="top-item-bar"><span class="top-item-bar-fill" style="width:' + qpct + '%"></span></div>' +
                        '</div>' +
                        '</li>';
                }
                list += '</ol>';
                topEl.innerHTML = list;
            }
        }
    }

    function dayLabelFor(date, locale) {
        return date.toLocaleDateString(locale || undefined, { weekday: 'short' });
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
        initTheme();
        initSidebar();
        switchView('overview');
        loadFilters();
        syncFilterControls();
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
        // Direction may have flipped (RTL) — keep the sidebar chevron pointing
        // the right way and re-label the dark-mode button.
        updateSidebarToggleIcon();
        updateDarkToggleIcon();
        // Re-render dynamic content whenever the dashboard is the active view.
        // Keying on visibility (not on auth state) keeps this correct even when
        // the dashboard is mounted via a non-auth path during testing.
        var dashboard = document.getElementById('dashboard');
        var dashboardVisible = dashboard && getComputedStyle(dashboard).display !== 'none';
        if (dashboardVisible) {
            updatePageTitle();
            updateStats();
            applyFilters(); // re-renders table + pagination with translated labels
            if (activeModalOrderId) renderOrderModal();
            // Re-render the menu view so its dynamic strings follow the language.
            if (currentView === 'menu' && window.menuManager && typeof window.menuManager.refresh === 'function') {
                window.menuManager.refresh();
            }
            // Re-draw the QR card (tagline / table text are canvas text).
            if (currentView === 'qr' && window.qrTool && typeof window.qrTool.refresh === 'function') {
                window.qrTool.refresh();
            }
        }
        if (lastStatus) {
            showDataStatus(lastStatus.type, lastStatus.count, lastStatus.message);
        }
    }

    // Called by the auth layer whenever the sign-in state changes (including
    // once at boot, replaying the current state).
    function handleAuthChange(user) {
        if (user) {
            // Reset the new-order baseline so the initial snapshot after login
            // does not trigger a spurious "new order" beep (Phase 5 #38).
            lastOrderCount = 0;
            showDashboard();
            // showDashboard() already calls loadOrders() and startListening().
            // Do NOT call loadOrders() again here — it would double-render.
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

        var sidebarLogout = document.getElementById('sidebar-logout');
        if (sidebarLogout) {
            sidebarLogout.addEventListener('click', handleLogout);
        }

        // Dark-mode toggle
        var darkToggle = document.getElementById('dark-toggle');
        if (darkToggle) {
            darkToggle.addEventListener('click', function () {
                setDarkMode(!darkMode);
            });
        }

        // Sidebar collapse toggle
        var sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }

        // Sidebar navigation between views
        var navItems = document.querySelectorAll('.nav-item[data-view]');
        for (var i = 0; i < navItems.length; i++) {
            navItems[i].addEventListener('click', function () {
                switchView(this.getAttribute('data-view'));
            });
        }

        // Status checkboxes (delegated)
        var statusCheckboxes = document.getElementById('status-checkboxes');
        if (statusCheckboxes) {
            statusCheckboxes.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }

        var typeFilter = document.getElementById('type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }

        var searchFilter = document.getElementById('search-filter');
        if (searchFilter) {
            searchFilter.addEventListener('input', function () {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(function () {
                    collectFilterControls();
                    applyFilters();
                    saveFilters();
                }, 300);
            });
        }

        // Date range filter
        var dateFilter = document.getElementById('date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }

        // Custom date inputs
        var dateFrom = document.getElementById('date-from');
        var dateTo = document.getElementById('date-to');
        if (dateFrom) {
            dateFrom.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }
        if (dateTo) {
            dateTo.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }

        // Payment status filter
        var paymentStatusFilter = document.getElementById('payment-status-filter');
        if (paymentStatusFilter) {
            paymentStatusFilter.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }

        // Payment method filter
        var paymentMethodFilter = document.getElementById('payment-method-filter');
        if (paymentMethodFilter) {
            paymentMethodFilter.addEventListener('change', function () {
                collectFilterControls();
                applyFilters();
                saveFilters();
            });
        }

        // Clear filters button
        var clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', resetFilters);
        }

        // Clickable stat cards (filter by status) — mouse + keyboard (Enter/Space).
        var statCards = document.querySelectorAll('.stat-card[data-status]');
        for (var i = 0; i < statCards.length; i++) {
            statCards[i].addEventListener('click', function () {
                toggleStatusFilter(this.getAttribute('data-status'));
                switchView('orders');
            });
            statCards[i].addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleStatusFilter(this.getAttribute('data-status'));
                    switchView('orders');
                }
            });
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
                // Success: show dashboard immediately for instant feedback.
                // onAuthStateChanged will also fire shortly and call handleAuthChange again,
                // which is idempotent (showDashboard handles already-visible dashboard).
                if (btn) { btn.disabled = false; }
                // We know login succeeded; don't wait for onAuthStateChanged to show UI.
                var user = window.adminAuth.getCurrentUser ? window.adminAuth.getCurrentUser() : null;
                if (user) {
                    handleAuthChange(user);
                }
            })
            .catch(function (error) {
                if (btn) { btn.disabled = false; }
                // Always log the raw error: the mapped message may be generic, and
                // the code is the fastest way to diagnose a console misconfiguration.
                console.error('[admin] Login error:', error && error.code, error && error.message, error);
                var key = window.adminAuth.loginErrorKey(error);
                var message = t(key);
                // If the error code is unmapped, surface it next to the generic
                // message so the real cause is never hidden.
                if (key === 'login.error.generic' && error && error.code) {
                    message += ' (' + error.code + ')';
                }
                if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
            });

        return false;
    }

    function handleLogout() {
        if (!confirm(t('logout.confirm'))) {
            return false;
        }
        // Clear any pending debounce timer before tearing down.
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
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

        // Load once, then subscribe to real-time updates from Firestore.
        // loadOrders() already triggers render via refreshFromData().
        // startListening() sets up the real-time listener; its callback
        // will fire on *changes* only (the first snapshot is already reflected).
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
    async function loadOrders() {
        try {
            if (adminOrderService && typeof adminOrderService.getAllOrders === 'function') {
                allOrders = await adminOrderService.getAllOrders();
            } else {
                allOrders = [];
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
            allOrders = [];
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
        // Daily profit counts only CONFIRMED orders — orders the admin has accepted
        // (any status except pending/cancelled). A fresh order must not raise the
        // total until the admin confirms it.
        var total = todayOrders
            .filter(function (o) { return o.status !== 'pending' && o.status !== 'cancelled'; })
            .reduce(function (sum, o) { return sum + safeNumber(o.total); }, 0);

        var pendingEl = document.getElementById('stat-pending');
        var preparingEl = document.getElementById('stat-preparing');
        var readyEl = document.getElementById('stat-ready');
        var totalEl = document.getElementById('stat-total');
        if (pendingEl) pendingEl.textContent = pending;
        if (preparingEl) preparingEl.textContent = preparing;
        if (readyEl) readyEl.textContent = ready;
        if (totalEl) totalEl.textContent = formatCurrency(total);

        // Sidebar badge: today's pending orders (updates live with Firestore).
        var pendingBadge = document.getElementById('sidebar-pending-badge');
        if (pendingBadge) {
            pendingBadge.hidden = pending === 0;
            pendingBadge.textContent = pending;
        }

        // Keep the overview (activity feed + quick stats) in sync with the data.
        renderOverview();
    }

    // ---------------------------------------------------------------------
    // Filtering + sorting + pagination
    // ---------------------------------------------------------------------
    function applyFilters() {
        var searchQuery = normalizeArabic(filterState.search);

        filteredOrders = allOrders.filter(function (order) {
            // A single malformed order must never break the whole list.
            try {
                // Status filter (multi-select: empty = all)
                if (filterState.statuses.length > 0 && filterState.statuses.indexOf(order.status || '') === -1) {
                    return false;
                }

                // Type filter
                if (filterState.type !== 'all' && (order.orderType || '') !== filterState.type) {
                    return false;
                }

                // Date range filter (today / week / month / custom)
                var orderTime = orderTimestampMs(order);
                var rangeStart, rangeEnd;
                if (filterState.dateRange === 'custom') {
                    rangeStart = customDateFromMs();
                    rangeEnd = customDateToMs();
                } else {
                    rangeStart = dateRangeStart(filterState.dateRange);
                    rangeEnd = dateRangeEnd(filterState.dateRange);
                }
                if (orderTime < rangeStart || orderTime > rangeEnd) {
                    return false;
                }

                // Payment status filter
                if (filterState.paymentStatus !== 'all' && (order.paymentStatus || '') !== filterState.paymentStatus) {
                    return false;
                }

                // Payment method filter
                if (filterState.paymentMethod !== 'all' && (order.paymentMethod || '') !== filterState.paymentMethod) {
                    return false;
                }

                // Search filter (expanded scope + Arabic normalization)
                if (searchQuery) {
                    var haystack = [
                        order.orderId || '',
                        (order.customer && order.customer.name) || '',
                        (order.customer && order.customer.phone) || '',
                        (order.customer && order.customer.address) || '',
                        order.tableNumber != null ? String(order.tableNumber) : '',
                        order.specialInstructions || ''
                    ];
                    // Add item names
                    var items = order.items || [];
                    for (var i = 0; i < items.length; i++) {
                        if (items[i].name) haystack.push(items[i].name);
                    }
                    var found = false;
                    for (var j = 0; j < haystack.length; j++) {
                        if (normalizeArabic(haystack[j]).indexOf(searchQuery) >= 0) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) return false;
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
        updateFilterUI();
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
        window.switchView = switchView;
        window.setDarkMode = setDarkMode;
        window.toggleSidebar = toggleSidebar;
        window.renderOverview = renderOverview;
        window.renderAnalytics = renderAnalytics;
    }
})();
