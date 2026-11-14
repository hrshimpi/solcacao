# SolCacao

Grown in sunlight, crafted with intention.

SolCacao is an online shop for single-origin chocolate. It has two sides: a storefront for people who want bars and truffles, and a wholesale side where hotels, event planners and companies can ask for custom, branded orders and get a quote. The site works in English and Spanish.

It's a team project for CSE 5335 (Web Data Management) at UT Arlington, Fall 2026. The frontend is built and runs on its own, the backend has just been started.

## What works right now

- English and Spanish. Every page lives under `/en` or `/es`, and the EN and ES buttons keep you on the same page
- Home page, shop with filters (cacao percentage, origin, category, tasting notes) and product pages with a batch passport and origin story. The filters are kept in the address, so a filtered shop can be shared
- A cart in a dialog that is kept by the server: a visitor's cart in a cookie, a signed in person's cart in the account, and the visitor's cart is added to the account at sign in. The stock is checked by the server, and the page says so when there are fewer than asked for. The Checkout button opens the checkout
- A checkout for a signed in person: where to send the order (a saved address, or a new one added on the page), how fast (standard or express) and how to pay, with the order summary beside it. The payment is made up (see "Checkout and orders API"): use the card `4242 4242 4242 4242`, and `4000 0000 0000 0002` to see a card that is declined. The total, the shipping and the tax are always the ones of the server
- Your orders, in your account: a list of everything bought, newest first, and a page for each order with what was bought, where it goes, how it was paid and how far along it is. An order that nobody started to pack can be cancelled there
- Wholesale page and the four step Corporate Cacao Studio form for business quotes, and a My quote requests page where a business account follows its requests. The wholesale page is open to everybody, the studio and the requests are for business accounts (see "Trying the studio" below)
- Real accounts: create an account (retail or business), sign in, forgot and reset password, and a profile page with the personal details, the language of the emails, a password change, the notifications switch, shipping addresses and (for a business account) the business details with their verification. A reload keeps you signed in
- Built to be usable with a keyboard and a screen reader, and to work from 320 pixels wide up. The notes are in the `docs` folder
- A backend with accounts (sign up, sign in, password reset), a health check, a standard error format and the protections listed under "Accounts and security"

Everything talks to the backend: the accounts, the profile, the addresses, the password reset, the products, the cart, the contact form, the newsletter box, the quote form of the studio and My quote requests. Only two small things stay in the browser: the language you chose and the draft of a quote. The products come from the seed (see "Shop API").

## Tech

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router, i18next for the translations
- Backend: Node.js, Express 5, TypeScript
- Database: MongoDB (through Mongoose)
- Login: a short lived JWT and a refresh cookie, passwords with bcrypt (see "Accounts and security")
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

The backend settings have defaults, so a `.env` file is optional. To change the port, copy `backend/.env.example` to `backend/.env`. The backend needs MongoDB: a local one on port 27017 is the default (`docker run -d -p 27017:27017 mongo:7` is the quickest way), or set `MONGODB_URI`. Without it the server still starts and the routes that need the database answer 503. In development the reset password email is not sent, its link is written in the log of the backend.

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
| Forgot password | http://localhost:5173/en/account/forgot-password |
| Profile | http://localhost:5173/en/profile |
| Shipping addresses | http://localhost:5173/en/profile/addresses |
| My quote requests (business accounts) | http://localhost:5173/en/account/requests |
| Backend health check | http://localhost:4000/api/health |

**Signing in.** Everything about accounts needs the backend and MongoDB running (see "Run it"). Open the create account page, make an account (choose Business account for the studio), and you are signed in. A sign in gives the page a token that it keeps in memory and a cookie that scripts cannot read, so a reload keeps you signed in and nothing about the sign in is saved in the browser. When the token runs out the page gets a new one by itself. The pages decide what to show, and the server checks again for everything that matters. The studio works like this:

- Not signed in: the studio address sends you to the sign in page, and after you sign in you are back in the studio. The address of the sign in page carries the way back (`?next=/wholesale/studio`), and only a page of this site is followed.
- Signed in with a retail account: a message says the studio is for business accounts, with a link to create a business account (`/en/account/register?type=business` opens the form on the business choice).
- Signed in with a business account: the studio opens.

The last step sends the request to the backend (`POST /api/b2b/quote`) as a multipart form with the token of the person, and shows how much of the files has gone up. A few more things to know:

- What was entered is kept in a draft in the browser tab, so a refresh brings it back. The files are not kept, so after a refresh the page lists the files to add again. The browser asks before the tab is closed with something unsent.
- The company and contact start from the name and company of the account.
- When the request is saved the page shows its reference (like `SC-1A2B3C4D`, the end of its id) and a link to that request in "My quote requests".
- A mistake of the sign in or the create account form is shown above the form (or on the field, for an email that has an account), in the language of the page. The server's words are English, so the pages say it in their own words by the code of the error.

**My quote requests.** `/en/account/requests` is for business accounts (a guest signs in first and comes back, a retail account gets a short message). It lists the requests the account sent, newest first, each with its date, cacao profile, packaging, units and status (submitted, quoted, approved or rejected), and the amount once it was quoted. Choosing one opens its details on the right (below the list on a phone): the notes, the note from our team and the files that were sent. The chosen request is in the address (`?request=<id>`), so the link can be shared. The account page links to it too, for business accounts only.

- The page needs a signed in business account to read the requests.
- An admin changes a status on the server (see "Reading and changing the requests" below). The page reads the list again when you come back to the tab and when you press Refresh, and a screen reader is told which request changed.
- A file cannot be opened with a plain link, because the server wants the token in the `Authorization` header. The Download button fetches the file with the token and saves it under the name it was uploaded with.

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
  src/api/        the calls to the products, the cart and the inquiries, and what they do with the answers
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
- The admin endpoints answer `401` without a token and `403` for a user who is not an admin. Make an admin with `pnpm create-admin` (see "Accounts and security"), sign in as that admin and use the access token from the answer: `curl -H "Authorization: Bearer <token>" "http://localhost:4000/api/inquiries?status=new"`.

The tests do not need a database. One group of tests checks the real MongoDB code and only runs when you give it a database, which is emptied first, so its name has to contain `test`:

```
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/solcacao_test pnpm test
```

## Accounts and security

People sign up and sign in with an email and a password, as a retail or a business account. Business accounts also keep their company details (and a verification status that only our team can change). Everything about accounts lives under `/api/auth`.

| Request | Who | What it does |
|---|---|---|
| `POST /api/auth/register` | anyone | `{ name, email, password, accountType: "retail" \| "b2b", companyName (business only), preferredLanguage }`. Makes the account and signs it in: `201 { user, accessToken, expiresIn }`. 5 accounts per hour per address |
| `POST /api/auth/login` | anyone | `{ email, password }` answers `200` like register. A wrong password and an unknown email give the same `401 INVALID_CREDENTIALS`. 5 wrong passwords in a row lock the account for 15 minutes (`429 TOO_MANY_ATTEMPTS`) |
| `POST /api/auth/refresh` | the cookie | a new access token and a new cookie. `401 SESSION_EXPIRED` when the cookie is missing, old or used before |
| `POST /api/auth/logout` | the cookie | ends the sign in of this device, `204` |
| `POST /api/auth/forgot-password` | anyone | `{ email }` always answers `200 { ok: true }`, and sends a link when the address has an account. 3 per hour per address |
| `POST /api/auth/reset-password` | anyone | `{ token, password }` from the link in the email: `204`, and every sign in of the account ends |

The signed in person's own account is under `/api/users/me`. All of it needs an access token, and every call only ever touches records of the user in the token: an address or a request that belongs to somebody else is answered `404`, the same as one that does not exist.

| Request | What it does |
|---|---|
| `GET /api/users/me` | `{ user, b2bProfile }` (the business details only for a business account) |
| `PATCH /api/users/me` | `name`, `phone` (empty takes it away), `preferredLanguage`, `marketingEmails`. The email, role and type of account cannot be changed: sending them is a `400` |
| `PATCH /api/users/me/password` | `{ currentPassword, newPassword }`. Ends every other sign in and answers like a sign in (`{ user, accessToken, expiresIn }` and a new cookie) so this device stays signed in. A wrong current password is `400 WRONG_PASSWORD`, and 5 wrong ones in 15 minutes are `429` |
| `GET /api/users/me/addresses` | the saved addresses, the oldest first |
| `POST /api/users/me/addresses` | `{ label, street, street2?, city, state, postalCode, country, isDefault? }`. Up to 10 per person (`409 ADDRESS_LIMIT`). The first one is the default |
| `PATCH /api/users/me/addresses/:id` | changes parts of an address (an empty `street2` takes it away) |
| `DELETE /api/users/me/addresses/:id` | `204`. When the default goes, the oldest address that is left becomes the default |
| `POST /api/users/me/addresses/:id/default` | makes it the default. A database index keeps it at one default for each user |
| `GET` and `PUT /api/users/me/b2b-profile` | business accounts only (`403` otherwise): `{ companyName, taxId?, industry? }`. The verification status (`pending`, `verified`, `rejected`) is not part of it |
| `PATCH /api/staff/b2b-profiles/:userId` | the team only (an admin token, or the key in `STAFF_API_KEY` sent as `X-Staff-Key`): `{ verificationStatus }` |

How signing in works:

- A sign in gives two tokens. The **access token** is a signed JWT that works for 15 minutes and is sent as `Authorization: Bearer <token>`. The **refresh token** is a random text in a cookie called `sc_refresh` (`HttpOnly`, `SameSite=Strict`, only sent to `/api/auth`, `Secure` in production) that lasts 7 days. Scripts on the page cannot read it, and it never appears in an answer.
- A refresh token works once. Using it gives a new one, and showing an old one again (a copy was stolen) ends that whole sign in. Two tabs that ask in the same moment are told to try again instead.
- An access token that ran out answers `401 TOKEN_EXPIRED`, which is the signal to call `/api/auth/refresh` and try again. Every other problem with a token is `401 UNAUTHENTICATED`, and a signed in user who may not do something gets `403 FORBIDDEN`.
- Passwords are hashed with bcrypt and never returned or logged. A new password needs at least 10 characters with a letter and a number, at most 72 (what bcrypt reads), and not one of the very common ones.
- The reset link is a random token. Only its hash is kept, it works once, and it stops working after an hour. The email goes out in the language of the account. With `SMTP_HOST` empty the email is only logged, and in development the log shows the link.

What protects every request:

- Security headers (helmet), no `X-Powered-By`, a limit of 100 kb on JSON bodies, and an id on every request (`X-Request-Id`, also in the log).
- Only the addresses in `CLIENT_ORIGIN` may read answers from a browser (CORS) and send changes (POST, PATCH, PUT, DELETE). A change that comes from another website is refused with `403`, which stops other pages from using the cookie of a signed in person. Requests with no `Origin` header (curl, other servers) are not from a browser, so they pass.
- A limit on requests for each visitor (`RATE_LIMIT_MAX` in `RATE_LIMIT_WINDOW_MINUTES`), and a stricter one on wrong tries at the sign in routes (`AUTH_RATE_LIMIT_MAX`). Answers are `429` with a `Retry-After` header.
- Everything that comes in is checked with a schema first, only the named fields are read (nobody can name their own role), tags are stripped from text, and MongoDB filters are sanitized so `{ "$ne": null }` is only ever text.
- Errors have one shape, `{ error: { code, message, details } }`. What the code does not expect is a `500` with no details, and the real error only goes to the log.
- Answers that belong to one person are sent with `Cache-Control: no-store`.
- Passwords, tokens and cookies are never written to the log: the logger hides them even if a line of code puts them in, and a request is logged without its headers.
- An error that nothing catches (a timer, a callback that fails on its own) is written to the log and stops the server, so the host starts a clean one. A stop that is asked for (`SIGTERM`) waits for the open requests, and forces the end after 10 seconds.
- `GET /api/health` says that the server is running and whether the database is connected (`database: "up"` or `"down"`). `GET /api/health/ready` answers `503 DATABASE_UNAVAILABLE` until it is, for a host that waits for it before it sends visitors. Neither is counted by the limit on requests, and neither is kept by a cache.

Making an admin (the sign up route can only make people and businesses):

```
cd backend
ADMIN_PASSWORD='a long password 1' pnpm create-admin you@example.com "Your Name"
```

Settings in `backend/.env` for this part (all in `.env.example`): `CLIENT_ORIGIN`, `TRUST_PROXY`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `BCRYPT_COST`, `COOKIE_SECURE`, `STAFF_API_KEY`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MINUTES` and `AUTH_RATE_LIMIT_MAX`. In production `JWT_SECRET` has to be your own text of at least 32 characters, and the server refuses to start without it.

**Putting the site online.** The cookie only works when the page and the API are on the same site, so the frontend host has to send `/api/*` to the backend (a rewrite or proxy rule, see the hosting notes) and `CLIENT_ORIGIN` has to be the address people see in the browser. Behind a proxy set `TRUST_PROXY` to the number of proxies, or the limits count all visitors as one.

## Who can call what

Every route of the API is in one of these groups. The test `backend/src/access.test.ts` has a table with every route and its group, and calls each one the way a person who is not allowed would: with no token, a token that is made up, signed with another key, with no algorithm, one that ran out, in a cookie or in the address instead of the header, and the token of an account of the wrong kind. A route that is not in the table makes the test fail, so a new route cannot be added without saying who it is for.

| Group | Routes | What the server checks |
|---|---|---|
| Anyone | register, login, refresh, logout, forgot and reset password, `GET /api/products...`, `POST /api/inquiries`, the health checks | the limits on each route (see the tables above), and the checks on the body |
| A visitor or a signed in person | the cart | no `Authorization` header is a visitor. A header with a token that is not good is `401`, never taken for a visitor |
| A signed in person | `/api/users/me...`, the checkout and the orders, a request for a quote, merging the cart | `401 UNAUTHENTICATED` without a good token, `401 TOKEN_EXPIRED` when it ran out. Records of somebody else are `404` |
| A business account | sending and listing quote requests, the business details | `403 FORBIDDEN` for a retail account |
| An admin | the dashboard and the orders of everybody (`/api/admin/...`), the list of inquiries, the status of a quote request | `403 FORBIDDEN` for anybody else |
| The team (an admin, or the staff key) | `/api/staff/...` | the key is compared in constant time. With no key, an admin token is needed |

Only the `Authorization: Bearer` header is a login. A token in a cookie or in the address is ignored, and the refresh cookie only reaches `/api/auth`. The role and the type of account are in the access token, so a change of role (an admin who is made a user) works when the token is renewed, at most 15 minutes later.

## Error codes

Every error has the shape `{ error: { code, message, details } }`, and the page decides what to say from the `code` (the `message` is in English, for the log and for a developer). `details` is a list of `{ field, message }` for `VALIDATION_ERROR`, and has `available` for `INSUFFICIENT_STOCK`.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `CART_EMPTY`, `INVALID_JSON`, `WRONG_PASSWORD`, `RESET_LINK_INVALID`, `INVALID_TRANSITION`, `INVALID_UPLOAD`, `INVALID_FILE_NAME`, `TOO_MANY_FILES`, `UNEXPECTED_FILE_FIELD` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` (renew it and try again), `SESSION_EXPIRED` (the refresh cookie is not good: sign in again), `INVALID_CREDENTIALS` |
| 402 | `CARD_DECLINED`, `INSUFFICIENT_FUNDS` (the made up payment service refused the card) |
| 403 | `FORBIDDEN` (also a change that came from another website) |
| 404 | `NOT_FOUND`, `FILE_NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `ADDRESS_LIMIT`, `SKU_TAKEN`, `SLUG_TAKEN`, `INSUFFICIENT_STOCK`, `CART_FULL`, `CART_BUSY`, `CART_CHANGED`, `ORDER_CHANGED`, `REQUEST_CHANGED` |
| 413 | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` |
| 429 | `RATE_LIMITED`, `TOO_MANY_ATTEMPTS` (a locked account) |
| 500 | `INTERNAL_ERROR`: nothing else is said, the real error is in the log with the id of the request (`X-Request-Id`) |
| 503 | `DATABASE_UNAVAILABLE` |

## Shop API

The products and their stock live in MongoDB. Load the seven products of the shop with `pnpm seed` (from `backend`). It is safe to run again: a product is found by its slug and gets its text back as it is in `backend/src/seed/products.seed.ts`, and the stock numbers of products that already exist are not touched.

How the data is kept: every text a shopper reads is stored in English and Spanish, prices are whole cents (`1200` is $12.00), and the stock is a separate document for each product (the `Inventory` model), so changing the stock never rewrites the product. Slug and SKU are unique.

The language of a request is, in this order: `?lang=en|es`, then the best of English and Spanish in `Accept-Language`, then English. A text that is missing in Spanish comes back in English. Answers that depend on the language carry `Vary: Accept-Language`.

| Request | What it does |
|---|---|
| `GET /api/products` | the list, `{ items, page, limit, total }`. Filters: `q` (a part of a name or country, any case, with or without accents, read as text and never as a pattern), `origin`, `category` and `notes` (lists with commas, a product matches any note), `minPct`, `maxPct`, `featured`. `sort` is `featured` (the default), `price_asc`, `price_desc`, `pct_desc` or `newest`. `page`, and `limit` (12 by default, 48 at most). A bad value is a `400` that names the field |
| `GET /api/products/:slug` | one product: `{ product }`, or `404` |
| `GET /api/products/:slug/related` | up to 4 products of the same category or origin, `{ items }` |

Each product has `id`, `slug`, `sku`, `name`, `caption`, `tastingSummary`, `imageAlt`, `farm`, `description`, `origin`, `originName`, `percentage`, `category`, `price` (cents), `notes`, `thumbnail`, `images`, `batchCode`, `harvestMonth`, `roastMonth`, `featured`, `stock` (units left) and `availability` (`in_stock`, `low` or `out`; low is at or under the threshold of the product, 10 by default). The shop lists can be kept by a cache for 30 seconds.

The team (an admin token, or the key in `STAFF_API_KEY` sent as `X-Staff-Key`) works on the whole product, in both languages:

| Request | What it does |
|---|---|
| `GET /api/staff/products` and `GET /api/staff/products/:id` | every product, also the ones that are switched off |
| `POST /api/staff/products` | makes a product. `quantity` is the stock it starts with. `409 SLUG_TAKEN` or `409 SKU_TAKEN` when one is used |
| `PATCH /api/staff/products/:id` | changes parts of a product. `active: false` takes it out of the shop. The stock is not one of the parts |
| `PUT /api/staff/products/:id/inventory` | `{ quantity, lowStockThreshold? }` |

These bodies are strict: a field that a product does not have (the id, the dates, the search text) is a `400`, and a price that is not whole cents, an image that is not an `https` address, a note that does not exist and so on are refused with the field named.

## Cart API

A cart works for a signed in user and for a visitor. A user's cart belongs to their account, so it follows them to any device. A visitor's cart belongs to a random id in a signed cookie called `sc_guest` (`HttpOnly`, `SameSite=Lax`, `Secure` in production). It is made with the first item, every change gives it 30 more days, and MongoDB removes it by itself after that. A cookie that was made up or changed is not in the signed cookies, so it never reaches somebody else's cart.

| Request | What it does |
|---|---|
| `GET /api/cart` | `{ cart: { lines, itemCount, subtotal, updatedAt } }`, with the names in the language of the request. Looking at an empty cart makes no cookie |
| `POST /api/cart/items` | `{ kind: "product", productId, quantity? }` or `{ kind: "sampler", productIds: [4 to 6 different ids], quantity? }`. The same item again adds to its line |
| `PATCH /api/cart/items/:lineId` | `{ quantity }` |
| `DELETE /api/cart/items/:lineId` | takes a line out |
| `DELETE /api/cart` | empties the cart |
| `POST /api/cart/merge` | a signed in user: adds the visitor's cart (the cookie) to the user's cart, then removes it and the cookie |

Rules the server keeps, whatever the client sends:

- **The price is locked.** A line keeps the price of the day it was added (`unitPrice`, in cents). A later price change does not change it, and the line says `priceChanged: true`. A client cannot send a price: a body with one is a `400`.
- **Stock.** A line can have as many units as there are in stock, counting what the other lines take of the same product (a sampler takes one of each of its products for each unit). More than that is `409 INSUFFICIENT_STOCK` and `details[0].available` says how many there can be. A line has at most 99 units and a cart at most 30 lines (`409 CART_FULL`).
- **What is wrong with a line.** Every line says how many units it can have now (`available`) and `issue`: `over_stock` (the stock fell under the quantity), `out_of_stock` or `unavailable` (the product was switched off). Nothing is removed behind the back of the shopper, the page decides what to do.
- **Merge.** Quantities of the same item are added (up to the stock, at least one), the prices that were already in the user's cart stay, and no line is lost. Doing it again changes nothing.
- **Changes at the same moment.** Every cart has a version, and a change is only saved if nobody saved one in between. The loser reads again and tries again, so two tabs never lose each other's change (`409 CART_BUSY` after five tries).
- A request with a token that is not good, or ran out (`401 TOKEN_EXPIRED`), is refused and never taken for a visitor's. A request with no token at all is a visitor's. No answer is kept by a cache.

## The shop in the frontend

- **Checkout** (`/checkout`, for a signed in person: a visitor is sent to sign in and comes back). The cart, the ways to ship with their prices and the tax come from `GET /api/checkout`, and the page never works out a price (the total beside the button is the subtotal plus the shipping that was chosen plus the tax of the server). The three steps are the addresses (the default one is chosen to begin with, and a new one can be added without leaving the page), the delivery and the card. The card is checked in the page first (number, date, code), and then by the server, and a problem it names is shown on its field. The place order button is in the summary and belongs to the form of the card with the `form` attribute, because the address form is a form too and forms cannot be nested. The page ignores a second press while an order is on its way, and the server makes one order for one cart.
- **Orders** (`/account/orders` and `/account/orders/:id`). The list adds ten orders at a time. The page of an order says thank you right after a purchase, shows the steps that happened with their dates, and offers to cancel while the order is just paid. The profile page links to both.

The pages never show a product they do not have from the server, and never show an empty shop as if it were a real one.

- **Products.** `ProductsProvider` reads the products once for the language of the page (and again when the language changes), and the shop, the product page, the sampler, the search box and the home page read them from it. While they are on their way a page says it is loading, and when they cannot be loaded it says so and offers "Try again". A product page says "not found" only after the products have loaded and the address is not one of them. The filters work on the products that were loaded, and an origin in the address that the shop does not have is left out.
- **Cart.** `CartProvider` reads the cart from the server and sends each change one after the other, so quick clicks reach the server in the order they were made. Every answer is the whole cart, and the page shows that and nothing else. When a change fails the cart stays as it was and the page says why. When the stock is smaller than the quantity the page adds what fits and tells the person how many there are. A line that cannot be bought (sold out or switched off) shows why and can only be removed.
- **Sign in and out.** The cart is read again when somebody signs in or out. At a sign in the visitor's cart is added to the account's cart.
- **Contact form and newsletter.** Both send an inquiry (`POST /api/inquiries`). The page says that the message was sent only when the server accepted it, keeps what was written when it did not, and shows a problem on the field that the server names.
- **In the tests.** `src/test/fakeServer.ts` is a stand-in for the backend with the same paths, status codes and error codes (products, cart, inquiries and accounts), and every unit test talks to it unless the test says otherwise. The browser tests use the same stand-in through `mockShopApi` in `e2e/helpers.ts`.

## Checkout and orders API

A signed in person buys what is in the cart of their account. The page sends only an address, a way to ship and a card: the lines, the prices and the totals all come from the server, and a body that carries any of them is a `400`.

| Request | What it does |
|---|---|
| `GET /api/checkout?shipping=standard` | `{ cart, shippingOptions, shipping, totals, ready }`: the cart as the server holds it, what each way to ship costs for it, and `totals: { subtotal, shipping, tax, total }` in cents. `ready` is false for an empty cart or one with a line that cannot be bought |
| `POST /api/orders` | `{ addressId, shippingMethod: "standard" \| "express", payment: { cardNumber, expiry: "MM/YY", cvc, nameOnCard }, note? }`. Makes the order: `201 { order }` |
| `GET /api/orders` | the orders of the person, newest first: `{ items, page, limit, total }` |
| `GET /api/orders/:id` | one order. An order of somebody else is `404`, the same as one that does not exist |
| `POST /api/orders/:id/cancel` | cancels an order that is still just paid (nobody started to pack it): the stock goes back and the payment is given back |

What the server does when an order is placed, in this order, and each step only starts when the one before it worked:

1. The address has to be one of the person's saved addresses (`404` otherwise), and the cart has to have something in it (`400 CART_EMPTY`) and nothing sold out or switched off (`409 CART_CHANGED`).
2. The stock is taken out of the shop for all the lines at once. When one product has fewer than the cart needs, nothing is taken and the answer is `409 INSUFFICIENT_STOCK`. Two shoppers cannot get the last unit: the update only matches while there are enough.
3. The card is charged by the payment service. When it says no the stock goes back (`402 CARD_DECLINED` or `402 INSUFFICIENT_FUNDS`, or `400` with the field `cardNumber`, `expiry` or `cvc` for a card that is not good).
4. The order is saved with a copy of everything that mattered on the day (the names and prices of the lines, the address, the shipping, the last four digits of the card), and the cart is emptied. A later change of a price or of an address never changes an order that was paid.

The same cart is one order. Two presses of the button at the same moment give the same order (the second answer is `200`) and charge once. A press after the order was made finds an empty cart (`400 CART_EMPTY`). Placing an order has a limit of 20 tries in 15 minutes for each person, and a try that fails counts, so the route cannot be used to test card numbers.

What an order costs (`backend/src/services/pricing.ts`, the only place with these rules): standard shipping is $5.95 and free from $60.00 of products, express is $14.95, and the tax is 8.25% of the products. All money is in whole cents.

**The payment is made up.** `backend/src/services/payment.service.ts` stands where a real payment service (Stripe, for example) would stand, and nobody is charged. It checks the card like a real one would (the number has to pass the Luhn check, the card must not be out of date, the security code has 3 digits or 4 for American Express). Test cards: `4242 4242 4242 4242` works, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has not enough money. The number and the security code are never saved and never written to the log (the logger hides them): an order keeps only the brand, the last four digits and a reference. To use a real service, write another payment object with the same two calls (`charge` and `refund`) and give it to `createOrderService`.

An order has a status: `paid` when it is made, then `processing`, `shipped` and `delivered`, one step at a time, set by the team. It can be `cancelled` until it is shipped. A cancelled order puts the stock back and marks the payment as `refunded`. The customer gets an email when the order is paid and another when it is shipped, in the language of the account (with `SMTP_HOST` empty they are only written to the log).

## Admin API

For admins only, with their access token (no staff key, because these answers show customers). Make an admin with `pnpm create-admin`.

| Request | What it does |
|---|---|
| `GET /api/admin/stats` | `{ orders, revenue, averageOrder, byStatus, today: { orders, revenue }, customers, products, lowStock: [...], recentOrders: [...] }`. The revenue leaves out cancelled orders |
| `GET /api/admin/orders?status=&q=&page=&limit=` | every order, newest first. `q` is a part of the number, the email or the name |
| `GET /api/admin/orders/:id` | one order, with the customer |
| `PATCH /api/admin/orders/:id` | `{ status }`. `400 INVALID_TRANSITION` for a step that is not allowed, `409 ORDER_CHANGED` when somebody else moved it first. Cancelling puts the stock back |

The products and their stock are changed with the staff routes (`/api/staff/products`, which also take an admin token), the inquiries with `/api/inquiries` and the quote requests with `/api/b2b/requests`. The dashboard of the website uses them as they are.

## B2B quotes

A company asks for custom chocolate in the Corporate Cacao Studio. The studio sends one multipart form to the backend, the wholesale address gets an email, and the company follows its request in "My quote requests". This section is about the backend side: sending a request, the files, where they are kept and the status of a request.

### Sending a quote request

A business account sends a quote request from the Corporate Cacao Studio as one multipart form: the text fields and up to 5 brand files.

`POST /api/b2b/quote` needs a business account, which means a token with `accountType: "b2b"`. A guest gets `401` and a retail account gets `403`. Each user can send 10 requests per hour, then it is `429`. Every request counts, also one that was refused, because even a refused one can carry big files.

| Field | Notes |
|---|---|
| `cacaoProfile` | text, up to 60 characters. The studio sends the name of the card, like `Ecuador 72%` or `Custom blend` |
| `packagingType` | `foil_wrap`, `rigid_box`, `specimen_card` or `paper_sleeve` |
| `quantityEstimate` | a whole number, from 1 to 10,000,000, written with digits only (`800`, not `1e3` or `0x20`) |
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

The answer is `201 { "request": { ... } }` with the saved request (status `submitted`, no quote yet) and the stored name of each file. Mistakes come back in the same error shape as the inquiries (see the table below). A request is either saved with all its files or not at all: if anything fails after the files were stored, they are deleted again. The wholesale address gets an email about each new request, and if that email fails the request still works.

Until the account code exists, the company, contact name and email are read from the `users` collection (`name`, or `firstName` and `lastName`; `companyName` or `b2bProfile.companyName`; `email`). Those field names are a guess and will be replaced by the real profile code.

### Files

The brand files go in the field `brandAssets`, the same field name for each file. A file is only accepted when three things agree: its extension, the type the browser says it is, and its first bytes. So a program that was renamed `invoice.png` is refused, and so is a real PNG sent as `application/pdf`.

| Kind | Extension | The file has to start with |
|---|---|---|
| PDF | `.pdf` | `%PDF-` |
| Illustrator | `.ai` | `%PDF-` (newer files) or `%!` (older files, which are PostScript) |
| EPS | `.eps` | `%!` |
| PNG | `.png` | the 8 bytes every PNG starts with |

The limits:

- At most 5 files, 50 MB each, and no file that is empty. The numbers come from `MAX_UPLOAD_FILES` and `MAX_UPLOAD_MB` in `.env`.
- Up to 20 text fields in the form, and no text field bigger than 1 MB. A JSON body (which only works when there are no files) can be up to 100 KB.
- If one file of the request is not good, none of them is stored, and `details` of the error lists every bad file with its name and code.

The name a person gave a file is only used to show it and as the name of the download, never as a place on the disk. Folders are cut off, control characters and the hidden marks that change the direction of text are taken out (they can make the end of a name be drawn backwards, so it looks like it ends in another extension than it really does), and a name over 100 characters is shortened, keeping its extension. The file itself is stored under a random name with the same extension, like `0b73ddeb-b341-4dc6-b260-f8bf2fee61b8.pdf`.

What can go wrong when a request is sent:

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | a text field is not valid. `details` has a message for each field |
| `400` | `UNSUPPORTED_FILE_TYPE` | the extension or the type is not one of the four |
| `400` | `FILE_CONTENT_MISMATCH` | the file does not start the way its extension says |
| `400` | `EMPTY_FILE` | the file has no bytes |
| `400` | `TOO_MANY_FILES` | more than 5 files |
| `400` | `UNEXPECTED_FILE_FIELD` | a file in another field than `brandAssets` |
| `400` | `INVALID_UPLOAD` | the form is cut off or broken, has more than 20 text fields, or has a text field that is too big |
| `401` | `UNAUTHENTICATED` | no token, or one that is not good |
| `403` | `FORBIDDEN` | a signed in user who has no business account |
| `413` | `FILE_TOO_LARGE`, `PAYLOAD_TOO_LARGE` | a file over the limit, or a JSON body over 100 KB |
| `429` | `RATE_LIMITED` | more than 10 requests in an hour |
| `503` | `DATABASE_UNAVAILABLE` | the server cannot reach the database |

### Where the files are kept

`UPLOAD_DIR` in `.env` is the folder for the files. The default is `./uploads`, and the folder is made the first time a file is saved.

- It is relative to the folder where the server was started, so with `pnpm dev` inside `backend` it is `backend/uploads`. Give an absolute path when the server is started from somewhere else, or when the files should live outside the project, which is the better choice on a real server, on a disk that is backed up.
- While a form is being read, its files wait in `UPLOAD_DIR/tmp`. They are moved into the folder once every file has passed, and removed when the request fails or the person leaves.
- Git ignores it. `.gitignore` has `uploads/`, which matches a folder with that name anywhere in the project, so `backend/uploads` is never committed. A test asks git itself, and also checks the folder that `.env.example` gives. If you choose another folder inside the project (say `data/brand-files`), add it to `.gitignore` yourself.
- It is not public. No route serves the folder, and a test tries a list of addresses (`/uploads/...`, `/api/uploads/...`, the folder itself, the temporary folder, with GET, HEAD and OPTIONS) and expects a `404` for each. The only way to get a file is the download route in the next part, with the token of the owner of the request or an admin.
- Nothing deletes a file after the request was saved. The API has no way yet to remove a request or its files, so on a real server the folder only grows.

### The status of a request

A request starts as `submitted`. An admin moves it on with `PATCH /api/b2b/requests/:id`, and the owner sees the new status in "My quote requests".

```
submitted --> quoted --> approved
    |            |
    |            +-----> rejected
    +------------------> rejected
```

| From | Can move to |
|---|---|
| `submitted` | `quoted` or `rejected` |
| `quoted` | `approved` or `rejected` |
| `approved` | nothing, it is final |
| `rejected` | nothing, it is final |

Any other change, also to the same status, is `400` with the code `INVALID_TRANSITION`, and the message says where the request can go. `quoted` needs a `quoteAmount`, a whole number of cents (`125000` is 1,250.00), which is set once: the other statuses do not take one, and the amount stays on the request. A `quoteNote` can come with any change. If two admins change the same request at the same moment, one of them wins and the other gets `409`.

### Reading and changing the requests

| Request | Who | What it does |
|---|---|---|
| `GET /api/b2b/requests` | business account | the user's own requests, newest first: `?page=1&limit=20` (up to 100). Answers `{ items, page, limit, total, totalPages }` |
| `GET /api/b2b/requests/:id` | the owner or an admin | one request, as `{ "request": { ... } }` |
| `GET /api/b2b/requests/:id/assets/:storedName` | the owner or an admin | the file, as a download with the name it was uploaded with |
| `PATCH /api/b2b/requests/:id` | admin | the new `status`, and with a quote the `quoteAmount` in cents and a `quoteNote` |

- A guest gets `401`. The list is for business accounts, so a retail account gets `403` there. Changing a status is for admins only: everybody else gets `403`, also the owner of the request.
- Somebody else's request answers `404`, exactly like a request that does not exist, so nobody can find out which ids are in use. The same goes for a file name that does not belong to that request. An id that is not 24 letters and numbers is a `400`.
- The files are never public. The download route needs the owner's or an admin's token. It is sent with `Content-Disposition: attachment`, so the browser saves it and does not open it, with `X-Content-Type-Options: nosniff`, and with `Cache-Control: private, no-store`. A stored name in the response is only a name: it does not tell where the file is kept.
- If a stored file cannot be read, the answer is the standard `500`, not a file and not a dropped connection. If it breaks in the middle of a download, the connection is ended and the server goes on.

Try it with an admin token (from the `backend` folder, same command as for the inquiries) and the id from the quote request answer:

```
curl -H "Authorization: Bearer <business token>" "http://localhost:4000/api/b2b/requests?limit=5"
curl -X PATCH http://localhost:4000/api/b2b/requests/<id> \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{ "status": "quoted", "quoteAmount": 125000, "quoteNote": "Includes shipping." }'
curl -OJ -H "Authorization: Bearer <business token>" http://localhost:4000/api/b2b/requests/<id>/assets/<storedName>
```

The last one saves the file under its original name (`-OJ` reads it from the header). There is no email to the customer yet when a request is quoted.
