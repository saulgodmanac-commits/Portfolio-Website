# Dakunesu' Workplace

A static one-page site for digital services. No build step, no dependencies —
open `index.html` in a browser and it runs.

## Editing the site

Everything on the page comes from one file: **`assets/js/content.js`**.

1. `SITE` at the top — name, role, status, location, description, bio, email, socials.
2. `WORKS` — your scripts. These are what the yin-yang button reveals.
3. `SERVICES` — what people can hire you for. Sits below the scripts.
4. `SERVICES_NOTE` — the one-line note under the Services heading.
5. `REVIEWS` — customer reviews, shown near the bottom.

## Reviews

`REVIEWS` starts empty, and the section shows an invitation instead of cards.
When a real customer sends you one, add it:

```js
const REVIEWS = [
  { quote: "He rewrote my script in two days and it doubled my watch time.",
    name: "Marie L.", role: "YouTube creator", rating: 5 }
];
```

`role` and `rating` are optional. **Never invent these.** Made-up testimonials
are the fastest way to lose the trust of someone deciding whether to pay you,
and they are illegal to publish in the EU under the Unfair Commercial
Practices Directive.

Visitors cannot post reviews themselves — this is a static site with no
database, so there is nowhere to store what they type. The "Leave a review"
button opens an email to you instead, and you paste anything good into the
file above. See the note at the bottom of this README if you want live
comments that visitors post directly.

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

- The first screen is a door: name, role and the yin-yang, nothing else.
  The menu, the scripts, the services, the About section and the footer are
  all hidden — and the page cannot even scroll — until the button is pressed.
- The headline is sized against screen height as well as width, so the
  yin-yang button stays above the fold on short laptop screens. If you make
  the name much longer, check it still fits.
- The intro has a fallback timer, so the loading screen can't get stuck if
  the page opens in a background tab.
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

## If you want visitors to post comments directly

This site has no server, so there is nothing to save a comment into. Real
commenting needs a third-party service that stores them for you:

- **Giscus** — free, comments stored as GitHub Discussions. Clean and ad-free,
  but it requires the repo to be **public**, and commenters need a GitHub
  account. Not a fit while this repo is private.
- **Disqus** — free, works on any static site, no repo requirements. Anyone
  can comment. The free tier shows ads to your visitors.
- **A form service** (Formspree, Tally) — visitors submit, it lands in your
  inbox, you publish what you choose. Closest to how the page works today.

Say the word and any of these can be wired in.
