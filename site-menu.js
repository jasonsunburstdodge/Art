(() => {
  "use strict";

  // Every internal link is a full page navigation between static pages.
  // Without this, some browsers (mobile Safari especially) restore the
  // scroll position a page was left at last time instead of starting at
  // the top, and back/forward navigation can do the same. Force every
  // fresh load to the top unless the URL points at an in-page anchor
  // (e.g. index.html#contact), which should still scroll to that section.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!window.location.hash) window.scrollTo(0, 0);
})();

(() => {
  "use strict";

  const toggle = document.querySelector(".site-menu-toggle");
  const panel = document.getElementById("site-menu-panel");
  if (!toggle || !panel) return;

  function open() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("click", onOutsideClick, true);
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onOutsideClick, true);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      close();
      toggle.focus();
    }
  }

  function onOutsideClick(e) {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) close();
  }

  function pulse() {
    toggle.classList.remove("pulse");
    // Restart the animation even if it's already mid-run from a rapid tap.
    void toggle.offsetWidth;
    toggle.classList.add("pulse");
  }
  toggle.addEventListener("animationend", () => toggle.classList.remove("pulse"));

  toggle.addEventListener("pointerdown", pulse);

  toggle.addEventListener("click", () => {
    if (panel.hidden) open();
    else close();
    if (typeof window.fireAllSynapses === "function") window.fireAllSynapses();
  });

  panel.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });
})();
