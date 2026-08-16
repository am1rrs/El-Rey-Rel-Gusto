// Admin Menu Manager
// Full CRUD for the restaurant menu (categories + items) inside the dashboard.
// Reads the menu through the shared js/menu-service.js (Firestore → static
// menu-data.js seed) and writes each change back through it (Firestore in
// Production Mode), so edits appear on the public site.
//
// The whole file is an IIFE so no top-level binding can collide with the globals
// in js/order-service.js / js/menu-data.js / dashboard.js (the classic-script
// global-collision bug class this codebase guards against).
(function () {
    'use strict';

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------
    var categories = null;        // { categoryKey: { icon, title, items } }
    var selectedKey = null;       // currently selected category key
    var source = 'loading';       // 'loading' | 'firestore' | 'local'

    var modalEl = null;           // active menu modal element (if any)
    var modalState = null;        // { mode, key | index }
    var saveHandler = null;       // save-cat | save-item

    // ---------------------------------------------------------------------
    // i18n + html helpers (delegate to window.adminI18n like dashboard.js)
    // ---------------------------------------------------------------------
    function t(key, vars) {
        return window.adminI18n ? window.adminI18n.t(key, vars) : key;
    }

    function escapeHtml(str) {
        if (window.adminI18n && typeof window.adminI18n.escapeHtml === 'function') {
            return window.adminI18n.escapeHtml(str);
        }
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function slugify(text) {
        var s = String(text || '').toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return s || ('cat_' + Math.random().toString(36).slice(2, 6));
    }

    // Unique category key derived from a slug (append -2, -3 … on collision).
    function uniqueKey(base) {
        var key = base;
        var n = 2;
        while (categories && categories[key]) {
            key = base + '-' + n;
            n++;
        }
        return key;
    }

    // ---------------------------------------------------------------------
    // Loading / rendering
    // ---------------------------------------------------------------------
    async function refresh() {
        source = 'loading';
        updateSource();

        var result = null;
        if (window.menuService && typeof window.menuService.getMenu === 'function') {
            result = await window.menuService.getMenu();
        }

        if (result && result.categories) {
            categories = result.categories;
            source = result.source || 'local';
        } else {
            // Seed from the static const bundled with the page.
            categories = (typeof menuData !== 'undefined' && menuData) ? menuData : {};
            source = 'local';
        }

        if (!selectedKey || !categories[selectedKey]) {
            selectedKey = Object.keys(categories)[0] || null;
        }

        render();
    }

    function render() {
        renderCategories();
        renderItems();
        updateSource();

        var addItemBtn = document.getElementById('menu-add-item-btn');
        if (addItemBtn) addItemBtn.disabled = !selectedKey;
    }

    function updateSource() {
        var el = document.getElementById('menu-source');
        if (!el) return;
        if (source === 'loading') {
            el.textContent = t('menu.source.loading');
            el.className = 'menu-source';
        } else {
            el.textContent = t(source === 'firestore' ? 'menu.source.firestore' : 'menu.source.local');
            el.className = 'menu-source' + (source === 'firestore' ? ' ok' : '');
        }
    }

    function renderCategories() {
        var list = document.getElementById('menu-categories');
        if (!list) return;

        var keys = Object.keys(categories || {});
        if (keys.length === 0) {
            list.innerHTML = '<div class="menu-empty">' + escapeHtml(t('menu.emptyCategories')) + '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var cat = categories[key] || {};
            var frTitle = (cat.title && cat.title.fr) || key;
            var count = Array.isArray(cat.items) ? cat.items.length : 0;
            html += '<div class="menu-cat-item' + (key === selectedKey ? ' active' : '') + '" data-cat="' + escapeHtml(key) + '">' +
                '<span class="menu-cat-icon">' + escapeHtml(cat.icon || '🍽️') + '</span>' +
                '<span class="menu-cat-name" title="' + escapeHtml(key) + '">' + escapeHtml(frTitle) + '</span>' +
                '<span class="menu-cat-count">' + count + '</span>' +
                '<span class="menu-cat-actions">' +
                    '<button type="button" class="icon-btn-sm" data-action="edit-cat" data-cat="' + escapeHtml(key) + '" title="' + escapeHtml(t('menu.edit')) + '" aria-label="' + escapeHtml(t('menu.edit')) + '">✎</button>' +
                    '<button type="button" class="icon-btn-sm danger" data-action="delete-cat" data-cat="' + escapeHtml(key) + '" title="' + escapeHtml(t('menu.delete')) + '" aria-label="' + escapeHtml(t('menu.delete')) + '">✕</button>' +
                '</span>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    function renderItems() {
        var list = document.getElementById('menu-items');
        var titleEl = document.getElementById('menu-items-title');
        if (!list) return;

        if (!selectedKey) {
            list.innerHTML = '<div class="menu-empty">' + escapeHtml(t('menu.selectCategory')) + '</div>';
            if (titleEl) titleEl.textContent = t('menu.itemsTitle');
            return;
        }

        var cat = categories[selectedKey] || {};
        if (titleEl) {
            var catName = (cat.title && cat.title.fr) || selectedKey;
            titleEl.textContent = t('menu.itemsTitle') + ' — ' + catName;
        }

        var items = Array.isArray(cat.items) ? cat.items : [];
        if (items.length === 0) {
            list.innerHTML = '<div class="menu-empty">' + escapeHtml(t('menu.emptyItems')) + '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < items.length; i++) {
            var item = items[i] || {};
            var priceText;
            if (item.prices && Array.isArray(item.prices)) {
                priceText = item.prices.map(function (p) { return p + ' DA'; }).join(' · ');
            } else if (item.price != null) {
                priceText = item.price + ' DA';
            } else {
                priceText = '—';
            }

            var tags = '';
            if (item.featured) tags += '<span class="menu-tag">' + escapeHtml(t('menu.modal.featured')) + '</span>';
            if (item.signature) tags += '<span class="menu-tag signature">' + escapeHtml(t('menu.modal.signature')) + '</span>';
            if (item.badge) tags += '<span class="menu-tag">' + escapeHtml(item.badge) + '</span>';

            html += '<div class="menu-item-row">' +
                '<div class="menu-item-main">' +
                    '<span class="menu-item-name">' + escapeHtml(item.name) + '</span>' +
                    (tags ? '<span class="menu-item-tags">' + tags + '</span>' : '') +
                '</div>' +
                '<span class="menu-item-price">' + escapeHtml(priceText) + '</span>' +
                '<span class="menu-cat-actions">' +
                    '<button type="button" class="icon-btn-sm" data-action="edit-item" data-index="' + i + '" title="' + escapeHtml(t('menu.edit')) + '" aria-label="' + escapeHtml(t('menu.edit')) + '">✎</button>' +
                    '<button type="button" class="icon-btn-sm danger" data-action="delete-item" data-index="' + i + '" title="' + escapeHtml(t('menu.delete')) + '" aria-label="' + escapeHtml(t('menu.delete')) + '">✕</button>' +
                '</span>' +
            '</div>';
        }
        list.innerHTML = html;
    }

    // ---------------------------------------------------------------------
    // Click delegation
    // ---------------------------------------------------------------------
    function onCategoriesClick(event) {
        var actionBtn = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
        if (actionBtn) {
            var action = actionBtn.getAttribute('data-action');
            var catKey = actionBtn.getAttribute('data-cat');
            if (action === 'edit-cat') { openCategoryModal(catKey); return; }
            if (action === 'delete-cat') { deleteCategory(catKey); return; }
        }

        var row = event.target && event.target.closest ? event.target.closest('.menu-cat-item') : null;
        if (row) {
            selectedKey = row.getAttribute('data-cat');
            render();
        }
    }

    function onItemsClick(event) {
        var actionBtn = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
        if (!actionBtn) return;
        var action = actionBtn.getAttribute('data-action');
        var index = Number(actionBtn.getAttribute('data-index'));
        if (action === 'edit-item') {
            openItemModal(index);
        } else if (action === 'delete-item') {
            deleteItem(index);
        }
    }

    // ---------------------------------------------------------------------
    // Modals
    // ---------------------------------------------------------------------
    function openCategoryModal(key) {
        var cat = key ? (categories[key] || {}) : {};
        modalState = { mode: key ? 'edit-cat' : 'add-cat', key: key };

        var title = key ? t('menu.modal.editCategory') : t('menu.modal.addCategory');
        var html =
            '<div class="menu-modal-form">' +
                '<div class="menu-form-row"><label for="mm-icon">' + escapeHtml(t('menu.modal.icon')) + '</label>' +
                    '<input type="text" id="mm-icon" value="' + escapeHtml(cat.icon || '🍽️') + '"></div>' +
                '<div class="menu-form-row"><label for="mm-title-fr">' + escapeHtml(t('menu.modal.titleFr')) + '</label>' +
                    '<input type="text" id="mm-title-fr" value="' + escapeHtml((cat.title && cat.title.fr) || '') + '"></div>' +
                '<div class="menu-form-row"><label for="mm-title-ar">' + escapeHtml(t('menu.modal.titleAr')) + '</label>' +
                    '<input type="text" id="mm-title-ar" value="' + escapeHtml((cat.title && cat.title.ar) || '') + '"></div>' +
                '<div class="menu-form-row"><label for="mm-title-en">' + escapeHtml(t('menu.modal.titleEn')) + '</label>' +
                    '<input type="text" id="mm-title-en" value="' + escapeHtml((cat.title && cat.title.en) || '') + '"></div>' +
            '</div>';

        openModal(title, html, 'save-cat');
    }

    function openItemModal(index) {
        var cat = selectedKey ? (categories[selectedKey] || {}) : null;
        if (!cat) return;
        var items = Array.isArray(cat.items) ? cat.items : [];
        var item = (index != null && items[index]) ? items[index] : {};
        modalState = { mode: index != null ? 'edit-item' : 'add-item', index: index };

        var isSizes = Array.isArray(item.prices);
        var singleVal = (item.price != null) ? item.price : '';
        var sizeVals = isSizes ? item.prices : ['', '', ''];

        var title = (index != null) ? t('menu.modal.editItem') : t('menu.modal.addItem');
        var html =
            '<div class="menu-modal-form">' +
                '<div class="menu-form-row"><label for="mi-name">' + escapeHtml(t('menu.modal.name')) + '</label>' +
                    '<input type="text" id="mi-name" value="' + escapeHtml(item.name || '') + '"></div>' +

                '<div class="menu-form-row"><label for="mi-price-mode">' + escapeHtml(t('menu.modal.priceType')) + '</label>' +
                    '<select id="mi-price-mode">' +
                        '<option value="single"' + (isSizes ? '' : ' selected') + '>' + escapeHtml(t('menu.modal.single')) + '</option>' +
                        '<option value="sizes"' + (isSizes ? ' selected' : '') + '>' + escapeHtml(t('menu.modal.sizes')) + '</option>' +
                    '</select></div>' +

                '<div class="menu-form-row" id="mi-single-wrap"' + (isSizes ? ' style="display:none"' : '') + '>' +
                    '<label for="mi-price">' + escapeHtml(t('menu.modal.price')) + '</label>' +
                    '<input type="number" min="0" step="1" id="mi-price" value="' + escapeHtml(singleVal) + '"></div>' +

                '<div class="menu-form-grid" id="mi-sizes-wrap"' + (isSizes ? '' : ' style="display:none"') + '>' +
                    '<div class="menu-form-row"><label for="mi-size-m">' + escapeHtml(t('menu.modal.sizeM')) + '</label>' +
                        '<input type="number" min="0" step="1" id="mi-size-m" value="' + escapeHtml(sizeVals[0] != null ? sizeVals[0] : '') + '"></div>' +
                    '<div class="menu-form-row"><label for="mi-size-l">' + escapeHtml(t('menu.modal.sizeL')) + '</label>' +
                        '<input type="number" min="0" step="1" id="mi-size-l" value="' + escapeHtml(sizeVals[1] != null ? sizeVals[1] : '') + '"></div>' +
                    '<div class="menu-form-row"><label for="mi-size-xl">' + escapeHtml(t('menu.modal.sizeXL')) + '</label>' +
                        '<input type="number" min="0" step="1" id="mi-size-xl" value="' + escapeHtml(sizeVals[2] != null ? sizeVals[2] : '') + '"></div>' +
                '</div>' +

                '<div class="menu-form-row"><label for="mi-ingredients">' + escapeHtml(t('menu.modal.ingredients')) + '</label>' +
                    '<textarea id="mi-ingredients">' + escapeHtml(item.ingredients || '') + '</textarea></div>' +

                '<div class="menu-form-grid">' +
                    '<div class="menu-form-row"><label for="mi-badge">' + escapeHtml(t('menu.modal.badge')) + '</label>' +
                        '<input type="text" id="mi-badge" value="' + escapeHtml(item.badge || '') + '"></div>' +
                    '<div class="menu-form-row mi-span-2"><label for="mi-image">' + escapeHtml(t('menu.modal.image')) + '</label>' +
                        '<input type="url" id="mi-image" value="' + escapeHtml(item.image || '') + '"></div>' +
                '</div>' +

                '<div class="menu-form-row menu-form-checks">' +
                    '<label class="menu-form-check"><input type="checkbox" id="mi-featured"' + (item.featured ? ' checked' : '') + '> ' + escapeHtml(t('menu.modal.featured')) + '</label>' +
                    '<label class="menu-form-check"><input type="checkbox" id="mi-signature"' + (item.signature ? ' checked' : '') + '> ' + escapeHtml(t('menu.modal.signature')) + '</label>' +
                '</div>' +
            '</div>';

        openModal(title, html, 'save-item');
    }

    function openModal(title, bodyHtml, action) {
        closeModal();

        modalEl = document.createElement('div');
        modalEl.className = 'modal';
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.style.display = 'flex';
        modalEl.innerHTML =
            '<div class="modal-content">' +
                '<button type="button" class="modal-close" data-mclose="1" aria-label="' + escapeHtml(t('menu.modal.cancel')) + '">&times;</button>' +
                '<h3 class="menu-modal-title">' + escapeHtml(title) + '</h3>' +
                bodyHtml +
                '<div class="menu-modal-actions">' +
                    '<button type="button" class="btn-ghost" data-mclose="1">' + escapeHtml(t('menu.modal.cancel')) + '</button>' +
                    '<button type="button" class="btn-primary-sm" data-msave="1">' + escapeHtml(t('menu.modal.save')) + '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modalEl);

        saveHandler = (action === 'save-cat') ? saveCategory : saveItem;

        modalEl.addEventListener('click', function (event) {
            if (event.target === modalEl) { closeModal(); return; }
            var closeBtn = event.target && event.target.closest ? event.target.closest('[data-mclose]') : null;
            if (closeBtn) { closeModal(); return; }
            var saveBtn = event.target && event.target.closest ? event.target.closest('[data-msave]') : null;
            if (saveBtn) { saveHandler(); }
        });

        // Toggle single-price vs size inputs.
        var modeSel = modalEl.querySelector('#mi-price-mode');
        if (modeSel) {
            modeSel.addEventListener('change', function () {
                var singleWrap = modalEl.querySelector('#mi-single-wrap');
                var sizesWrap = modalEl.querySelector('#mi-sizes-wrap');
                if (singleWrap) singleWrap.style.display = modeSel.value === 'sizes' ? 'none' : '';
                if (sizesWrap) sizesWrap.style.display = modeSel.value === 'sizes' ? '' : 'none';
            });
        }

        var first = modalEl.querySelector('input, textarea, select');
        if (first && first.focus) first.focus();
    }

    function closeModal() {
        if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
        modalEl = null;
        modalState = null;
        saveHandler = null;
    }

    function getVal(sel, type) {
        if (!modalEl) return '';
        var el = modalEl.querySelector(sel);
        if (!el) return '';
        return (type === 'text') ? String(el.value).trim() : el.value;
    }

    function numVal(sel) {
        if (!modalEl) return null;
        var el = modalEl.querySelector(sel);
        if (!el) return null;
        var v = parseInt(el.value, 10);
        return (isNaN(v) || v < 0) ? null : v;
    }

    function getChecked(sel) {
        if (!modalEl) return false;
        var el = modalEl.querySelector(sel);
        return !!(el && el.checked);
    }

    // ---------------------------------------------------------------------
    // Save handlers
    // ---------------------------------------------------------------------
    async function saveCategory() {
        var iconVal = getVal('#mm-icon', 'text');
        var titleFr = getVal('#mm-title-fr', 'text');
        var titleAr = getVal('#mm-title-ar', 'text');
        var titleEn = getVal('#mm-title-en', 'text');

        if (!titleFr) {
            alert(t('menu.errorTitleRequired'));
            return;
        }

        var key = modalState.key;
        var isNew = !key;
        if (isNew) key = uniqueKey(slugify(titleFr));

        categories[key] = {
            icon: iconVal || '🍽️',
            title: { fr: titleFr, ar: titleAr || titleFr, en: titleEn || titleFr },
            items: isNew ? [] : (categories[key] && categories[key].items) || []
        };

        if (isNew) selectedKey = key;
        try {
            await persist();
        } catch (error) {
            setStatus(t('menu.errorSave'), true);
            console.error('Menu save failed:', error);
        }
        closeModal();
    }

    async function saveItem() {
        var nameVal = getVal('#mi-name', 'text');
        if (!nameVal) {
            alert(t('menu.errorNameRequired'));
            return;
        }

        var cat = selectedKey ? categories[selectedKey] : null;
        if (!cat) { closeModal(); return; }
        if (!Array.isArray(cat.items)) cat.items = [];

        var item = { name: nameVal };
        var ingredients = getVal('#mi-ingredients', 'text');
        if (ingredients) item.ingredients = ingredients;

        if (getVal('#mi-price-mode', 'text') === 'sizes') {
            var prices = [numVal('#mi-size-m'), numVal('#mi-size-l'), numVal('#mi-size-xl')];
            // Trim trailing empty sizes; all empty → fall back to single price.
            while (prices.length > 0 && prices[prices.length - 1] == null) prices.pop();
            if (prices.length > 0) {
                item.prices = prices;
            } else {
                item.price = numVal('#mi-price');
            }
        } else {
            item.price = numVal('#mi-price');
        }

        var badge = getVal('#mi-badge', 'text');
        if (badge) item.badge = badge;
        var image = getVal('#mi-image', 'text');
        if (image) item.image = image;

        if (getChecked('#mi-featured')) item.featured = true;
        if (getChecked('#mi-signature')) item.signature = true;

        if (modalState && modalState.index != null && cat && Array.isArray(cat.items) && modalState.index < cat.items.length) {
            cat.items[modalState.index] = item;
        } else if (cat) {
            cat.items.push(item);
        }

        try {
            await persist();
        } catch (error) {
            setStatus(t('menu.errorSave'), true);
            console.error('Menu save failed:', error);
        }
        closeModal();
    }

    // ---------------------------------------------------------------------
    // Deletes + persistence
    // ---------------------------------------------------------------------
    async function deleteCategory(key) {
        if (!categories || !categories[key]) return;
        if (!confirm(t('menu.confirmDeleteCategory'))) return;

        delete categories[key];
        if (selectedKey === key) {
            selectedKey = Object.keys(categories)[0] || null;
        }
        try {
            await persist();
        } catch (error) {
            setStatus(t('menu.errorSave'), true);
            console.error('Menu save failed:', error);
        }
    }

    async function deleteItem(index) {
        var cat = selectedKey ? categories[selectedKey] : null;
        if (!cat || !Array.isArray(cat.items) || index < 0 || index >= cat.items.length) return;
        if (!confirm(t('menu.confirmDeleteItem'))) return;

        cat.items.splice(index, 1);
        try {
            await persist();
        } catch (error) {
            setStatus(t('menu.errorSave'), true);
            console.error('Menu save failed:', error);
        }
    }


    // Write the full menu through the shared service (Firestore in Production
    // Mode), then refresh the UI. Errors are thrown so the caller can show a
    // user-facing message instead of silently hiding the failure.
    async function persist() {
        if (!(window.menuService && typeof window.menuService.saveMenu === 'function')) {
            throw new Error('Menu service unavailable. Check that Firebase is initialized.');
        }
        if (!window.firebaseConfig || !window.firebaseConfig.FORCE_FIREBASE) {
            throw new Error('Firebase not in Production Mode. Cannot save menu.');
        }
        var result = await window.menuService.saveMenu(categories);
        source = (result && result.success && result.source) ? result.source : 'local';
        updateSource();
        render();
    }

    // ---------------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------------
    function bindEvents() {
        var catList = document.getElementById('menu-categories');
        if (catList) catList.addEventListener('click', onCategoriesClick);

        var itemsList = document.getElementById('menu-items');
        if (itemsList) itemsList.addEventListener('click', onItemsClick);

        var addCatBtn = document.getElementById('menu-add-category-btn');
        if (addCatBtn) addCatBtn.addEventListener('click', function () { openCategoryModal(null); });

        var addItemBtn = document.getElementById('menu-add-item-btn');
        if (addItemBtn) addItemBtn.addEventListener('click', function () { openItemModal(null); });

        var reloadBtn = document.getElementById('menu-reload-btn');
        if (reloadBtn) reloadBtn.addEventListener('click', function () { refresh(); });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && modalEl) closeModal();
        });
    }

    function init() {
        bindEvents();
        refresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.menuManager = {
        refresh: refresh,
        getCategories: function () { return categories; },
        selectCategory: function (key) {
            if (categories && categories[key]) {
                selectedKey = key;
                render();
            }
        }
    };
})();
