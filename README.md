# SolCacao

Grown in sunlight, crafted with intention.

SolCacao is an online shop for single-origin chocolate. It has two sides: a storefront for people who want bars and truffles, and a wholesale side where hotels, event planners and companies can ask for custom, branded orders and get a quote. The site works in English and Spanish.

It's a team project for CSE 5335 (Web Data Management) at UT Arlington, Fall 2026. The frontend is built and runs on its own, the backend has just been started.

## What works right now

- English and Spanish. Every page lives under `/en` or `/es`, and the EN and ES buttons keep you on the same page
- Home page, shop with filters (cacao percentage, origin, category, tasting notes) and product pages with a batch passport and origin story. The filters are kept in the address, so a filtered shop can be shared
- A cart in a dialog that is saved in the browser. Checkout isn't available, the button says so
- Wholesale page and the four step Corporate Cacao Studio form for business quotes. The wholesale page is open to everybody, the studio is for business accounts (see "Trying the studio" below)
- Sign in and create account screens, a profile page (with sample data), a sampler builder (pick 4 to 6 and add them as one cart item) and a contact page
- Built to be usable with a keyboard and a screen reader, and to work from 320 pixels wide up. The notes are in the `docs` folder
- A backend with a health check and a standard error format

The forms, the language switch and the cart don't talk to the backend yet. That's the next part of the work, along with the database, real accounts and emails.

## Tech

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router, i18next for the translations
- Backend: Node.js, Express 5, TypeScript
- Database (planned): MongoDB
- Login (planned): JWT and bcrypt
- Tests: vitest, Testing Library and vitest-axe (unit and page tests), supertest (backend), Playwright with axe (browser tests)

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

Open the shop at http://localhost:5173. The address `/` sends you to `/en` or `/es`, depending on the language you used last or your browser language. The frontend forwards anything under `/api` to the backend on port 4000.

Use `/es` instead of `/en` for the Spanish version.

| Page | URL |
|---|---|
| Home | http://localhost:5173/en |
| Shop | http://localhost:5173/en/shop |
| Product | http://localhost:5173/en/shop/ecuador-72 |
| Wholesale | http://localhost:5173/en/wholesale |
| Corporate Cacao Studio | http://localhost:5173/en/wholesale/studio |
| Sampler | http://localhost:5173/en/sampler |
| Contact | http://localhost:5173/en/contact |
| Sign in | http://localhost:5173/en/account/login |
| Create account | http://localhost:5173/en/account/register |
| Profile | http://localhost:5173/en/profile |
| Backend health check | http://localhost:4000/api/health |

**Trying the studio.** There are no real accounts yet, so signing in is a preview: the form doesn't check anything, it only remembers the account type chosen above the form (retail or business) and the email, until you close the browser tab. The studio then works like this:

- Not signed in: the studio address sends you to the sign in page, and after you sign in you are back in the studio. The address of the sign in page carries the way back (`?next=/wholesale/studio`), and only a page of this site is followed.
- Signed in with a retail account: a message says the studio is for business accounts, with a link to create a business account (`/en/account/register?type=business` opens the form on the business choice).
- Signed in with a business account: the studio opens.

To try it, open the sign in page, choose Business account, type any email and password, and press Sign in. The check is only there to keep people out of a page they can't use. The backend checks the account type again when a quote request is sent.

Other commands, run inside `frontend` or `backend`:

- `pnpm test` runs the tests
- `pnpm typecheck` checks the TypeScript
- `pnpm build` makes a production build
- `pnpm lint` (frontend) checks the code, including the accessibility rules for JSX
- `pnpm test:e2e` (frontend) runs the browser tests. The first time, run `pnpm exec playwright install` to download the browsers

## Folders

```
frontend/
  src/app/        routes and the shared page layout
  src/features/   one folder per area (shell, auth, catalog, cart, studio, ...)
  src/data/       the demo products (bilingual, read with getProducts and getProductBySlug)
  src/i18n/       the English and Spanish text and the language helpers
  src/ui/         shared pieces: dialog, form field, live region, icons
  src/lib/        form validation and small hooks
  e2e/            the Playwright browser tests
backend/
  src/config/     settings read from the environment
  src/routes/     API routes
  src/middleware/ error handling
docs/             accessibility report, cross browser test sheet
```
