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

  document.querySelectorAll(".event-image img").forEach((image) => {
    const setPosterShape = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      const shape = ratio < .7 ? "reel" : ratio < .9 ? "portrait" : "square";
      image.closest(".event-feature")?.setAttribute("data-poster-shape", shape);
    };
    if (image.complete) setPosterShape();
    else image.addEventListener("load", setPosterShape, { once: true });
  });

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

  document.querySelectorAll("[data-upcoming-event]").forEach((event) => {
    const end = Date.parse(event.dataset.eventEnd || "");
    if (!Number.isFinite(end) || Date.now() <= end) return;
    event.hidden = true;
    event.closest("[data-events-section]")?.classList.add("no-upcoming");
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
