(() => {
  "use strict";
  const cookieName = "stc_privacy_preferences";
  const legacyCookieName = "stc_consent_v1";
  const maxAge = 60 * 60 * 24 * 183;
  const banner = document.querySelector("[data-consent-banner]");
  const dialog = document.querySelector("[data-consent-dialog]");
  const paymentChoice = document.querySelector("[data-payment-choice]");
  const paymentRoot = document.querySelector("[data-payment-root]");

  function parseChoice(name) {
    const item = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
    if (!item) return null;
    try {
      const value = JSON.parse(decodeURIComponent(item.slice(name.length + 1)));
      return value && value.version === 1 && typeof value.payments === "boolean" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function readChoice() {
    const current = parseChoice(cookieName);
    if (current) return current;
    const legacy = parseChoice(legacyCookieName);
    if (!legacy) return null;
    const migrated = writeChoice(legacy.payments);
    document.cookie = legacyCookieName + "=; Path=/; Max-Age=0; SameSite=Lax; Secure";
    return migrated;
  }

  function writeChoice(payments) {
    const value = encodeURIComponent(JSON.stringify({ version: 1, payments: Boolean(payments), savedAt: new Date().toISOString() }));
    document.cookie = cookieName + "=" + value + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax; Secure";
    document.cookie = legacyCookieName + "=; Path=/; Max-Age=0; SameSite=Lax; Secure";
    return { version: 1, payments: Boolean(payments) };
  }

  function setPageLocked(locked) {
    const shell = document.querySelector(".shell");
    if (!shell) return;
    if (locked) {
      shell.setAttribute("inert", "");
      document.documentElement.style.overflow = "hidden";
    } else {
      shell.removeAttribute("inert");
      document.documentElement.style.overflow = "";
    }
  }

  function loadStripe() {
    if (!paymentRoot || paymentRoot.dataset.loaded === "true") return;
    paymentRoot.dataset.loaded = "true";
    paymentRoot.replaceChildren();
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/buy-button.js";
    script.async = true;
    script.onload = () => {
      const button = document.createElement("stripe-buy-button");
      button.setAttribute("buy-button-id", "buy_btn_1USc74D2yOkvJ6F5Ce3IW5Ru");
      button.setAttribute("publishable-key", "pk_live_51TSF7fD2yOkvJ6F5CO0vMqkFNHlAcanOFSyc1er8EvFqeKjyIZjg8jtLyI4f7NtU2NjcHH6hWSEExaHQ5oCry1FY00skI39WI3");
      paymentRoot.replaceChildren(button);
    };
    script.onerror = () => {
      paymentRoot.dataset.loaded = "false";
      const message = document.createElement("p");
      message.className = "payment-placeholder";
      message.textContent = "The secure payment card could not be loaded. Please try again.";
      paymentRoot.replaceChildren(message);
    };
    document.head.appendChild(script);
  }

  function applyChoice(choice, previousChoice) {
    if (banner) banner.hidden = true;
    setPageLocked(false);
    if (choice.payments) {
      loadStripe();
    } else if (paymentRoot && previousChoice && previousChoice.payments) {
      window.location.reload();
    }
  }

  function save(payments) {
    const previousChoice = readChoice();
    const choice = writeChoice(payments);
    if (dialog && dialog.open) dialog.close();
    applyChoice(choice, previousChoice);
  }

  function openPreferences() {
    const choice = readChoice();
    if (paymentChoice) paymentChoice.checked = Boolean(choice && choice.payments);
    if (dialog && typeof dialog.showModal === "function") dialog.showModal();
  }

  document.querySelectorAll("[data-consent-manage]").forEach((button) => button.addEventListener("click", openPreferences));
  document.querySelector("[data-consent-accept]")?.addEventListener("click", () => save(true));
  document.querySelector("[data-consent-dialog-accept]")?.addEventListener("click", () => save(true));
  document.querySelector("[data-consent-reject]")?.addEventListener("click", () => save(false));
  document.querySelector("[data-consent-save]")?.addEventListener("click", (event) => {
    event.preventDefault();
    save(Boolean(paymentChoice && paymentChoice.checked));
  });
  document.querySelector("[data-enable-payments]")?.addEventListener("click", () => save(true));

  const choice = readChoice();
  if (choice) applyChoice(choice, null);
  else if (banner) {
    setPageLocked(true);
    banner.hidden = false;
    document.querySelector("[data-consent-accept]")?.focus();
  }
})();