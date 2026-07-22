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
    // The address in plain text, so it can always be copied by hand.
    $$('[data-site-text="email"]').forEach(a => { a.textContent = SITE.email; });

    const socials = (SITE.socials || [])
      .map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`)
      .join("");
    set("socials", socials);

    $("#year").textContent = new Date().getFullYear();
    $("#workCount").textContent = String(WORKS.length).padStart(2, "0");

    const note = $("#servicesNote");
    note.textContent = L.servicesNote || "";
    note.hidden = !L.servicesNote;

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

    hydrate();
    renderList("#worksList", WORKS, "work");
    renderList("#servicesList", L.services, "service");
    renderReviews();
    watchReveals();   // the redrawn rows need observing again
  }

  function bindLang() {
    $$(".lang__btn").forEach(btn => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
      btn.addEventListener("click", () => applyLanguage(btn.dataset.lang));
    });
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
      const text = T(el.dataset.hint);
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

  async function fetchReviews() {
    const url = `${SUPABASE.url}/rest/v1/${TABLE}` +
                `?select=name,rating,comment,created_at&order=created_at.desc&limit=100`;
    const res = await fetch(url, { headers: sbHeaders() });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }

  async function postReview(review) {
    const res = await fetch(`${SUPABASE.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "return=representation" },
      body: JSON.stringify(review)
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json())[0];
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

  function paintReviews(reviews) {
    const list = $("#reviewsList");
    list.innerHTML = reviews.map((r, i) => {
      const body = r.comment || r.quote || "";
      const when = r.created_at ? fmtDate(r.created_at) : (r.role || "");
      return `
        <figure class="review" style="--i:${i}">
          ${r.rating ? `<div class="review__stars" aria-label="${esc(r.rating)} / 5">${starRow(r.rating)}</div>` : ""}
          <blockquote class="review__quote">${esc(body)}</blockquote>
          <figcaption class="review__by">
            <span class="review__name">${esc(r.name)}</span>
            ${when ? `<span class="review__role">${esc(when)}</span>` : ""}
          </figcaption>
        </figure>`;
    }).join("");
  }

  function status(msg, kind) {
    const el = $("#reviewsStatus");
    el.hidden = !msg;
    el.textContent = msg || "";
    el.className = "reviews__status" + (kind ? ` is-${kind}` : "");
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
    form.hidden = false;

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

    const load = async () => {
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
    };

    // Listeners attach once. Without this guard, switching language would
    // bind a second submit handler and post every review twice.
    if (!reviewsBound) {
      reviewsBound = true;

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
        if (!rating)            return fail(T("errRating"));
        if (name.length < 2)    return fail(T("errName"), nameEl);
        if (comment.length < 4) return fail(T("errComment"), textEl);

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
          await load();
        } catch (err) {
          msg.className = "rform__msg is-error";
          msg.textContent = T("errPost");
          console.error("[reviews] post failed:", err);
        } finally {
          submit.disabled = false;
        }
      });
    }

    // Only actually go to the network the first time. Later calls come from
    // a language switch, and the repaint above has already handled those.
    if (!loadedReviews) await load();
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
     ### headings and **bold**. Blank lines separate paragraphs. */
  function formatScript(raw) {
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

    const facts = (isWork ? [item.length] : [item.price, item.turnaround])
      .filter(Boolean).map(f => `<span>${esc(f)}</span>`).join("");

    const bullets = (item.deliverables || []).map(d => `<li>${esc(d)}</li>`).join("");
    const alts    = (item.altTitles || []).map(t => `<li>${esc(t)}</li>`).join("");

    const custom = (item.links || []).map(l =>
      `<a class="btn-ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`);

    // Every row gets an enquiry link with the subject already filled in.
    const subject = isWork
      ? `${T("subjScript")} — ${item.title}`
      : `${T("subjEnquiry")} — ${item.title}`;
    const enquiry =
      `<a class="btn-ghost" href="${esc(contactHref(subject))}"${contactAttrs()}>${esc(T("emailAboutThis"))}</a>`;

    const id = `${kind}-${i}`;

    const right = isWork
      ? `${facts ? `<div class="work__facts">${facts}</div>` : ""}
         ${item.hook ? `<span class="work__label">${esc(T("hook"))}</span>
                        <p class="work__synopsis">${esc(item.hook)}</p>` : ""}
         ${alts ? `<span class="work__label">${esc(T("otherTitles"))}</span>
                   <ul class="work__bullets">${alts}</ul>` : ""}
         <div class="work__links">${[...custom, enquiry].join("")}</div>`
      : `${facts ? `<div class="work__facts">${facts}</div>` : ""}
         ${item.details ? `<span class="work__label">${esc(T("details"))}</span>
                           <p class="work__synopsis">${esc(item.details)}</p>` : ""}
         ${bullets ? `<span class="work__label">${esc(T("whatYouGet"))}</span>
                      <ul class="work__bullets">${bullets}</ul>` : ""}
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
          <span class="work__sign" aria-hidden="true">+</span>
        </button>

        <div class="work__panel" id="panel-${id}" role="region">
          <div class="work__inner">
            <div><p class="work__logline">${esc(summary)}</p></div>
            <div>${right}</div>
          </div>
          ${item.script ? `<div class="script">
              <span class="work__label">${esc(T("fullScript"))}</span>
              <div class="script__body">${formatScript(item.script)}</div>
            </div>` : ""}
        </div>
      </li>`;
  }

  function renderList(sel, items, kind) {
    const list = $(sel);
    list.innerHTML = items.map((item, i) => row(item, i, kind)).join("");
    $$(".work__bar", list).forEach(bar => bar.addEventListener("click", () => toggleRow(bar)));
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

    if (open) {
      work.classList.add("is-open");
      panel.style.maxHeight = panel.scrollHeight + "px";
      panel.addEventListener("transitionend", function done(e) {
        if (e.propertyName !== "max-height") return;
        panel.style.maxHeight = "none";           // let it grow if the window resizes
        panel.removeEventListener("transitionend", done);
      });
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

    btn.addEventListener("click", () => open(works));

    // Every menu item works from the front door, not just "Work".
    $$(".nav__links a[href^='#']").forEach(link => {
      const id = link.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      if (!section) return;                     // e.g. the email button
      link.addEventListener("click", (e) => {
        e.preventDefault();
        open(section);
      });
    });

    // Scrolling is the other thing people try when a page looks like a
    // dead end. Treat it as "let me in" rather than ignoring it.
    const onWheel = (e) => {
      if (isOpen() || e.deltaY <= 0) return;               // ignore scroll-up
      open(works);
    };

    const SCROLL_KEYS = ["ArrowDown", "PageDown", "End", " "];
    const onKey = (e) => {
      if (isOpen()) return;
      if (!SCROLL_KEYS.includes(e.key)) return;
      // Enter and Space belong to whatever is focused. Only treat a key as
      // "let me in" when nothing interactive has focus — otherwise pressing
      // Enter on a menu link would scroll to Work and fight its own handler.
      const el = document.activeElement;
      if (el && el !== document.body && el.closest("a,button,input,textarea,select")) return;
      open(works);
    };

    addEventListener("wheel", onWheel, { passive: true });
    addEventListener("keydown", onKey);

    let touchY = null;
    addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    addEventListener("touchmove", (e) => {
      if (isOpen() || touchY === null) return;
      if (touchY - e.touches[0].clientY > 30) open(works);  // swiped up
    }, { passive: true });
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
    bindEnter();
    bindLang();
    bindTheme();

    // One frame's grace so the first paint has the finished layout —
    // otherwise the drop can start against a half-built hero.
    requestAnimationFrame(runIntro);
  });
})();
