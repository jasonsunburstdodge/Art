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

  toggle.addEventListener("click", () => {
    if (panel.hidden) open();
    else close();
  });

  panel.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });
})();
