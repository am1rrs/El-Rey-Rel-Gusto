// Checkout Page Logic
// Handles order type selection, form validation, and order submission
// Updated to open WhatsApp with the order details after successful submission

let selectedOrderType = null;
// cart is declared in cart.js and accessible via window.getCart()

document.addEventListener('DOMContentLoaded', () => {
    cart = window.getCart();
    if (!cart) {
        console.error('Cart instance not available on window.getCart();');
        return;
    }

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

function showTableNumber(tableNumber) {
    const display = document.getElementById('table-number-display');
    if (display) {
        display.textContent = `Table #${tableNumber}`;
        display.style.display = 'block';
    }
}

function renderOrderSummary() {
    const container = document.getElementById('order-summary-items');
    container.innerHTML = '';

    cart.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'summary-item';

        const sizeInfo = item.size ? ` (${item.size})` : '';
        const qtyInfo = item.quantity > 1 ? ` x${item.quantity}` : '';
        const notesInfo = item.notes ? `<div class="summary-item-details">ملاحظة: ${item.notes}</div>` : '';

        itemEl.innerHTML = `
            <div class="summary-item-info">
                <div class="summary-item-name">${item.name}${sizeInfo}${qtyInfo}</div>
                ${notesInfo}
            </div>
            <div class="summary-item-price">${item.price * item.quantity} د.إ</div>
        `;
        container.appendChild(itemEl);
    });

    // Update totals
    const subtotal = cart.getTotal();
    document.getElementById('summary-subtotal').textContent = subtotal + ' د.إ';

    // Add delivery fee if applicable
    const deliveryFeeRow = document.getElementById('delivery-fee-row');
    let deliveryFee = 0;

    if (selectedOrderType === 'delivery') {
        deliveryFee = 200; // Fixed delivery fee
        deliveryFeeRow.style.display = 'flex';
        document.getElementById('summary-delivery-fee').textContent = deliveryFee + ' د.إ';
    } else {
        deliveryFeeRow.style.display = 'none';
    }

    const total = subtotal + deliveryFee;
    document.getElementById('summary-total').textContent = total + ' د.إ';
}

function validateForm() {
    const form = document.getElementById('checkout-form');
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const address = document.getElementById('customer-address').value.trim();

    if (!name) {
        showError('الرجاء إدخال اسمك');
        return false;
    }

    if (!phone) {
        showError('الرجاء إدخال رقم هاتفك');
        return false;
    }

    // Validate phone format (Algerian)
    const phoneRegex = /^(0)(5|6|7)[0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        showError('رقم هاتف غير صالح (الصيغة: 07XX XX XX XX)');
        return false;
    }

    if (selectedOrderType === 'delivery' && !address) {
        showError('الرجاء إدخال عنوان التسليم');
        return false;
    }

    return true;
}

function showError(message) {
    alert(message);
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

async function createOrder(orderData) {
    const service = window.getOrderService ? window.getOrderService() : null;

    if (!service || typeof service.submitOrder !== 'function') {
        throw new Error('Order service unavailable');
    }

    const result = await service.submitOrder(orderData);

    if (!result || !result.success) {
        throw new Error(result && result.error ? result.error : 'Order not saved');
    }

    return result;
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

    try {
        const result = await createOrder(orderData);

        // Persist local snapshot for the admin dashboard and confirmation page
        saveOrderLocally(orderData);

        // Clear cart after successful save
        cart.clear();

        hideLoading();

        setTimeout(() => {
            window.location.href = `order-confirmation.html?orderId=${orderData.orderId}`;
        }, 500);

        return result;
    } catch (error) {
        hideLoading();
        showError((error && error.message) ? error.message : 'خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
        console.error('Order creation failed:', error);
        return { success: false, error: error && error.message ? error.message : 'Order creation failed' };
    }
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
    window.createOrder = createOrder;
}