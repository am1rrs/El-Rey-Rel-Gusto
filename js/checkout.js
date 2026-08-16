// Checkout Page Logic
// Handles order type selection, form validation, and order submission
// Updated to open WhatsApp with the order details after successful submission

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

let selectedOrderType = null;
// cart is declared in cart.js and accessible via window.getCart()

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for cart to be fully initialized (Firebase load or fallback complete)
    await window.cartReady;
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

    // Dine-in table: picked up either from a direct ?table= URL param (QR scan)
    // or from the table number already saved on the cart by the menu page
    // (QR scan → menu.html?table=N → cart carries the table through).
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');
    const scannedTable = tableParam ? parseInt(tableParam) : (cart.tableNumber || null);

    if (scannedTable) {
        selectOrderType('dine-in');
        showTableNumber(scannedTable);
    }
});

function selectOrderType(type) {
    selectedOrderType = type;

    // Update button states
    document.querySelectorAll('.order-type-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', String(btn.dataset.type === type));
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Show customer info section
    document.getElementById('customer-info-section').style.display = 'block';

    // Show/hide fields based on order type
    const addressGroup = document.getElementById('address-group');
    const pickupTimeGroup = document.getElementById('pickup-time-group');
    const nameGroup = document.getElementById('name-group');
    const phoneGroup = document.getElementById('phone-group');
    const phoneInput = document.getElementById('customer-phone');

    // Dine-in customers order by table — no name or phone needed.
    const isDineIn = type === 'dine-in';
    if (nameGroup) nameGroup.style.display = isDineIn ? 'none' : 'block';
    if (phoneGroup) phoneGroup.style.display = isDineIn ? 'none' : 'block';
    if (phoneInput) phoneInput.required = !isDineIn;

    // Keep the table display in sync: shown only for dine-in with a known table.
    const tableDisplay = document.getElementById('table-number-display');
    if (tableDisplay) {
        tableDisplay.style.display = (isDineIn && cart.tableNumber) ? 'block' : 'none';
    }

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

        const safeName = escapeHtml(item.name);
        const safeSize = escapeHtml(item.size || '');
        const safeNotes = escapeHtml(item.notes || '');
        const safeQty = escapeHtml(String(item.quantity));
        const safePrice = escapeHtml(String(item.price * item.quantity));

        const sizeInfo = safeSize ? ` (${safeSize})` : '';
        const qtyInfo = item.quantity > 1 ? ` x${safeQty}` : '';
        const notesInfo = safeNotes ? `<div class="summary-item-details">ملاحظة: ${safeNotes}</div>` : '';

        itemEl.innerHTML = `
            <div class="summary-item-info">
                <div class="summary-item-name">${safeName}${sizeInfo}${qtyInfo}</div>
                ${notesInfo}
            </div>
            <div class="summary-item-price">${safePrice} د.إ</div>
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
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const address = document.getElementById('customer-address').value.trim();

    // Name is optional for every order type.

    // Phone is required for delivery / takeaway (to contact the customer),
    // but NOT for dine-in — those customers order by table.
    if (selectedOrderType !== 'dine-in' && !phone) {
        showError('الرجاء إدخال رقم هاتفك');
        return false;
    }

    // Validate phone format (Algerian) when provided
    if (phone) {
        const phoneRegex = /^(0)(5|6|7)[0-9]{8}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            showError('رقم هاتف غير صالح (الصيغة: 07XX XX XX XX)');
            return false;
        }
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
    const nameValue = document.getElementById('customer-name').value.trim();
    const phoneValue = document.getElementById('customer-phone').value.trim();

    const orderData = {
        orderId: generateOrderId(),
        timestamp: Date.now(),
        status: 'pending',

        customer: {
            name: nameValue || null,
            phone: phoneValue || null,
            address: selectedOrderType === 'delivery' ? document.getElementById('customer-address').value.trim() : null
        },

        orderType: selectedOrderType,
        tableNumber: selectedOrderType === 'dine-in' ? (cart.tableNumber || null) : null,
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

// Generate a collision-resistant order ID. Delegates to the shared utils module
// when available (single source of truth), falling back to a local copy.
function generateOrderId() {
    if (typeof window !== 'undefined' && window.utils && typeof window.utils.generateOrderId === 'function') {
        return window.utils.generateOrderId();
    }
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    // Use crypto.randomUUID() when available to avoid Math.random() collisions;
    // fall back to a high-entropy random suffix otherwise.
    let suffix;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    } else {
        suffix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    }
    return `ORD-${dateStr}-${suffix}`;
}

// Export functions
if (typeof window !== 'undefined') {
    window.selectOrderType = selectOrderType;
    window.submitOrder = submitOrder;
    window.createOrder = createOrder;
}