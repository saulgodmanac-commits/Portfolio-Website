# Dakunesu' Workplace

A static one-page site for digital services. No build step, no dependencies —
open `index.html` in a browser and it runs.

## Editing the site

Everything on the page comes from one file: **`assets/js/content.js`**.

1. `SITE` at the top — name, role, status, location, bio, email, social links.
2. `WORKS` — your scripts. These are what the yin-yang button reveals.
3. `SERVICES` — what people can hire you for. Sits below the scripts.

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
