// Admin UI localization (EN / FR / AR-RTL)
// Zero-dependency dictionary + helpers. Exposed as window.adminI18n.
//
// Static markup strings use data-i18n / data-i18n-ph / data-i18n-title
// attributes; dynamic strings (table, modal, pagination) use t(key, vars).
// All inside an IIFE so no top-level binding can collide with the globals in
// js/order-service.js / js/firebase-config.js / auth.js / dashboard.js.
(function () {
    'use strict';

    var currentLang = 'fr';

    var dictionary = {
        en: {
            'login.subtitle': 'Admin Dashboard',
            'login.email': 'Email',
            'login.password': 'Password',
            'login.submit': 'Sign in',
            'login.hint': 'Admin account:',
            'login.error.invalid': 'Incorrect email or password.',
            'login.error.network': 'Network error. Please check your connection and try again.',
            'login.error.tooMany': 'Too many attempts. Please try again later.',
            'login.error.generic': 'Login failed. Please try again.',
            'login.error.operationNotAllowed': 'Email/password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.',
            'login.error.unauthorizedDomain': 'This domain is not authorized. Add it under Firebase Console → Authentication → Settings → Authorized domains.',
            'login.error.invalidApiKey': 'The Firebase API key is invalid or restricted. Check js/firebase-config.js and the key\'s API restrictions.',
            'login.error.configurationNotFound': 'Firebase Auth is not configured for this project. Check the authDomain in js/firebase-config.js.',
            'logout': 'Sign out',
            'logout.confirm': 'Are you sure you want to sign out?',
            'refresh': 'Refresh',
            'dashboard.subtitle': 'Administration',
            'view.overview': 'Dashboard',
            'view.orders': 'Orders',
            'nav.dashboard': 'Dashboard',
            'nav.orders': 'Orders',
            'nav.viewSite': 'View site',
            'nav.logout': 'Sign out',
            'sidebar.main': 'Menu',
            'sidebar.account': 'Account',
            'sidebar.toggle': 'Collapse sidebar',
            'overview.activityTitle': 'Recent activity',
            'overview.quickStats': 'Quick stats',
            'overview.empty': 'No orders today yet.',
            'activity.orderPlaced': 'New order {id} · {items}',
            'activity.statusChanged': '{id} · {status}',
            'quick.ordersToday': 'Orders today',
            'quick.avgConfirmed': 'Avg. confirmed order',
            'quick.dineIn': 'Dine-in',
            'quick.delivery': 'Delivery',
            'quick.takeaway': 'Takeaway',
            'header.darkMode': 'Switch to dark mode',
            'header.lightMode': 'Switch to light mode',
            'lang.en': 'EN',
            'lang.fr': 'FR',
            'lang.ar': 'AR',
            'stats.pending': 'Pending',
            'stats.preparing': 'In preparation',
            'stats.ready': 'Ready',
            'stats.total': 'Today\'s total',
            'filters.status': 'Status:',
            'filters.type': 'Type:',
            'filters.search': 'Search:',
            'filters.searchPlaceholder': 'Order, phone, item, address...',
            'filters.all': 'All',
            'filters.dateRange': 'Date range:',
            'filters.dateFrom': 'From',
            'filters.dateTo': 'To',
            'filters.paymentStatus': 'Payment status:',
            'filters.paymentMethod': 'Payment method:',
            'filters.clear': 'Clear filters',
            'filters.resultsCount': 'Found {count} of {total} order(s)',
            'dateRange.today': 'Today',
            'dateRange.week': 'This week',
            'dateRange.month': 'This month',
            'dateRange.custom': 'Custom',
            'payment.paid': 'Paid',
            'status.pending': 'Pending',
            'status.preparing': 'In preparation',
            'status.ready': 'Ready',
            'status.delivered': 'Delivered',
            'status.cancelled': 'Cancelled',
            'type.dine-in': 'Dine-in',
            'type.takeaway': 'Takeaway',
            'type.delivery': 'Delivery',
            'table.orderId': 'Order ID',
            'table.date': 'Date / Time',
            'table.customer': 'Customer',
            'table.phone': 'Phone',
            'table.items': 'Items',
            'table.type': 'Type',
            'table.total': 'Total',
            'table.status': 'Status',
            'table.actions': 'Actions',
            'table.view': 'View',
            'table.empty': 'No orders found',
            'table.itemsSummary': '{count} item(s)',
            'orders.title': 'Orders',
            'modal.title': 'Order details',
            'modal.close': 'Close',
            'modal.notFound': 'Order not found.',
            'modal.customer': 'Customer',
            'modal.name': 'Name',
            'modal.phone': 'Phone',
            'modal.address': 'Address',
            'modal.table': 'Table',
            'modal.pickup': 'Pickup time',
            'modal.placedAt': 'Placed at',
            'modal.items': 'Items',
            'modal.subtotal': 'Subtotal',
            'modal.deliveryFee': 'Delivery fee',
            'modal.total': 'Total',
            'modal.payment': 'Payment',
            'modal.paymentMethod': 'Method',
            'modal.paymentStatus': 'Payment status',
            'modal.instructions': 'Special instructions',
            'modal.noInstructions': 'None',
            'payment.cash': 'Cash',
            'payment.pending': 'Pending',
            'action.markPreparing': 'Mark as in preparation',
            'action.markReady': 'Mark as ready',
            'action.markDelivered': 'Mark as delivered',
            'action.cancel': 'Cancel order',
            'pagination.size': 'Per page',
            'pagination.page': 'Page {current} of {total}',
            'pagination.prev': 'Prev',
            'pagination.next': 'Next',
            'export.csv': 'Export CSV',
            'export.print': 'Print',
            'status.connecting': 'Connected — live updates from Firestore ({count} order(s)).',
            'status.warn': 'Firebase not connected — showing local orders only.',
            'status.noAccess': 'Access denied — your account is not an administrator. Contact the administrator.',
            'status.error': 'Error: {message}',
            'currency.suffix': 'DA'
        },

        fr: {
            'login.subtitle': 'Tableau de Bord Admin',
            'login.email': 'Email',
            'login.password': 'Mot de passe',
            'login.submit': 'Se connecter',
            'login.hint': 'Compte admin :',
            'login.error.invalid': 'Email ou mot de passe incorrect.',
            'login.error.network': 'Erreur réseau. Vérifiez votre connexion et réessayez.',
            'login.error.tooMany': 'Trop de tentatives. Réessayez plus tard.',
            'login.error.generic': 'Échec de la connexion. Réessayez.',
            'login.error.operationNotAllowed': 'La connexion email/mot de passe est désactivée. Activez-la dans Firebase Console → Authentication → Sign-in method.',
            'login.error.unauthorizedDomain': 'Ce domaine n\'est pas autorisé. Ajoutez-le dans Firebase Console → Authentication → Settings → Authorized domains.',
            'login.error.invalidApiKey': 'La clé API Firebase est invalide ou restreinte. Vérifiez js/firebase-config.js et les restrictions de la clé.',
            'login.error.configurationNotFound': 'Firebase Auth n\'est pas configuré pour ce projet. Vérifiez authDomain dans js/firebase-config.js.',
            'logout': 'Déconnexion',
            'logout.confirm': 'Voulez-vous vraiment vous déconnecter ?',
            'refresh': 'Actualiser',
            'dashboard.subtitle': 'Administration',
            'view.overview': 'Tableau de bord',
            'view.orders': 'Commandes',
            'nav.dashboard': 'Tableau de bord',
            'nav.orders': 'Commandes',
            'nav.viewSite': 'Voir le site',
            'nav.logout': 'Déconnexion',
            'sidebar.main': 'Menu',
            'sidebar.account': 'Compte',
            'sidebar.toggle': 'Réduire la barre latérale',
            'overview.activityTitle': 'Activité récente',
            'overview.quickStats': 'Statistiques rapides',
            'overview.empty': 'Aucune commande aujourd\'hui.',
            'activity.orderPlaced': 'Nouvelle commande {id} · {items}',
            'activity.statusChanged': '{id} · {status}',
            'quick.ordersToday': 'Commandes aujourd\'hui',
            'quick.avgConfirmed': 'Panier moyen confirmé',
            'quick.dineIn': 'Sur place',
            'quick.delivery': 'Livraison',
            'quick.takeaway': 'À emporter',
            'header.darkMode': 'Passer en mode sombre',
            'header.lightMode': 'Passer en mode clair',
            'lang.en': 'EN',
            'lang.fr': 'FR',
            'lang.ar': 'AR',
            'stats.pending': 'En attente',
            'stats.preparing': 'En préparation',
            'stats.ready': 'Prêtes',
            'stats.total': 'Total du jour',
            'filters.status': 'Statut :',
            'filters.type': 'Type :',
            'filters.search': 'Recherche :',
            'filters.searchPlaceholder': 'N° commande, téléphone, article, adresse...',
            'filters.all': 'Tous',
            'filters.dateRange': 'Période :',
            'filters.dateFrom': 'Du',
            'filters.dateTo': 'Au',
            'filters.paymentStatus': 'Statut du paiement :',
            'filters.paymentMethod': 'Moyen de paiement :',
            'filters.clear': 'Effacer les filtres',
            'filters.resultsCount': 'Trouvé {count} sur {total} commande(s)',
            'dateRange.today': 'Aujourd\'hui',
            'dateRange.week': 'Cette semaine',
            'dateRange.month': 'Ce mois-ci',
            'dateRange.custom': 'Personnalisé',
            'payment.paid': 'Payé',
            'status.pending': 'En attente',
            'status.preparing': 'En préparation',
            'status.ready': 'Prêt',
            'status.delivered': 'Livré',
            'status.cancelled': 'Annulé',
            'type.dine-in': 'Sur place',
            'type.takeaway': 'À emporter',
            'type.delivery': 'Livraison',
            'table.orderId': 'N° Commande',
            'table.date': 'Date / Heure',
            'table.customer': 'Client',
            'table.phone': 'Téléphone',
            'table.items': 'Articles',
            'table.type': 'Type',
            'table.total': 'Total',
            'table.status': 'Statut',
            'table.actions': 'Actions',
            'table.view': 'Voir',
            'table.empty': 'Aucune commande trouvée',
            'table.itemsSummary': '{count} article(s)',
            'orders.title': 'Commandes',
            'modal.title': 'Détails de la commande',
            'modal.close': 'Fermer',
            'modal.notFound': 'Commande introuvable.',
            'modal.customer': 'Client',
            'modal.name': 'Nom',
            'modal.phone': 'Téléphone',
            'modal.address': 'Adresse',
            'modal.table': 'Table',
            'modal.pickup': 'Heure de retrait',
            'modal.placedAt': 'Passée à',
            'modal.items': 'Articles',
            'modal.subtotal': 'Sous-total',
            'modal.deliveryFee': 'Frais de livraison',
            'modal.total': 'Total',
            'modal.payment': 'Paiement',
            'modal.paymentMethod': 'Méthode',
            'modal.paymentStatus': 'Statut du paiement',
            'modal.instructions': 'Instructions spéciales',
            'modal.noInstructions': 'Aucune',
            'payment.cash': 'Espèces',
            'payment.pending': 'En attente',
            'action.markPreparing': 'Marquer en préparation',
            'action.markReady': 'Marquer prêt',
            'action.markDelivered': 'Marquer livré',
            'action.cancel': 'Annuler la commande',
            'pagination.size': 'Par page',
            'pagination.page': 'Page {current} sur {total}',
            'pagination.prev': 'Précédent',
            'pagination.next': 'Suivant',
            'export.csv': 'Exporter CSV',
            'export.print': 'Imprimer',
            'status.connecting': 'Connecté — mise à jour en direct depuis Firestore ({count} commande(s)).',
            'status.warn': 'Firebase non connecté — seules les commandes locales sont affichées.',
            'status.noAccess': 'Accès refusé — votre compte n\'est pas administrateur. Contactez l\'administrateur.',
            'status.error': 'Erreur : {message}',
            'currency.suffix': 'DA'
        },

        ar: {
            'login.subtitle': 'لوحة تحكم الإدارة',
            'login.email': 'البريد الإلكتروني',
            'login.password': 'كلمة المرور',
            'login.submit': 'تسجيل الدخول',
            'login.hint': 'حساب المدير :',
            'login.error.invalid': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
            'login.error.network': 'خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.',
            'login.error.tooMany': 'محاولات كثيرة. حاول مرة أخرى لاحقاً.',
            'login.error.generic': 'فشل تسجيل الدخول. حاول مرة أخرى.',
            'login.error.operationNotAllowed': 'تسجيل الدخول بالبريد الإلكتروني/كلمة المرور معطّل. فعّله في Firebase Console → Authentication → Sign-in method.',
            'login.error.unauthorizedDomain': 'هذا النطاق غير مصرح به. أضفه في Firebase Console → Authentication → Settings → Authorized domains.',
            'login.error.invalidApiKey': 'مفتاح Firebase API غير صالح أو مقيد. تحقق من js/firebase-config.js ومن قيود المفتاح.',
            'login.error.configurationNotFound': 'Firebase Auth غير مكوّن لهذا المشروع. تحقق من authDomain في js/firebase-config.js.',
            'logout': 'تسجيل الخروج',
            'logout.confirm': 'هل تريد حقاً تسجيل الخروج؟',
            'refresh': 'تحديث',
            'dashboard.subtitle': 'الإدارة',
            'view.overview': 'لوحة التحكم',
            'view.orders': 'الطلبات',
            'nav.dashboard': 'لوحة التحكم',
            'nav.orders': 'الطلبات',
            'nav.viewSite': 'عرض الموقع',
            'nav.logout': 'تسجيل الخروج',
            'sidebar.main': 'القائمة',
            'sidebar.account': 'الحساب',
            'sidebar.toggle': 'طي الشريط الجانبي',
            'overview.activityTitle': 'النشاط الأخير',
            'overview.quickStats': 'إحصائيات سريعة',
            'overview.empty': 'لا توجد طلبات اليوم بعد.',
            'activity.orderPlaced': 'طلب جديد {id} · {items}',
            'activity.statusChanged': '{id} · {status}',
            'quick.ordersToday': 'طلبات اليوم',
            'quick.avgConfirmed': 'متوسط الطلب المؤكد',
            'quick.dineIn': 'في المحل',
            'quick.delivery': 'توصيل',
            'quick.takeaway': 'طلب جاهز',
            'header.darkMode': 'التبديل إلى الوضع الداكن',
            'header.lightMode': 'التبديل إلى الوضع الفاتح',
            'lang.en': 'EN',
            'lang.fr': 'FR',
            'lang.ar': 'AR',
            'stats.pending': 'قيد الانتظار',
            'stats.preparing': 'قيد التحضير',
            'stats.ready': 'جاهز',
            'stats.total': 'مجموع اليوم',
            'filters.status': 'الحالة :',
            'filters.type': 'النوع :',
            'filters.search': 'بحث :',
            'filters.searchPlaceholder': 'رقم الطلب، الهاتف، العنصر، العنوان...',
            'filters.all': 'الكل',
            'filters.dateRange': 'الفترة :',
            'filters.dateFrom': 'من',
            'filters.dateTo': 'إلى',
            'filters.paymentStatus': 'حالة الدفع :',
            'filters.paymentMethod': 'طريقة الدفع :',
            'filters.clear': 'مسح الفلاتر',
            'filters.resultsCount': 'وُجد {count} من أصل {total} طلب',
            'dateRange.today': 'اليوم',
            'dateRange.week': 'هذا الأسبوع',
            'dateRange.month': 'هذا الشهر',
            'dateRange.custom': 'مخصص',
            'payment.paid': 'مدفوع',
            'status.pending': 'قيد الانتظار',
            'status.preparing': 'قيد التحضير',
            'status.ready': 'جاهز',
            'status.delivered': 'تم التوصيل',
            'status.cancelled': 'ملغي',
            'type.dine-in': 'في المحل',
            'type.takeaway': 'طلب جاهز',
            'type.delivery': 'توصيل',
            'table.orderId': 'رقم الطلب',
            'table.date': 'التاريخ / الوقت',
            'table.customer': 'الزبون',
            'table.phone': 'الهاتف',
            'table.items': 'العناصر',
            'table.type': 'النوع',
            'table.total': 'المجموع',
            'table.status': 'الحالة',
            'table.actions': 'إجراءات',
            'table.view': 'عرض',
            'table.empty': 'لا توجد طلبات',
            'table.itemsSummary': '{count} عنصر',
            'orders.title': 'الطلبات',
            'modal.title': 'تفاصيل الطلب',
            'modal.close': 'إغلاق',
            'modal.notFound': 'الطلب غير موجود.',
            'modal.customer': 'الزبون',
            'modal.name': 'الاسم',
            'modal.phone': 'الهاتف',
            'modal.address': 'العنوان',
            'modal.table': 'الطاولة',
            'modal.pickup': 'وقت الاستلام',
            'modal.placedAt': 'أُرسل في',
            'modal.items': 'العناصر',
            'modal.subtotal': 'المجموع الفرعي',
            'modal.deliveryFee': 'رسوم التوصيل',
            'modal.total': 'المجموع',
            'modal.payment': 'الدفع',
            'modal.paymentMethod': 'الطريقة',
            'modal.paymentStatus': 'حالة الدفع',
            'modal.instructions': 'تعليمات خاصة',
            'modal.noInstructions': 'لا شيء',
            'payment.cash': 'نقداً',
            'payment.pending': 'قيد الانتظار',
            'action.markPreparing': 'وضع في التحضير',
            'action.markReady': 'تحديد كجاهز',
            'action.markDelivered': 'تحديد كموصّل',
            'action.cancel': 'إلغاء الطلب',
            'pagination.size': 'لكل صفحة',
            'pagination.page': 'الصفحة {current} من {total}',
            'pagination.prev': 'السابق',
            'pagination.next': 'التالي',
            'export.csv': 'تصدير CSV',
            'export.print': 'طباعة',
            'status.connecting': 'متصل — تحديث مباشر من Firestore ({count} طلب).',
            'status.warn': 'Firebase غير متصل — تُعرض الطلبات المحلية فقط.',
            'status.noAccess': 'وصول مرفوض — حسابك ليس حساب مدير. اتصل بالمسؤول.',
            'status.error': 'خطأ : {message}',
            'currency.suffix': 'دج'
        }
    };

    function t(key, vars) {
        var langDict = dictionary[currentLang] || {};
        var str = langDict[key];
        if (str === undefined) str = dictionary.en[key];
        if (str === undefined) str = key;
        if (vars) {
            str = str.replace(/\{(\w+)\}/g, function (m, name) {
                return vars[name] !== undefined ? String(vars[name]) : m;
            });
        }
        return str;
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function localeFor(lang) {
        if (lang === 'ar') return 'ar-DZ';
        if (lang === 'fr') return 'fr-FR';
        return 'en-GB';
    }

    function formatDateTime(ms) {
        if (!ms) return '—';
        var d = new Date(ms);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString(localeFor(currentLang), {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatCurrency(n) {
        var v = Number(n) || 0;
        return v.toLocaleString(localeFor(currentLang), { maximumFractionDigits: 0 }) + ' ' + t('currency.suffix');
    }

    function statusLabel(status) {
        if (!status) return '—';
        var label = t('status.' + status);
        return label === ('status.' + status) ? status : label;
    }

    function typeLabel(type) {
        if (!type) return '—';
        var label = t('type.' + type);
        return label === ('type.' + type) ? type : label;
    }

    // Translate every static element with data-i18n / data-i18n-ph / data-i18n-title
    // and set the document language + direction.
    function applyToDOM() {
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

        var i18nEls = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < i18nEls.length; i++) {
            i18nEls[i].textContent = t(i18nEls[i].getAttribute('data-i18n'));
        }

        var phEls = document.querySelectorAll('[data-i18n-ph]');
        for (var j = 0; j < phEls.length; j++) {
            phEls[j].setAttribute('placeholder', t(phEls[j].getAttribute('data-i18n-ph')));
        }

        var titleEls = document.querySelectorAll('[data-i18n-title]');
        for (var k = 0; k < titleEls.length; k++) {
            var key = titleEls[k].getAttribute('data-i18n-title');
            titleEls[k].setAttribute('title', t(key));
            titleEls[k].setAttribute('aria-label', t(key));
        }
    }

    function syncSwitcherButtons() {
        var buttons = document.querySelectorAll('.lang-switcher [data-lang]');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.toggle('active', buttons[i].getAttribute('data-lang') === currentLang);
        }
    }

    function setLanguage(lang) {
        if (!dictionary[lang]) lang = 'fr';
        currentLang = lang;
        try { localStorage.setItem('adminLang', lang); } catch (e) { /* private mode */ }
        applyToDOM();
        syncSwitcherButtons();
        // Let the dashboard re-render its dynamic content (table, modal, stats).
        window.dispatchEvent(new CustomEvent('admin:i18n'));
    }

    function detectDefaultLang() {
        var navLang = ((navigator.language || 'fr') || '').slice(0, 2).toLowerCase();
        if (dictionary[navLang]) return navLang;
        return 'fr';
    }

    function init() {
        var stored = null;
        try { stored = localStorage.getItem('adminLang'); } catch (e) { /* private mode */ }
        currentLang = (stored && dictionary[stored]) ? stored : detectDefaultLang();
        applyToDOM();
        syncSwitcherButtons();

        // Language switcher — delegated so both the login-screen and header
        // switchers work without rebinding.
        document.addEventListener('click', function (event) {
            var btn = event.target && event.target.closest ? event.target.closest('[data-lang]') : null;
            if (btn && dictionary[btn.getAttribute('data-lang')]) {
                setLanguage(btn.getAttribute('data-lang'));
            }
        });
    }

    window.adminI18n = {
        t: t,
        escapeHtml: escapeHtml,
        localeFor: localeFor,
        formatDateTime: formatDateTime,
        formatCurrency: formatCurrency,
        statusLabel: statusLabel,
        typeLabel: typeLabel,
        applyToDOM: applyToDOM,
        setLanguage: setLanguage,
        getLang: function () { return currentLang; },
        init: init
    };

    init();
})();
