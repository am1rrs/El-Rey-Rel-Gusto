// Menu Service
// Loads and saves the menu (categories + items) using Firebase Firestore only.
// No localStorage fallback — menu data is sourced exclusively from Firestore.
//
// The menu lives as ONE document: Firestore `menu/public` → { categories, updatedAt }.
// The public site reads it; the admin dashboard writes through the same service.
//
// When a DB copy wins the load it is exposed as window.activeMenu and a
// `menu:loaded` event is fired so the renderers (menu-renderer.js, categories.js)
// re-draw with the up-to-date menu without blocking first paint.

(function () {
    'use strict';

    var MENU_DOC = 'public';

    var service = {
        useFirebase: false,
        db: null,
        cached: null                  // last { categories, source, updatedAt } returned by getMenu()
    };

    function isPlainObject(v) {
        return v !== null && typeof v === 'object' && !Array.isArray(v);
    }

    // The categories object is a map of categoryKey → { icon, title, items }.
    // A valid menu must be a non-empty object of such entries.
    function normalizeCategories(v) {
        if (!isPlainObject(v)) return null;
        var keys = Object.keys(v);
        if (keys.length === 0) return null;
        return v;
    }

    function init() {
        if (typeof window.initFirebase === 'function') {
            service.useFirebase = window.initFirebase();
            if (service.useFirebase) {
                service.db = window.getFirestore();
            }
        }
        if (!service.useFirebase) {
            console.log('[menu] No Firestore — menu will use static fallback');
        } else {
            console.log('[menu] Firestore initialized, db:', !!service.db);
        }
        return service;
    }

    // Read the menu from Firestore only (Production Mode).
    // Returns null when Firestore is unavailable or has no valid menu.
    // Optional onProgress callback receives { loaded: bool, source: string }.
    async function getMenu(onProgress) {
        if (service.useFirebase && service.db) {
            try {
                if (onProgress) onProgress({ loaded: false, source: 'firestore' });
                var snap = await service.db.collection('menu').doc(MENU_DOC).get();
                if (snap.exists) {
                    var data = snap.data();
                    var cats = data && data.categories;
                    if (normalizeCategories(cats)) {
                        var fireUpdatedAt = (data && typeof data.updatedAt === 'number') ? data.updatedAt : 0;
                        service.cached = { categories: cats, source: 'firestore', updatedAt: fireUpdatedAt };
                        if (onProgress) onProgress({ loaded: true, source: 'firestore' });
                        return service.cached;
                    }
                }
                console.warn('[menu] Firestore document exists but has invalid data');
            } catch (error) {
                console.warn('[menu] Firestore read failed:', (error && (error.code || error.message)) || error);
            }
        } else {
            console.warn('[menu] Firestore not available');
        }

        service.cached = null;
        if (onProgress) onProgress({ loaded: true, source: 'static' });
        return null;
    }

    // Save the menu to Firestore only (Production Mode - no localStorage fallback).
    // Throws on error so caller can handle it explicitly.
    async function saveMenu(categories) {
        if (!normalizeCategories(categories)) {
            return { success: false, error: 'Invalid menu data' };
        }

        if (!service.useFirebase || !service.db) {
            var error = new Error('Firestore not initialized. Check Firebase config and authentication.');
            console.error('[menu] Save failed:', error.message);
            throw error;
        }

        try {
            var now = Date.now();
            await service.db.collection('menu').doc(MENU_DOC).set({
                categories: categories,
                updatedAt: now
            });
            service.cached = { categories: categories, source: 'firestore', updatedAt: now };
            console.log('[menu] Saved to Firestore');
            return { success: true, source: 'firestore' };
        } catch (error) {
            console.error('[menu] Firestore write failed:', error);
            throw error;
        }
    }

    // Load the menu into window.activeMenu and announce it via `menu:loaded`.
    // Called once on DOMContentLoaded; renderers re-draw when the event fires.
    async function loadActiveMenu() {
        var result = await getMenu(function onProgress(progress) {
            if (progress.loaded && progress.source === 'static') {
                console.info('[menu] Using static menuData fallback');
            }
        });
        var categories = result
            ? result.categories
            : (typeof menuData !== 'undefined' ? menuData : null);

        if (normalizeCategories(categories)) {
            window.activeMenu = categories;
            if (result && result.source !== 'static') {
                console.info('[menu] Active menu source:', result.source);
            }
            try {
                window.dispatchEvent(new CustomEvent('menu:loaded'));
            } catch (error) {
                console.warn('[menu] menu:loaded dispatch failed:', error);
            }
            showSourceBadge(result);
        }
        return categories;
    }

    // Tiny dismissible pill on the PUBLIC site showing that the menu is loaded from Firestore.
    function showSourceBadge(result) {
        if (!result || result.source === 'static') return;
        try {
            var lang = document.documentElement.getAttribute('lang') || 'fr';
            var labels = {
                firestore: { fr: 'Menu Firestore', ar: 'قائمة Firestore', en: 'Firestore menu' }
            };
            var text = (labels[result.source] && labels[result.source][lang]) || labels[result.source].fr;

            var pill = document.createElement('div');
            pill.setAttribute('id', 'menu-source-pill');
            pill.style.cssText = [
                'position:fixed',
                'bottom:14px',
                'inset-inline-start:14px',
                'z-index:9999',
                'display:flex',
                'align-items:center',
                'gap:8px',
                'padding:7px 12px',
                'border-radius:999px',
                'font:600 11px/1.4 "General Sans","Cairo",system-ui,sans-serif',
                'color:#0f766e',
                'background:#ccfbf1',
                'border:1px solid #5eead4',
                'box-shadow:0 2px 8px rgba(0,0,0,0.14)',
                'cursor:pointer'
            ].join(';');
            var dot = document.createElement('span');
            dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#0f766e;flex-shrink:0';
            pill.appendChild(dot);
            pill.appendChild(document.createTextNode(text));
            pill.title = 'data source: ' + result.source;
            pill.addEventListener('click', function () {
                if (pill.parentNode) pill.parentNode.removeChild(pill);
            });
            document.body.appendChild(pill);

            // Auto-dismiss after 10s so it never stays in customers' way.
            setTimeout(function () {
                if (pill.parentNode) pill.parentNode.removeChild(pill);
            }, 10000);
        } catch (error) {
            // Badge is a nice-to-have; never break the page because of it.
        }
    }

    // The menu currently in effect on this page (DB copy, else static const).
    function getActiveMenu() {
        if (window.activeMenu) return window.activeMenu;
        return typeof menuData !== 'undefined' ? menuData : null;
    }

    // Real-time listener for menu changes from Firestore.
    // Calls callback with { categories, source, updatedAt } on each change.
    function listenToMenu(callback) {
        if (!service.useFirebase || !service.db) {
            console.log('[menu] No Firestore — real-time listener unavailable (useFirebase:', service.useFirebase, 'db:', !!service.db, ')');
            return function () {}; // no-op unsubscribe
        }
        console.log('[menu] Starting real-time listener on menu/public');
        var unsub = service.db.collection('menu').doc(MENU_DOC).onSnapshot(function (snap) {
            console.log('[menu] Real-time snapshot received, exists:', snap.exists);
            if (!snap.exists) return;
            var data = snap.data();
            var cats = data && data.categories;
            if (!normalizeCategories(cats)) return;
            var fireUpdatedAt = (data && typeof data.updatedAt === 'number') ? data.updatedAt : 0;
            service.cached = { categories: cats, source: 'firestore', updatedAt: fireUpdatedAt };
            window.activeMenu = cats;
            window.dispatchEvent(new CustomEvent('menu:loaded'));
            if (callback) callback(service.cached);
        }, function (error) {
            console.warn('[menu] Real-time listener error:', error);
        });
        return unsub;
    }

    // Bootstrap: expose the service, then kick off the async load so the public
    // menu picks up any DB/local edits (first paint still uses the static const).
    if (typeof window !== 'undefined') {
        window.menuService = {
            getMenu: getMenu,
            saveMenu: saveMenu,
            loadActiveMenu: loadActiveMenu,
            getActiveMenu: getActiveMenu,
            listenToMenu: listenToMenu,
            isFirestore: function () { return service.useFirebase; },
            get source() { return service.cached ? service.cached.source : null; }
        };
        window.getMenuService = function () { return window.menuService; };
        init();

        if (window.addEventListener) {
            window.addEventListener('DOMContentLoaded', function () {
                loadActiveMenu();
            });
        }
    }
})();
