// Category Management System
// Manages filtering and display of menu items by category

class CategoryManager {
    constructor() {
        this.currentCategory = 'all';
        this.categoryTranslations = {
            fr: {
                all: 'Tout le Menu',
                pizza_rouge: 'Pizza Sauce Rouge',
                pizza_blanche: 'Pizza Sauce Blanche',
                sandwiches: 'Sandwiches',
                pains_maison: 'Pains Maison',
                tacos: 'Tacos',
                burgers: 'Burgers',
                hot_chicken: 'Hot Chicken',
                tenders: 'Tenders',
                wings: 'Wings',
                salades: 'Salades',
                gratins: 'Gratins',
                poutine: 'Poutine',
                bowls: 'Bowls',
                pastas: 'Pastas',
                omelettes: 'Omelettes',
                camembert: 'Camembert Pané',
                plats: 'Plats',
                assiettes: 'Assiettes',
                gaufres: 'Gaufres',
                crepes: 'Crêpes',
                pancakes: 'Pancakes',
                supplements: 'Suppléments',
                mojitos: 'Mojitos',
                mocktails: 'Mocktails',
                boissons_fraiches: 'Boissons Fraîches',
                boissons_chaudes: 'Boissons Chaudes',
                desserts: 'Desserts'
            },
            ar: {
                all: 'القائمة الكاملة',
                pizza_rouge: 'بيتزا صلصة حمراء',
                pizza_blanche: 'بيتزا صلصة بيضاء',
                sandwiches: 'سندويشات',
                pains_maison: 'خبز البيت',
                tacos: 'تاكوس',
                burgers: 'همبرغر',
                hot_chicken: 'دجاج حار',
                tenders: 'تندرز',
                wings: 'أجنحة',
                salades: 'سلطات',
                gratins: 'غراتان',
                poutine: 'بوتين',
                bowls: 'بولز',
                pastas: 'معكرونة',
                omelettes: 'عجة',
                camembert: 'كامامبير مقلي',
                plats: 'أطباق',
                assiettes: 'صحون',
                gaufres: 'وافل',
                crepes: 'كريب',
                pancakes: 'بان كيك',
                supplements: 'إضافات',
                mojitos: 'موهيتو',
                mocktails: 'موكتيل',
                boissons_fraiches: 'مشروبات باردة',
                boissons_chaudes: 'مشروبات ساخنة',
                desserts: 'حلويات'
            },
            en: {
                all: 'Full Menu',
                pizza_rouge: 'Pizza Red Sauce',
                pizza_blanche: 'Pizza White Sauce',
                sandwiches: 'Sandwiches',
                pains_maison: 'House Breads',
                tacos: 'Tacos',
                burgers: 'Burgers',
                hot_chicken: 'Hot Chicken',
                tenders: 'Tenders',
                wings: 'Wings',
                salades: 'Salads',
                gratins: 'Gratins',
                poutine: 'Poutine',
                bowls: 'Bowls',
                pastas: 'Pastas',
                omelettes: 'Omelettes',
                camembert: 'Breaded Camembert',
                plats: 'Dishes',
                assiettes: 'Plates',
                gaufres: 'Waffles',
                crepes: 'Crêpes',
                pancakes: 'Pancakes',
                supplements: 'Extras',
                mojitos: 'Mojitos',
                mocktails: 'Mocktails',
                boissons_fraiches: 'Cold Drinks',
                boissons_chaudes: 'Hot Drinks',
                desserts: 'Desserts'
            }
        };

        this.init();
    }

    init() {
        // Load saved category from localStorage
        const savedCategory = localStorage.getItem('selectedCategory');
        if (savedCategory) {
            this.currentCategory = savedCategory;
        }

        // Check URL hash
        if (window.location.hash) {
            const hashCategory = window.location.hash.substring(1);
            if (this.isValidCategory(hashCategory)) {
                this.currentCategory = hashCategory;
            }
        }

        this.renderCategoryNav();
        this.attachEventListeners();
        this.filterMenuByCategory(this.currentCategory);
    }

    isValidCategory(category) {
        return category === 'all' || menuData.hasOwnProperty(category);
    }

    getCategoryCount(categoryKey) {
        if (categoryKey === 'all') {
            return Object.values(menuData).reduce((total, cat) => total + cat.items.length, 0);
        }
        return menuData[categoryKey] ? menuData[categoryKey].items.length : 0;
    }

    renderCategoryNav() {
        const container = document.getElementById('category-nav');
        if (!container) return;

        const currentLang = document.documentElement.getAttribute('lang') || 'fr';
        const categories = ['all', ...Object.keys(menuData)];

        container.innerHTML = '';

        categories.forEach(categoryKey => {
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.dataset.category = categoryKey;

            if (categoryKey === this.currentCategory) {
                button.classList.add('active');
            }

            // Get category icon
            const icon = categoryKey === 'all' ? '📋' : menuData[categoryKey]?.icon || '🍽️';

            // Get category name
            const categoryName = this.categoryTranslations[currentLang][categoryKey] || categoryKey;

            // Get item count
            const count = this.getCategoryCount(categoryKey);

            button.innerHTML = `
                <span class="category-icon">${icon}</span>
                <span class="category-name">${categoryName}</span>
                <span class="category-count">${count}</span>
            `;

            container.appendChild(button);
        });
    }

    attachEventListeners() {
        const container = document.getElementById('category-nav');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn');
            if (!btn) return;

            const category = btn.dataset.category;
            this.selectCategory(category);
        });
    }

    selectCategory(category) {
        if (!this.isValidCategory(category)) return;

        this.currentCategory = category;

        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });

        // Update URL hash
        window.location.hash = category;

        // Save to localStorage
        localStorage.setItem('selectedCategory', category);

        // Filter menu
        this.filterMenuByCategory(category);

        // Smooth scroll to menu
        const menuContainer = document.getElementById('menu-container');
        if (menuContainer) {
            menuContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    filterMenuByCategory(category) {
        const sections = document.querySelectorAll('.menu-section');

        if (category === 'all') {
            // Show all sections
            sections.forEach(section => {
                section.style.display = 'block';
            });
        } else {
            // Show only selected category
            sections.forEach(section => {
                const sectionCategory = section.dataset.category;
                if (sectionCategory === category) {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            });
        }

        // Re-trigger animations
        if (typeof animateMenuItems === 'function') {
            setTimeout(animateMenuItems, 100);
        }
    }

    updateLanguage(lang) {
        this.renderCategoryNav();
    }
}

// Initialize category manager when DOM is ready
let categoryManager;
document.addEventListener('DOMContentLoaded', () => {
    categoryManager = new CategoryManager();
});

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.CategoryManager = CategoryManager;
    window.getCategoryManager = () => categoryManager;
}
