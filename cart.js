// Shopping Cart Management System
// Handles cart operations: add, remove, update, clear

class ShoppingCart {
    constructor() {
        this.items = [];
        this.orderType = null; // 'delivery' | 'takeaway' | 'dine-in'
        this.tableNumber = null;
        this.loadFromStorage();
        this.init();
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

    // Save to localStorage
    saveToStorage() {
        const cartData = {
            items: this.items,
            orderType: this.orderType,
            tableNumber: this.tableNumber
        };
        localStorage.setItem('cart', JSON.stringify(cartData));
    }

    // Load from localStorage
    loadFromStorage() {
        const saved = localStorage.getItem('cart');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.items = data.items || [];
                this.orderType = data.orderType || null;
                this.tableNumber = data.tableNumber || null;
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
        banner.innerHTML = `
            <span class="table-icon">🪑</span>
            <span class="table-text">Table ${this.tableNumber}</span>
        `;

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

            const sizeInfo = item.size ? `<span class="item-size">(${item.size})</span>` : '';
            const notesInfo = item.notes ? `<p class="item-notes">Note: ${item.notes}</p>` : '';

            itemElement.innerHTML = `
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.name} ${sizeInfo}</h4>
                    ${notesInfo}
                    <p class="cart-item-price">${item.price} DA</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn minus" data-id="${item.id}" data-size="${item.size || ''}">-</button>
                    <span class="cart-item-quantity">${item.quantity}</span>
                    <button class="qty-btn plus" data-id="${item.id}" data-size="${item.size || ''}">+</button>
                    <button class="remove-btn" data-id="${item.id}" data-size="${item.size || ''}">🗑️</button>
                </div>
                <div class="cart-item-total">${item.price * item.quantity} DA</div>
            `;

            container.appendChild(itemElement);
        });

        // Update summary
        this.updateCartSummary();

        // Attach event listeners
        this.attachCartEventListeners();
    }

    // Update cart summary
    updateCartSummary() {
        const subtotalEl = document.getElementById('cart-subtotal');
        const totalEl = document.getElementById('cart-total');

        if (subtotalEl) subtotalEl.textContent = this.getTotal() + ' DA';
        if (totalEl) totalEl.textContent = this.getTotal() + ' DA';
    }

    // Attach event listeners for cart page
    attachCartEventListeners() {
        // Quantity buttons
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const size = e.target.dataset.size || null;
                const item = this.items.find(i => i.id === id && i.size === size);

                if (item) {
                    if (e.target.classList.contains('plus')) {
                        this.updateQuantity(id, size, item.quantity + 1);
                    } else if (e.target.classList.contains('minus')) {
                        this.updateQuantity(id, size, item.quantity - 1);
                    }
                }
            });
        });

        // Remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const size = e.target.dataset.size || null;
                this.removeItem(id, size);
            });
        });
    }
}

// Initialize cart
let cart;
document.addEventListener('DOMContentLoaded', () => {
    cart = new ShoppingCart();

    // If on cart page, render cart
    if (document.getElementById('cart-items')) {
        cart.renderCart();
    }
});

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ShoppingCart = ShoppingCart;
    window.getCart = () => cart;
}
