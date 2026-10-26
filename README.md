# SolCacao

Grown in sunlight, crafted with intention.

SolCacao is an online shop for single-origin chocolate. It has two sides: a storefront for people who want bars and truffles, and a wholesale side where hotels, event planners and companies can ask for custom, branded orders and get a quote. The site is meant to work in English and Spanish.

It's a team project for CSE 5335 (Web Data Management) at UT Arlington, Fall 2026. The frontend is built and runs on its own, the backend has just been started.

## What works right now

- Home page, shop with filters (cacao percentage, origin, category, tasting notes) and product pages with a batch passport and origin story
- A cart with a drawer. Checkout isn't available, the button says so
- Wholesale page and the four step Corporate Cacao Studio form for business quotes
- Sign in and create account screens, a profile page (with sample data), a sampler builder and a contact form
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
| Profile | http://localhost:5173/profile |
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

## Email

The backend can send three emails: a message to the team when someone writes through the site (wholesale inquiries go to the wholesale address, everything else to support), a notice to a customer when their quote is ready, and a welcome for new newsletter subscribers in English or Spanish. The code is in `backend/src/services/mail.service.ts` and the templates are in `mail-templates.ts`. Sending an email never breaks a request: if something goes wrong the function returns `false` and the error message is written to the log.

**Without a mail server (the default).** When `SMTP_HOST` is empty, which is how `.env.example` ships, nothing is sent. Nodemailer's JSON transport only builds the message, and the server log shows who it was for, the subject and the text. The tests work the same way, so you don't need an account to develop or to run them.

The settings go in `backend/.env` (see `.env.example`):

| Setting | What it is |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | the mail server. Leave `SMTP_HOST` empty to only log. Port 465 uses TLS from the start, other ports (587, 2525) switch to it when the server allows it |
| `MAIL_FROM` | the sender, like `SolCacao <no-reply@yourdomain.com>` |
| `MAIL_TO_SUPPORT`, `MAIL_TO_WHOLESALE` | where the inquiries go |

**Try it with a test inbox.** A test inbox catches the emails, so nothing reaches a real person.

- Mailtrap: make a free account, open Email Testing, then Inboxes, pick your inbox and look at its SMTP settings. Copy the host, port, username and password into `.env`.
- Ethereal: go to https://ethereal.email and press "Create Ethereal Account". It gives you a host (`smtp.ethereal.email`), port 587, a username and a password. Put them in `.env`, then log in to the same site and open "Messages" to see what arrived.

Then send one from the `backend` folder (the endpoints that use these functions come later):

```
node --input-type=module -e "import { sendNewsletterWelcome } from './src/services/mail.service.ts'; console.log(await sendNewsletterWelcome('you@example.com', 'en'))"
```

It prints `true` when the server accepted the message. Then look in the inbox. If it prints `false`, the log says why (wrong host, port, username or password are the usual reasons). Change `'en'` to `'es'` for the Spanish welcome.

**With Gmail.** Turn on 2-step verification for the account, then create an app password (Google Account, Security, App passwords). Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587` (or 465), your address as `SMTP_USER` and the 16 character app password as `SMTP_PASS`, written without spaces. Use the same address in `MAIL_FROM`, because Gmail replaces other senders. Your normal Gmail password does not work here, and Gmail limits how many emails you can send per day, so it is fine for trying things out but not for the real shop.

The screens of these services change now and then. If the names above don't match, search for "SMTP" in their help pages.
