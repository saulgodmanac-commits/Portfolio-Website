(() => {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Anything from content.js goes through here before it touches the DOM. */
  const esc = (str) => String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* ---------- fill in the details from SITE ---------- */
  function hydrate() {
    const set = (key, html) => $$(`[data-site="${key}"]`).forEach(el => { el.innerHTML = html; });

    set("name", esc(SITE.name));
    set("role", esc(SITE.role));
    set("status", esc(SITE.status));
    set("location", esc(SITE.location));
    set("bio", esc(SITE.bio));
    set("about", esc(SITE.about));

    // Every email link points at the same place, decided in one place.
    $$('[data-site="email-link"]').forEach(a => {
      a.href = contactHref(`Enquiry — ${SITE.name}`);
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

    $("#servicesNote").textContent = SERVICES_NOTE || "";
    if (!SERVICES_NOTE) $("#servicesNote").hidden = true;

    document.title = `${SITE.name} — ${SITE.role}`;
    if (SITE.description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", SITE.description);
    }
  }

  /* ================= reviews =================
     Live mode talks to Supabase's REST API directly — no SDK, no
     third-party script. Without keys it falls back to the hand-written
     REVIEWS list and the email button. */

  const liveReviews = Boolean(SUPABASE && SUPABASE.url && SUPABASE.anonKey);
  const TABLE = "reviews";

  const sbHeaders = () => ({
    "apikey": SUPABASE.anonKey,
    "Authorization": `Bearer ${SUPABASE.anonKey}`,
    "Content-Type": "application/json"
  });

  const starRow = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined,
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

    if (!reviews.length) {
      box.hidden = true;
      count.textContent = "None yet";
      return;
    }
    const rated = reviews.filter(r => r.rating);
    const avg = rated.length
      ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length
      : 0;

    box.hidden = !rated.length;
    $("#avgScore").textContent = avg.toFixed(1);
    $("#avgStars").textContent = starRow(Math.round(avg));
    $("#avgCount").textContent =
      `${rated.length} ${rated.length === 1 ? "rating" : "ratings"}`;
    count.textContent =
      `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`;
  }

  function paintReviews(reviews) {
    const list = $("#reviewsList");
    list.innerHTML = reviews.map((r, i) => {
      const body = r.comment || r.quote || "";
      const when = r.created_at ? fmtDate(r.created_at) : (r.role || "");
      return `
        <figure class="review" style="--i:${i}">
          ${r.rating ? `<div class="review__stars" aria-label="${r.rating} out of 5">${starRow(r.rating)}</div>` : ""}
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
              data-value="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("");

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

    const picker = buildStarPicker();

    textEl.addEventListener("input", () => {
      $("#rCount").textContent = String(textEl.value.length);
    });

    const load = async () => {
      status("Loading reviews…");
      try {
        const reviews = await fetchReviews();
        status("");
        paintSummary(reviews);
        paintReviews(reviews);
      } catch (err) {
        // Say so plainly rather than showing an empty section that looks fine.
        status("Reviews could not be loaded right now. Please try again later.", "error");
        paintSummary([]);
        console.error("[reviews] load failed:", err);
      }
    };

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
      if (!rating)          return fail("Pick a star rating first.");
      if (name.length < 2)  return fail("Please add your name.", nameEl);
      if (comment.length < 4) return fail("Please write a few words.", textEl);

      submit.disabled = true;
      msg.className = "rform__msg";
      msg.textContent = "Posting…";

      try {
        await postReview({ name, rating, comment });
        form.reset();
        picker.reset();
        $("#rCount").textContent = "0";
        msg.className = "rform__msg is-ok";
        msg.textContent = "Thank you — your review is up.";
        await load();
      } catch (err) {
        msg.className = "rform__msg is-error";
        msg.textContent = "That didn't send. Please try again in a moment.";
        console.error("[reviews] post failed:", err);
      } finally {
        submit.disabled = false;
      }
    });

    await load();
  }

  function initStaticReviews() {
    const prompt = $("#reviewPrompt");
    const button = $("#reviewButton");

    $("#reviewForm").hidden = true;
    $("#reviewsCta").hidden = false;

    button.href = contactHref(`Review — ${SITE.name}`);
    if (useGmail) { button.target = "_blank"; button.rel = "noopener"; }

    paintSummary(REVIEWS);
    paintReviews(REVIEWS);

    prompt.textContent = REVIEWS.length
      ? "Worked with me? Send a review and it goes up here."
      : "No reviews yet. If I've worked for you, send one over and it goes up here.";
  }

  function renderReviews() {
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
      ? `About your script — ${item.title}`
      : `Enquiry — ${item.title}`;
    const enquiry =
      `<a class="btn-ghost" href="${esc(contactHref(subject))}"${contactAttrs()}>Email me about this</a>`;

    const id = `${kind}-${i}`;

    const right = isWork
      ? `${facts ? `<div class="work__facts">${facts}</div>` : ""}
         ${item.hook ? `<span class="work__label">Hook</span>
                        <p class="work__synopsis">${esc(item.hook)}</p>` : ""}
         ${alts ? `<span class="work__label">Other titles</span>
                   <ul class="work__bullets">${alts}</ul>` : ""}
         <div class="work__links">${[...custom, enquiry].join("")}</div>`
      : `${facts ? `<div class="work__facts">${facts}</div>` : ""}
         ${item.details ? `<span class="work__label">Details</span>
                           <p class="work__synopsis">${esc(item.details)}</p>` : ""}
         ${bullets ? `<span class="work__label">What you get</span>
                      <ul class="work__bullets">${bullets}</ul>` : ""}
         <div class="work__links">${[...custom, enquiry].join("")}</div>`;

    const summary = isWork ? item.description : item.summary;

    // Scripts stagger in the moment the button opens them; services further
    // down the page wait until you actually scroll to them.
    const revealClass = isWork ? "" : " reveal";

    return `
      <li class="work${revealClass}" style="--i:${i}">
        <button class="work__bar" type="button" aria-expanded="false" aria-controls="panel-${id}">
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
              <span class="work__label">Full script</span>
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

  /* Reveal-on-scroll for everything below the scripts. */
  function watchReveals() {
    const targets = $$(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(el => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);          // reveal once, then stop watching
      });
    }, { rootMargin: "0px 0px -12% 0px" });

    targets.forEach(el => io.observe(el));
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
  }

  /* ---------- the yin-yang ---------- */
  function bindEnter() {
    const btn   = $("#enter");
    const label = $("#enterLabel");
    const works = $("#works");

    const scrollTo = (el) =>
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

    const open = () => {
      document.body.classList.add("works-open");
      works.setAttribute("aria-hidden", "false");
      btn.setAttribute("aria-expanded", "true");
      label.textContent = "My work";
      scrollTo(works);
    };

    btn.addEventListener("click", () => {
      if (document.body.classList.contains("works-open")) scrollTo(works);
      else open();
    });

    // "Work" in the menu opens the section rather than jumping to a hidden one.
    $('.nav__links a[href="#works"]').addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
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

  /* ---------- intro ---------- */
  function runIntro() {
    const loader = $("#loader");
    const count  = $("#count");
    const bar    = $("#bar");

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      loader.classList.add("is-done");
      document.body.classList.remove("is-loading");
      document.body.classList.add("is-ready");
    };

    if (reduceMotion) {
      count.textContent = "100";
      finish();
      return;
    }

    const DURATION = 1400;
    const start = performance.now();

    // rAF is paused in a hidden tab. Without this the loader could sit on a
    // black screen until the visitor focuses the page.
    setTimeout(finish, DURATION + 1200);

    (function tick(now) {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);              // ease-out cubic
      count.textContent = String(Math.round(eased * 100)).padStart(2, "0");
      bar.style.width = (eased * 100) + "%";
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(finish, 260);
    })(start);
  }

  document.addEventListener("DOMContentLoaded", () => {
    hydrate();
    renderList("#worksList", WORKS, "work");
    renderList("#servicesList", SERVICES, "service");
    renderReviews();
    watchReveals();          // after render, so the generated rows are seen
    watchScroll();
    bindEnter();
    runIntro();
  });
})();
