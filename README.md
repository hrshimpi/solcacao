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

The quote form of the studio sends its request, with the brand files, to the backend (see "Trying the studio" below). The other forms, the language switch and the cart don't talk to the backend yet. That's the next part of the work, along with real accounts.

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

To try it, open the sign in page, choose Business account, type any email and password, and press Sign in. The check is only there to keep people out of a page they can't use.

The last step sends the request to the backend (`POST /api/b2b/quote`) as a multipart form, and shows how much of the files has gone up. The backend checks the account type again, with a token, and the preview sign in does not give one yet. Without it the studio says that the server does not know who you are, and keeps everything that was typed. To send a request for real, run the backend with a database, make a business token (the command is in the "Quote requests API" section below) and put it in the browser tab, from the developer console of the studio page:

```
sessionStorage.setItem("sc_token", "<token>")
```

Once there is a real sign in, it should put the token there by itself. A few more things to know:

- What was entered is kept in a draft in the browser tab, so a refresh brings it back. The files are not kept, so after a refresh the page lists the files to add again. The browser asks before the tab is closed with something unsent.
- The company and contact start from the name and company that were given when the account was created in this tab, when there are any.
- When the request is saved the page shows its reference (like `SC-1A2B3C4D`, the end of its id) and a link to "My quote requests" at `/en/account/requests`. That page is not built yet, so the link has nowhere to go for now.

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

## Email

The backend can send four emails: a message to the team when someone writes through the site (wholesale inquiries go to the wholesale address, everything else to support), a notice to the wholesale address when a business sends a quote request, a notice to a customer when their quote is ready (no endpoint uses this one yet), and a welcome for new newsletter subscribers in English or Spanish. The code is in `backend/src/services/mail.service.ts` and the templates are in `mail-templates.ts`. Sending an email never breaks a request: if something goes wrong the function returns `false` and the error message is written to the log.

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

## Inquiries API

The contact form, the feedback form and the newsletter box all post to one endpoint, and the team reads the messages with two admin endpoints. The database is MongoDB: set `MONGODB_URI` in `backend/.env` (the default is `mongodb://127.0.0.1:27017/solcacao`, a MongoDB on your own machine or an Atlas address both work). The server starts even when the database is not there yet. It keeps trying every 10 seconds and the inquiry routes answer 503 until it is connected.

| Request | Who | What it does |
|---|---|---|
| `POST /api/inquiries` | anyone | saves a message, feedback or newsletter sign up and answers `201 { "id": "..." }`. Emails the team (a welcome email for the newsletter). 5 messages per 15 minutes per IP address, then `429` |
| `GET /api/inquiries` | admin | a page of inquiries, newest first: `?status=new\|responded`, `?category=...`, `?page=1&limit=20` (up to 100). Answers `{ items, page, limit, total }` |
| `PATCH /api/inquiries/:id` | admin | `{ "status": "new" }` or `{ "status": "responded" }` |

The body of a `POST` depends on the category (`general`, `wholesale`, `support`, `feedback` or `newsletter`):

```
{ "category": "general", "name": "Isabel", "email": "isabel@example.com", "message": "Do you ship to Canada?" }
{ "category": "feedback", "rating": 5, "message": "optional", "email": "optional" }
{ "category": "newsletter", "email": "isabel@example.com" }
```

- Tags are stripped from all the text, so only plain text is saved.
- The forms have a hidden field called `website` that people never see. If anything is in it the answer is `201` as usual, but nothing is saved or sent.
- A newsletter address that is already subscribed gets the same `201` answer, with no second record and no second email. The language of the welcome email comes from the `Accept-Language` header.
- A signed in user's id is saved with the message when the request has a good token (`Authorization: Bearer <token>`). A missing or bad token does not stop the message.
- Mistakes come back as `400` with a message for each field: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "email", "message": "..." }] } }`.
- The admin endpoints answer `401` without a token and `403` for a user who is not an admin. The login routes come later. Until then you can make an admin token yourself, from the `backend` folder (it uses `JWT_SECRET` from `.env`, and lasts an hour):

```
node --input-type=module -e "import { signToken } from './src/middleware/auth.ts'; console.log(await signToken({ id: '64b7f0c2a1b2c3d4e5f60718', role: 'admin' }))"
curl -H "Authorization: Bearer <token>" "http://localhost:4000/api/inquiries?status=new"
```

The tests do not need a database. One group of tests checks the real MongoDB code and only runs when you give it a database, which is emptied first, so its name has to contain `test`:

```
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
```

## Quote requests API

A business account sends a quote request from the Corporate Cacao Studio as one multipart form: the text fields and up to 5 brand files.

`POST /api/b2b/quote` needs a business account, which means a token with `accountType: "b2b"`. A guest gets `401` and a retail account gets `403`. Each user can send 10 requests per hour, then it is `429`.

| Field | Notes |
|---|---|
| `cacaoProfile` | text, up to 60 characters. The studio sends the name of the card, like `Ecuador 72%` or `Custom blend` |
| `packagingType` | `foil_wrap`, `rigid_box`, `specimen_card` or `paper_sleeve` |
| `quantityEstimate` | a whole number, 1 or more |
| `companyName`, `contactName` | taken from the user's profile when the form leaves them out |
| `notes` | optional, up to 2000 characters |
| `brandAssets` | 0 to 5 files (PDF, AI, EPS or PNG), 50 MB each. It is one field name, repeated for each file |

You can make a business token yourself, like the admin one above (from the `backend` folder), and try the endpoint with curl. Use your own files:

```
node --input-type=module -e "import { signToken } from './src/middleware/auth.ts'; console.log(await signToken({ id: '64b7f0c2a1b2c3d4e5f60718', role: 'user', accountType: 'b2b' }))"
curl -X POST http://localhost:4000/api/b2b/quote \
  -H "Authorization: Bearer <token>" \
  -F cacaoProfile=Ecuador \
  -F packagingType=foil_wrap \
  -F quantityEstimate=800 \
  -F companyName="Hacienda Brands" \
  -F contactName="Isabel Vasquez" \
  -F notes="Before the holidays, please" \
  -F "brandAssets=@brand-guide.pdf;type=application/pdf" \
  -F "brandAssets=@logo.png;type=image/png"
```

The answer is `201 { "request": { ... } }` with the saved request (status `submitted`, no quote yet) and the stored name of each file. Mistakes come back in the same error shape as the inquiries: `400` with a message for each field, and `413` for a file that is too big. A request is either saved with all its files or not at all: if anything fails after the files were stored, they are deleted again. The wholesale address gets an email about each new request, and if that email fails the request still works.

Until the account code exists, the company, contact name and email are read from the `users` collection (`name`, or `firstName` and `lastName`; `companyName` or `b2bProfile.companyName`; `email`). Those field names are a guess and will be replaced by the real profile code.

### Reading and changing the requests

| Request | Who | What it does |
|---|---|---|
| `GET /api/b2b/requests` | business account | the user's own requests, newest first: `?page=1&limit=20` (up to 100). Answers `{ items, page, limit, total, totalPages }` |
| `GET /api/b2b/requests/:id` | the owner or an admin | one request, as `{ "request": { ... } }` |
| `GET /api/b2b/requests/:id/assets/:storedName` | the owner or an admin | the file, as a download with the name it was uploaded with |
| `PATCH /api/b2b/requests/:id` | admin | the new `status`, and with a quote the `quoteAmount` in cents and a `quoteNote` |

- A guest gets `401`. The list is for business accounts, so a retail account gets `403` there. Changing a status is for admins only: everybody else gets `403`, also the owner of the request.
- Somebody else's request answers `404`, exactly like a request that does not exist, so nobody can find out which ids are in use. The same goes for a file name that does not belong to that request. An id that is not 24 letters and numbers is a `400`.
- The files are never public. The only way to get one is the download route above, which needs the owner's or an admin's token. It is sent with `Content-Disposition: attachment`, so the browser saves it and does not open it, and with `Cache-Control: private, no-store`. A stored name in the response is only a name: it does not tell where the file is kept.
- Statuses move one way: `submitted` to `quoted` or `rejected`, and `quoted` to `approved` or `rejected`. `approved` and `rejected` are final. Any other change is `400` with the code `INVALID_TRANSITION`, and the message says where the request can go.
- `quoted` needs a `quoteAmount` (a whole number of cents, so `125000` is 1,250.00). It is set once, so the other statuses do not take one, and the amount stays on the request. A `quoteNote` can come with any change.
- If two admins change the same request at the same moment, one of them wins and the other gets `409`.

Try it with an admin token (from the `backend` folder, same command as for the inquiries) and the id from the quote request answer:

```
curl -H "Authorization: Bearer <business token>" "http://localhost:4000/api/b2b/requests?limit=5"
curl -X PATCH http://localhost:4000/api/b2b/requests/<id> \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{ "status": "quoted", "quoteAmount": 125000, "quoteNote": "Includes shipping." }'
curl -OJ -H "Authorization: Bearer <business token>" http://localhost:4000/api/b2b/requests/<id>/assets/<storedName>
```

The last one saves the file under its original name (`-OJ` reads it from the header). There is no email to the customer yet when a request is quoted.
