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

  /* ---------- reviews ---------- */
  function renderReviews() {
    const list   = $("#reviewsList");
    const count  = $("#reviewCount");
    const prompt = $("#reviewPrompt");
    const button = $("#reviewButton");

    button.href = contactHref(`Review — ${SITE.name}`);
    if (useGmail) { button.target = "_blank"; button.rel = "noopener"; }

    const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

    if (!REVIEWS.length) {
      count.textContent = "None yet";
      list.innerHTML = "";
      prompt.textContent =
        "No reviews yet. If I've worked for you, send one over and it goes up here.";
      return;
    }

    count.textContent = REVIEWS.length === 1 ? "1 review" : `${REVIEWS.length} reviews`;
    prompt.textContent = "Worked with me? Send a review and it goes up here.";

    list.innerHTML = REVIEWS.map((r, i) => `
      <figure class="review reveal" style="--i:${i}">
        ${r.rating ? `<div class="review__stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</div>` : ""}
        <blockquote class="review__quote">${esc(r.quote)}</blockquote>
        <figcaption class="review__by">
          <span class="review__name">${esc(r.name)}</span>
          ${r.role ? `<span class="review__role">${esc(r.role)}</span>` : ""}
        </figcaption>
      </figure>`).join("");
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
