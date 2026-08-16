// Menu Renderer - Dynamically generates menu sections from menu-data.js

// Sanitize image URL to prevent XSS via javascript: or data: schemes.
// Delegates to the shared utils module when available.
function sanitizeImageUrl(url) {
    if (typeof window !== 'undefined' && window.utils && typeof window.utils.sanitizeImageUrl === 'function') {
        return window.utils.sanitizeImageUrl(url);
    }
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return trimmed;
    }
    return null;
}

let currentLanguage = 'fr';

// Localized label helper (falls back to fr, then the key itself).
// `translations` is a top-level const in script.js — parsed before any DOMContentLoaded handler runs.
function t(key) {
    var d = typeof translations !== 'undefined' ? translations : null;
    var cur = (d && d[currentLanguage] && d[currentLanguage][key]) || (d && d.fr && d.fr[key]);
    return cur || key;
}

// Render menu function
function renderMenu() {
    const container = document.getElementById('menu-container');
    if (!container) return;

    // Menu in effect: DB/local copy when the menu service loaded one, else the
    // static const from menu-data.js (never blocks first paint).
    const menu = (typeof window !== 'undefined' && window.menuService && typeof window.menuService.getActiveMenu === 'function')
        ? window.menuService.getActiveMenu()
        : menuData;

    container.innerHTML = '';

    // Loop through all menu categories
    Object.keys(menu).forEach(categoryKey => {
        const category = menu[categoryKey];

        // Create section
        const section = document.createElement('section');
        section.className = 'menu-section';
        section.dataset.category = categoryKey; // Add category identifier for filtering

        // Create section header
        const header = document.createElement('div');
        header.className = 'section-header';

        const icon = document.createElement('div');
        icon.className = 'pizza-icon';
        icon.textContent = category.icon;

        const title = document.createElement('h2');
        title.textContent = typeof category.title === 'object'
            ? category.title[currentLanguage]
            : category.title;

        header.appendChild(icon);
        header.appendChild(title);
        section.appendChild(header);

        // Create menu grid
        const grid = document.createElement('div');
        grid.className = 'menu-grid';

        // Add items
        category.items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';

            if (item.featured) menuItem.classList.add('featured');
            if (item.signature) menuItem.classList.add('signature');

            // ---- Media block (placeholder + optional image + badges + ADD pill) ----
            const media = document.createElement('div');
            media.className = 'item-media';

            // Placeholder is ALWAYS present, rendered beneath the image.
            // A missing/broken image (removed by onerror) reveals it.
            const placeholder = document.createElement('div');
            placeholder.className = 'item-placeholder';
            placeholder.setAttribute('aria-hidden', 'true');

            const placeholderEmoji = document.createElement('span');
            placeholderEmoji.className = 'item-placeholder-emoji';
            placeholderEmoji.textContent = category.icon;

            const placeholderInitial = document.createElement('span');
            placeholderInitial.className = 'item-placeholder-initial';
            placeholderInitial.textContent = [...item.name][0] || '';

            placeholder.appendChild(placeholderEmoji);
            placeholder.appendChild(placeholderInitial);
            media.appendChild(placeholder);

            // Real image, only when the owner provides one
            if (item.image) {
                const safeSrc = sanitizeImageUrl(item.image);
                if (safeSrc) {
                    const img = document.createElement('img');
                    img.className = 'item-img';
                    img.src = safeSrc;
                    img.alt = item.name;
                    img.loading = 'lazy';
                    img.onerror = function () { this.remove(); }; // reveal placeholder
                    media.appendChild(img);
                }
            }

            // Badge chip on image corner
            if (item.badge) {
                const badge = document.createElement('span');
                badge.className = 'item-badge';
                badge.textContent = item.badge;
                media.appendChild(badge);
            }

            // Featured / signature ribbons
            if (item.featured) {
                const ribbon = document.createElement('span');
                ribbon.className = 'item-ribbon ribbon-featured';
                ribbon.textContent = 'Featured';
                media.appendChild(ribbon);
            }
            if (item.signature) {
                const ribbon = document.createElement('span');
                ribbon.className = 'item-ribbon ribbon-signature';
                ribbon.textContent = 'Signature';
                media.appendChild(ribbon);
            }

            // ADD pill (overlaid on media; full-width bar on touch)
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'card-add-btn';
            const plus = document.createElement('span');
            plus.setAttribute('aria-hidden', 'true');
            plus.textContent = '+';
            const addLabel = document.createElement('span');
            addLabel.textContent = t('add');
            addBtn.appendChild(plus);
            addBtn.appendChild(addLabel);
            addBtn.onclick = () => openItemModal(categoryKey, item);
            media.appendChild(addBtn);

            menuItem.appendChild(media);

            // ---- Body block (price row, name, ingredients) ----
            const body = document.createElement('div');
            body.className = 'item-body';

            const priceRow = document.createElement('div');
            priceRow.className = 'item-price-row';

            const itemPrice = document.createElement('span');
            itemPrice.className = 'item-price';

            // Handle different price formats
            if (item.prices && Array.isArray(item.prices)) {
                itemPrice.textContent = t('from') + ' ' + item.prices[0] + ' DA';
                priceRow.appendChild(itemPrice);

                const sizesLabel = document.createElement('span');
                sizesLabel.className = 'item-price-note';
                sizesLabel.textContent = ['M', 'L', 'XL'].slice(0, item.prices.length).join(' / ');
                priceRow.appendChild(sizesLabel);
            } else {
                itemPrice.textContent = item.price + ' DA';
                priceRow.appendChild(itemPrice);
            }

            body.appendChild(priceRow);

            const itemName = document.createElement('h3');
            itemName.className = 'item-name';
            itemName.textContent = item.name;
            body.appendChild(itemName);

            // Ingredients
            if (item.ingredients) {
                const ingredients = document.createElement('p');
                ingredients.className = 'item-ingredients';
                ingredients.textContent = item.ingredients;
                body.appendChild(ingredients);
            }

            menuItem.appendChild(body);

            grid.appendChild(menuItem);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });

    // Re-apply animations
    animateMenuItems();
}

// Initialize menu on page load
document.addEventListener('DOMContentLoaded', () => {
    renderMenu();

    // Start real-time listener for menu changes from Firestore
    if (window.menuService && typeof window.menuService.listenToMenu === 'function') {
        console.log('[menu-renderer] Starting real-time listener');
        window.menuService.listenToMenu(function(result) {
            console.log('[menu-renderer] Real-time menu update received:', result);
            renderMenu();
        });
    } else {
        console.warn('[menu-renderer] menuService.listenToMenu not available');
    }
});

// Re-render when the menu service loads a DB/local copy of the menu.
document.addEventListener('menu:loaded', () => {
    console.log('[menu-renderer] menu:loaded event fired');
    renderMenu();
});

// Update menu when language changes
function updateMenuLanguage(lang) {
    currentLanguage = lang;
    renderMenu();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.renderMenu = renderMenu;
    window.updateMenuLanguage = updateMenuLanguage;
}

// Open item modal for adding to cart
function openItemModal(categoryKey, item) {
    const modal = document.getElementById('item-modal');
    if (!modal) {
        createItemModal();
        setTimeout(() => openItemModal(categoryKey, item), 100);
        return;
    }

    // Populate modal with item details
    document.getElementById('modal-item-name').textContent = item.name;
    document.getElementById('modal-item-ingredients').textContent = item.ingredients || '';

    // Handle prices
    const priceContainer = document.getElementById('modal-item-price');
    const sizeSection = document.getElementById('size-section');

    if (item.prices && Array.isArray(item.prices)) {
        // Has multiple sizes
        sizeSection.style.display = 'block';
        const sizes = ['M', 'L', 'XL'];
        const sizeButtons = document.getElementById('size-buttons');
        sizeButtons.innerHTML = '';

        item.prices.forEach((price, index) => {
            if (price) {
                const btn = document.createElement('button');
                btn.className = 'size-btn';
                btn.textContent = `${sizes[index]} - ${price} DA`;
                btn.dataset.size = sizes[index];
                btn.dataset.price = price;
                if (index === 0) btn.classList.add('active');
                btn.onclick = () => selectSize(btn);
                sizeButtons.appendChild(btn);
            }
        });

        priceContainer.textContent = item.prices[0] + ' DA';
    } else {
        // Single size
        sizeSection.style.display = 'none';
        priceContainer.textContent = item.price + ' DA';
    }

    // Reset quantity and notes
    document.getElementById('modal-quantity').textContent = '1';
    document.getElementById('modal-notes').value = '';

    // Set modal media background (or hide it when no image)
    const modalMedia = document.getElementById('modal-media');
    if (modalMedia) {
        if (item.image) {
            // Validate the URL to prevent javascript: or other dangerous schemes
            const safeUrl = sanitizeImageUrl(item.image);
            modalMedia.style.backgroundImage = safeUrl ? `url("${safeUrl}")` : '';
            modalMedia.classList.toggle('no-image', !safeUrl);
        } else {
            modalMedia.style.backgroundImage = '';
            modalMedia.classList.add('no-image');
        }
    }

    // Store item data
    modal.dataset.categoryKey = categoryKey;
    modal.dataset.itemName = item.name;
    modal.dataset.itemPrice = item.price || item.prices[0];
    modal.dataset.hasMultipleSizes = item.prices ? 'true' : 'false';

    // Show modal
    modal.classList.remove('hidden');

    // Attach Escape + focus-trap listeners (detached on close).
    if (!modal._keyHandler) {
        modal._keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeItemModal();
                return;
            }
            if (e.key === 'Tab') trapFocus(modal, e);
        };
    }
    document.removeEventListener('keydown', modal._keyHandler);
    document.addEventListener('keydown', modal._keyHandler);

    // Move focus into the modal for keyboard/screen-reader users.
    const initialFocus = modal.querySelector('.modal-close') || modal;
    initialFocus.focus();
}

function createItemModal() {
    const modal = document.createElement('div');
    modal.id = 'item-modal';
    modal.className = 'item-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-item-name');
    modal.tabIndex = -1;
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-media no-image" id="modal-media"></div>
            <button class="modal-close" type="button" aria-label="Fermer" onclick="closeItemModal()">&times;</button>
            <div class="modal-pad">
            <h3 class="modal-title" id="modal-item-name"></h3>
            <p class="modal-price" id="modal-item-price"></p>
            <p class="modal-ingredients" id="modal-item-ingredients"></p>

            <div class="modal-section" id="size-section" style="display: none;">
                <h4>Taille</h4>
                <div class="size-options" id="size-buttons"></div>
            </div>

            <div class="modal-section">
                <h4>Quantité</h4>
                <div class="quantity-selector">
                    <button type="button" onclick="changeQuantity(-1)">-</button>
                    <span id="modal-quantity">1</span>
                    <button type="button" onclick="changeQuantity(1)">+</button>
                </div>
            </div>

            <div class="modal-section">
                <h4>Notes spéciales (optionnel)</h4>
                <textarea id="modal-notes" class="notes-input" placeholder="Ex: Sans oignons, bien cuit..."></textarea>
            </div>

            <button type="button" class="add-to-cart-btn" onclick="addToCartFromModal()">
                <span>🛒</span>
                <span>` + t('add-to-cart') + `</span>
            </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeItemModal();
    });
}

function selectSize(button) {
    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const modal = document.getElementById('item-modal');
    const price = button.dataset.price;
    document.getElementById('modal-item-price').textContent = price + ' DA';
    modal.dataset.itemPrice = price;
    modal.dataset.itemSize = button.dataset.size;
}

function changeQuantity(delta) {
    const qtyEl = document.getElementById('modal-quantity');
    let qty = parseInt(qtyEl.textContent);
    qty = Math.max(1, qty + delta);
    qtyEl.textContent = qty;
}

function closeItemModal() {
    const modal = document.getElementById('item-modal');
    if (modal) {
        modal.classList.add('hidden');
        if (modal._keyHandler) {
            document.removeEventListener('keydown', modal._keyHandler);
            modal._keyHandler = null;
        }
    }
}

// Keep keyboard focus inside the modal while it is open.
function trapFocus(container, e) {
    const focusable = container.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

function addToCartFromModal() {
    const modal = document.getElementById('item-modal');
    const cart = window.getCart();

    if (!cart) {
        showToast('Erreur: système de panier non disponible');
        return;
    }

    const itemData = {
        id: modal.dataset.categoryKey + '_' + modal.dataset.itemName.toLowerCase().replace(/\s+/g, '_'),
        name: modal.dataset.itemName,
        price: parseInt(modal.dataset.itemPrice),
        quantity: parseInt(document.getElementById('modal-quantity').textContent),
        size: modal.dataset.itemSize || null,
        notes: document.getElementById('modal-notes').value
    };

    cart.addItem(itemData);
    closeItemModal();
}

// Export modal functions
if (typeof window !== 'undefined') {
    window.openItemModal = openItemModal;
    window.closeItemModal = closeItemModal;
    window.selectSize = selectSize;
    window.changeQuantity = changeQuantity;
    window.addToCartFromModal = addToCartFromModal;
    window.showToast = showToast;
}

// Lightweight non-blocking toast (reuses the cart notification styling).
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'cart-notification';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
