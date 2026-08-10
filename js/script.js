// Translations
const translations = {
    fr: {
        tagline: "Le Roi du Goût",
        location: "Relizane, Algérie",
        hours: "Ouvert tous les jours",
        "qr-title": "Scannez pour voir le menu",
        "print-btn": "Imprimer le menu",
        "footer-text": "Tous droits réservés"
    },
    ar: {
        tagline: "ملك الذوق",
        location: "غيليزان، الجزائر",
        hours: "مفتوح يومياً",
        "qr-title": "امسح لرؤية القائمة",
        "print-btn": "طباعة القائمة",
        "footer-text": "جميع الحقوق محفوظة"
    },
    en: {
        tagline: "The King of Taste",
        location: "Relizane, Algeria",
        hours: "Open daily",
        "qr-title": "Scan to view the menu",
        "print-btn": "Print Menu",
        "footer-text": "All rights reserved"
    }
};

// Language Switching
const langButtons = document.querySelectorAll('.lang-btn');
const htmlElement = document.documentElement;
const bodyElement = document.body;

langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;

        // Update active button
        langButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update HTML lang attribute
        htmlElement.setAttribute('lang', lang);

        // Handle RTL for Arabic
        if (lang === 'ar') {
            bodyElement.setAttribute('dir', 'rtl');
        } else {
            bodyElement.setAttribute('dir', 'ltr');
        }

        // Update translated elements
        updateTranslations(lang);

        // Update menu with new language
        if (typeof updateMenuLanguage === 'function') {
            updateMenuLanguage(lang);
        }

        // Update category navigation
        const catManager = window.getCategoryManager?.();
        if (catManager) {
            catManager.updateLanguage(lang);
        }

        // Save preference
        localStorage.setItem('preferredLanguage', lang);
    });
});

// Update translations
function updateTranslations(lang) {
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.dataset.translate;
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
}

// Load saved language preference
function loadLanguagePreference() {
    const savedLang = localStorage.getItem('preferredLanguage') || 'fr';
    const btn = document.querySelector(`[data-lang="${savedLang}"]`);
    if (btn) {
        btn.click();
    }
}

// Generate QR Code
function generateQRCode() {
    const qrcodeContainer = document.getElementById('qrcode');
    if (qrcodeContainer && typeof QRCode !== 'undefined') {
        // Get current URL or use a placeholder
        const currentURL = window.location.href;

        new QRCode(qrcodeContainer, {
            text: currentURL,
            width: 250,
            height: 250,
            colorDark: "#000000",
            colorLight: "#f9fafb",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// Smooth scroll animation for menu items
function animateMenuItems() {
    const menuItems = document.querySelectorAll('.menu-item');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 50);
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    menuItems.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(item);
    });
}

// Search functionality (optional enhancement)
function addSearchFeature() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Rechercher une pizza...';
    searchInput.className = 'search-input';
    searchInput.style.cssText = `
        width: 100%;
        max-width: 500px;
        padding: 15px 25px;
        margin: 30px auto;
        display: block;
        border: 2px solid var(--decorative-gray);
        border-radius: 50px;
        font-size: 1rem;
        outline: none;
        transition: all 0.3s ease;
    `;

    searchInput.addEventListener('focus', () => {
        searchInput.style.borderColor = 'var(--price-copper)';
        searchInput.style.boxShadow = '0 4px 12px rgba(205, 127, 50, 0.2)';
    });

    searchInput.addEventListener('blur', () => {
        searchInput.style.borderColor = 'var(--decorative-gray)';
        searchInput.style.boxShadow = 'none';
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const menuItems = document.querySelectorAll('.menu-item');

        menuItems.forEach(item => {
            const name = item.querySelector('.item-name').textContent.toLowerCase();
            const ingredients = item.querySelector('.item-ingredients').textContent.toLowerCase();

            if (name.includes(searchTerm) || ingredients.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Insert search bar before first menu section
    const firstSection = document.querySelector('.menu-section');
    if (firstSection) {
        firstSection.parentNode.insertBefore(searchInput, firstSection);
    }
}

// Add price filter (optional)
function addPriceFilter() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'price-filter';
    filterContainer.style.cssText = `
        text-align: center;
        margin: 30px auto;
        display: flex;
        justify-content: center;
        gap: 15px;
        flex-wrap: wrap;
    `;

    const priceRanges = [
        { label: 'Tout', min: 0, max: Infinity },
        { label: '< 500 DA', min: 0, max: 500 },
        { label: '500-700 DA', min: 500, max: 700 },
        { label: '> 700 DA', min: 700, max: Infinity }
    ];

    priceRanges.forEach(range => {
        const btn = document.createElement('button');
        btn.textContent = range.label;
        btn.className = 'filter-btn';
        btn.style.cssText = `
            padding: 10px 20px;
            border: 2px solid var(--decorative-gray);
            background: white;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
        `;

        btn.addEventListener('click', () => {
            // Update active state
            filterContainer.querySelectorAll('.filter-btn').forEach(b => {
                b.style.background = 'white';
                b.style.color = 'var(--text-black)';
                b.style.borderColor = 'var(--decorative-gray)';
            });
            btn.style.background = 'var(--price-copper)';
            btn.style.color = 'white';
            btn.style.borderColor = 'var(--price-copper)';

            // Filter items
            const menuItems = document.querySelectorAll('.menu-item');
            menuItems.forEach(item => {
                const priceText = item.querySelector('.item-price').textContent;
                const price = parseInt(priceText.replace(/[^0-9]/g, ''));

                if (price >= range.min && price < range.max) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });

        filterContainer.appendChild(btn);
    });

    // Set "Tout" as active by default
    filterContainer.querySelector('.filter-btn').click();

    // Insert before first menu section
    const firstSection = document.querySelector('.menu-section');
    if (firstSection) {
        firstSection.parentNode.insertBefore(filterContainer, firstSection);
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadLanguagePreference();
    generateQRCode();
    animateMenuItems();
    // Uncomment these if you want search and filter features:
    // addSearchFeature();
    // addPriceFilter();
});

// Add hover effect sound (optional - uncomment if you want sound effects)
/*
const hoverSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZURE=');
hoverSound.volume = 0.1;

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        hoverSound.currentTime = 0;
        hoverSound.play().catch(e => console.log('Audio play failed'));
    });
});
*/

// Add to cart functionality (future enhancement placeholder)
function initializeCart() {
    // This is a placeholder for future e-commerce integration
    console.log('Cart system ready for integration');
}

// Analytics tracking (placeholder)
function trackMenuView() {
    // Add your analytics code here (Google Analytics, etc.)
    console.log('Menu viewed at:', new Date().toISOString());
}

// Call analytics on page load
trackMenuView();

// Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    });
}
