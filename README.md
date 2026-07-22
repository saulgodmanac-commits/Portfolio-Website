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

Prices stay as `€5` / `€10` in both languages. Dates under reviews follow the
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

- The first screen is a door: name, role and the yin-yang. The sections
  below stay hidden until the visitor comes in — but the **menu is always
  visible**, a **Scroll** cue sits under the button, and **scrolling, swiping
  up, or pressing any menu item** opens the site just as the button does.
  An earlier version hid the menu too, and a client reported being unable to
  navigate; that is what these three extra ways in are for.
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
