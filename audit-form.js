(() => {
  "use strict";

  let overlay, form, titleEl, notesEl, charCountEl, lastTrigger;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "audit-modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
        <button type="button" class="audit-modal-close" aria-label="Close">&times;</button>
        <h2 id="audit-modal-title" class="audit-modal-title">Audit</h2>
        <p class="audit-modal-sub">Tell us a bit about your business and we'll get back to you within 24 hours.</p>
        <form class="audit-modal-form">
          <div class="audit-field-row">
            <label class="audit-field">First Name*<input type="text" name="firstName" autocomplete="given-name" required></label>
            <label class="audit-field">Last Name*<input type="text" name="lastName" autocomplete="family-name" required></label>
          </div>
          <div class="audit-field-row">
            <label class="audit-field">Email*<input type="email" name="email" autocomplete="email" required></label>
            <label class="audit-field">Phone*<input type="tel" name="phone" autocomplete="tel" required></label>
          </div>
          <label class="audit-field audit-field-full">Website Address*<input type="text" name="website" autocomplete="url" placeholder="yourbusiness.com" required></label>
          <label class="audit-field audit-field-full">Additional Information<textarea name="notes" maxlength="5000" rows="5" placeholder="Anything else we should know? (optional)"></textarea></label>
          <div class="audit-char-count"><span class="audit-char-count-num">0</span> / 5,000</div>
          <button type="submit" class="cta audit-submit">Submit Request &rarr;</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    form = overlay.querySelector("form");
    titleEl = overlay.querySelector(".audit-modal-title");
    notesEl = overlay.querySelector("textarea[name=notes]");
    charCountEl = overlay.querySelector(".audit-char-count-num");

    overlay.querySelector(".audit-modal-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) close();
    });

    notesEl.addEventListener("input", () => {
      charCountEl.textContent = notesEl.value.length;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Placeholder only: no backend is wired up yet, so this just closes
      // the form. Once a form backend (e.g. Formspree) is configured, this
      // is where the submission gets sent, an auto-reply thanks the
      // submitter, and the data forwards to info@silverxis.com.
      close();
      form.reset();
      charCountEl.textContent = "0";
    });
  }

  function open(type, trigger) {
    if (!overlay) build();
    titleEl.textContent = type;
    lastTrigger = trigger || null;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    const firstField = form.querySelector("input");
    if (firstField) firstField.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-audit-type]");
    if (!trigger) return;
    e.preventDefault();
    open(trigger.getAttribute("data-audit-type"), trigger);
  });
})();
