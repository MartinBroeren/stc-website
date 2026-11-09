(() => {
  "use strict";

  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-site-nav]");
  navToggle?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open") ?? false;
    navToggle.setAttribute("aria-expanded", String(open));
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
  }));

  const header = document.querySelector(".site-header");
  const updateHeader = () => {
    if (!header) return;
    if (!header.classList.contains("is-scrolled") && window.scrollY > 140) {
      header.classList.add("is-scrolled");
    } else if (header.classList.contains("is-scrolled") && window.scrollY < 12) {
      header.classList.remove("is-scrolled");
    }
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const setPosterShape = (image) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const shape = ratio < .7 ? "reel" : ratio < .9 ? "portrait" : "square";
    image.closest(".event-feature")?.setAttribute("data-poster-shape", shape);
  };

  document.querySelectorAll(".event-image img").forEach((image) => {
    if (image.complete) setPosterShape(image);
    else image.addEventListener("load", () => setPosterShape(image), { once: true });
  });

  const renderFeaturedEvent = async () => {
    const section = document.querySelector("[data-events-section]");
    const stage = document.querySelector("[data-event-stage]");
    if (!section || !stage) return;

    const hideFeature = () => {
      section.classList.add("no-upcoming");
      stage.replaceChildren();
    };

    try {
      const response = await fetch("/data/events.json", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Event data is unavailable.");
      const payload = await response.json();
      const now = Date.now();
      const upcoming = (Array.isArray(payload.events) ? payload.events : [])
        .filter((item) => item.status === "published" && Date.parse(item.end) >= now)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
      if (!upcoming) {
        hideFeature();
        return;
      }

      const article = document.createElement("article");
      article.className = "event-feature visible";
      article.dataset.eventEnd = upcoming.end;

      const imageWrap = document.createElement("div");
      imageWrap.className = "event-image";
      const image = document.createElement("img");
      image.src = upcoming.image;
      image.alt = upcoming.imageAlt || `${upcoming.title} event artwork`;
      image.addEventListener("load", () => setPosterShape(image), { once: true });
      imageWrap.append(image);

      const details = document.createElement("div");
      details.className = "event-details";
      const eyebrow = document.createElement("span");
      eyebrow.className = "eyebrow";
      eyebrow.textContent = `Next event · ${upcoming.venue}`;
      const title = document.createElement("h3");
      title.textContent = upcoming.title;
      const meta = document.createElement("div");
      meta.className = "event-meta";
      const date = document.createElement("span");
      date.textContent = upcoming.dateLabel;
      const place = document.createElement("span");
      place.textContent = `${upcoming.timeLabel} · ${upcoming.city}`;
      meta.append(date, place);
      const lineup = document.createElement("p");
      lineup.className = "event-lineup";
      lineup.textContent = Array.isArray(upcoming.lineup) ? upcoming.lineup.join(" · ") : "";
      const tickets = document.createElement("a");
      tickets.className = "button";
      tickets.href = upcoming.ticketUrl;
      tickets.textContent = "Tickets ↗";
      details.append(eyebrow, title, meta, lineup, tickets);
      article.append(imageWrap, details);
      stage.replaceChildren(article);
    } catch (error) {
      hideFeature();
    }
  };

  renderFeaturedEvent();

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.04, rootMargin: "0px 0px -4% 0px" })
    : null;

  document.querySelectorAll("[data-reveal]").forEach((item) => {
    if (observer) observer.observe(item);
    else item.classList.add("visible");
  });

  document.querySelectorAll("[data-current-year]").forEach((item) => {
    item.textContent = String(new Date().getFullYear());
  });

  const form = document.querySelector("[data-community-form]");
  const status = document.querySelector("[data-form-status]");
  if (!form || !status) return;

  const setStatus = (message, type) => {
    status.textContent = message;
    status.className = `form-status visible ${type}`;
    status.setAttribute("role", type === "success" ? "status" : "alert");
    status.focus({ preventScroll: true });
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    submit.textContent = "Sending...";
    status.className = "form-status";

    const data = Object.fromEntries(new FormData(form).entries());
    data.email_updates = data.email_updates === "yes";
    data.membership_consent = data.membership_consent === "yes";
    data.consent_version = "community-v1-2026-11";

    try {
      const response = await fetch("/.netlify/functions/community-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "We could not process your registration.");

      form.reset();
      setStatus("You are in. Check your inbox for the next step and your STC community invite.", "success");
    } catch (error) {
      setStatus(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Become part of STC";
    }
  });
})();
