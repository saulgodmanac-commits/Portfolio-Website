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

Prices are written once, as euros, and are the same figure in both languages —
only the wording around them changes (`From €5` / `Від €5`). Dates under
reviews follow the chosen language, not the visitor's browser.

To add a third language, copy a whole block in `TEXT`, translate it, and add a
button to the switch in `index.html` with the matching `data-lang` code.

## Euros and dollars

The switch beside the language buttons shows every price in euros or in US
dollars. **Euros are the default and stay the default** — they are what you
invoice, and a dollar figure is only ever a conversion. A visitor's choice is
remembered for their next visit.

Two settings in `SITE`, at the top of `content.js`:

```js
liveRate: true,     // look up today's rate when someone asks for dollars
usdPerEur: 1.15,    // used until that arrives, and if it can't be reached
```

With `liveRate` on, the rate comes from the European Central Bank's daily
figures (`api.frankfurter.dev`), fetched **once, and only at the moment a
visitor actually presses `$`**. Anyone who stays in euros never causes that
request. Dollars appear instantly at the fixed rate above and correct
themselves a moment later if the live one differs.

Set `liveRate: false` to never go to the network, and keep `usdPerEur` roughly
current by hand.

Dollar figures are **rounded to whole dollars** — the rate moves daily, so
showing cents would claim a precision this doesn't have. While dollars are on
screen a line under *Services* says so, and says that the invoice is in euros.
That sentence is `usdNote` in both `ui` blocks. Don't delete it: a converted
number sitting next to a service with no explanation reads as a quote, and in
the EU an unclear price is a real problem, not a stylistic one.

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

### Who may leave a review

**A review now requires a confirmed email address.** The visitor types theirs,
Supabase mails a six-digit code, they type it back, and the token that comes
out of that is what signs the insert. They never leave the page.

This is not a form field that asks nicely — the database refuses any insert
that isn't signed by a verified account, so posting straight to the API with
the anon key gets turned away. One account gets one review, and a person can
delete their own review and write another.

**You must run this SQL, or nobody will be able to post at all.** Open
**SQL Editor** in Supabase:

```sql
-- Remove the review left by mistake while this was being built.
delete from public.reviews
where id = 'fe461854-4240-493f-95e7-7289be51ba69';

-- Tie a review to the account that wrote it.
alter table public.reviews
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- One account, one review. Existing rows have no account and are left alone,
-- because Postgres lets a unique index hold any number of nulls.
create unique index if not exists reviews_one_per_user
  on public.reviews (user_id);

-- Anyone may read — INCLUDING signed-in visitors. The original "public read"
-- policy is scoped to the anon role, and a signed-in visitor is a different
-- role ('authenticated'), so without this they cannot read the table at all.
-- That breaks posting, not just reading: an insert returns the new row, and
-- RLS checks the read side of that too. Policies are OR'd, so this adds to
-- the existing one rather than replacing it.
create policy "authenticated read" on public.reviews
  for select to authenticated using (true);

-- Only a verified account may post, and only as itself.
drop policy if exists "public insert" on public.reviews;
create policy "verified insert" on public.reviews
  for insert to authenticated
  with check (auth.uid() = user_id);

-- A person may delete their own review, and nobody else's.
drop policy if exists "own delete" on public.reviews;
create policy "own delete" on public.reviews
  for delete to authenticated
  using (auth.uid() = user_id);
```

**Then make the code appear in the email.** By default Supabase's magic-link
template sends a *link*, not a code, and the box on the page will never
accept anything. Go to **Authentication → Email Templates → Magic Link** and
make sure the body contains the token, for example:

```html
<h2>Your code</h2>
<p>Enter this code to leave your review:</p>
<p style="font-size:24px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
<p>It expires in an hour. If you didn't ask for this, ignore this email.</p>
```

`{{ .Token }}` is the six digits. Without it in the template, nothing arrives
that the form can use.

**The free email quota is small.** Supabase's built-in mailer is meant for
development and allows only a handful of messages an hour across the whole
project. That is fine while reviews trickle in. If you ever ask a group of
clients for reviews on the same day, most of them will silently get no code —
so before that, add your own SMTP under **Authentication → Emails → SMTP
Settings** (Resend, Postmark and Brevo all have usable free tiers).

**What this costs you.** Asking for an email loses you some reviews — a
willing client who can't be bothered to check their inbox just closes the tab.
That is the trade. What you get is that every review on the page came from a
reachable human, which is worth more to the next client reading it than a
larger number of reviews nobody can vouch for.

### Keeping spam out

There are two layers, and only one of them matters.

**In the browser** (already working, nothing to do): a hidden honeypot field,
a three-second trap timed from the moment the form becomes reachable, and
checks that reject web addresses and single-character gibberish.

That timing is the whole point of the trap and it was wrong for a while: it
measured from page load, which is minutes earlier than the form appearing now
that there is an email step in front of it. The window had always closed
before anyone could type, so the check never once fired.
There is no per-browser cooldown any more — a verified address and one review
per account do that job properly, and in the database rather than in a
`localStorage` value anyone can clear.

**On Supabase** (you must run this): the browser checks stop the ordinary
nuisance and tell an honest person what's wrong, but anyone willing to post
straight to the API skips every one of them. These rules cannot be skipped,
because they run on Supabase's server. Open **SQL Editor** and run:

```sql
-- No web addresses, in the review or the name. Spam sells something,
-- and selling needs a link. Bare domains are caught too, which is how
-- most of them slip past a naive http:// check.
alter table public.reviews drop constraint if exists reviews_no_links;
alter table public.reviews add constraint reviews_no_links check (
  comment !~* '(https?://|www\.|\y[a-z0-9-]+\.(com|net|org|ru|xyz|top|shop|info|biz|click|link|site|online)\y)'
  and name !~* '(https?://|www\.)'
);

-- A rate limit and a duplicate guard.
create or replace function public.reviews_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent int;
begin
  -- Five in ten minutes, site-wide. A real client posts one.
  select count(*) into recent
  from public.reviews
  where created_at > now() - interval '10 minutes';

  if recent >= 5 then
    raise exception 'Too many reviews just now, please try later'
      using errcode = 'check_violation';
  end if;

  -- The same words twice inside a day is a double-tap or a bot.
  if exists (
    select 1 from public.reviews
    where comment = new.comment
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'That review has already been posted'
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard
  before insert on public.reviews
  for each row execute function public.reviews_guard();
```

`security definer` is load-bearing: without it the count runs as the anonymous
visitor and row-level security could hide the very rows it needs to count.

**A trap in the same family, which cost a day.** `anon` and `authenticated` are
two different Postgres roles, and a policy granted `to anon` does *nothing* for
a signed-in visitor. A policy that reads "anyone may read" in the comment but
says `to anon` in the code is a lie you will not notice, because the review
list is fetched with the anon key and keeps working perfectly. What broke was
*posting* — an insert returns the new row, RLS checks the read side of that
return, and the whole request failed with nothing but a generic error. When a
policy misbehaves, check which **role** it names before anything else.

To loosen or tighten it, change the two intervals. If you ever get a burst of
legitimate reviews at once — say you ask a group of clients on the same day —
raise the `5` temporarily, or they will be turned away.

**What this does not stop.** A person determined to write one convincing fake
review by hand will get through, because nothing here can tell a real client
from a patient liar. If something rubbish lands, delete the row in
**Table Editor → reviews**. If it becomes a habit, the fix is approval before
publishing — see the note at the end of the next section.

### Things to know before you switch it on

- **The `anon` key is public.** It sits in the page source for anyone to read.
  That is how Supabase is designed to work, and it is safe *because* the
  policies above only permit reading and inserting. **Never** put the
  `service_role` key in this file — it ignores all policies.
- **Anyone with a working email address can post**, and a review appears the
  moment it is submitted. That is a much smaller door than it was, but it is
  still a door: a determined person with an inbox can post rubbish. To remove
  something, open **Table Editor → reviews** in Supabase and delete the row.
- **A reviewer can delete their own review** from the page, and only their
  own — the delete button appears on a review you wrote, and the policy above
  refuses the request regardless of what the page shows.
- If you later want reviews to wait for your approval, add an
  `approved boolean default false` column, change the read policy to
  `using (approved)`, and tell me — the front-end needs a one-line change.

### Translating a review

Clients write in whatever language they think in, and yours already arrive in
Ukrainian and English. Every review carries a small **Translate** button that
rewrites it into whichever language the site is currently set to; pressing it
again puts the client's own words back.

**Machine translation gets things wrong, and you should assume it will.** On
your own first review it turned "Не боїться підправити роботи свої" — *he
isn't afraid to correct his own work*, praise about you — into "Do not be
afraid to correct your work", an instruction aimed at the reader. Ukrainian
drops the subject where English needs one, and the engine guessed wrong.

So you can write the translation yourself, and it wins over the machine every
time. Add two optional columns:

```sql
alter table public.reviews add column if not exists comment_en text;
alter table public.reviews add column if not exists comment_uk text;
```

Then in **Table Editor → reviews**, fill in `comment_en` for a Ukrainian
review (or `comment_uk` for an English one). Where you have, the site uses
your words, makes no request to anyone, and labels it *Translated* rather than
*Machine translation*. Where you haven't, it falls back to the machine exactly
as before. The columns are optional — the site works without them.

**This is worth doing for the reviews you already have.** They are testimonials
about your work, they are the two an English visitor will read first, and one
of them currently says something you did not do.

Worth knowing before you rely on it:

- **Nothing is sent anywhere until a visitor presses the button.** The page
  makes no translation request on load. What gets sent is the review text —
  already published on this page for anyone to read.
- It goes to Google's public translation endpoint, and falls back to MyMemory
  if that fails. Both are free and unofficial, so both can go down. If they
  both fail the review is left exactly as written and the button says so.
  Nothing to fix if that happens; it usually comes back on its own.
- A translated quote is shown in italics and labelled **Machine translation**.
  Leave that label alone. Passing a machine's wording off as a client's own
  words is the kind of small dishonesty that costs you a client who notices.
- If the text is already in the language being read, it says so rather than
  repainting the same sentence.
- Translations are cached for the visit, so toggling back and forth is free.

The wording is in `ui` (`translate`, `showOriginal`, `translatedNote`,
`errTranslate`, `sameLanguage`). The providers are `viaGoogle` and
`viaMyMemory` in `main.js` — they are tried in order, so to add or replace one,
put it in that array.

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
price: 5, priceFrom: true,
tiers: [
  { label: "Up to 10 min", price: 5 },
  { label: "10–20 min",    price: 10 },
  { label: "20 min +",     price: 20 }
]
```

**Write prices as plain numbers of euros — `5`, not `"€5"`.** The site adds
the symbol itself, and it can only convert a price to dollars if it is given a
number to work on. A price written as text still renders, but it will be stuck
in euros whichever currency the visitor picks.

When you use tiers, add `priceFrom: true` so the collapsed row reads "From €5"
and is honest about it being a starting figure. Keep the ranges contiguous — a
gap like "5–10" then "15–20" leaves 11–14 minutes unpriced.

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

The nav's `backdrop-filter` blur barely registered when measured. It is the
one remaining per-frame cost on this page — a blur has to re-sample what is
behind it on every scrolled frame — so if scrolling ever feels heavy on a slow
machine, that is the next lever: drop the radius from 12px, or swap it for a
plain opaque `--bg-blur`.

**`background-attachment: fixed` is gone, and this note used to say keeping it
was the right call.** That was half right. Deleting the line on its own does
make things worse, because it also deletes the fixed positioning — the washes
start sliding and repeating down the page, and get repainted anyway. But a
fixed background on a *scrolling* element is one of the more expensive things
you can ask a browser for: the background has to stay put while the element
moves, so it is re-rasterised every frame. The answer was to move the washes,
not remove them. They now live on `.bg`, which is `position:fixed` already, so
they are painted once and simply held still while the page travels underneath.
Identical to look at, and nothing repaints while you scroll.

The general shape of that mistake is worth keeping: "we tried removing X and it
got worse" only rules out *removing* X. It says nothing about moving it.

A language switch does **not** rebuild the script rows. Their text is the same
in both languages, so only the labels around them swap, via `data-i18n` and
`data-subj-key`. Rebuilding them blocked the main thread for ~60ms on a slow
phone. If you add a translatable label inside a script row, give it a
`data-i18n` attribute — it will not be re-rendered into place.

Measured on a 6x-throttled CPU, all scripts expanded, ~18,000px page:
60fps scrolling on desktop and mobile, and every interaction under 30ms.

## The background

Three fixed layers on `body`: a soft highlight where the headline sits, a
deeper corner opposite it, and a linear fade underneath. All of it comes from
CSS variables, so the light and dark themes each get their own wash.

Because the layers are `fixed`, the light belongs to the *window*, not the
page — the deepest area is always the bottom of the screen, wherever you have
scrolled to. If you make the gradient stronger, re-check contrast against the
**painted pixels**, not the flat `--bg` value: the two are no longer the same.

The light theme needs care. A white wash on a near-white base is invisible —
the first attempt looked completely flat. It reads now because `--bg` sits
*below* white, so the top wash has somewhere to fall to. Resist making the
foot darker to get more contrast: the deep corner is where the small grey
labels live, and past about `.22` on `--wash-2` they drop under 4.5:1.
Measured, the deepest corner is ~`rgb(220,216,207)` and `--grey-dim` clears
it at 4.52:1 — there is very little headroom, so change one and re-measure.

## The background

Thin rings turning slowly behind everything, echoing the yin-yang. Black on
the light theme, white on the dark one, at prime periods (181s, 233s, 149s)
so they never return to the same arrangement. Markup is the `.bg` block at the
top of `index.html`; everything else is `.bg__ring` in the CSS.

The first attempt was three large soft gradient orbs, and it failed twice
over — invisible *and* slow. Both failures are worth remembering:

- **A big soft shape has to be faint to be safe over text, and once it is
  faint enough to be safe you cannot see it.** A hairline is the opposite: it
  covers almost none of a letter it passes behind, so it can be drawn at a
  strength that actually reads without moving any contrast floor.
- **A composited layer costs its AREA, not what you draw in it.** Three 78vmax
  orbs meant three ~1000px layers held on the GPU for the life of the page,
  pinned there by `will-change`. That was the whole of the reported lag.

So: no `will-change`, no `filter`, no animated `background-position`. Rotation
only, which needs no new raster — the compositor turns a layer it already has.
`contain: layout paint` keeps the rings out of the rest of the page's work.
If you add to this, keep to transforms and check the layer area first.

## A trap worth knowing

Each `.work` row builds its own stacking context, so a `z-index` inside a row
cannot rise above a *later* row. That is why the hover tooltip was getting a
line struck through it — the next row's 1px top border was painting over it.
The fix is `.work:hover{position:relative;z-index:5}`, lifting the whole row.
Anything else that needs to overflow a row will hit the same wall.

Here is a second one. `.reveal` elements start at `opacity:0` and are only
shown when the scroll observer marks them `is-in`. An element that was
`display:none` at the moment that observer ran **never intersects anything, so
it is never marked** — and unhiding it later leaves it invisible while still
taking up space. This bit for real: a visitor who arrived already signed in
and then signed out got a sign-in card that was there, occupied the layout,
and could not be seen or used. Anything you reveal by changing state rather
than by scrolling to it must be passed through `revealNow()` in `main.js`.
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

The `D` lettermark, in `assets/icons/`. To change it, replace those files
keeping the same names. `favicon-512.png` doubles as the image shown when the
link is pasted into a chat, so keep it square and legible when small.

Every icon link in `index.html` ends in `?v=2`. **Bump that number whenever you
replace the icons.** Browsers cache a favicon far longer than they cache a
page, and without a changed URL a returning visitor keeps seeing the old one
for weeks — which is exactly what makes people think the swap didn't work.
