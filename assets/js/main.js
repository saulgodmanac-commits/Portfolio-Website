(() => {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Anything from content.js goes through here before it touches the DOM. */
  const esc = (str) => String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* ================= language =================
     `L` always points at the current language block in TEXT.
     Everything that reads text goes through it, so switching is
     a matter of repointing L and re-rendering. */

  const STORE_KEY = "lang";
  const supported = (code) => Object.prototype.hasOwnProperty.call(TEXT, code);

  function startingLang() {
    let saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* private mode */ }
    if (saved && supported(saved)) return saved;
    return supported(SITE.defaultLang) ? SITE.defaultLang : "en";
  }

  let lang = startingLang();
  let L = TEXT[lang];
  const T = (key) => L.ui[key];

  /* ---------- fill in the details ---------- */
  function hydrate() {
    const set = (key, html) => $$(`[data-site="${key}"]`).forEach(el => { el.innerHTML = html; });

    set("name", esc(SITE.name));
    set("role", esc(L.role));
    set("status", esc(L.status));
    set("location", esc(L.location));
    set("bio", esc(L.bio));
    set("about", esc(L.about));

    // Static interface text, swapped by key. A missing key leaves the markup's
    // own fallback text alone rather than writing the word "undefined".
    $$("[data-i18n]").forEach(el => {
      const text = T(el.dataset.i18n);
      if (typeof text === "string") el.textContent = text;
    });
    $$("[data-i18n-ph]").forEach(el => {
      const text = T(el.dataset.i18nPh);
      if (typeof text === "string") el.placeholder = text;
    });

    // Every email link points at the same place, decided in one place.
    $$('[data-site="email-link"]').forEach(a => {
      a.href = contactHref(`${T("subjEnquiry")} — ${SITE.name}`);
      if (useGmail) { a.target = "_blank"; a.rel = "noopener"; }
    });
    // Per-row enquiry links: the subject is translated, the title is not.
    $$("[data-subj-key]").forEach(a => {
      a.href = contactHref(`${T(a.dataset.subjKey)} — ${a.dataset.subjTitle}`);
      if (useGmail) { a.target = "_blank"; a.rel = "noopener"; }
    });

    // The address in plain text, so it can always be copied by hand.
    $$('[data-site-text="email"]').forEach(a => { a.textContent = SITE.email; });

    const socials = (SITE.socials || [])
      .map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`)
      .join("");
    set("socials", socials);

    $("#year").textContent = new Date().getFullYear();
    $("#workCount").textContent = String(WORKS.length).padStart(2, "0");

    paintServicesNote();

    // The yin-yang label depends on whether the site has been opened.
    const opened = document.body.classList.contains("works-open");
    $("#enterLabel").textContent = opened ? T("entered") : T("enter");

    applyHints();

    document.documentElement.lang = lang;
    document.title = `${SITE.name} — ${L.role}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && L.description) meta.setAttribute("content", L.description);
  }

  /* Repoint L, redraw everything that holds text. */
  function applyLanguage(code) {
    if (!supported(code) || code === lang) return;
    lang = code;
    L = TEXT[lang];
    try { localStorage.setItem(STORE_KEY, lang); } catch { /* private mode */ }

    $$(".lang__btn").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));

    // The scripts themselves are identical in both languages, so their rows
    // are left standing and hydrate() just swaps the labels around them.
    // Rebuilding them meant re-parsing thousands of words of HTML and blocked
    // the main thread for ~60ms on a slow phone.
    hydrate();
    renderList("#servicesList", L.services, "service");
    renderReviews();
    watchReveals();   // the redrawn service rows need observing again
  }

  function bindLang() {
    $$(".lang__btn").forEach(btn => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
      btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
    });
  }

  /* ================= currency =================
     Content holds a number of euros and nothing else. Euros are what gets
     invoiced; dollars are a courtesy for a visitor who doesn't think in them,
     and are always shown as what they are — a rounded conversion. */

  const CUR_KEY = "currency";
  const RATE_URL = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD";

  function startingCurrency() {
    let saved = null;
    try { saved = localStorage.getItem(CUR_KEY); } catch { /* private mode */ }
    return saved === "usd" ? "usd" : "eur";     // euros unless asked otherwise
  }

  let currency = startingCurrency();
  let usdRate = Number(SITE.usdPerEur) > 0 ? Number(SITE.usdPerEur) : 1.15;
  let ratePromise = null;

  /* One price, in whatever is on screen. Rounded to whole units on purpose:
     the rate moves every day, so cents would claim a precision this doesn't
     have. Anything that isn't a number is passed straight through, so a price
     hand-written as "Ask me" still renders. */
  function money(eur) {
    const n = Number(eur);
    if (eur === "" || eur === null || !isFinite(n)) return String(eur);
    return currency === "usd" ? `$${Math.round(n * usdRate)}` : `€${n}`;
  }

  /* Today's rate from the European Central Bank's daily reference set, asked
     for once and only at the moment someone actually wants dollars — a visitor
     who stays in euros never causes this request at all. */
  function fetchRate() {
    if (ratePromise) return ratePromise;

    ratePromise = fetch(RATE_URL)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then(data => {
        const rate = Number(data && data.rates && data.rates.USD);
        if (!(rate > 0)) return false;
        usdRate = rate;
        return true;
      })
      .catch(err => {
        // Not worth a message on screen: the fixed rate in content.js is
        // already showing a sensible number.
        console.warn("[currency] live rate unavailable, using the fixed one:", err);
        return false;
      });

    return ratePromise;
  }

  /* "€5" on its own, or "From €5" where the figure is where a service starts
     rather than what it costs. */
  function priceLabel(eur, isFrom) {
    const amount = money(eur);
    const wrap = T("fromPrice");
    return isFrom && typeof wrap === "function" ? wrap(amount) : amount;
  }

  /* Prices are patched in place rather than by re-rendering the list — a
     rebuild would restart the reveal animations under the visitor's cursor. */
  function paintPrices() {
    $$("[data-eur]").forEach(el => {
      el.textContent = priceLabel(el.dataset.eur, el.hasAttribute("data-price-from"));
    });
    paintServicesNote();
  }

  /* The services line, plus the conversion caveat while dollars are showing. */
  function paintServicesNote() {
    const note = $("#servicesNote");
    if (!note) return;

    const base = L.servicesNote || "";
    const caveat = currency === "usd" ? (T("usdNote") || "") : "";

    note.innerHTML = esc(base) +
      (caveat ? `${base ? " " : ""}<span class="services__rate">${esc(caveat)}</span>` : "");
    note.hidden = !(base || caveat);
  }

  function applyCurrency(code, remember = true) {
    if (code !== "eur" && code !== "usd") return;
    currency = code;
    if (remember) { try { localStorage.setItem(CUR_KEY, currency); } catch {} }

    $$(".cur__btn").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.cur === currency)));

    paintPrices();

    // Dollars appear immediately at the fixed rate, then correct themselves
    // if the live one arrives — better than a blank column while we wait.
    if (currency === "usd" && SITE.liveRate !== false) {
      fetchRate().then(fresh => { if (fresh && currency === "usd") paintPrices(); });
    }
  }

  function bindCurrency() {
    applyCurrency(currency, false);      // don't store a choice nobody made yet
    $$(".cur__btn").forEach(btn =>
      btn.addEventListener("click", () => applyCurrency(btn.dataset.cur)));
  }

  /* ================= light / dark =================
     The palette is CSS variables, so a theme is one attribute on <html>. */

  const THEME_KEY = "theme";

  function startingTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* private mode */ }
    if (saved === "light" || saved === "dark") return saved;
    // No stored choice: follow whatever the visitor's system already asks for.
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  let theme = startingTheme();

  function applyTheme(next, remember = true) {
    theme = next;
    document.documentElement.setAttribute("data-theme", theme);
    if (remember) { try { localStorage.setItem(THEME_KEY, theme); } catch {} }

    const btn = $("#themeBtn");
    btn.setAttribute("aria-pressed", String(theme === "dark"));

    // Keep the browser chrome in step with the page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c0c0c" : "#f6f6f4");
  }

  function bindTheme() {
    applyTheme(theme, false);          // don't store a choice nobody made yet
    $("#themeBtn").addEventListener("click", () =>
      applyTheme(theme === "dark" ? "light" : "dark"));

    // If the visitor never chose, keep following their system.
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let stored = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch {}
      if (!stored) applyTheme(e.matches ? "dark" : "light", false);
    });
  }

  /* Hints. `data-hint` holds a key into TEXT, so they translate with
     everything else, and are re-applied whenever the language changes.
     Deliberately no `title` attribute: that would stack the browser's own
     tooltip on top of the styled one. */
  function applyHints() {
    $$("[data-hint]").forEach(el => {
      // An already-open row says "click to close", so don't reset it to
      // "click to open" just because the language changed.
      const key = (el.dataset.hint === "hintRow" &&
                   el.getAttribute("aria-expanded") === "true")
        ? "hintRowOpen" : el.dataset.hint;
      const text = T(key);
      if (text) el.setAttribute("data-hint-text", text);
    });
  }

  /* ================= reviews =================
     Live mode talks to Supabase's REST API directly — no SDK, no
     third-party script. Without keys it falls back to the hand-written
     REVIEWS list and the email button. */

  const liveReviews = Boolean(SUPABASE && SUPABASE.url && SUPABASE.anonKey);
  const TABLE = "reviews";

  let picker = null;          // the star picker, rebuilt on language change
  let reviewsBound = false;   // form listeners attached exactly once
  let loadedReviews = null;   // last set fetched, so a language switch can
                              // repaint without a second network call

  const sbHeaders = () => ({
    "apikey": SUPABASE.anonKey,
    "Authorization": `Bearer ${SUPABASE.anonKey}`,
    "Content-Type": "application/json"
  });

  const starRow = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  // Dates follow the chosen language, not the visitor's browser.
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(L.locale,
      { year: "numeric", month: "short", day: "numeric" });
  };

  /* select=* rather than a named list on purpose: it picks up the optional
     comment_en / comment_uk columns if you have added them, and still works
     if you haven't. Naming them explicitly would 400 the whole request on a
     table that doesn't have them yet, taking the reviews down with it. */
  async function fetchReviews() {
    const url = `${SUPABASE.url}/rest/v1/${TABLE}` +
                `?select=*&order=created_at.desc&limit=100`;
    const res = await fetch(url, { headers: sbHeaders() });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }

  /* Signed with the visitor's own token, not the anon key — that is what lets
     the database see who is posting and tie the row to them. */
  async function postReview(review) {
    const token = await accessToken();
    if (!token) throw new Error("not signed in");

    const res = await fetch(`${SUPABASE.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        ...sbHeaders(),
        "Authorization": `Bearer ${token}`,     // must win over the anon key above
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ ...review, user_id: session.id })
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json())[0];
  }

  async function deleteReview(id) {
    const token = await accessToken();
    if (!token) throw new Error("not signed in");

    const res = await fetch(
      `${SUPABASE.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          ...sbHeaders(),
          "Authorization": `Bearer ${token}`,
          "Prefer": "return=representation"
        }
      });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    /* A delete the policy refused comes back 200 with an empty list, not an
       error — it deleted nothing and says so quietly. Worth knowing: an
       earlier attempt to remove a row with the anon key returned 204 and
       changed nothing, which reads exactly like success. */
    const rows = await res.json();
    if (!rows.length) throw new Error("policy refused the delete");
    return rows[0];
  }

  function paintSummary(reviews) {
    const box = $("#reviewsSummary");
    const count = $("#reviewCount");
    const navScore = $("#navScore");

    if (!reviews.length) {
      box.hidden = true;
      navScore.hidden = true;
      count.textContent = T("noneYet");
      return;
    }
    const rated = reviews.filter(r => r.rating);
    const avg = rated.length
      ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length
      : 0;

    box.hidden = !rated.length;
    $("#avgScore").textContent = avg.toFixed(1);
    $("#avgStars").textContent = starRow(Math.round(avg));
    $("#avgCount").textContent = T("ratingCount")(rated.length);
    count.textContent = T("reviewCount")(reviews.length);

    // The score rides along in the menu — a number pulls the eye harder
    // than a word does.
    navScore.hidden = !rated.length;
    navScore.textContent = avg.toFixed(1);
  }

  /* ---------- translating a review ----------
     Reviews are written in whatever language the client happens to use, so a
     visitor can meet a card they simply cannot read. Each one carries a button
     that fetches a translation into the language the site is currently set to.

     Two providers, tried in order, because both are free services that go down
     from time to time. Nothing leaves the browser until a visitor presses the
     button, and what is sent is text already published on this page. The
     result is always labelled as a machine's work, never passed off as the
     client's own words. */

  const trCache = new Map();          // `${target}\n${source}` -> result
  const hasCyrillic = (str) => /[Ѐ-ӿ]/.test(str);

  async function viaGoogle(text, target) {
    const url = "https://translate.googleapis.com/translate_a/single" +
                `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}` +
                `&dt=t&q=${encodeURIComponent(text)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`google ${res.status}`);

    // [[["translated","original",…],…], null, "detected-language", …]
    const data = await res.json();
    const chunks = Array.isArray(data && data[0]) ? data[0] : [];
    const out = chunks.map(c => (c && c[0]) || "").join("").trim();
    if (!out) throw new Error("google: empty response");

    return { text: out, from: typeof data[2] === "string" ? data[2] : "" };
  }

  async function viaMyMemory(text, target) {
    // This one has no auto-detect and must be told the source language.
    // Reading it off the alphabet covers the case that actually turns up
    // here — Ukrainian and English sitting in the same list of reviews.
    const from = hasCyrillic(text) ? "uk" : "en";
    if (from === target) return { text, from };

    const url = "https://api.mymemory.translated.net/get" +
                `?q=${encodeURIComponent(text)}&langpair=${from}|${target}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`mymemory ${res.status}`);

    const data = await res.json();
    // It answers 200 with the failure written into the body, so the status
    // inside the JSON is the one that counts.
    if (Number(data && data.responseStatus) !== 200) {
      throw new Error(`mymemory: ${(data && data.responseDetails) || "refused"}`);
    }
    const out = String((data.responseData && data.responseData.translatedText) || "").trim();
    if (!out) throw new Error("mymemory: empty response");

    return { text: out, from };
  }

  async function translateText(text, target) {
    const key = `${target}\n${text}`;
    if (trCache.has(key)) return trCache.get(key);

    let lastErr = null;
    for (const provider of [viaGoogle, viaMyMemory]) {
      try {
        const result = await provider(text, target);
        trCache.set(key, result);
        return result;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("no translation provider answered");
  }

  /* Which reviews are currently on screen, so a button can find its own
     original text by index without stuffing a copy into the markup. */
  let paintedReviews = [];
  let reviewToolsBound = false;

  async function toggleTranslation(btn) {
    const card  = btn.closest(".review");
    const quote = $(".review__quote", card);
    const note  = $(".review__trnote", card);

    const source = paintedReviews[Number(btn.dataset.i)] || {};
    const original = source.comment || source.quote || "";
    const target = supported(lang) ? lang : "en";

    // A second press gives the client their own words back.
    if (card.classList.contains("is-translated")) {
      card.classList.remove("is-translated");
      quote.textContent = original;
      quote.removeAttribute("lang");
      note.hidden = true;
      btn.textContent = T("translate");
      return;
    }

    /* A translation you wrote yourself always wins. Machine translation is
       good enough to get the gist across and no better — on one of these very
       reviews it turned "he isn't afraid to correct his own work" into an
       instruction aimed at the reader. Put the right words in `comment_en` /
       `comment_uk` on Supabase and they are used instead, with no request to
       anyone and no "machine translation" caveat. */
    const stored = String(source[`comment_${target}`] || "").trim();
    if (stored) {
      quote.textContent = stored;
      quote.setAttribute("lang", target);
      card.classList.add("is-translated");
      note.hidden = false;
      note.textContent = T("translatedHuman");
      btn.textContent = T("showOriginal");
      return;
    }

    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = T("translating");
    note.hidden = true;

    try {
      const result = await translateText(original, target);

      // Nothing gained by repainting the same sentence — say so instead.
      if (result.from === target || result.text.trim() === original.trim()) {
        note.hidden = false;
        note.textContent = T("sameLanguage");
        btn.textContent = T("translate");
        return;
      }

      quote.textContent = result.text;
      quote.setAttribute("lang", target);
      card.classList.add("is-translated");
      note.hidden = false;
      note.textContent = T("translatedNote");
      btn.textContent = T("showOriginal");
    } catch (err) {
      note.hidden = false;
      note.textContent = T("errTranslate");
      btn.textContent = T("translate");
      console.error("[reviews] translation failed:", err);
    } finally {
      btn.disabled = false;
    }
  }

  /* Delegated, and bound exactly once: paintReviews replaces this list's
     contents on every language switch and after every post. */
  function bindReviewTools() {
    if (reviewToolsBound) return;
    reviewToolsBound = true;

    $("#reviewsList").addEventListener("click", (e) => {
      const translate = e.target.closest(".review__tr");
      if (translate) { toggleTranslation(translate); return; }

      const remove = e.target.closest(".review__del");
      if (remove) removeOwnReview(remove);
    });
  }

  async function removeOwnReview(btn) {
    if (btn.disabled) return;

    // Irreversible, so it gets an explicit yes rather than a quiet second tap.
    if (!confirm(T("confirmDelete"))) return;

    btn.disabled = true;
    btn.textContent = T("deleting");

    try {
      await deleteReview(btn.dataset.id);
      loadedReviews = null;              // force a real re-read, not the cache
      await reloadReviews();
      status(T("deletedOk"), "ok");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = T("deleteReview");
      status(T("errDelete"), "error");
      console.error("[reviews] delete failed:", err);
    }
  }

  function paintReviews(reviews) {
    const list = $("#reviewsList");
    paintedReviews = reviews;

    list.innerHTML = reviews.map((r, i) => {
      const body = r.comment || r.quote || "";
      const when = r.created_at ? fmtDate(r.created_at) : (r.role || "");

      // Only ever a convenience. The database refuses a delete that isn't
      // yours whether or not this button was on the page.
      const mine = Boolean(session && r.user_id && r.user_id === session.id && r.id);

      return `
        <figure class="review" style="--i:${i}">
          ${r.rating ? `<div class="review__stars" aria-label="${esc(r.rating)} / 5">${starRow(r.rating)}</div>` : ""}
          <blockquote class="review__quote">${esc(body)}</blockquote>
          ${body || mine ? `<div class="review__tools">
            ${body ? `<button type="button" class="review__tr" data-i="${i}"
                    data-hint="hintTranslate" data-hint-text="${esc(T("hintTranslate"))}"
            >${esc(T("translate"))}</button>` : ""}
            ${mine ? `<button type="button" class="review__del" data-id="${esc(r.id)}"
                    data-hint="hintDelete" data-hint-text="${esc(T("hintDelete"))}"
            >${esc(T("deleteReview"))}</button>` : ""}
            <span class="review__trnote" hidden></span>
          </div>` : ""}
          <figcaption class="review__by">
            <span class="review__name">${esc(r.name)}</span>
            ${when ? `<span class="review__role">${esc(when)}</span>` : ""}
          </figcaption>
        </figure>`;
    }).join("");

    bindReviewTools();
  }

  function status(msg, kind) {
    const el = $("#reviewsStatus");
    el.hidden = !msg;
    el.textContent = msg || "";
    el.className = "reviews__status" + (kind ? ` is-${kind}` : "");
  }

  /* ================= keeping the rubbish out =================
     Four cheap checks in the browser, none of which are the real defence.
     Anything here can be skipped by anyone willing to post straight to the
     API instead of using the form, so the rules that actually hold the line
     are the SQL ones on Supabase (they are in README.md — run them). These
     exist to stop the ordinary nuisance before it ever reaches the database,
     and to tell an honest person what is wrong in words they can act on. */

  // Bots sell things, and selling needs a link. Catches bare domains too,
  // which is how most of them get past a naive http:// check.
  const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|top|shop|info|biz|click|link|site|online)\b)/i;

  // No letters at all, or one character hammered over and over.
  const isGibberish = (str) =>
    !/[\p{L}]/u.test(str) || /^(.)\1+$/u.test(str.replace(/\s+/g, ""));

  /* ================= who is leaving the review =================
     Supabase mails a six-digit code, the visitor types it back, and the token
     that comes out of that is what signs the insert. So "you need a working
     email address" is a rule the database enforces on every request — this
     file only puts a form around it. Someone posting straight to the API with
     the anon key gets refused, which is the entire point.

     There is no per-browser cooldown any more: one account gets one review,
     and that is a unique index, not a guess about which browser you are in. */

  const AUTH_KEY = "reviewSession";

  let session = loadSession();      // { access_token, refresh_token, expires_at, email, id }

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      return (saved && saved.access_token && saved.id) ? saved : null;
    } catch { return null; }
  }

  function saveSession(next) {
    session = next;
    try {
      if (next) localStorage.setItem(AUTH_KEY, JSON.stringify(next));
      else localStorage.removeItem(AUTH_KEY);
    } catch { /* private mode */ }
  }

  const authHeaders = () => ({
    "apikey": SUPABASE.anonKey,
    "Content-Type": "application/json"
  });

  async function sendCode(email) {
    const res = await fetch(`${SUPABASE.url}/auth/v1/otp`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, create_user: true })
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  }

  async function verifyCode(email, token) {
    const res = await fetch(`${SUPABASE.url}/auth/v1/verify`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, token, type: "email" })
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const data = await res.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || 0,
      email: (data.user && data.user.email) || email,
      id: data.user && data.user.id
    };
  }

  /* A live token, refreshed if the stored one has aged out. Returns null when
     the session is past saving, which puts the visitor back at the code box
     rather than failing their post with something they can't act on. */
  async function accessToken() {
    if (!session) return null;

    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - 60 > now) return session.access_token;

    try {
      const res = await fetch(`${SUPABASE.url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!res.ok) throw new Error(String(res.status));

      const data = await res.json();
      saveSession({
        ...session,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Number(data.expires_at) || 0
      });
      return session.access_token;
    } catch (err) {
      console.warn("[reviews] session expired, asking for a new code:", err);
      saveSession(null);
      paintAuthState();
      return null;
    }
  }

  async function signOut() {
    const token = session && session.access_token;
    saveSession(null);
    paintAuthState();
    renderReviews();               // drops the delete buttons that are no longer theirs

    // Best effort: the local session is already gone either way.
    if (!token) return;
    try {
      await fetch(`${SUPABASE.url}/auth/v1/logout`, {
        method: "POST",
        headers: { ...authHeaders(), "Authorization": `Bearer ${token}` }
      });
    } catch { /* nothing left to clean up here */ }
  }

  /* Signed in: the form. Signed out: the code box. Never both. */
  function paintAuthState() {
    const box = $("#reviewAuth");
    const who = $("#reviewWho");
    const form = $("#reviewForm");
    if (!box || !who || !form) return;

    // Switched off for now: show the reason instead of a form that would
    // only fail on submit. Reading reviews carries on as normal.
    const paused = SITE.reviewsPaused === true;
    const notice = $("#reviewsPaused");
    if (notice) {
      notice.textContent = paused ? (T("reviewsPausedNote") || "") : "";
      notice.hidden = !paused;
    }
    if (paused) {
      box.hidden = true;
      who.hidden = true;
      form.hidden = true;
      return;
    }

    const signedIn = Boolean(session);
    box.hidden = signedIn;
    who.hidden = !signedIn;
    form.hidden = !signedIn;

    if (signedIn) {
      const label = T("signedInAs");
      $("#rWhoText").textContent = typeof label === "function"
        ? label(session.email) : session.email;
    } else {
      // Back to the first step, so a signed-out visitor isn't met with a
      // code box for an address they can no longer remember entering.
      $("#emailStep").hidden = false;
      $("#codeStep").hidden = true;
      $("#rAuthMsg").textContent = "";
    }
  }

  /* Re-read the list and repaint it. At module level because a delete needs
     it just as much as the form does. */
  async function reloadReviews() {
    if (!loadedReviews) status(T("loading"));
    try {
      loadedReviews = await fetchReviews();
      status("");
      paintSummary(loadedReviews);
      paintReviews(loadedReviews);
    } catch (err) {
      // Say so plainly rather than showing an empty section that looks fine.
      status(T("loadError"), "error");
      paintSummary(loadedReviews || []);
      console.error("[reviews] load failed:", err);
    }
  }

  /* The two steps of getting an address confirmed. Bound once; the markup
     they drive is static, so a language switch only relabels it. */
  let authBound = false;

  function bindAuth() {
    if (authBound) return;
    authBound = true;

    const emailStep = $("#emailStep");
    const codeStep  = $("#codeStep");
    const emailEl   = $("#rEmail");
    const codeEl    = $("#rCode");
    const sendBtn   = $("#rSendCode");
    const verifyBtn = $("#rVerify");
    const msg       = $("#rAuthMsg");

    const say = (text, kind) => {
      msg.textContent = text;
      msg.className = "rform__msg" + (kind ? ` is-${kind}` : "");
    };

    emailStep.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailEl.value.trim();

      // Deliberately loose. Whether the address really exists is settled by
      // whether a code arrives, not by a regex arguing about it here.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say(T("errEmail"), "error");
        emailEl.focus();
        return;
      }

      sendBtn.disabled = true;
      say(T("sending"));

      try {
        await sendCode(email);
        emailStep.hidden = true;
        codeStep.hidden = false;
        const sent = T("codeSent");
        say(typeof sent === "function" ? sent(email) : sent, "ok");
        codeEl.value = "";
        codeEl.focus();
      } catch (err) {
        say(T("errSend"), "error");
        console.error("[reviews] could not send code:", err);
      } finally {
        sendBtn.disabled = false;
      }
    });

    codeStep.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = codeEl.value.trim();
      const email = emailEl.value.trim();

      if (!/^\d{6}$/.test(code)) {
        say(T("errCode"), "error");
        codeEl.focus();
        return;
      }

      verifyBtn.disabled = true;
      say(T("verifying"));

      try {
        saveSession(await verifyCode(email, code));
        say("");
        paintAuthState();
        renderReviews();          // their own review can now carry a delete button
      } catch (err) {
        say(T("errCodeWrong"), "error");
        codeEl.select();
        console.error("[reviews] code rejected:", err);
      } finally {
        verifyBtn.disabled = false;
      }
    });

    $("#rChangeEmail").addEventListener("click", () => {
      codeStep.hidden = true;
      emailStep.hidden = false;
      say("");
      emailEl.focus();
    });

    $("#rSignOut").addEventListener("click", signOut);
  }

  /* Five buttons, arrow-key navigable, because a rating is a radio group. */
  function buildStarPicker() {
    const box = $("#starPicker");
    let value = 0;

    box.innerHTML = [1, 2, 3, 4, 5].map(n => `
      <button type="button" class="star" role="radio" aria-checked="false"
              data-value="${n}" aria-label="${n} star${n > 1 ? "s" : ""}"
              data-hint="hintStar" data-hint-text="${esc(T("hintStar"))}">★</button>`).join("");

    const buttons = $$(".star", box);
    const paint = (n) => buttons.forEach((b, i) => {
      b.classList.toggle("is-on", i < n);
      b.setAttribute("aria-checked", String(i + 1 === n));
      b.tabIndex = (i + 1 === (n || 1)) ? 0 : -1;
    });

    const set = (n) => { value = n; paint(n); };

    buttons.forEach((b, i) => {
      b.addEventListener("click", () => set(i + 1));
      b.addEventListener("mouseenter", () => paint(i + 1));
      b.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault(); set(Math.min(5, (value || 0) + 1)); buttons[Math.min(4, value - 1)].focus();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault(); set(Math.max(1, (value || 1) - 1)); buttons[Math.max(0, value - 1)].focus();
        }
      });
    });
    box.addEventListener("mouseleave", () => paint(value));
    paint(0);

    return { get: () => value, reset: () => set(0) };
  }

  async function initLiveReviews() {
    const form = $("#reviewForm");
    const msg  = $("#rMsg");
    const submit = $("#rSubmit");
    const nameEl = $("#rName");
    const textEl = $("#rComment");

    $("#reviewsCta").hidden = true;

    bindAuth();
    paintAuthState();          // decides between the code box and the form

    // Rebuilt each time so the star labels follow the language. The submit
    // handler reads `picker` from this scope, so it always sees the current one.
    picker = buildStarPicker();

    // A language switch only changes wording, so repaint what we already
    // have instead of asking the database for it again.
    if (loadedReviews) {
      status("");
      paintSummary(loadedReviews);
      paintReviews(loadedReviews);
    }

    // Listeners attach once. Without this guard, switching language would
    // bind a second submit handler and post every review twice.
    if (!reviewsBound) {
      reviewsBound = true;

      // When the form became fillable. A person needs seconds to read the
      // labels and type; a script submits the moment the page is ready.
      const shownAt = Date.now();

      textEl.addEventListener("input", () => {
        $("#rCount").textContent = String(textEl.value.length);
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if ($("#rTrap").value) return;              // bot

        const rating = picker.get();
        const name = nameEl.value.trim();
        const comment = textEl.value.trim();

        const fail = (text, el) => {
          msg.textContent = text;
          msg.className = "rform__msg is-error";
          if (el) el.focus();
        };

        // Three seconds, not thirty. Long enough that nothing automated gets
        // through, short enough that pasting a prepared review and pressing
        // straight away only costs one extra press.
        if (Date.now() - shownAt < 3000) return fail(T("errTooFast"));

        if (!rating)            return fail(T("errRating"));
        if (name.length < 2)    return fail(T("errName"), nameEl);
        if (comment.length < 4) return fail(T("errComment"), textEl);

        if (isGibberish(comment)) return fail(T("errComment"), textEl);
        if (LINK_RE.test(comment)) return fail(T("errLinks"), textEl);
        if (LINK_RE.test(name))    return fail(T("errLinks"), nameEl);

        submit.disabled = true;
        msg.className = "rform__msg";
        msg.textContent = T("posting");

        try {
          await postReview({ name, rating, comment });
          form.reset();
          picker.reset();
          $("#rCount").textContent = "0";
          msg.className = "rform__msg is-ok";
          msg.textContent = T("thanks");
          loadedReviews = null;              // re-read, so their own row comes
          await reloadReviews();             // back with a delete button on it
        } catch (err) {
          const detail = String((err && err.message) || "");
          msg.className = "rform__msg is-error";
          // 23505 is the unique index that gives one account one review. Say
          // what to do about it rather than "that didn't send".
          msg.textContent = /23505|duplicate key/i.test(detail)
            ? T("errAlready")
            : T("errPost");
          console.error("[reviews] post failed:", err);
        } finally {
          submit.disabled = false;
        }
      });
    }

    // Only actually go to the network the first time. Later calls come from
    // a language switch, and the repaint above has already handled those.
    if (!loadedReviews) await reloadReviews();
  }

  function initStaticReviews() {
    const prompt = $("#reviewPrompt");

    $("#reviewForm").hidden = true;
    $("#reviewsCta").hidden = false;

    paintSummary(REVIEWS);
    paintReviews(REVIEWS);

    prompt.textContent = REVIEWS.length
      ? T("haveReviewsPrompt")
      : T("noReviewsPrompt");
  }

  function renderReviews() {
    // Set even in live mode: the fallback button is hidden, not removed,
    // and a hidden element should still hold a real address, never "#".
    const button = $("#reviewButton");
    button.href = contactHref(`${T("subjReview")} — ${SITE.name}`);
    if (useGmail) { button.target = "_blank"; button.rel = "noopener"; }

    if (liveReviews) initLiveReviews();
    else initStaticReviews();
  }

  /* ---------- the script body ----------
     Escape first, then apply the small subset of markdown the scripts use:
     ### headings and **bold**. Blank lines separate paragraphs.

     Cached: the scripts never change, but a language switch re-renders every
     row, and re-parsing thousands of words each time is wasted work. */
  const scriptCache = new Map();

  function formatScript(raw) {
    if (scriptCache.has(raw)) return scriptCache.get(raw);
    const html = buildScript(raw);
    scriptCache.set(raw, html);
    return html;
  }

  function buildScript(raw) {
    return esc(raw)
      .split(/\n{2,}/)
      .map(block => {
        const line = block.trim();
        if (line.startsWith("###")) {
          return `<h4 class="script__h">${line.replace(/^#+\s*/, "")}</h4>`;
        }
        return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
      })
      .join("");
  }

  /* Where an "Email me" button points. See SITE.contactMethod in content.js.
     Gmail's compose URL opens in the browser, so it works for visitors with
     no mail app set up — which is what mailto: silently fails to do. */
  const useGmail = SITE.contactMethod !== "mailto";

  function contactHref(subject) {
    if (!useGmail) {
      return subject
        ? `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`
        : `mailto:${SITE.email}`;
    }
    const url = new URL("https://mail.google.com/mail/");
    url.searchParams.set("view", "cm");     // compose
    url.searchParams.set("fs", "1");
    url.searchParams.set("to", SITE.email);
    if (subject) url.searchParams.set("su", subject);
    return url.toString();
  }

  // A Gmail tab must open in a new tab; a mailto: must not.
  const contactAttrs = () => useGmail ? ' target="_blank" rel="noopener"' : "";

  /* ---------- one row, used by both lists ---------- */
  function row(item, i, kind) {
    const isWork = kind === "work";

    const tags = (isWork ? [item.category, item.length] : [item.category, item.turnaround])
      .filter(Boolean).map(esc).join(" &nbsp;/&nbsp; ");

    // The turnaround already sits in the row's tag line, so don't repeat it.
    const facts = (isWork ? [item.length] : [item.turnaround])
      .filter(Boolean).map(f => `<span>${esc(f)}</span>`).join("");

    const bullets = (item.deliverables || []).map(d => `<li>${esc(d)}</li>`).join("");
    const alts    = (item.altTitles || []).map(t => `<li>${esc(t)}</li>`).join("");

    // Priced by tier (e.g. scripts, by video length) — rendered as a table.
    // data-eur keeps the euro figure on the element, so switching currency is
    // a text swap rather than a rebuild of the row.
    const tiers = (item.tiers || []).map(t => `
      <li class="tier">
        <span class="tier__label">${esc(t.label)}</span>
        <span class="tier__dots" aria-hidden="true"></span>
        <span class="tier__price" data-eur="${esc(t.price)}">${esc(money(t.price))}</span>
      </li>`).join("");

    const custom = (item.links || []).map(l =>
      `<a class="btn-ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`);

    // Every row gets an enquiry link with the subject already filled in.
    // The data-subj-* attributes let hydrate() re-point the address on a
    // language switch without rebuilding the row.
    const subjKey = isWork ? "subjScript" : "subjEnquiry";
    const subject = `${T(subjKey)} — ${item.title}`;
    const enquiry =
      `<a class="btn-ghost" href="${esc(contactHref(subject))}"${contactAttrs()}
          data-i18n="emailAboutThis"
          data-subj-key="${subjKey}" data-subj-title="${esc(item.title)}"
       >${esc(T("emailAboutThis"))}</a>`;

    const id = `${kind}-${i}`;

    // 0 is a real price ("free"), so test for absence rather than falsiness.
    const hasPrice = item.price !== undefined && item.price !== null && item.price !== "";

    const right = isWork
      ? `${facts ? `<div class="work__facts">${facts}</div>` : ""}
         ${item.hook ? `<span class="work__label" data-i18n="hook">${esc(T("hook"))}</span>
                        <p class="work__synopsis">${esc(item.hook)}</p>` : ""}
         ${alts ? `<span class="work__label" data-i18n="otherTitles">${esc(T("otherTitles"))}</span>
                   <ul class="work__bullets">${alts}</ul>` : ""}
         <div class="work__links">${[...custom, enquiry].join("")}</div>`
      : `${facts ? `<div class="work__facts">${facts}</div>` : ""}
         ${tiers ? `<span class="work__label">${esc(T("pricing"))}</span>
                    <ul class="tiers">${tiers}</ul>` : ""}
         ${item.details ? `<span class="work__label">${esc(T("details"))}</span>
                           <p class="work__synopsis">${esc(item.details)}</p>` : ""}
         ${bullets ? `<span class="work__label">${esc(T("whatYouGet"))}</span>
                      <ul class="work__bullets">${bullets}</ul>` : ""}
         ${item.note ? `<p class="work__note">${esc(item.note)}</p>` : ""}
         <div class="work__links">${[...custom, enquiry].join("")}</div>`;

    const summary = isWork ? item.description : item.summary;

    // Scripts stagger in the moment the button opens them; services further
    // down the page wait until you actually scroll to them.
    const revealClass = isWork ? "" : " reveal";

    return `
      <li class="work${revealClass}" style="--i:${i}">
        <button class="work__bar" type="button" aria-expanded="false" aria-controls="panel-${id}"
                data-hint="hintRow" data-hint-text="${esc(T("hintRow"))}">
          <span class="work__num">${String(i + 1).padStart(2, "0")}</span>
          <span class="work__title">${esc(item.title)}</span>
          <span class="work__tags">${tags}</span>
          ${hasPrice ? `<span class="work__price" data-eur="${esc(item.price)}"${
              item.priceFrom ? " data-price-from" : ""
            }>${esc(priceLabel(item.price, item.priceFrom))}</span>` : ""}
          <span class="work__sign" aria-hidden="true">+</span>
        </button>

        <div class="work__panel" id="panel-${id}" role="region"
             aria-label="${esc(item.title)}">
          <div class="work__inner">
            <div><p class="work__logline">${esc(summary)}</p></div>
            <div>${right}</div>
          </div>
          ${item.script ? `<div class="script">
              <span class="work__label" data-i18n="fullScript">${esc(T("fullScript"))}</span>
              <div class="script__body">${formatScript(item.script)}</div>
            </div>` : ""}
        </div>
      </li>`;
  }

  function renderList(sel, items, kind) {
    const list = $(sel);

    // A language switch rebuilds these rows; don't shut a panel the visitor
    // was reading. Remember which were open and put them back.
    const wasOpen = $$(".work", list).reduce(
      (acc, el, i) => (el.classList.contains("is-open") ? acc.concat(i) : acc), []);

    list.innerHTML = items.map((item, i) => row(item, i, kind)).join("");
    const bars = $$(".work__bar", list);
    bars.forEach(bar => bar.addEventListener("click", () => toggleRow(bar)));

    if (wasOpen.length) {
      const rows = $$(".work", list);
      wasOpen.forEach(i => {
        const el = rows[i];
        if (!el) return;
        el.classList.add("is-open");
        el.querySelector(".work__panel").style.maxHeight = "none";   // no replay
        const bar = el.querySelector(".work__bar");
        bar.setAttribute("aria-expanded", "true");
        bar.setAttribute("data-hint-text", T("hintRowOpen"));
      });
    }
  }

  /* Reveal-on-scroll for everything below the scripts.
     Called again after a language switch and when the gate opens, so the
     previous observer is thrown away first — otherwise they pile up, one
     per call, all watching the same elements. */
  let revealObserver = null;

  function watchReveals() {
    const targets = $$(".reveal");

    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(el => el.classList.add("is-in"));
      return;
    }

    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        obs.unobserve(entry.target);         // reveal once, then stop watching
      });
    }, { rootMargin: "0px 0px -12% 0px" });

    targets.forEach(el => revealObserver.observe(el));
  }

  /* An open panel is measured, not guessed — so it fits whatever you write. */
  function toggleRow(bar) {
    const work  = bar.closest(".work");
    const panel = work.querySelector(".work__panel");
    const open  = !work.classList.contains("is-open");

    // Drop any handler left from a previous toggle. Without this, opening and
    // closing quickly lets the *close* transition run the open-handler, which
    // sets max-height:none and leaves the panel wide open while the row says
    // it is shut.
    if (panel._settle) {
      panel.removeEventListener("transitionend", panel._settle);
      panel._settle = null;
    }

    if (open) {
      work.classList.add("is-open");
      panel.style.maxHeight = panel.scrollHeight + "px";
      panel._settle = (e) => {
        if (e.propertyName !== "max-height") return;
        panel.removeEventListener("transitionend", panel._settle);
        panel._settle = null;
        // Only release the cap if the row is *still* open.
        if (work.classList.contains("is-open")) panel.style.maxHeight = "none";
      };
      panel.addEventListener("transitionend", panel._settle);
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
      requestAnimationFrame(() => {
        work.classList.remove("is-open");
        panel.style.maxHeight = "0px";
      });
    }
    bar.setAttribute("aria-expanded", String(open));
    bar.setAttribute("data-hint-text", T(open ? "hintRowOpen" : "hintRow"));
  }

  /* ---------- the yin-yang ---------- */
  function bindEnter() {
    const btn   = $("#enter");
    const label = $("#enterLabel");
    const works = $("#works");

    const scrollTo = (el) =>
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

    const isOpen = () => document.body.classList.contains("works-open");

    // `target` lets the menu open the site and land on the section asked for,
    // instead of always dumping the visitor at the top of Work.
    const open = (target = works) => {
      if (!isOpen()) {
        document.body.classList.add("works-open");
        works.setAttribute("aria-hidden", "false");
        btn.setAttribute("aria-expanded", "true");
        label.textContent = T("entered");
        watchReveals();          // sections revealed just now need observing
      }
      // The sections were display:none a moment ago and have no geometry yet;
      // wait a frame so scrollIntoView measures the real position.
      requestAnimationFrame(() => scrollTo(target));
    };

    // Pressing the yin-yang is the only way in. If the visitor was aiming at
    // a particular section when they were turned back, remember it and take
    // them there once they press.
    let pending = null;

    btn.addEventListener("click", () => {
      const target = pending || works;
      pending = null;
      open(target);
    });

    /* A dead click teaches nothing, so a menu item pressed before entry
       throws the eye at the button and remembers where they wanted to go. */
    const nudge = () => {
      btn.classList.remove("is-nudged");
      void btn.offsetWidth;               // restart the animation
      btn.classList.add("is-nudged");
      btn.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      setTimeout(() => btn.classList.remove("is-nudged"), 800);
    };

    $$(".nav__links a[href^='#']").forEach(link => {
      const id = link.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      if (!section) return;                     // e.g. the email button
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (isOpen()) { scrollTo(section); return; }
        pending = section;                      // honoured on the first press
        nudge();
      });
    });
  }

  /* The hero's animations loop forever. Pause them the moment the hero is off
     screen — a compositor busy with invisible work is the difference between
     a smooth scroll and a stuttering one. */
  function watchHero() {
    const hero = $(".hero");
    if (!hero || !("IntersectionObserver" in window)) return;

    new IntersectionObserver(([entry]) => {
      document.body.classList.toggle("is-away", !entry.isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* The nav needs a backdrop as soon as anything scrolls beneath it. */
  function watchScroll() {
    const nav = $(".nav");
    let ticking = false;
    const update = () => {
      nav.classList.toggle("is-stuck", window.scrollY > 24);
      ticking = false;
    };
    addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ---------- intro ----------
     There is no loading screen any more. `is-ready` starts the hero reveal
     and the yin-yang's drop, both of which are CSS animations. */
  function runIntro() {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
  }

  document.addEventListener("DOMContentLoaded", () => {
    hydrate();
    renderList("#worksList", WORKS, "work");
    renderList("#servicesList", L.services, "service");
    renderReviews();
    watchReveals();          // after render, so the generated rows are seen
    watchScroll();
    watchHero();
    bindEnter();
    bindLang();
    bindCurrency();     // after the lists exist: it repaints their prices
    bindTheme();

    // One frame's grace so the first paint has the finished layout —
    // otherwise the drop can start against a half-built hero.
    requestAnimationFrame(runIntro);
  });
})();
