# SolCacao

Grown in sunlight, crafted with intention.

SolCacao is an online shop for single-origin chocolate. It has two sides: a storefront for people who want bars and truffles, and a wholesale side where hotels, event planners and companies can ask for custom, branded orders and get a quote. The site works in English and Spanish.

It's a team project for CSE 5335 (Web Data Management) at UT Arlington, Fall 2026. The frontend is built and runs on its own, the backend has just been started.

## What works right now

- English and Spanish. Every page lives under `/en` or `/es`, and the EN and ES buttons keep you on the same page
- Home page, shop with filters (cacao percentage, origin, category, tasting notes) and product pages with a batch passport and origin story. The filters are kept in the address, so a filtered shop can be shared
- A cart in a dialog that is saved in the browser. Checkout isn't available, the button says so
- Wholesale page and the four step Corporate Cacao Studio form for business quotes, and a My quote requests page where a business account follows its requests. The wholesale page is open to everybody, the studio and the requests are for business accounts (see "Trying the studio" below)
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
| My quote requests (business accounts) | http://localhost:5173/en/account/requests |
| Backend health check | http://localhost:4000/api/health |

**Trying the studio.** There are no real accounts yet, so signing in is a preview: the form doesn't check anything, it only remembers the account type chosen above the form (retail or business) and the email, until you close the browser tab. The studio then works like this:

- Not signed in: the studio address sends you to the sign in page, and after you sign in you are back in the studio. The address of the sign in page carries the way back (`?next=/wholesale/studio`), and only a page of this site is followed.
- Signed in with a retail account: a message says the studio is for business accounts, with a link to create a business account (`/en/account/register?type=business` opens the form on the business choice).
- Signed in with a business account: the studio opens.

To try it, open the sign in page, choose Business account, type any email and password, and press Sign in. The check is only there to keep people out of a page they can't use.

The last step sends the request to the backend (`POST /api/b2b/quote`) as a multipart form, and shows how much of the files has gone up. The backend checks the account type again, with a token, and the preview sign in does not give one yet. Without it the studio says that the server does not know who you are, and keeps everything that was typed. To send a request for real, run the backend with a database, make a business token (the command is in the "B2B quotes" section below) and put it in the browser tab, from the developer console of the studio page:

```
sessionStorage.setItem("sc_token", "<token>")
```

Once there is a real sign in, it should put the token there by itself. A few more things to know:

- What was entered is kept in a draft in the browser tab, so a refresh brings it back. The files are not kept, so after a refresh the page lists the files to add again. The browser asks before the tab is closed with something unsent.
- The company and contact start from the name and company that were given when the account was created in this tab, when there are any.
- When the request is saved the page shows its reference (like `SC-1A2B3C4D`, the end of its id) and a link to that request in "My quote requests".

**My quote requests.** `/en/account/requests` is for business accounts (a guest signs in first and comes back, a retail account gets a short message). It lists the requests the account sent, newest first, each with its date, cacao profile, packaging, units and status (submitted, quoted, approved or rejected), and the amount once it was quoted. Choosing one opens its details on the right (below the list on a phone): the notes, the note from our team and the files that were sent. The chosen request is in the address (`?request=<id>`), so the link can be shared. The account page links to it too, for business accounts only.

- The page needs the same token as the studio (see above) to read the requests. Without it, it says that the server does not know who you are.
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
