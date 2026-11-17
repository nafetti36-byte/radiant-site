// Mobile menu
const burger = document.getElementById("burger");
const nav = document.getElementById("nav");
burger?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});
nav?.addEventListener("click", (e) => {
  if (e.target.closest("a")) { nav.classList.remove("open"); burger?.setAttribute("aria-expanded", "false"); }
});

// Analytics: only if a GA4 ID is configured AND the visitor accepts.
const gaId = document.body.dataset.ga;
const KEY = "radiant_consent";
function loadGA() {
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", gaId, { anonymize_ip: true });
  // Count inquiry submissions as a key event.
  document.querySelectorAll("form[name]").forEach((f) =>
    f.addEventListener("submit", () => window.gtag("event", "generate_lead", { form_name: f.getAttribute("name") })));
}
if (gaId) {
  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch {}
  const banner = document.getElementById("consent");
  if (choice === "yes") loadGA();
  else if (choice !== "no" && banner) {
    banner.hidden = false;
    banner.addEventListener("click", (e) => {
      const b = e.target.closest("[data-consent]");
      if (!b) return;
      const v = b.dataset.consent;
      try { localStorage.setItem(KEY, v); } catch {}
      banner.hidden = true;
      if (v === "yes") loadGA();
    });
  }
}
