// Landing Page Enhancements
// Handles: menu preview, testimonials carousel, newsletter form, scroll animations, particles

(function() {
    'use strict';

    // ==========================================
    // MENU PREVIEW - Load featured items from the active menu
    // ==========================================
    function getActiveMenuData() {
        if (window.menuService && typeof window.menuService.getActiveMenu === 'function') {
            const active = window.menuService.getActiveMenu();
            if (active) return active;
        }
        return (typeof menuData !== 'undefined') ? menuData : null;
    }

    // Pick up to N "best" items across the menu: signature first, then featured,
    // then the first item of each major category. Ensures visual variety.
    function getPreviewItems(menu, maxCount = 4) {
        const priorityCategories = ['pizza_rouge', 'burgers', 'pastas', 'salades'];
        const picked = [];
        const seen = new Set();

        function addItem(item, categoryKey) {
            if (!item || seen.has(item.name)) return;
            seen.add(item.name);
            picked.push(Object.assign({ category: categoryKey }, item));
        }

        // 1) Signature / featured items from priority categories
        priorityCategories.forEach(catKey => {
            const cat = menu[catKey];
            if (!cat || !Array.isArray(cat.items)) return;
            cat.items
                .filter(i => i.signature || i.featured)
                .forEach(i => addItem(i, catKey));
        });

        // 2) Fallback: first item of each priority category if still short
        if (picked.length < maxCount) {
            priorityCategories.forEach(catKey => {
                const cat = menu[catKey];
                if (cat && Array.isArray(cat.items) && cat.items[0]) {
                    addItem(cat.items[0], catKey);
                }
            });
        }

        return picked.slice(0, maxCount);
    }

    // Safe background-image URL: only allow http(s) or root-relative paths,
    // otherwise return null so the SVG placeholder is used.
    function safeBgUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
            return trimmed;
        }
        return null;
    }

    async function loadMenuPreview() {
        const grid = document.getElementById('menu-preview-grid');
        const menu = getActiveMenuData();
        if (!grid || !menu) return;

        const featured = getPreviewItems(menu, 4);
        if (featured.length === 0) return;

        // Wait for menu:loaded (Firestore) so the freshest copy is used when available.
        const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRkFGN0YwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+4oCc77+8PC90ZXh0Pjwvc3ZnPg==';

        grid.innerHTML = featured.map((item, index) => {
            const img = safeBgUrl(item.image);
            const bg = img ? `url('${img}')` : `url('${placeholderSvg}')`;
            const badge = item.badge
                ? `<span class="preview-badge">${item.badge}</span>`
                : `<span class="preview-badge" data-translate="preview.popular">Populaire</span>`;
            const price = item.prices ? `${item.prices[0]} د.إ` : `${item.price || 0} د.إ`;
            return `
                <article class="preview-card" style="--i: ${index}">
                    <div class="preview-image" style="background-image: ${bg}"></div>
                    <div class="preview-content">
                        <span class="preview-category">${item.category || ''}</span>
                        <h3 class="preview-name">${item.name || ''}</h3>
                        <p class="preview-desc">${item.ingredients || ''}</p>
                        <div class="preview-footer">
                            <span class="preview-price">${price}</span>
                            ${badge}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Trigger animation
        requestAnimationFrame(() => {
            grid.querySelectorAll('.preview-card').forEach((card, i) => {
                card.style.animationDelay = `${i * 100}ms`;
                card.classList.add('animate-in');
            });
        });
    }

    // ==========================================
    // TESTIMONIALS CAROUSEL (multilingual, data-driven)
    // ==========================================
    let testimonials = window.landingTestimonials || [];

    function getTestimonialLang() {
        return document.documentElement.lang || 'fr';
    }

    function initTestimonialsCarousel() {
        const track = document.getElementById('testimonials-track');
        const dotsContainer = document.getElementById('testimonials-dots');
        if (!track || !dotsContainer) return;

        let currentIndex = 0;
        const cardWidth = 100; // percentage

        function renderCards() {
            const lang = getTestimonialLang();
            track.innerHTML = testimonials.map((t, i) => `
                <div class="testimonial-card" data-index="${i}">
                    <div class="testimonial-rating">
                        ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}
                    </div>
                    <p class="testimonial-text">"${t.text[lang] || t.text.fr}"</p>
                    <div class="testimonial-author">
                        <span class="author-name">${t.author}</span>
                        <span class="author-date">${t.date[lang] || t.date.fr}</span>
                    </div>
                </div>
            `).join('');

            dotsContainer.innerHTML = testimonials.map((_, i) => `
                <button class="testimonial-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Avis ${i + 1}"></button>
            `).join('');

            // Re-bind dots
            dotsContainer.querySelectorAll('.testimonial-dot').forEach(dot => {
                dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.index)));
            });
        }

        function goToSlide(index) {
            currentIndex = (index + testimonials.length) % testimonials.length;
            track.style.transform = `translateX(-${currentIndex * cardWidth}%)`;
            dotsContainer.querySelectorAll('.testimonial-dot').forEach((dot, i) =>
                dot.classList.toggle('active', i === currentIndex));
        }

        // Initial render
        renderCards();

        // Auto-rotate
        let autoRotate = setInterval(() => goToSlide(currentIndex + 1), 5000);

        // Pause on hover
        const carousel = document.getElementById('testimonials-carousel');
        if (carousel) {
            carousel.addEventListener('mouseenter', () => clearInterval(autoRotate));
            carousel.addEventListener('mouseleave', () => {
                autoRotate = setInterval(() => goToSlide(currentIndex + 1), 5000);
            });
        }

        // Touch swipe support
        let touchStartX = 0;
        track.addEventListener('touchstart', (e) => touchStartX = e.touches[0].clientX, { passive: true });
        track.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) goToSlide(currentIndex + (diff > 0 ? 1 : -1));
        }, { passive: true });

        // Expose re-render for language switch
        window.rerenderTestimonials = function (lang) {
            document.documentElement.lang = lang;
            renderCards();
            currentIndex = 0;
            track.style.transform = `translateX(0%)`;
            dotsContainer.querySelectorAll('.testimonial-dot').forEach((dot, i) =>
                dot.classList.toggle('active', i === 0));
        };
    }

    // ==========================================
    // NEWSLETTER FORM
    // ==========================================
    function initNewsletterForm() {
        const form = document.getElementById('newsletter-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = form.querySelector('input[type="email"]').value.trim();
            const submitBtn = form.querySelector('.newsletter-submit');
            const originalText = submitBtn.textContent;

            if (!email || !email.includes('@')) {
                showToast('Email invalide', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Inscription...';

            // Simulate API call (replace with real endpoint)
            await new Promise(r => setTimeout(r, 1000));

            // Store locally for demo
            const subscriptions = JSON.parse(localStorage.getItem('newsletter_subs') || '[]');
            if (!subscriptions.includes(email)) {
                subscriptions.push(email);
                localStorage.setItem('newsletter_subs', JSON.stringify(subscriptions));
            }

            showToast('Merci ! Vous êtes inscrit à la newsletter.', 'success');
            form.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 2rem; right: 2rem; z-index: 10000;
            padding: 1rem 1.5rem; border-radius: var(--radius-lg);
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : 'var(--text-black)'};
            color: white; font-weight: 600; box-shadow: var(--shadow-lg);
            animation: slideUp 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==========================================
    // HERO PARTICLES
    // ==========================================
    function initHeroParticles() {
        const container = document.getElementById('hero-particles');
        if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'hero-particle';
            const size = Math.random() * 4 + 2;
            const left = Math.random() * 100;
            const delay = Math.random() * 8;
            const duration = 8 + Math.random() * 8;
            particle.style.cssText = `
                width: ${size}px; height: ${size}px; left: ${left}%;
                animation-delay: ${delay}s; animation-duration: ${duration}s;
                background: radial-gradient(circle, var(--price-copper) 0%, transparent 70%);
            `;
            container.appendChild(particle);
        }
    }

    // ==========================================
    // SCROLL ANIMATIONS (IntersectionObserver)
    // ==========================================
    function initScrollAnimations() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.querySelectorAll('.animate-on-scroll').forEach(el => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
    }

    // ==========================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ==========================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#') return;
                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // ==========================================
    // PARALLAX HERO BACKGROUND
    // ==========================================
    function initParallax() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const hero = document.querySelector('.landing-hero');
        const heroBg = document.querySelector('.landing-hero-bg');
        if (!hero || !heroBg) return;

        let ticking = false;
        function onScroll() {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrolled = window.scrollY;
                    const rate = scrolled * 0.3;
                    heroBg.style.transform = `translateY(${rate}px)`;
                    ticking = false;
                });
                ticking = true;
            }
        }
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        loadMenuPreview();
        initTestimonialsCarousel();
        initNewsletterForm();
        initHeroParticles();
        initScrollAnimations();
        initSmoothScroll();
        initParallax();

        // Add animation classes to sections
        document.querySelectorAll('.section-header, .feature, .preview-card, .contact-item, .stat, .newsletter-content').forEach((el, i) => {
            el.classList.add('animate-on-scroll');
            el.style.transitionDelay = `${Math.min(i * 50, 300)}ms`;
        });
    });
})();