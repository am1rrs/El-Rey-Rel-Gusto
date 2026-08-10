// Site-wide dark mode toggle (customer pages).
// Persists the choice in localStorage; falls back to the OS preference.
// The .dark class is applied on <html> so every page that loads this file
// picks up the saved theme (an inline <head> guard prevents a flash of light).

(function () {
    'use strict';

    var THEME_KEY = 'siteTheme';
    var root = document.documentElement;
    var toggle = document.getElementById('theme-toggle');

    function applyTheme(dark) {
        root.classList.toggle('dark', dark);
        if (toggle) {
            toggle.textContent = dark ? '☀️' : '🌙';
            toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
            toggle.setAttribute('title', dark ? 'Light mode' : 'Dark mode');
        }
    }

    function init() {
        var saved = localStorage.getItem(THEME_KEY);
        var dark = saved
            ? saved === 'dark'
            : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

        applyTheme(dark);

        if (toggle) {
            toggle.addEventListener('click', function () {
                var next = !root.classList.contains('dark');
                localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
                applyTheme(next);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
