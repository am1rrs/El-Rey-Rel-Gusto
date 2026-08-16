// Shared Utilities
// Single source of truth for XSS prevention, image sanitization, and formatting.
// Loaded via classic <script> so it works with the current deployed architecture.

(function () {
    'use strict';

    // ---------------------------------------------------------------------
    // XSS Prevention
    // ---------------------------------------------------------------------

    // Escape HTML special characters for safe textContent/innerHTML interpolation.
    // Returns '' for null/undefined. NOTE: replacements map to entity codes,
    // not the literal characters (a no-op bug from an earlier version).
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escape for HTML attribute context (value="...").
    // Returns '' for null/undefined.
    function escapeAttr(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ---------------------------------------------------------------------
    // Image URL Sanitization
    // ---------------------------------------------------------------------

    // Validate image URL to prevent javascript: / data: scheme XSS.
    // Allows: http://, https://, or relative / paths. Returns null for invalid.
    function sanitizeImageUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
            return trimmed;
        }
        return null;
    }

    // ---------------------------------------------------------------------
    // Formatting Helpers
    // ---------------------------------------------------------------------

    // Format integer DA amount with locale-appropriate thousands separator.
    function formatCurrency(amount) {
        const n = Number(amount);
        if (!isFinite(n)) return '—';
        return n.toLocaleString('fr-DZ') + ' DA';
    }

    // Format a timestamp (ms since epoch, Firestore Timestamp, or ISO string) to localized string.
    function formatDateTime(ts) {
        if (ts == null) return '—';
        const ms = ts && ts.toMillis ? ts.toMillis() : (typeof ts === 'string' ? Date.parse(ts) : Number(ts));
        if (!isFinite(ms)) return '—';
        return new Date(ms).toLocaleString('fr-DZ');
    }

    // Generate a collision-resistant order ID: ORD-YYYYMMDD-xxxxxxxx
    // Uses crypto.randomUUID() when available; falls back to high-entropy random.
    function generateOrderId() {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        let suffix;
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        } else {
            suffix = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
        }
        return `ORD-${dateStr}-${suffix}`;
    }

    // ---------------------------------------------------------------------
    // Export (classic script → window.utils)
    // ---------------------------------------------------------------------
    window.utils = {
        escapeHtml,
        escapeAttr,
        sanitizeImageUrl,
        formatCurrency,
        formatDateTime,
        generateOrderId
    };
})();
