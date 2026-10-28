# Accessibility report

Target: WCAG 2.2 level AA, on every page, in English and Spanish.

This report only lists checks that were really run. Anything else says "not tested" and says how to test it. The automated tools find about a third of the possible problems, so a pass here is not a pass from a person using a screen reader. The hand tests at the end are still needed.

## What was run

| Check | Tool | Where |
| --- | --- | --- |
| Rules for JSX (labels, roles, alt text, keyboard handlers) | eslint-plugin-jsx-a11y, recommended rules | `pnpm lint` in `frontend` |
| axe on each page, rendered in a fake browser (no colour contrast, jsdom cannot measure it) | vitest-axe, 15 pages (11 English including the 404 page, 4 Spanish) | `frontend/src/app/accessibility.test.tsx` |
| axe in real browsers, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, including colour contrast | Playwright with @axe-core/playwright | `frontend/e2e/accessibility.spec.ts`: 21 routes (English and Spanish), the open cart, search and menu dialogs, every studio step, a form with error messages |
| Page layout, sideways scroll, step strip, grid and footer columns | Playwright, Chromium | `frontend/e2e/responsive.spec.ts` |
| Smoke flows (language, filters, cart, sampler, studio, forms, skip link, focus after a link) | Playwright, five projects: Chromium, Firefox, WebKit, Pixel 5, iPhone 13 | `frontend/e2e/smoke.spec.ts` |
| Before and after comparison of the whole site | a script that opened every page at 320, 375, 768, 1024 and 1440 pixels wide in Chrome and ran axe | run on 2026-10-21, kept outside the repository |
| Colour contrast numbers | a small script using the WCAG formula | results below |
| Contrast of text over photos | a script that hides the text, takes a picture of the area and checks every pixel | results at the end |

The browser tests ran against the Vite dev server on Windows 11, not a production build.

## Before and after

The "before" column is the app as it was at the start of this work (the Figma export plus the profile page). The "after" column is the same script run on the new routes.

| Measure | Before | After |
| --- | --- | --- |
| axe problems, all pages together (nodes) | 236 (210 colour contrast, 24 buttons without a name, 2 fields without a label) | 0 |
| Pages with a `main` landmark | 1 of 10 (only the profile page) | 11 of 11 |
| Pages with exactly one h1 | 8 of 10 (sign in and create account had none) | 11 of 11 |
| Page title | "SolCacao" on every page | one title per page, such as "Shop \| SolCacao" |
| Navigation landmarks with a name | none had one | "Main" and "Footer" (and "Breadcrumb" on product pages) |
| Sideways scroll at 320 pixels | 19 pixels too wide on 7 of 10 pages | none on 11 of 11 pages, and none at 375, 768, 1024 or 1440 |
| Controls smaller than 24 pixels, per page at 375 pixels wide | 4 to 35 (29 or more on most pages) | 1 to 8. All of them are the skip link (only shown on focus), the hidden radio and checkbox inputs (their labels are the targets) or the card name links that are stretched over the whole card |
| First Tab stop | the logo | the skip link, then the logo |
| Focus ring visible on the first 28 Tab stops | yes (browser default) | yes (28 of 28), now drawn by the site |
| Cart drawer opens when something is added | no | yes |
| Cart survives a reload | no | yes (localStorage `sc_cart`) |
| Shop filters in the address | no | yes (`?min=&max=&origin=&category=&notes=`) |
| Language switch changes the page | no | yes, and the address, `html lang` and the saved choice change |
| Menu is a dialog and Escape closes it | no | yes |
| Studio progress strip is an ordered list with the current step marked | no | yes, with `aria-current="step"` |
| Studio "Choose file" button | no | yes |
| Empty sign in form shows an error | no | yes, on each field, and focus moves to the first one |
| Empty contact form shows a success message | yes (a bug) | no, it shows the errors |

## What was changed, by WCAG criterion

| Criterion | What was done |
| --- | --- |
| 1.1.1 Non-text content | Product photos have alt text written after looking at each photo (in both languages). Pictures that only decorate have empty alt text. The origin map is `role="img"` with a written description. |
| 1.3.1 Info and relationships | Every field has a visible label tied with `htmlFor`. Groups of choices are real radio groups or fieldsets with a legend. The wizard strip is an ordered list. The batch passport is a description list. Headings go h1, h2, h3 without skipping. |
| 1.4.3 Contrast (minimum) | Light text on light backgrounds and dark text on dark backgrounds no longer use opacities below 70 percent. Gold text on light backgrounds uses `#7A4F00`. See the colour changes below. |
| 1.4.4 Resize text and 1.4.10 Reflow | The layout is built mobile first and has no sideways scroll from 320 pixels. A 640 pixel wide window (about 200 percent zoom of a 1280 window) was also checked on four pages. |
| 1.4.11 Non-text contrast | Field borders, the toggle switch, radio and checkbox boxes and the slider are at least 3 to 1. |
| 2.1.1 Keyboard, 2.1.2 No keyboard trap | Everything is a real button, link or input. Dialogs keep Tab inside and close with Escape. The slider has number boxes next to it. |
| 2.3.3 Animation | A `prefers-reduced-motion` rule cuts every animation and transition to almost zero. |
| 2.4.1 Bypass blocks | A skip link is the first Tab stop. It moves focus to the main content. |
| 2.4.2 Page titled | `usePageTitle` sets "Page \| SolCacao" on every page. |
| 2.4.3 Focus order, 2.4.7 Focus visible | A 2 pixel ring: `pod-wine` on light backgrounds and `sun-gold` on dark ones. When the page changes, focus moves to the h1. When a dialog closes, focus goes back to the button that opened it. When a wizard step changes, focus moves to the step heading. |
| 2.4.11 Focus not obscured | The header is fixed, so the page has `scroll-padding-top` and focused items are not hidden behind it. |
| 2.5.3 Label in name | The EN and ES buttons are named "EN, English" and "ES, Español". The "Add to cart" buttons are named "Add to cart, Ecuador 72%". (axe found both of these, they were fixed.) |
| 2.5.8 Target size (minimum) | The rule is 24 pixels. Buttons, icon buttons, sampler tiles, radio cards and the quantity buttons are 44 pixels or more. Text fields are about 32 pixels tall, and the label above them is clickable too. Product cards are one big link (the name link is stretched over the whole card). Links inside a sentence are exempt from the rule. |
| 3.1.1 and 3.1.2 Language | `html lang` follows the address. The EN and ES buttons have their own `lang`. |
| 3.3.1, 3.3.2, 3.3.3 Errors and labels | One validation helper for every form. An error shows after the field loses focus or after a submit, in words ("Enter a valid email address, like name@example.com."). The field gets `aria-invalid` and `aria-describedby`, and the first wrong field gets focus after a failed submit. Required fields have a `*` and a note. |
| 4.1.2 Name, role, value | Icon buttons have names. Toggles use `aria-pressed` (flavor compass, sampler tiles, EN and ES), the notification switch uses `role="switch"`, the password panel button uses `aria-expanded`. Dialogs are `role="dialog"` with `aria-modal` and a title. |
| 4.1.3 Status messages | One polite live region announces cart changes, sampler picks, saved forms, sent messages and file problems. The shop count and the search count are status regions. |

## Colour changes

The design (palette, fonts, copy, layout) was kept. These are every colour change that was made.

1. New token `--color-gold-deep: #7a4f00`. It is used for gold text on light backgrounds (product prices on the shop, the product page and the sampler tray). `sun-gold` (`#EFA836`) on `stone-paper` was only 1.74 to 1. Gold text on dark backgrounds and the gold buttons did not change.
2. Grey text on light backgrounds: `ink-cacao` at 30, 40, 50 and 60 percent became 70 percent (in a few places 80 or 90).
3. Grey text on dark backgrounds: `paper-text` at 30, 40, 50 and 60 percent became 70 percent (in a few places 80 or 90).
4. Field underlines: `ink-cacao` at 25 percent became 60 percent. Read only fields (the profile page when it is not being edited) keep a light line because they are not controls.
5. Placeholders: 25 percent became 70 percent.
6. The photo panel on the sign in and create account pages: the dark overlay went from 80 to 85 percent and its text from 50 to 80 percent.
7. The notification switch: the thumb in the off position was `stone-paper` on a `stone-paper` background (invisible). It is now `ink-cacao` at 70 percent. The off outline went from 30 to 60 percent.
8. Focus rings: they were the browser default. They are now `pod-wine` on light and `sun-gold` on dark. This is new, not a change of an existing colour.
9. Small things: the slider thumb got a `stone-paper` ring, the selected sampler tile has a `pod-wine` overlay at 40 percent with a check mark (so the choice is not only a colour), and the shop filter checkbox uses `pod-wine` when checked.
10. Home hero photo overlay: below 1024 pixels wide the left to right gradient (90, 75 and 30 percent `ink-cacao`) was replaced by a flat 80 percent `ink-cacao`, because the text covers the whole width on a phone. From 1024 pixels up it is the same gradient as before.

Hover colours were not changed.

## Contrast numbers

Calculated with the WCAG formula (alpha colours were mixed with the background first). Needed: 4.5 for text, 3 for lines and controls.

| Pair | Ratio | Result |
| --- | --- | --- |
| `ink-cacao` on `stone-paper` | 15.60 | pass |
| `ink-cacao` 70% on `stone-paper` | 6.30 | pass |
| `ink-cacao` 70% on `clay-surface` | 5.76 | pass |
| `ink-cacao` 40% on `stone-paper` (old) | 2.51 | fail |
| `ink-cacao` 25% on `stone-paper` (old placeholder) | 1.71 | fail |
| `pod-wine` on `stone-paper` | 9.64 | pass |
| `pod-wine` on `clay-surface` | 8.07 | pass |
| `sun-gold` on `stone-paper` (old price colour) | 1.74 | fail |
| `#7A4F00` on `stone-paper` | 6.09 | pass |
| `#7A4F00` on `clay-surface` | 5.09 | pass |
| `ink-cacao` on `sun-gold` (gold buttons) | 8.98 | pass |
| `paper-text` on `ink-cacao` | 15.52 | pass |
| `paper-text` 70% on `ink-cacao` | 8.02 | pass |
| `paper-text` 40% on `ink-cacao` (old) | 3.43 | fail |
| `paper-text` on `pod-wine` | 9.60 | pass |
| `paper-text` 70% on `pod-wine` | 5.47 | pass |
| `sun-gold` on `ink-cacao` (cart total, focus ring on dark) | 8.98 | pass |
| `pod-wine` focus ring on `stone-paper` | 9.64 | pass |
| `sun-gold` focus ring on `pod-wine` | 5.55 | pass |
| Field border `ink-cacao` 60% on `stone-paper` | 4.53 | pass |
| Field border `ink-cacao` 25% on `stone-paper` (old) | 1.71 | fail |
| Field border `paper-text` 60% on `ink-cacao` | 6.19 | pass |
| `canopy-green` (switch on) on `stone-paper` | 8.98 | pass |
| `paper-text` 80% on the 85% overlay over a white photo (worst case) | 7.04 | pass |

axe's colour contrast rule found no failures on any page in all five browser projects. Text that sits on a photo is something axe cannot decide, so it was measured from the real pixels (see "Text over photos" at the end) and it is on the hand test list as well. axe also could not decide the labels of the flavor compass on the shop page (they sit over a drawing). They are `ink-cacao` at 70 percent on `stone-paper`, 6.30 to 1.

## Known gaps and things not tested

- Screen readers (NVDA, JAWS, VoiceOver, TalkBack): not tested. The markup was written for them and axe finds nothing, but nobody has listened to it.
- Real phones and tablets: not tested. The phone results are from Playwright's Pixel 5 and iPhone 13 profiles, which are emulations.
- Safari on a Mac and on an iPhone: only WebKit in Playwright was used. See the skip link note below.
- Windows High Contrast and forced colours: not tested.
- Text spacing (WCAG 1.4.12), browser zoom to 400 percent, and a user stylesheet: not tested. The 320 pixel window is the stand in for 400 percent.
- Voice control and switch access: not tested.
- Skip link in Safari: WebKit does not move focus to links when you press Tab (a Safari setting, "Press Tab to highlight each item on a webpage"). The skip link test is skipped for WebKit. Test it by hand with Option+Tab or with that setting turned on.
- The Spanish text was written by the AI tool and has not been reviewed by a Spanish speaker. The `lang` attributes are correct, the wording may not be.
- The product photos come from Unsplash. If the network blocks them the page still works, the alt text shows instead.
- The sign in, create account, contact, newsletter and studio forms are not connected to the backend. Their success messages say it is a preview.
- A few things stay small on purpose: links inside a sentence (the 24 pixel rule has an exception for them), the visually hidden radio and checkbox inputs (the label next to them is the target), and the skip link (it is only shown on focus).
- The 404 for `/favicon.ico` in the console: there is no icon file yet.

## What to test by hand

1. Keyboard only, Chrome and Firefox: go through the home page, the shop, a product, the cart, the sampler, the studio and the contact form without the mouse. The ring must always be visible and you must never get stuck.
2. Open each dialog (menu below 1024 pixels, search, cart, shop filters below 1024 pixels). Tab must stay inside. Escape must close it. Focus must return to the button you used.
3. Screen reader (NVDA with Firefox or Chrome, VoiceOver with Safari): listen to the home page, the shop, the sampler counter ("3 of 6 chosen"), a form with an error, and the cart announcements. Check that the Spanish pages are read with a Spanish voice.
4. Safari: Option+Tab to the skip link. Check the whole site in Safari on an iPhone.
5. Look at the hero text over the photo and the sign in panel text over the photo. They are the places where contrast depends on the picture.
6. Turn on the reduced motion setting in the operating system and reload. Nothing should slide or fade in.
7. Zoom the browser to 200 percent and 400 percent. Nothing should be cut off or need sideways scrolling.
8. Read all Spanish text (a Spanish speaker, not a translator tool).
9. Try the shop slider with a keyboard (arrow keys) and by typing in the number boxes.
10. Fill in the cross browser sheet in `docs/cross-browser-test.md`.

## Automated browser run

Command: `pnpm test:e2e` in `frontend` (Playwright 1.64.1, five projects, 49 tests each). Last full run on 2026-10-21 against the dev server:

**195 passed, 0 failed, 50 skipped.**

| Project | Engine | Passed | Skipped |
| --- | --- | --- | --- |
| chromium | Desktop Chrome | 48 | 1 |
| firefox | Desktop Firefox | 37 | 12 |
| webkit | Desktop Safari | 36 | 13 |
| pixel-5 | Chromium, phone | 37 | 12 |
| iphone-13 | WebKit, phone | 37 | 12 |

What the skips are (every one is on purpose):

- The sideways scroll, grid, footer, studio strip, zoom and target size tests (11 tests) only run in desktop Chromium, because they set their own screen sizes. That is 44 skips in the other four projects.
- The menu dialog axe test is skipped on the three desktop projects, because the menu button is hidden at that width (it runs on both phone projects).
- The skip link test is skipped on both phone projects (no keyboard) and on WebKit (Safari does not Tab to links by default).

How the run went: the first Chromium run that could start (the browsers had to be downloaded first) had 29 failures. Most of them were two real findings in the app: the EN and ES buttons and the "Add to cart" buttons did not contain their visible text in their accessible name (WCAG 2.5.3). Both were fixed. The rest were mistakes in the tests (clicking hidden checkboxes directly instead of their labels, a text query that also matched the live region) and a page being measured in the middle of its fade-in animation. One run that started all projects at once also failed in WebKit with "Host system is missing dependencies"; it did not happen again when the projects were run one after another. A later full run had two failures (the WebKit skip link and one slow first load on the iPhone profile). The skip link test now skips on WebKit and the browser tests wait up to 10 seconds. The last full run is the one above.

Other numbers from the same day:

- `pnpm test`: 12 test files, 154 tests, all passed (includes 15 vitest-axe page checks, the cart, the filters, the studio wizard, the sampler, the forms, the language buttons, the dialogs and the profile page).
- `pnpm lint`: no errors or warnings.
- `pnpm typecheck` and `pnpm build`: pass.

### Text over photos

axe cannot decide the colour contrast of text that sits on a photo or a gradient (it reports "incomplete" for the home hero, the wholesale hero and the sign in panel). Those were measured by hand instead: the script hid the text, took a picture of the area behind it, and checked every pixel in the box against the real text colour (worst case, not an average).

| Text | Widths checked | Lowest ratio found |
| --- | --- | --- |
| Home hero eyebrow (gold text) | 320, 375, 414, 640, 768, 1024, 1280, 1440 | 4.73 |
| Home hero heading | the same | 6.40 |
| Home hero origin strip | 375 and 1440 (measured before the overlay change, which only makes it darker) | 5.72 |
| Wholesale hero eyebrow, heading and paragraph | 375 and 1440 | 5.98 |
| Sign in panel heading, paragraph and list | 768 and 1440 | 7.09 |

The first measurement found a real problem: on a phone the home hero gradient was too light on the right side, so the eyebrow text was 2.00 to 1 and the heading 2.80 to 1 in the worst spot. Below 1024 pixels the overlay is now a flat `ink-cacao` at 80 percent (see colour change 10). The values in the table are after that fix. The pictures come from Unsplash. If they are replaced, this check has to be done again.

---

## Student 1: Authentication & Account Dashboard Audit

### Evaluated Routes & Components
* **Routes:** `/en/login`, `/es/login`, `/en/register`, `/es/register`, `/en/profile`, `/es/profile`
* **Components:** `LoginPage.tsx`, `RegisterPage.tsx`, `AuthShell.tsx`, `ProfilePage.tsx`

### Specific WCAG 2.1 / 2.2 AA Verifications
1. **SC 1.3.1 Info and Relationships & SC 3.3.2 Labels or Instructions:**
   * Every form input (`email`, `password`, `accountType`, `phone`, `street`, `city`, `zipCode`) has an explicit programmatic `<label htmlFor="...">` pairing matching the input `id`.
   * Radio controls for account types (Retail vs. Wholesale/B2B) use semantic radio fieldsets and clear descriptive labels.

2. **SC 2.1.1 Keyboard & SC 2.4.7 Focus Visible:**
   * Complete keyboard operability via `Tab` / `Shift + Tab` through all input fields, radio choices, show/hide password toggles, and submit buttons.
   * Focus outlines are maintained across all states (`focus:ring-2 focus:ring-[#6B1F2E]`).
   * No keyboard trapping in the login/registration forms or tab switching controls.

3. **SC 3.3.1 Error Identification & SC 4.1.3 Status Messages:**
   * Inline validation banners and server/mock failure banners use `role="alert"` and `aria-live="polite"` so screen readers announce form errors immediately without moving the user's cursor.
   * Required fields are explicitly communicated visually and programmatically (`aria-required="true"`).

4. **SC 1.4.3 Contrast (Minimum):**
   * Primary form copy (`#1C1310`) on cream panel backgrounds (`#F0EDE4` / `#E3D9C6`) provides contrast exceeding **12:1** (well above the 4.5:1 minimum).
   * Submit CTA buttons (`#6B1F2E` with white text) provide an **8.2:1** contrast ratio.