# SolCacao

Grown in sunlight, crafted with intention.

SolCacao is an online shop for single-origin chocolate. It has two sides: a storefront for people who want bars and truffles, and a wholesale side where hotels, event planners and companies can ask for custom, branded orders and get a quote. The site is meant to work in English and Spanish.

It's a team project for CSE 5335 (Web Data Management) at UT Arlington, Fall 2026. The frontend is built and runs on its own, the backend has just been started.

## What works right now

- Home page, shop with filters (cacao percentage, origin, category, tasting notes) and product pages with a batch passport and origin story
- A cart with a drawer. Checkout isn't available, the button says so
- Wholesale page and the four step Corporate Cacao Studio form for business quotes
- Sign in and create account screens, a sampler builder and a contact form
- A backend with a health check and a standard error format

The forms, the language switch and the cart don't talk to the backend yet. That's the next part of the work, along with the database, real accounts and emails.

## Tech

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router
- Backend: Node.js, Express 5, TypeScript
- Database (planned): MongoDB
- Login (planned): JWT and bcrypt
- Tests: vitest, Testing Library, supertest

## Run it

You need Node.js 22.18 or newer (the backend runs its TypeScript files directly) and pnpm. The frontend and the backend are two separate apps, so use two terminals.

Backend:

```
cd backend
pnpm install
pnpm dev
```

Frontend:

```
cd frontend
pnpm install
pnpm dev
```

The backend settings have defaults, so a `.env` file is optional. To change the port, copy `backend/.env.example` to `backend/.env`.

Open the shop at http://localhost:5173. The frontend forwards anything under `/api` to the backend on port 4000.

| Page | URL |
|---|---|
| Home | http://localhost:5173/ |
| Shop | http://localhost:5173/shop |
| Product | http://localhost:5173/shop/ecuador-72 |
| Wholesale | http://localhost:5173/wholesale |
| Corporate Cacao Studio | http://localhost:5173/wholesale/studio |
| Sign in | http://localhost:5173/login |
| Create account | http://localhost:5173/register |
| Sampler and contact | http://localhost:5173/sampler |
| Backend health check | http://localhost:4000/api/health |

Other commands, run inside `frontend` or `backend`:

- `pnpm test` runs the tests
- `pnpm typecheck` checks the TypeScript
- `pnpm build` makes a production build

## Folders

```
frontend/
  src/app/        routes and the shared page layout
  src/features/   one folder per area (shell, auth, catalog, cart, studio, ...)
  src/data/       the demo products
backend/
  src/config/     settings read from the environment
  src/routes/     API routes
  src/middleware/ error handling
```
