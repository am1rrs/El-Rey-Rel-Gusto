# El Rey del Gusto — Admin Dashboard Update (Step-by-Step Work Order)

You are working on the **El Rey del Gusto** restaurant ordering project at:

```
C:\scripts\elrey-menu\El Rey Del Gusto
```

It is a **static HTML/CSS/JS site** (no framework, no build step) that writes orders to **Firebase Firestore** (`orders` collection) via the **Firebase compat SDK 9.23.0** loaded from the gstatic CDN. The admin area lives in `admin/` (`index.html`, `dashboard.js`, `dashboard.css`, `auth.js`) and shares `js/firebase-config.js` and `js/order-service.js` with the customer-facing checkout.

---

## 0. Process — start in Plan Mode

**Do not edit any file before producing an approved plan.**

1. Read every relevant file first: `admin/index.html`, `admin/dashboard.js`, `admin/dashboard.css`, `admin/auth.js`, `js/firebase-config.js`, `js/order-service.js`, and the customer-facing `js/checkout.js` (to preserve the order data shape it writes).
2. Enter Plan Mode and produce a detailed **action plan** covering:
   - The exact files to modify and the precise change in each one.
   - Implementation order and dependencies between changes (e.g., auth before rules, rules before table hardening).
   - The security approach (Firebase Auth + Firestore rules + admin identity model).
   - A concrete verification strategy (manual + optional headless browser).
3. Present the plan and **wait for my approval before writing any code.**

---

## 1. Preserve the current state (already fixed — do not regress)

- The global identifier collision that crashed `dashboard.js` is **already fixed**: the admin page variable is named `adminOrderService` because `let orderService` already exists as a global in `js/order-service.js` (re-declaring it in `dashboard.js` is a `SyntaxError` that kills the whole script). **Never reintroduce `let orderService` on the admin page.**
- Keep the existing, working behaviors intact:
  - Customer orders are written to Firestore `orders`, with a `localStorage` mirror used by the confirmation page and as an offline fallback.
  - The dashboard uses a Firestore real-time listener (`onSnapshot`) plus a one-off fetch (`getAllOrders`).
  - The `data-status` banner communicates connection/error state.
  - `orderTimestampMs()` normalizes `timestamp` (number / string / Firestore Timestamp) to epoch ms — reuse it.

---

## 2. Required modifications (in priority order)

### M1 — Replace order cards with a real responsive data table
- In `admin/index.html`, replace the card grid (`#orders-list`) with a proper `<table>` (inside a horizontally-scrollable container on small screens).
- Columns: **Order ID · Date/Time · Customer (name + phone) · Items (count / short summary) · Type · Total · Status · Actions (View)**.
- Sortable columns: clicking a header toggles ascending/descending; implement with `data-*` attributes and a small comparator. No external library.
- Responsive behavior: stack to a card-like layout or horizontal scroll under ~768px using `dashboard.css`.
- Rows are clickable → open the details modal (M2).

### M2 — Order details modal
- Use the existing `#order-modal` skeleton and fill `#order-details` with the full order:
  - Header: order ID, type badge, date/time.
  - Customer block: name, phone, address (delivery), table (dine-in), pickup time (takeaway).
  - Itemized list: name, size, notes, quantity, line totals.
  - Totals: subtotal, delivery fee, total.
  - Payment method & status, special instructions.
  - Status workflow buttons (En attente → En préparation → Prêt → Livré, plus Annuler) that call `updateOrderStatus` and let the real-time listener refresh the table.
- Make it accessible: close on **×**, on **backdrop click**, and on **Escape**; focus the close button on open and restore focus on close.

### M3 — Export (CSV), print, pagination
- **CSV export** of the currently *filtered* orders: header row, proper quoting/escaping, UTF-8 BOM so Excel opens it correctly, filename `orders-YYYYMMDD-HHmm.csv`.
- **Print**: `@media print` rules so printing shows only the orders (and current filters), not the header/buttons/filters.
- **Pagination**: page-size selector (10 / 25 / 50) + prev/next + "Page X of Y", applied to the filtered set. When the real-time listener adds/removes orders, refresh counts without losing the user's place (e.g., clamp the page index).

### M4 — Real Firebase Authentication (replace the demo login)
- Rewrite `admin/auth.js` to use **Firebase Auth email/password** via the already-loaded compat SDK:
  - `firebase.auth().signInWithEmailAndPassword(email, password)` on submit.
  - `firebase.auth().onAuthStateChanged(user => …)` as the single source of truth for showing the login screen vs. the dashboard.
  - `firebase.auth().signOut()` on logout; set persistence to `LOCAL`.
  - Remove the hard-coded demo credentials (`admin@elrey.com` / `admin123`), the localStorage session, and the "Demo" hint on the login screen.
- Gate the dashboard on the authenticated user **before** any Firestore order reads (with new rules, unauthenticated reads are denied).
- Keep a single, clearly-marked config point for the admin email (used for display); actual authorization is enforced by Firestore rules via an `admins` collection (see M6).
- Do not break the customer-facing checkout — it must still place orders **without** authentication.

### M5 — Multi-language UI (English, French, Arabic RTL) with a switcher
- Add a small, zero-dependency i18n layer in `admin/`:
  - A dictionary `{ en, fr, ar }` covering every UI string: login, navigation, table headers, order types, statuses, buttons, banners, empty states, modal labels, confirmations.
  - `data-i18n` attributes updated via `textContent`, `data-i18n-ph` for placeholders, and a `t('key')` helper for dynamic strings.
- Add a **language switcher (EN | FR | AR)** in the header; persist the choice in `localStorage`.
- Set `document.documentElement.lang` and `dir` (`rtl` for Arabic); use logical CSS properties (`margin-inline-start`, etc.) in `dashboard.css` so RTL works without duplication.
- Format dates/numbers with `toLocaleString(locale)`.
- Scope: the admin dashboard only — customer pages stay as-is.

### M6 — Firestore security rules + deployment config (full hardening)
- Provide a `firestore.rules` file (plus `firebase.json` pointing to it) deployable with `firebase deploy --only firestore`, with this security model:
  - **Customers place orders without auth**: `orders` collection allows `create` for anyone, validated (`request.resource.data` has the required fields, `status` matches the allowed set, `orderId`/`total` types checked).
  - **Admin reads/updates only**: `read` and `update` on `orders` require an authenticated user present in an `admins/{uid}` document (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))`).
  - **No `delete`** on orders; `admins` collection readable only by its own user and writable only from the console.
- Document the required manual steps (you cannot perform them): enable **Email/Password** sign-in in Firebase Auth, create the admin user, add the admin doc `admins/{uid}` = `{ email, role: 'admin' }`, and deploy the rules.

---

## 3. Clean & secure engineering requirements

- **No frameworks and no build step.** Keep classic `<script>` tags and the existing Firebase compat SDK 9.23.0 CDN URLs. The site deploys as static files (Netlify / GitHub Pages / Vercel / plain hosting).
- **Escape all user-supplied data** interpolated into HTML (order/customer/item fields) with a small `escapeHtml()` helper — prevent XSS in the table and modal.
- **Event handling:** replace generated inline `onclick="..."` attributes with `addEventListener` + event delegation on the table/modal containers. Keep `window.*` exports only where existing pages depend on them.
- **Defensive field handling:** `(order.orderId || '')` before `.toLowerCase()`, `orderTimestampMs(order)` for dates, guard against missing/NaN `price`/`quantity`/`total`, and never let a single malformed order break `renderOrders`/`applyFilters`.
- **Keep the real-time listener contract**: status updates should flow back through the listener; do not double-render or lose the `lastOrderCount` new-order notification.
- **No secrets in frontend code** beyond the existing public Firebase config values.
- Preserve the customer checkout → confirmation flow exactly; it is out of scope for behavior changes.

---

## 4. Scope & non-goals

**In scope:** `admin/index.html`, `admin/dashboard.js`, `admin/dashboard.css`, `admin/auth.js`, shared `js/firebase-config.js` (only if auth setup requires it), `js/order-service.js` (only if read/auth logic must change), plus new `firestore.rules` and `firebase.json`.

**Out of scope / do not change:** `js/checkout.js`, `js/cart.js`, `js/menu-*.js`, `cart.html`, `checkout.html`, `order-confirmation.html`, `index.html` (customer menu), and the customer-facing CSS.

---

## 5. Verification / acceptance criteria

Before declaring done, verify every item below (manual browser test, plus an optional headless-Chrome run if useful):

- [ ] Login with a real Firebase Auth admin account works; wrong credentials show a clear error; demo credentials no longer exist anywhere.
- [ ] The table renders all Firestore orders, is sortable on every column, and handles empty results with the existing "no orders" state.
- [ ] Clicking a row opens the modal with full details; closing works via ×, backdrop, and Escape.
- [ ] Status changes persist to Firestore and the table updates live via the listener.
- [ ] CSV export contains exactly the filtered rows and opens correctly in Excel.
- [ ] Print view shows only the orders.
- [ ] Pagination works with page-size changes, prev/next, and doesn't break when new orders arrive live.
- [ ] Language switcher flips EN/FR/AR, persists across reloads, and Arabic renders correctly RTL with no layout breakage.
- [ ] `firestore.rules`: an unauthenticated client **cannot** read `orders` but **can** create a valid order (matches the checkout flow); an authenticated admin can read and update.
- [ ] Zero console errors on load, login, and every interaction.

---

## 6. Final report requirements

When the work is complete, report:

1. Every file changed and a one-line summary of the change.
2. Any manual steps I must perform in the Firebase Console / CLI (enable Email/Password, create the admin user + `admins/{uid}` doc, deploy rules) with exact commands.
3. How to verify the result end-to-end.
4. Anything that could not be done from the frontend code alone, stated explicitly.
