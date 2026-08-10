# El Rey del Gusto - Deployment Ready

## Overview
This project is a static restaurant ordering website that keeps the customer inside the website flow. Orders are persisted to **Firebase Firestore** (`orders` collection); a `localStorage` mirror is kept only so the confirmation page can render immediately and the admin dashboard can fall back during a Firebase outage.

## Features
- Full menu page with category filtering
- Add-to-cart flow
- Cart and checkout pages
- Order confirmation page within the site
- Admin dashboard with demo login
- Order tracking and status updates
- No redirect to WhatsApp

## Live access
The project can be served as a static site from the root folder.

## Admin credentials
- Email: admin@elrey.com
- Password: admin123

## Deployment notes
This version is ready for static hosting such as:
- Netlify
- GitHub Pages
- Vercel static hosting
- Any simple HTML hosting service

## Important behavior
- The order is submitted to **Firebase Firestore** first
- The redirect to the confirmation page happens **only after** Firestore confirms the write — a failed save shows an error and never redirects
- Customer remains on-site after submission
- Confirmation page loads in the site with the generated `orderId`
- Admin dashboard reads orders from Firestore (auto-refresh every 30 s)

## Main files
- index.html
- cart.html
- checkout.html
- order-confirmation.html
- admin/index.html
- js/checkout.js
- js/order-service.js
- admin/dashboard.js

## Local verification status
The site has been checked locally via browser and the following behavior was confirmed:
- Main menu renders correctly
- Checkout flow works
- Order is saved
- Confirmation page loads
- Admin login works
- Orders appear in the admin dashboard

## Production recommendation
Orders persist to Firebase Firestore across all devices. Before going live, restrict the Firestore `orders` rules (e.g. require Authentication) and move the admin dashboard to a real auth provider instead of the demo credentials.
