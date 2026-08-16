// QR Code Generator Tool (admin)
//
// Builds a scannable code for the public menu, optionally pre-filling a table
// number (?table=N) — the public site already reads that param (js/cart.js,
// js/checkout.js). The raw QR is rendered locally with the `qrcode` library
// (global `QRCode`, loaded from CDN in admin/index.html), then composed into a
// branded card (restaurant name + tagline) on a white canvas so it scans
// reliably in both light and dark themes. Download exports the whole card as
// PNG; Print opens it in a print dialog.
(function () {
    'use strict';

    var BRAND = 'El Rey del Gusto';          // brand line drawn on the card

    var QS = {
        url: 'qr-url',
        table: 'qr-table',
        size: 'qr-size',
        fg: 'qr-fg',
        bg: 'qr-bg',
        qr: 'qr-code',                        // offscreen canvas: raw QR
        card: 'qr-card',                      // visible preview canvas: the card
        status: 'qr-status',
        error: 'qr-error'
    };

    function $(id) { return document.getElementById(id); }
    function val(id) { var el = $(id); return el ? el.value : ''; }
    function t(key) {
        if (window.adminI18n && typeof window.adminI18n.t === 'function') return window.adminI18n.t(key);
        return key;
    }

    // Defensive: if QRCode library is not ready yet, retry a few times
    // (it loads locally via lib/qrcode.min.js before this script).
    let qrRetryInterval = null;
    function waitForQRCode(maxTries = 10, intervalMs = 50) {
        return new Promise(resolve => {
            let tries = 0;
            qrRetryInterval = setInterval(() => {
                tries++;
                if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
                    clearInterval(qrRetryInterval);
                    qrRetryInterval = null;
                    resolve(true);
                } else if (tries >= maxTries) {
                    clearInterval(qrRetryInterval);
                    qrRetryInterval = null;
                    console.warn('[QR] QRCode library not available after ' + maxTries + ' attempts');
                    resolve(false);
                }
            }, intervalMs);
        });
    }

    // Clean up any pending retry interval when the view is torn down.
    function stopQRRetry() {
        if (qrRetryInterval !== null) {
            clearInterval(qrRetryInterval);
            qrRetryInterval = null;
        }
    }

    // Production menu site. Printed QR codes must point here even when the
    // dashboard is opened locally (localhost / LAN), so the fallback is the
    // live address rather than the dev host.
    var PROD_URL = 'https://el-rey-del-gusto.pages.dev/menu.html';

    // On the deployed host the public site lives one folder up from /admin/;
    // anywhere else (localhost / LAN) default to the live site so QRs work
    // once printed.
    function defaultUrl() {
        try {
            var u = new URL(window.location.href);
            if (u.hostname === 'el-rey-del-gusto.pages.dev') {
                u.pathname = u.pathname.replace(/\/admin\/?([^/]*)$/, '/menu.html');
                u.search = '';
                u.hash = '';
                return u.href;
            }
            return PROD_URL;
        } catch (error) {
            return PROD_URL;
        }
    }

    function buildUrl() {
        var base = (val(QS.url) || '').trim();
        var table = (val(QS.table) || '').trim();
        if (!base) return '';
        if (!table) return base;
        return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'table=' + encodeURIComponent(table);
    }

    // Dynamic messages go in #qr-status. The library-missing message lives in
    // #qr-error (static data-i18n) so it follows the language automatically.
    function setStatus(msg, isError) {
        var statusEl = $(QS.status);
        if (statusEl) {
            statusEl.textContent = msg || '';
            statusEl.hidden = !msg;
            statusEl.classList.toggle('error', !!isError);
        }
        var errorEl = $(QS.error);
        if (errorEl) errorEl.hidden = true;
    }

    function setLibError(on) {
        var errorEl = $(QS.error);
        if (errorEl) errorEl.hidden = !on;
        var statusEl = $(QS.status);
        if (statusEl) statusEl.hidden = on;
    }

    // Compose the branded card: brand on top, QR in the middle, tagline (and
    // table number) below. Always a white background so it scans anywhere.
    function drawCard(qrCanvas, url, table) {
        var preview = $(QS.card);
        if (!preview) return;
        var ctx = preview.getContext('2d');

        var size = qrCanvas.width;
        var pad = 48;
        var uiFont = '"General Sans","Cairo",system-ui,sans-serif';
        var brandFont = '"Averia Serif Libre","Cairo",serif';

        // Measure the text rows to size the card.
        ctx.font = '700 30px ' + brandFont;
        var nameW = ctx.measureText(BRAND).width;
        ctx.font = '600 15px ' + uiFont;
        var tagW = ctx.measureText(t('qr.tagline')).width;
        var tableW = 0;
        if (table) {
            ctx.font = '700 16px ' + uiFont;
            tableW = ctx.measureText(t('qr.tablePrefix') + ' #' + table).width;
        }

        var cardW = Math.max(nameW, tagW, tableW, size) + pad * 2;
        var headerH = table ? 76 : 52;       // room for brand (+ table line)
        var footerH = 66;

        preview.width = cardW;
        preview.height = headerH + size + footerH;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cardW, preview.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        // Brand
        ctx.fillStyle = '#1a1917';
        ctx.font = '700 30px ' + brandFont;
        ctx.fillText(BRAND, cardW / 2, 34);

        // Table line (below the brand)
        if (table) {
            ctx.fillStyle = '#a85f1f';
            ctx.font = '700 16px ' + uiFont;
            ctx.fillText(t('qr.tablePrefix') + ' #' + table, cardW / 2, 62);
        }

        // Raw QR
        ctx.drawImage(qrCanvas, (cardW - size) / 2, headerH);

        // Tagline
        ctx.fillStyle = '#7d7c78';
        ctx.font = '600 15px ' + uiFont;
        ctx.fillText(t('qr.tagline'), cardW / 2, headerH + size + 44);
    }

    async function generate() {
        console.log('[QR] generate() called');
        var url = buildUrl();
        if (!url) {
            setStatus(t('qr.noUrl'), true);
            return;
        }

        var size = parseInt(val(QS.size), 10) || 256;
        var fg = val(QS.fg) || '#1a1917';
        var bg = val(QS.bg) || '#ffffff';
        var table = (val(QS.table) || '').trim();

        // Wait for QRCode library to be ready (max 5s)
        console.log('[QR] Waiting for QRCode library...');
        if (!await waitForQRCode(50, 100)) {
            console.log('[QR] QRCode library failed to load');
            setLibError(true);
            setStatus('', false);
            return;
        }

        var qrCanvas = $(QS.qr);
        console.log('[QR] qrCanvas element:', qrCanvas);
        // Ensure canvas has a size attribute that exists even before drawing
        if (!qrCanvas) {
            console.log('[QR] ERROR: qrCanvas not found!');
            return;
        }
        qrCanvas.width = 256;
        qrCanvas.height = 256;

        console.log('[QR] Calling QRCode.toCanvas...');
        QRCode.toCanvas(qrCanvas, url, {
            width: size,
            margin: 2,
            color: { dark: fg, light: bg },
            errorCorrectionLevel: 'M'
        }, function (err) {
            if (err) {
                console.log('[QR] QRCode.toCanvas error:', err);
                setLibError(true);
                return;
            }
            console.log('[QR] QRCode drawn successfully, calling drawCard...');
            drawCard(qrCanvas, url, table);
            var hint = t('qr.cardHint');
            if (table) hint += ' — ' + t('qr.tablePrefix') + ' #' + table;
            setStatus(hint, false);
        });
    }

    function downloadPng() {
        var preview = $(QS.card);
        if (!preview || preview.width === 0) return;
        var table = (val(QS.table) || '').trim();
        var a = document.createElement('a');
        a.download = 'elrey-menu-qr' + (table ? '-' + table : '') + '.png';
        a.href = preview.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function printCard() {
        var preview = $(QS.card);
        if (!preview || preview.width === 0) return;
        var win = window.open('', '_blank', 'width=600,height=800');
        if (!win) return;
        win.document.write(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
            BRAND + ' QR</title><style>html,body{margin:0}body{min-height:100vh;display:flex;' +
            'align-items:center;justify-content:center;background:#fff}img{max-width:100%;height:auto}</style>' +
            '</head><body><img src="' + preview.toDataURL('image/png') + '"></body></html>'
        );
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); }, 250);
    }

    function bindEvents() {
        var live = [QS.url, QS.table, QS.size, QS.fg, QS.bg];
        for (var i = 0; i < live.length; i++) {
            var el = $(live[i]);
            if (el) el.addEventListener('input', generate);
        }
        var dl = $('qr-download-btn');
        if (dl) dl.addEventListener('click', downloadPng);
        var pr = $('qr-print-btn');
        if (pr) pr.addEventListener('click', printCard);
    }

    function refresh() {
        var urlEl = $(QS.url);
        if (urlEl && !urlEl.value) urlEl.value = defaultUrl();
        generate();
    }

    if (typeof window !== 'undefined') {
        window.qrTool = { refresh: refresh, stop: stopQRRetry };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                bindEvents();
                refresh();
            });
        } else {
            bindEvents();
            refresh();
        }
    }
})();
