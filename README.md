# Dakunesu' Workplace

A static one-page site for digital services. No build step, no dependencies —
open `index.html` in a browser and it runs.

## Editing the site

Everything on the page comes from one file: **`assets/js/content.js`**.

1. `SITE` — things that never change with language: your name, email, and
   which language a first-time visitor sees (`defaultLang`).
2. `WORKS` — your scripts. These are what the yin-yang button reveals.
3. `TEXT` — everything that *does* change with language, in two blocks:
   `TEXT.en` and `TEXT.uk`.
4. `REVIEWS` — hand-written reviews, used only when Supabase is switched off.

## Languages

The site is English and Ukrainian. The switch (`EN / UA`) sits in the top-right
and stays visible on the front door, before the yin-yang is pressed — otherwise
a Ukrainian visitor would have to read English to find it. The choice is
remembered in the browser, so a returning visitor gets their language back.

Each language block in `TEXT` has three parts:

- the words about you — `role`, `status`, `location`, `bio`, `about`, `description`
- `services` — the three services, fully translated including turnaround times
- `ui` — the wording of the interface itself: menu, headings, form, messages

**The two blocks must have the same shape.** If you add a line to `TEXT.en`,
add it to `TEXT.uk` as well, or that piece of text will come out blank when
someone switches.

**Your scripts are deliberately not translated.** They live in `WORKS`, outside
the language blocks, because they are the writing samples themselves — a client
hiring an English scriptwriter wants to read your English. The labels around
them (`Hook`, `Full script`) do translate.

Prices stay in euros in both languages — only the wording around them changes
(`From €5` / `Від €5`). Dates under reviews follow the
chosen language, not the visitor's browser.

To add a third language, copy a whole block in `TEXT`, translate it, and add a
button to the switch in `index.html` with the matching `data-lang` code.

## Reviews

The site has two review modes. It picks automatically.

**Without keys** (how it ships): the section shows the hand-written `REVIEWS`
list and a "Leave a review" button that emails you.

**With keys**: visitors post star reviews straight onto the page, App Store
style, and they appear immediately. This needs a free Supabase project.

### Turning on live reviews

1. Make a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your project and run this:

```sql
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 60),
  rating     int  not null check (rating between 1 and 5),
  comment    text not null check (char_length(comment) between 1 and 1000)
);

alter table public.reviews enable row level security;

-- Visitors may read every review, and add new ones. Nothing else.
create policy "public read"   on public.reviews for select to anon using (true);
create policy "public insert" on public.reviews for insert to anon with check (true);
```

3. Go to **Settings → API**. Copy the **Project URL** and the **`anon` public**
   key into `SUPABASE` at the top of `content.js`.
4. Push. The form appears by itself.

The checks in that SQL are the real protection: they run on Supabase's server,
where a visitor cannot reach them. The length limits and the rating range are
enforced there, not just in the browser.

### Things to know before you switch it on

- **The `anon` key is public.** It sits in the page source for anyone to read.
  That is how Supabase is designed to work, and it is safe *because* the
  policies above only permit reading and inserting. **Never** put the
  `service_role` key in this file — it ignores all policies.
- **Anyone can post.** You chose instant publishing, so a review appears the
  moment it is submitted. There is a hidden honeypot field that stops naive
  bots, but a determined person can still post rubbish. To remove something,
  open **Table Editor → reviews** in Supabase and delete the row.
- If you later want reviews to wait for your approval, add an
  `approved boolean default false` column, change the read policy to
  `using (approved)`, and tell me — the front-end needs a one-line change.

### Hand-written reviews

Used only while `SUPABASE` is empty:

```js
const REVIEWS = [
  { quote: "He rewrote my script in two days and it doubled my watch time.",
    name: "Marie L.", role: "YouTube creator", rating: 5 }
];
```

**Never invent these.** Made-up testimonials are the fastest way to lose the
trust of someone deciding whether to pay you, and publishing them is illegal
in the EU under the Unfair Commercial Practices Directive.

Each `{ ... }` block is one row. To add another, copy a block, paste it,
change the text. Order matters: the first entry is the first one shown, and
the number beside "Work" in the menu counts them automatically.

Prices show in the collapsed service row, so nobody has to click to find
out what something costs. A service can also carry a `tiers` list, rendered
as a small price table in its panel:

```js
tiers: [
  { label: "Up to 10 min", price: "€5" },
  { label: "10–20 min",    price: "€10" },
  { label: "20 min +",     price: "€20" }
]
```

When you use tiers, set the row `price` to "From €5" so the collapsed row is
honest about it being a starting figure. Keep the ranges contiguous — a gap
like "5–10" then "15–20" leaves 11–14 minutes unpriced.

For a script, only `title` and `description` are required.
For a service, only `title` and `summary`.
Every other field can be deleted and that part simply won't render.

In the `script` field, a line starting with `###` becomes a heading and
`**text**` becomes bold. Blank lines separate paragraphs. Long scripts get
their own scroll area so a single one can't swallow the whole page.

Every row gets an "Email me about this" button automatically, with the subject
line pre-filled — so you know what an enquiry is about before you open it.

## Downloads

Put anything you want visitors to download (a PDF price list, a portfolio)
into `assets/files/`, then link it from a service:

```js
links: [
  { label: "Download my rates", url: "assets/files/rates.pdf" }
]
```

Use lowercase filenames with hyphens instead of spaces. GitHub Pages is
case-sensitive where Windows is not, so `My Rates.PDF` will work on your
machine and 404 once published.

## Publishing to GitHub Pages

```bash
git init
git add .
git commit -m "Site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `root` → Save.**

The site appears at `https://YOUR-USERNAME.github.io/YOUR-REPO/` within a minute
or two. Every `git push` after that redeploys it.

To use your own domain, add it under Settings → Pages → Custom domain.

## Structure

```
index.html
assets/
  css/style.css      the whole design
  js/content.js      ← your content lives here
  js/main.js         intro animation, the button, the accordion
  files/             anything downloadable
```

## Notes

- The first screen is a door: name, role and the yin-yang. **Pressing the
  yin-yang is the only way in** — scrolling, swiping and the keyboard do not
  open the site. A "Press me" cue sits under the button.
  The menu stays visible so nobody thinks the page is broken, but a menu item
  pressed before entry does not open the site: it makes the yin-yang jump so
  the eye lands on it, and remembers which section was wanted so the first
  press goes straight there.
  Be aware of the trade-off: a client once reported the site was hard to
  navigate, which is why the menu is visible and the cue exists at all. If
  that feedback returns, the ways in are all in `bindEnter()` in `main.js`.
- Section order is Work, Reviews, Services, About. Reviews sit high on
  purpose: social proof lands before the price list.
- The palette lives in the CSS variables at the top of `style.css`. It is a
  light theme; swapping `--bg` and `--fg` (plus `--bg-blur`, `--glow` and
  `--ring`) is all it takes to go back to dark. The yin-yang is drawn with
  those variables rather than fixed colours, so it stays correct either way.
- There is no loading screen. On arrival the yin-yang falls in from above,
  overshoots slightly, bounces once and settles; its label fades in after it
  lands. The whole thing is CSS (`@keyframes yy-drop`), so nothing can hang
  waiting for JavaScript.
- `data-theme` is set by a small inline script in `<head>`, before the first
  paint. It has to stay inline and stay there — an external file arrives too
  late, and a dark-mode visitor gets a white flash.
- The whole page is built by JavaScript, so there is a `<noscript>` block with
  the email address and prices. If you change your address or rates, change it
  there too — nothing else updates it.
- Only Cormorant **300 and 400** are downloaded. Asking for 500 anywhere makes
  the browser fake a bold and it looks smeared; if you want a heavier serif,
  add the weight to the Google Fonts URL first.
- An open accordion panel is measured, then released to `max-height:none` when
  its transition ends. That handler is stored on the element and cleared on
  every toggle — without that, opening and closing quickly leaves a "closed"
  row fully expanded.

## Performance

The page scrolled badly once. Measuring — not guessing — found the cause: the
yin-yang's endless spin and the cue's travelling light kept running while the
hero was scrolled far out of view, so the compositor did invisible work on
every frame. The `is-away` class (set by an IntersectionObserver on the hero)
pauses them. **If you add another looping animation, pause it the same way.**

Two things that look like obvious culprits are not: removing
`background-attachment: fixed` made scrolling *worse* in testing, and the
nav's `backdrop-filter` blur barely registered. Measure before "optimising"
either of them.

A language switch does **not** rebuild the script rows. Their text is the same
in both languages, so only the labels around them swap, via `data-i18n` and
`data-subj-key`. Rebuilding them blocked the main thread for ~60ms on a slow
phone. If you add a translatable label inside a script row, give it a
`data-i18n` attribute — it will not be re-rendered into place.

Measured on a 6x-throttled CPU, all scripts expanded, ~18,000px page:
60fps scrolling on desktop and mobile, and every interaction under 30ms.
- The headline is sized against screen height as well as width, so the
  yin-yang button stays above the fold on short laptop screens. If you make
  the name much longer, check it still fits.
- Everything respects `prefers-reduced-motion`: animations are skipped for
  visitors who ask their system for that.
- The "Email me" buttons open **Gmail's compose window in a new tab**, with
  the recipient and subject already filled in. This works even for visitors
  who have no mail app installed — but a visitor who uses Outlook rather than
  Gmail will be asked to sign in to Google first.

  To use the visitor's own mail app instead, set `contactMethod: "mailto"`
  in `SITE` (top of `content.js`). That works for everyone who has a mail app
  configured, and does nothing at all for everyone who doesn't. Pick your poison.

  Either way, the address is also printed as selectable text in the About
  section, so it can always be copied by hand.

## The favicon

Lives in `assets/icons/`. To change it, replace those files keeping the same
names. `favicon-512.png` doubles as the image shown when the link is pasted
into a chat, so keep it square and legible when small.
