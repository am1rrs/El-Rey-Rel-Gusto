// Menu Renderer - Dynamically generates menu sections from menu-data.js

let currentLanguage = 'fr';

// Render menu function
function renderMenu() {
    const container = document.getElementById('menu-container');
    if (!container) return;

    container.innerHTML = '';

    // Loop through all menu categories
    Object.keys(menuData).forEach(categoryKey => {
        const category = menuData[categoryKey];

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

            // Item header
            const itemHeader = document.createElement('div');
            itemHeader.className = 'item-header';

            const itemName = document.createElement('h3');
            itemName.className = 'item-name';
            itemName.textContent = item.name;

            const itemPrice = document.createElement('span');
            itemPrice.className = 'item-price';

            // Handle different price formats
            if (item.prices && Array.isArray(item.prices)) {
                itemPrice.textContent = item.prices.map(p => p + ' DA').join(' / ');
            } else {
                itemPrice.textContent = item.price + ' DA';
            }

            itemHeader.appendChild(itemName);
            itemHeader.appendChild(itemPrice);
            menuItem.appendChild(itemHeader);

            // Ingredients
            if (item.ingredients) {
                const ingredients = document.createElement('p');
                ingredients.className = 'item-ingredients';
                ingredients.textContent = item.ingredients;
                menuItem.appendChild(ingredients);
            }

            // Badge for special items
            if (item.badge) {
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = item.badge;
                menuItem.appendChild(badge);
            }

            // Add to cart button
            const addToCartBtn = document.createElement('button');
            addToCartBtn.className = 'add-to-cart-btn';
            addToCartBtn.innerHTML = '<span>🛒</span><span>Ajouter</span>';
            addToCartBtn.onclick = () => openItemModal(categoryKey, item);
            menuItem.appendChild(addToCartBtn);

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

    // Store item data
    modal.dataset.categoryKey = categoryKey;
    modal.dataset.itemName = item.name;
    modal.dataset.itemPrice = item.price || item.prices[0];
    modal.dataset.hasMultipleSizes = item.prices ? 'true' : 'false';

    // Show modal
    modal.classList.remove('hidden');
}

function createItemModal() {
    const modal = document.createElement('div');
    modal.id = 'item-modal';
    modal.className = 'item-modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="closeItemModal()">&times;</button>
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
                    <button onclick="changeQuantity(-1)">-</button>
                    <span id="modal-quantity">1</span>
                    <button onclick="changeQuantity(1)">+</button>
                </div>
            </div>

            <div class="modal-section">
                <h4>Notes spéciales (optionnel)</h4>
                <textarea id="modal-notes" class="notes-input" placeholder="Ex: Sans oignons, bien cuit..."></textarea>
            </div>

            <button class="add-to-cart-btn" onclick="addToCartFromModal()">
                <span>🛒</span>
                <span>Ajouter au panier</span>
            </button>
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
    if (modal) modal.classList.add('hidden');
}

function addToCartFromModal() {
    const modal = document.getElementById('item-modal');
    const cart = window.getCart();

    if (!cart) {
        alert('Erreur: système de panier non disponible');
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
}
