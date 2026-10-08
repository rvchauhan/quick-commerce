# Quick Commerce — Shopify Admin App

Embedded Shopify app (React Router / Polaris) for **business admins only**.  
All product data lives in **dark-store-api**. Store managers use **dark-store-portal**.

## Architecture

```
Shopify Admin (merchant)
        ↓  Shopify session
quick-commerce (this app)     ← PARTNER_API_KEY only on the server
        ↓  partner /session → staff JWT
        ↓  browser calls API with Bearer JWT
dark-store-api                ← only business backend
```

dark-store-portal keeps email/Google login for admin **and** manager.

## Setup

1. Create a platform partner key in dark-store-api:

```bash
npm run partner-key:create -- --platform --name "Shopify App"
```

2. Copy `.env.example` → `.env` (Shopify CLI also injects shop credentials) and set:

```bash
DARK_STORE_API_URL=http://localhost:3001
PARTNER_API_KEY=dsk_test_...
```

3. Add your Shopify app tunnel origin to dark-store-api `CORS_ORIGIN` (comma-separated with `http://localhost:8080`).

4. Run:

```bash
shopify app dev
```

Admin nav: Dashboard · Master Catalog · Dark Stores · Inventory · Pricing · Analytics.

## What lives where

| Concern | Location |
|---------|----------|
| Shopify OAuth / session / uninstall webhook | This app (template + thin partner glue) |
| Partner provision / session JWT | `dark-store-api` `/api/partner/*` |
| Catalog, stores, inventory, analytics | `dark-store-api` — called from the browser with JWT |
| Manager UI | `dark-store-portal` only |

## Template / deployment

Built from the [Shopify React Router app template](https://github.com/Shopify/shopify-app-template-react-router).  
Prisma SQLite stores Shopify sessions only (not dark-store data).  
See [shopify.dev deployment docs](https://shopify.dev/docs/apps/launch/deployment) when you host the app.
