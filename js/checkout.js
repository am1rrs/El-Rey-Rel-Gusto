// Checkout Page Logic
// Handles order type selection, form validation, and order submission

let selectedOrderType = null;
let cart = null;

document.addEventListener('DOMContentLoaded', () => {
    cart = window.getCart();

    // Check if cart is empty
    if (!cart || cart.items.length === 0) {
        window.location.href = 'cart.html';
        return;
    }

    // Check for table parameter (dine-in)
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');

    if (tableParam) {
        selectOrderType('dine-in');
        showTableNumber(parseInt(tableParam));
    }
});

function selectOrderType(type) {
    selectedOrderType = type;

    // Update button states
    document.querySelectorAll('.order-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Show customer info section
    document.getElementById('customer-info-section').style.display = 'block';

    // Show/hide fields based on order type
    const addressGroup = document.getElementById('address-group');
    const pickupTimeGroup = document.getElementById('pickup-time-group');

    if (type === 'delivery') {
        addressGroup.style.display = 'block';
        pickupTimeGroup.style.display = 'none';
        document.getElementById('customer-address').required = true;
    } else if (type === 'takeaway') {
        addressGroup.style.display = 'none';
        pickupTimeGroup.style.display = 'block';
        document.getElementById('customer-address').required = false;
    } else {
        addressGroup.style.display = 'none';
        pickupTimeGroup.style.display = 'none';
        document.getElementById('customer-address').required = false;
    }

    // Show order summary
    renderOrderSummary();
    document.getElementById('order-summary-section').style.display = 'block';
}

function showTableNumber(tableNum) {
    const section = document.getElementById('order-type-section');
    const display = document.createElement('div');
    display.className = 'table-number-display';
    display.innerHTML = `🪑 Table ${tableNum}`;
    section.insertBefore(display, section.firstChild);

    // Hide order type buttons
    document.querySelector('.order-type-buttons').style.display = 'none';
}

function renderOrderSummary() {
    const container = document.getElementById('order-summary-items');
    container.innerHTML = '';

    cart.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'summary-item';

        const sizeInfo = item.size ? ` (${item.size})` : '';
        const qtyInfo = item.quantity > 1 ? ` x${item.quantity}` : '';
        const notesInfo = item.notes ? `<div class="summary-item-details">Note: ${item.notes}</div>` : '';

        itemEl.innerHTML = `
            <div class="summary-item-info">
                <div class="summary-item-name">${item.name}${sizeInfo}${qtyInfo}</div>
                ${notesInfo}
            </div>
            <div class="summary-item-price">${item.price * item.quantity} DA</div>
        `;

        container.appendChild(itemEl);
    });

    // Update totals
    const subtotal = cart.getTotal();
    document.getElementById('summary-subtotal').textContent = subtotal + ' DA';

    // Add delivery fee if applicable
    const deliveryFeeRow = document.getElementById('delivery-fee-row');
    let deliveryFee = 0;

    if (selectedOrderType === 'delivery') {
        deliveryFee = 200; // Fixed delivery fee
        deliveryFeeRow.style.display = 'flex';
        document.getElementById('summary-delivery-fee').textContent = deliveryFee + ' DA';
    } else {
        deliveryFeeRow.style.display = 'none';
    }

    const total = subtotal + deliveryFee;
    document.getElementById('summary-total').textContent = total + ' DA';
}

function validateForm() {
    const form = document.getElementById('checkout-form');
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const address = document.getElementById('customer-address').value.trim();

    if (!name) {
        showError('Veuillez entrer votre nom');
        return false;
    }

    if (!phone) {
        showError('Veuillez entrer votre numéro de téléphone');
        return false;
    }

    // Validate phone format (Algerian)
    const phoneRegex = /^(0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        showError('Numéro de téléphone invalide (Format: 07XX XX XX XX)');
        return false;
    }

    if (selectedOrderType === 'delivery' && !address) {
        showError('Veuillez entrer votre adresse de livraison');
        return false;
    }

    return true;
}

function showError(message) {
    alert(message); // Simple alert for now
}

function showLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

async function submitOrder() {
    if (!validateForm()) return;

    showLoading();

    // Prepare order data
    const orderData = {
        orderId: generateOrderId(),
        timestamp: Date.now(),
        status: 'pending',

        customer: {
            name: document.getElementById('customer-name').value.trim(),
            phone: document.getElementById('customer-phone').value.trim(),
            address: selectedOrderType === 'delivery' ? document.getElementById('customer-address').value.trim() : null
        },

        orderType: selectedOrderType,
        tableNumber: cart.tableNumber || null,
        pickupTime: selectedOrderType === 'takeaway' ? document.getElementById('pickup-time').value : null,

        items: cart.items,
        subtotal: cart.getTotal(),
        deliveryFee: selectedOrderType === 'delivery' ? 200 : 0,
        total: cart.getTotal() + (selectedOrderType === 'delivery' ? 200 : 0),

        specialInstructions: document.getElementById('special-instructions').value.trim(),

        paymentMethod: 'cash',
        paymentStatus: 'pending'
    };

    // Submit using OrderService
    const service = window.getOrderService();
    const result = await service.submitOrder(orderData);

    if (!result.success) {
        hideLoading();
        showError('Erreur lors de l\'envoi de la commande. Veuillez réessayer.');
        return;
    }

    // Clear cart
    cart.clear();

    // Redirect to confirmation page
    setTimeout(() => {
        hideLoading();
        window.location.href = `order-confirmation.html?orderId=${orderData.orderId}`;
    }, 1000);
}

function generateOrderId() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${dateStr}-${random}`;
}

function saveOrderLocally(orderData) {
    // Get existing orders
    let orders = [];
    const saved = localStorage.getItem('orders');
    if (saved) {
        try {
            orders = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse orders:', e);
        }
    }

    // Add new order
    orders.push(orderData);

    // Save back to localStorage
    localStorage.setItem('orders', JSON.stringify(orders));
}

// Export functions
if (typeof window !== 'undefined') {
    window.selectOrderType = selectOrderType;
    window.submitOrder = submitOrder;
}
