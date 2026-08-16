// Shopping Cart Management System
// Handles cart operations: add, remove, update, clear
// Persists cart to Firestore (carts/{sessionId}) for cross-device sync and durability.

// Escape HTML to prevent XSS. Delegates to the shared utils module when available
// (single source of truth), falling back to a local copy for legacy/standalone use.
function escapeHtml(str) {
    if (typeof window !== 'undefined' && window.utils && typeof window.utils.escapeHtml === 'function') {
        return window.utils.escapeHtml(str);
    }
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

class ShoppingCart {
    constructor() {
        this.items = [];
        this.orderType = null; // 'delivery' | 'takeaway' | 'dine-in'
        this.tableNumber = null;
        this.sessionId = this.getOrCreateSessionId();
        this.db = null;
        this.useFirebase = false;
        this.initFirebase();
        this.init();
    }

    // Initialize Firebase connection
    async initFirebase() {
        if (typeof window.initFirebase === 'function') {
            this.useFirebase = window.initFirebase();
            if (this.useFirebase) {
                this.db = window.getFirestore();
            }
        }
        if (!this.useFirebase) {
            console.log('[cart] No Firestore — falling back to localStorage');
        }
        // Load cart after Firebase init (or immediately if no Firebase)
        await this.loadFromStorage();
        // Signal that cart is ready (Firebase loaded or fallback complete)
        if (cartReadyResolve) cartReadyResolve(this);
    }

    // Get or create a unique session ID for this browser
    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('cartSessionId');
        if (!sessionId) {
            sessionId = 'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cartSessionId', sessionId);
        }
        return sessionId;
    }

    init() {
        // Check for table parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const tableParam = urlParams.get('table');

        if (tableParam) {
            this.orderType = 'dine-in';
            this.tableNumber = parseInt(tableParam);
            this.showTableBanner();
        }

        this.updateCartIcon();

        // Attach click handler to cart icon (now a button)
        const cartIcon = document.getElementById('cart-icon');
        if (cartIcon) {
            cartIcon.addEventListener('click', () => this.openCart());
        }
    }

    // Add item to cart
    addItem(item) {
        const existingIndex = this.items.findIndex(i =>
            i.id === item.id && i.size === item.size
        );

        if (existingIndex > -1) {
            this.items[existingIndex].quantity += item.quantity || 1;
        } else {
            this.items.push({
                ...item,
                quantity: item.quantity || 1
            });
        }

        this.saveToStorage();
        this.updateCartIcon();
        this.showNotification('Ajouté au panier');
    }

    // Remove item from cart
    removeItem(id, size = null) {
        this.items = this.items.filter(item =>
            !(item.id === id && item.size === size)
        );
        this.saveToStorage();
        this.updateCartIcon();
        this.renderCart();
    }

    // Update item quantity
    updateQuantity(id, size, quantity) {
        const item = this.items.find(i => i.id === id && i.size === size);
        if (item) {
            if (quantity <= 0) {
                this.removeItem(id, size);
            } else {
                item.quantity = quantity;
                this.saveToStorage();
                this.updateCartIcon();
                this.renderCart();
            }
        }
    }

    // Clear cart
    clear() {
        this.items = [];
        this.saveToStorage();
        this.updateCartIcon();
        this.renderCart();
    }

    // Get total price
    getTotal() {
        return this.items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);
    }

    // Get item count
    getItemCount() {
        return this.items.reduce((count, item) => count + item.quantity, 0);
    }

    // Save to Firestore (or localStorage fallback)
    async saveToStorage() {
        const cartData = {
            items: this.items,
            orderType: this.orderType,
            tableNumber: this.tableNumber,
            updatedAt: Date.now()
        };

        if (this.useFirebase && this.db) {
            try {
                await this.db.collection('carts').doc(this.sessionId).set(cartData);
                console.log('[cart] Saved to Firestore');
                return;
            } catch (error) {
                console.warn('[cart] Firestore save failed, falling back to localStorage:', error);
            }
        }

        // Fallback to localStorage
        localStorage.setItem('cart', JSON.stringify(cartData));
    }

    // Load from Firestore (or localStorage fallback)
    async loadFromStorage() {
        if (this.useFirebase && this.db) {
            try {
                const doc = await this.db.collection('carts').doc(this.sessionId).get();
                if (doc.exists) {
                    const data = doc.data();
                    this.items = data.items || [];
                    this.orderType = data.orderType || null;
                    this.tableNumber = data.tableNumber || null;
                    console.log('[cart] Loaded from Firestore');
                    this.updateCartIcon();
                    return;
                }
            } catch (error) {
                console.warn('[cart] Firestore load failed, falling back to localStorage:', error);
            }
        }

        // Fallback to localStorage
        const saved = localStorage.getItem('cart');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.items = data.items || [];
                this.orderType = data.orderType || null;
                this.tableNumber = data.tableNumber || null;
                console.log('[cart] Loaded from localStorage');
                this.updateCartIcon();
            } catch (e) {
                console.error('Failed to load cart:', e);
            }
        }
    }

    // Update cart icon
    updateCartIcon() {
        const icon = document.getElementById('cart-icon');
        const badge = document.getElementById('cart-badge');

        if (icon && badge) {
            const count = this.getItemCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
            icon.setAttribute('aria-label', `Panier - ${count} article${count > 1 ? 's' : ''}`);
        }
    }

    // Show notification
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Show table banner (for dine-in)
    showTableBanner() {
        const banner = document.createElement('div');
        banner.className = 'table-banner';

        const icon = document.createElement('span');
        icon.className = 'table-icon';
        icon.textContent = '🪑';

        const text = document.createElement('span');
        text.className = 'table-text';
        text.textContent = 'Table ' + escapeHtml(String(this.tableNumber));

        banner.appendChild(icon);
        banner.appendChild(text);

        const header = document.querySelector('.header');
        if (header) {
            header.appendChild(banner);
        }
    }

    // Open cart modal/page
    openCart() {
        window.location.href = 'cart.html';
    }

    // Render cart (used in cart.html)
    renderCart() {
        const container = document.getElementById('cart-items');
        const emptyMessage = document.getElementById('cart-empty');
        const cartSummary = document.getElementById('cart-summary');

        if (!container) return;

        if (this.items.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
            if (cartSummary) cartSummary.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        if (emptyMessage) emptyMessage.style.display = 'none';
        if (cartSummary) cartSummary.style.display = 'block';

        container.innerHTML = '';

        this.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';

            const safeName = escapeHtml(item.name);
            const safeSize = escapeHtml(item.size || '');
            const safeNotes = escapeHtml(item.notes || '');
            const safePrice = escapeHtml(String(item.price));
            const safeQuantity = escapeHtml(String(item.quantity));
            const safeTotal = escapeHtml(String(item.price * item.quantity));
            const safeId = escapeHtml(item.id);

            const sizeInfo = safeSize ? `<span class="item-size">(${safeSize})</span>` : '';
            const notesInfo = safeNotes ? `<p class="item-notes">Note: ${safeNotes}</p>` : '';

            itemElement.innerHTML = `
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${safeName} ${sizeInfo}</h4>
                    ${notesInfo}
                    <p class="cart-item-price">${safePrice} DA</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn minus" data-id="${safeId}" data-size="${safeSize}">-</button>
                    <span class="cart-item-quantity">${safeQuantity}</span>
                    <button class="qty-btn plus" data-id="${safeId}" data-size="${safeSize}">+</button>
                    <button class="remove-btn" data-id="${safeId}" data-size="${safeSize}">🗑️</button>
                </div>
                <div class="cart-item-total">${safeTotal} DA</div>
            `;

            container.appendChild(itemElement);
        });

        // Update summary
        this.updateCartSummary();

        // Event delegation is attached once on the static container
        // (see bindCartDelegation), so we never re-bind per render.
    }

    // Update cart summary
    updateCartSummary() {
        const subtotalEl = document.getElementById('cart-subtotal');
        const totalEl = document.getElementById('cart-total');

        if (subtotalEl) subtotalEl.textContent = this.getTotal() + ' DA';
        if (totalEl) totalEl.textContent = this.getTotal() + ' DA';
    }

    // Attach a single delegated listener on the static #cart-items container.
    // Called once (from the cart page initializer) so re-rendering the cart
    // never stacks duplicate listeners on the rebuilt buttons.
    bindCartDelegation() {
        const container = document.getElementById('cart-items');
        if (!container || container.__cartDelegated) return;
        container.__cartDelegated = true;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.qty-btn, .remove-btn');
            if (!btn || !container.contains(btn)) return;

            const id = btn.dataset.id;
            const size = btn.dataset.size || null;

            if (btn.classList.contains('remove-btn')) {
                this.removeItem(id, size);
                return;
            }

            const item = this.items.find(i => i.id === id && i.size === size);
            if (!item) return;

            if (btn.classList.contains('plus')) {
                this.updateQuantity(id, size, item.quantity + 1);
            } else if (btn.classList.contains('minus')) {
                this.updateQuantity(id, size, item.quantity - 1);
            }
        });
    }
}

// Initialize cart
let cart;
let cartReadyResolve = null;
let cartReadyReject = null;

// Promise that resolves when cart is fully initialized (Firebase loaded or fallback complete)
window.cartReady = new Promise((resolve, reject) => {
    cartReadyResolve = resolve;
    cartReadyReject = reject;
});

window.getCart = function() { return cart; };
window.setCart = function(instance) { cart = instance; };
document.addEventListener('DOMContentLoaded', () => {
    cart = new ShoppingCart();

    // If on cart page, render cart and bind delegated listeners once.
    if (document.getElementById('cart-items')) {
        cart.bindCartDelegation();
        cart.renderCart();
    }
});

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ShoppingCart = ShoppingCart;
    window.getCart = () => cart;
}