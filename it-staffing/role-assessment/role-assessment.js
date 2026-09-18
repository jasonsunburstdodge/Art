(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Free IT Role Assessment
  //
  // A transparent, rules-based tool. Role title, seniority, and skill
  // category are guessed with simple keyword matching over whatever text
  // the visitor provides — there is no AI model and no hidden scoring.
  // Every guess is shown back to the visitor and can be corrected before
  // results are generated.
  //
  // Flow: path -> input -> extract (classify requirements) -> seniority
  //       -> engagement -> delivery -> timeline -> notes -> results ->
  //       optional expert-review handoff.
  // ---------------------------------------------------------------------

  const root = document.getElementById("role-app");
  if (!root) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function trackEvent(name, params) {
    const detail = Object.assign({ event: name }, params || {});
    try {
      if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
    } catch (e) { /* analytics must never break the assessment */ }
    document.dispatchEvent(new CustomEvent("silverxis:analytics", { detail }));
  }

  // -----------------------------------------------------------------
  // Skill categories, matched against the site's real IT Staffing
  // disciplines (see it-staffing/index.html and talent-solutions/).
  // -----------------------------------------------------------------
  const CATEGORIES = {
    development: { label: "Software Development", keywords: ["develop", "engineer", "full-stack", "full stack", "frontend", "front-end", "front end", "backend", "back-end", "back end", "mobile", "react", "java", "python", "javascript", "node", "api", "code", "coding", "application", "software"] },
    cloud: { label: "Cloud & Infrastructure", keywords: ["cloud", "aws", "azure", "gcp", "devops", "infrastructure", "network", "systems engineer", "kubernetes", "docker", "sysadmin", "site reliability"] },
    data: { label: "Data & Intelligence", keywords: ["data engineer", "data analyst", "data scientist", "analytics", "machine learning", " ai ", "artificial intelligence", "etl", "warehouse", "sql", "reporting", "business intelligence"] },
    quality: { label: "Quality & Delivery", keywords: ["qa", "quality assurance", "automation engineer", "test", "tester", "business analyst", "project manager", "scrum", "agile", "delivery manager"] },
    leadership: { label: "Technology Leadership", keywords: ["architect", "technical lead", "tech lead", "it manager", "director of", "head of", "consultant", "principal engineer", "cto"] }
  };
  const CATEGORY_ORDER = ["development", "cloud", "data", "quality", "leadership"];

  const SENIORITY_KEYWORDS = [
    ["Lead / Principal", ["principal", "lead engineer", "tech lead", "technical lead", "staff engineer", "architect", "director", "head of"]],
    ["Senior", ["senior", "sr.", "sr "]],
    ["Mid-Level", ["mid-level", "mid level", "intermediate"]],
    ["Junior / Entry-Level", ["junior", "entry level", "entry-level", "associate", "intern"]]
  ];

  const SENIORITY_OPTIONS = ["Junior / Entry-Level", "Mid-Level", "Senior", "Lead / Principal", "Not Sure"];
  const ENGAGEMENT_OPTIONS = ["Contract Staffing", "Contract-to-Hire", "Direct Placement", "Dedicated Team", "Not Sure Yet"];
  const DELIVERY_OPTIONS = ["Onshore", "Nearshore", "Offshore", "Blended / No Preference"];
  const TIMELINE_OPTIONS = ["Immediately", "Within 2 Weeks", "Within a Month", "1–3 Months", "Just Exploring"];

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------
  const STEP_ORDER = ["start", "path", "input", "extract", "seniority", "engagement", "delivery", "timeline", "notes", "results"];
  const STEP_STAGE = {
    path: "Role", input: "Role",
    extract: "Requirements", seniority: "Requirements",
    engagement: "Engagement", delivery: "Engagement",
    timeline: "Timeline", notes: "Assessment"
  };
  const STAGES = ["Role", "Requirements", "Engagement", "Timeline", "Assessment"];
  const STAGE_SHORT = { Role: "1", Requirements: "2", Engagement: "3", Timeline: "4", Assessment: "5" };

  let stepIndex = 0;
  let started = false;
  let completed = false;

  const state = {
    path: null,
    rawText: "",
    titleHint: "",
    detectedTitle: null,
    detectedSeniority: null,
    detectedCategory: null,
    requirements: [],
    seniority: null,
    engagement: null,
    delivery: null,
    timeline: null,
    notes: ""
  };

  // -----------------------------------------------------------------
  // Extraction (simple, documented keyword rules — not real NLP)
  // -----------------------------------------------------------------
  function extractRequirementLines(text) {
    // Strips a leading bullet or numbered-list marker only — never bare
    // leading digits, which would eat real content like "5+ years".
    const clean = (s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    let lines = text.split("\n").map(clean).filter((l) => l.length >= 8 && l.length <= 160);
    if (lines.length < 2) {
      lines = text.split(/[.;](?:\s+|$)/).map(clean).filter((l) => l.length >= 8 && l.length <= 160);
    }
    return lines.slice(0, 8);
  }

  function runExtraction() {
    const text = state.rawText;
    const lower = (state.titleHint + " " + text).toLowerCase();

    // When the title is guessed from the pasted text's first line, that
    // line is excluded from requirement extraction so it isn't also
    // listed as a requirement.
    let requirementSource = text;
    if (state.path === "describe" && state.titleHint.trim()) {
      state.detectedTitle = state.titleHint.trim();
    } else {
      const firstLine = (text.split("\n")[0] || "").trim().replace(/^[-*•]\s*/, "");
      if (firstLine.length > 0 && firstLine.length <= 80) {
        state.detectedTitle = firstLine;
        requirementSource = text.split("\n").slice(1).join("\n");
      } else {
        state.detectedTitle = null;
      }
    }

    state.detectedSeniority = null;
    for (let i = 0; i < SENIORITY_KEYWORDS.length; i++) {
      const label = SENIORITY_KEYWORDS[i][0], keywords = SENIORITY_KEYWORDS[i][1];
      if (keywords.some((k) => lower.includes(k))) { state.detectedSeniority = label; break; }
    }

    let bestKey = null, bestScore = 0;
    CATEGORY_ORDER.forEach((key) => {
      const score = CATEGORIES[key].keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; bestKey = key; }
    });
    state.detectedCategory = bestScore > 0 ? bestKey : null;

    const lines = extractRequirementLines(requirementSource);
    state.requirements = lines.length
      ? lines.map((t) => ({ text: t, status: "preferred" }))
      : [{ text: "Add the first requirement for this role", status: "preferred" }];
  }

  // -----------------------------------------------------------------
  // Results
  // -----------------------------------------------------------------
  function buildResult() {
    const musts = state.requirements.filter((r) => r.status === "must");
    const preferreds = state.requirements.filter((r) => r.status === "preferred");

    let clarity;
    if (musts.length === 0 && preferreds.length === 0) clarity = "Needs Definition";
    else if (musts.length >= 2) clarity = "Well Defined";
    else clarity = "Partially Defined";

    const categoryLabel = state.detectedCategory ? CATEGORIES[state.detectedCategory].label : "Not Determined";

    let engagement = state.engagement;
    let engagementSuggested = false;
    if (!engagement || engagement === "Not Sure Yet") {
      engagementSuggested = true;
      if (state.timeline === "Immediately" || state.timeline === "Within 2 Weeks") engagement = "Contract Staffing";
      else if (state.seniority === "Lead / Principal") engagement = "Dedicated Team";
      else if (state.timeline === "1–3 Months" || state.timeline === "Just Exploring") engagement = "Direct Placement";
      else engagement = "Contract-to-Hire";
    }

    const tagSource = musts.length ? musts : preferreds;
    const tags = tagSource.slice(0, 5).map((r) => (r.text.length > 42 ? r.text.slice(0, 39) + "…" : r.text));

    const qqSource = musts.length ? musts : preferreds.slice(0, 3);
    const qq = qqSource.slice(0, 5).map((r) => `Ask the candidate to describe hands-on experience with: “${r.text}”`);
    if (qq.length === 0) qq.push("Ask the candidate to walk through how their background matches the core responsibilities of this role.");

    return { musts, preferreds, clarity, categoryLabel, engagement, engagementSuggested, tags, qq };
  }

  function buildNarrative(result) {
    const points = [];

    if (result.clarity === "Needs Definition") {
      points.push({ h: "Role Clarity", p: "None of the requirements pulled from your description were marked Must Have yet. Before recruiting starts, decide which two or three requirements are truly non-negotiable, that's what turns a long wish list into a role someone can actually be qualified against." });
    } else if (result.clarity === "Partially Defined") {
      points.push({ h: "Role Clarity", p: "You've flagged at least one must-have requirement, which is a start. Most roles are easier to fill well once there are two or more clear non-negotiables, so candidates can be qualified with confidence instead of guesswork." });
    } else {
      points.push({ h: "Role Clarity", p: "You've identified multiple must-have requirements, which gives SilverXis a clear, specific bar to qualify candidates against instead of relying on job titles or keyword matching." });
    }

    if (result.engagementSuggested) {
      points.push({ h: "Engagement Fit", p: `Based on your timeline and seniority level, ${result.engagement} looks like the best starting point. This is a suggestion, not a final recommendation, a SilverXis staffing specialist can confirm it fits your situation.` });
    } else {
      points.push({ h: "Engagement Fit", p: `${result.engagement} is a reasonable fit for a ${state.seniority || "role at this"} level position with a timeline of ${state.timeline || "your stated timeline"}.` });
    }

    const seniorRush = (state.seniority === "Lead / Principal" || state.seniority === "Senior") &&
      (state.timeline === "Immediately" || state.timeline === "Within 2 Weeks");
    if (seniorRush) {
      points.push({ h: "Timeline Reality Check", p: "Senior and specialized roles with an immediate start typically take longer to fill than the timeline suggests. Staying flexible on the exact start date, or using Contract Staffing while a permanent search continues, often keeps the work moving without waiting on a perfect match." });
    } else {
      points.push({ h: "Timeline Reality Check", p: "Your timeline and role scope look reasonable together. Sharpening the must-have list further will help keep the search focused once recruiting starts." });
    }

    return points;
  }

  // -----------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------
  const progressEl = document.querySelector(".role-progress");
  const contentEl = root.querySelector("#role-step-content");

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  function renderProgress() {
    const stage = STEP_STAGE[STEP_ORDER[stepIndex]];
    progressEl.hidden = !started || completed;
    progressEl.innerHTML = STAGES.map((s) => {
      const idx = STAGES.indexOf(s);
      const curIdx = STAGES.indexOf(stage);
      const cls = s === stage ? "is-active" : idx < curIdx ? "is-done" : "";
      return `<li class="${cls}" data-short="${STAGE_SHORT[s]}">${s}</li>`;
    }).join("");
  }

  function goTo(index, opts) {
    opts = opts || {};
    const completedStep = STEP_ORDER[stepIndex];
    stepIndex = index;
    render();
    if (!opts.silent) trackEvent("role_assessment_step_completed", { step: completedStep });
    if (!reduceMotion) window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
  }

  function renderNav(opts) {
    opts = opts || {};
    return `
      <div class="role-nav">
        <button type="button" class="role-btn-back" ${stepIndex <= 1 ? "disabled" : ""} data-action="back">&larr; Back</button>
        <button type="${opts.submit ? "submit" : "button"}" class="role-btn-continue" data-action="continue">${opts.label || "Continue →"}</button>
      </div>
    `;
  }

  function attachNav(container, onContinue) {
    container.querySelector('[data-action="back"]').addEventListener("click", () => {
      if (stepIndex > 1) goTo(stepIndex - 1, { silent: true });
    });
    const continueBtn = container.querySelector('[data-action="continue"]');
    if (continueBtn.type !== "submit") continueBtn.addEventListener("click", onContinue);
  }

  function render() {
    const step = STEP_ORDER[stepIndex];
    renderProgress();
    if (step === "start") return renderStart();
    if (step === "path") return renderPathStep();
    if (step === "input") return renderInputStep();
    if (step === "extract") return renderExtractStep();
    if (step === "seniority") {
      if (!state.seniority && state.detectedSeniority) state.seniority = state.detectedSeniority;
      return renderBigChoiceStep({ step, question: "What seniority level does this role need?", subtext: "Choose the closest fit — you can adjust this anytime.", options: SENIORITY_OPTIONS, field: "seniority" });
    }
    if (step === "engagement") return renderBigChoiceStep({ step, question: "How do you want to add this person?", subtext: "Choose the engagement model that fits, or tell us you're not sure.", options: ENGAGEMENT_OPTIONS, field: "engagement" });
    if (step === "delivery") return renderBigChoiceStep({ step, question: "Where should this talent be located?", subtext: "Choose the delivery model that fits your team.", options: DELIVERY_OPTIONS, field: "delivery" });
    if (step === "timeline") return renderBigChoiceStep({ step, question: "When do you need this role filled?", subtext: "This gives us context — it isn't a commitment.", options: TIMELINE_OPTIONS, field: "timeline" });
    if (step === "notes") return renderNotesStep();
    if (step === "results") return renderResults();
  }

  function renderStart() {
    // The intro/H1/CTA/microcopy already live as static, always-crawlable
    // markup in the page hero above the app mount point; its "Start My
    // Assessment" button calls window.__roleStart directly.
    contentEl.innerHTML = "";
  }

  function renderPathStep() {
    contentEl.innerHTML = `
      <div class="role-card" data-step="path">
        <h2 class="role-question">How do you want to start?</h2>
        <p class="role-subtext">Choose whichever is easier — both lead to the same assessment.</p>
        <div class="role-path-grid" role="group">
          <button type="button" class="role-path-btn" data-value="paste" aria-pressed="${state.path === "paste"}">Paste a Job Description<span>We'll pull out a starting set of requirements for you to refine.</span></button>
          <button type="button" class="role-path-btn" data-value="describe" aria-pressed="${state.path === "describe"}">Describe the Role Yourself<span>Answer in your own words — no job description needed.</span></button>
        </div>
      </div>
    `;
    const container = contentEl.querySelector('[data-step="path"]');
    container.querySelectorAll(".role-path-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.path = btn.getAttribute("data-value");
        goTo(stepIndex + 1);
      });
    });
  }

  function renderInputStep() {
    const isPaste = state.path === "paste";
    contentEl.innerHTML = `
      <form class="role-card" data-step="input">
        <h2 class="role-question">${isPaste ? "Paste the Job Description" : "Describe the Role"}</h2>
        <p class="role-subtext">${isPaste ? "Paste as much or as little as you have — we'll turn it into a starting checklist." : "Tell us the job title and what this person needs to do and know."}</p>
        ${isPaste ? "" : `<input type="text" class="role-text-input" name="titleHint" maxlength="80" placeholder="Job title (e.g. Senior Backend Developer)" value="${escapeAttr(state.titleHint)}">`}
        <textarea class="role-textarea" name="rawText" maxlength="4000" placeholder="${isPaste ? "Paste the job description here..." : "What will this person be responsible for, and what skills or experience do they need?"}">${escapeHtml(state.rawText)}</textarea>
        <p class="role-privacy-note">Nothing you type here is stored or sent anywhere. It's used only to build your assessment, unless you choose to submit your contact information at the end.</p>
        <p class="role-error" hidden>Add a bit more detail so we have something to work with.</p>
        ${renderNav({ label: "Extract Requirements →" })}
      </form>
    `;
    const form = contentEl.querySelector("form");
    if (!isPaste) {
      form.querySelector('input[name="titleHint"]').addEventListener("input", (e) => { state.titleHint = e.target.value; });
    }
    form.querySelector('textarea[name="rawText"]').addEventListener("input", (e) => { state.rawText = e.target.value; });
    attachNav(form, () => {
      if (state.rawText.trim().length < 15) {
        form.querySelector(".role-error").hidden = false;
        return;
      }
      runExtraction();
      goTo(stepIndex + 1);
    });
  }

  function roleChipsHTML() {
    const n = state.requirements.length;
    if (n === 0) return "";
    const radius = 100;
    return state.requirements.map((r, i) => {
      const angle = (-90 + (360 / n) * i) * Math.PI / 180;
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius);
      return `<span class="role-chip status-${r.status}" style="transform:translate(${x}px, ${y}px)"></span>`;
    }).join("");
  }

  function metaChipHTML(label, value) {
    return `<span class="role-meta-chip${value ? "" : " is-empty"}">${escapeHtml(label)}: ${value ? escapeHtml(value) : "Not detected"}</span>`;
  }

  function reqRowHTML(r, i) {
    return `
      <div class="role-req-row">
        <span class="role-req-text">${escapeHtml(r.text)}</span>
        <div class="role-req-toggles">
          <button type="button" class="role-req-toggle" data-req-toggle="must" data-index="${i}" aria-pressed="${r.status === "must"}">Must Have</button>
          <button type="button" class="role-req-toggle" data-req-toggle="preferred" data-index="${i}" aria-pressed="${r.status === "preferred"}">Preferred</button>
          <button type="button" class="role-req-toggle" data-req-toggle="skip" data-index="${i}" aria-pressed="${r.status === "skip"}">Skip</button>
        </div>
        <button type="button" class="role-req-remove" data-req-remove data-index="${i}" aria-label="Remove this requirement">&times;</button>
      </div>
    `;
  }

  function renderExtractStep() {
    const mustCount = state.requirements.filter((r) => r.status === "must").length;
    contentEl.innerHTML = `
      <div class="role-card" data-step="extract">
        <h2 class="role-question">Here's a Starting Checklist</h2>
        <p class="role-subtext">We pulled these from what you shared. Mark each one Must Have, Preferred, or Skip, and add anything we missed.</p>

        <div class="role-visual${mustCount > 0 ? " is-defined" : ""}">
          <svg viewBox="0 0 260 260" role="presentation" focusable="false">
            <polygon class="role-hexagon" points="130,40 207.9,85 207.9,175 130,220 52.1,175 52.1,85" />
          </svg>
          ${roleChipsHTML()}
        </div>

        <div class="role-meta-chips">
          ${metaChipHTML("Title", state.detectedTitle)}
          ${metaChipHTML("Seniority", state.detectedSeniority)}
          ${metaChipHTML("Category", state.detectedCategory ? CATEGORIES[state.detectedCategory].label : null)}
        </div>

        <div class="role-req-list">
          ${state.requirements.map((r, i) => reqRowHTML(r, i)).join("")}
        </div>

        <div class="role-add-row">
          <input type="text" class="role-text-input" id="role-add-input" maxlength="160" placeholder="Add a requirement we missed...">
          <button type="button" class="role-add-btn" data-action="add-req">Add</button>
        </div>

        <p class="role-error" hidden>Classify at least one requirement as Must Have or Preferred (or add one).</p>
        ${renderNav()}
      </div>
    `;
    const container = contentEl.querySelector('[data-step="extract"]');

    container.querySelectorAll("[data-req-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-index"));
        state.requirements[i].status = btn.getAttribute("data-req-toggle");
        renderExtractStep();
      });
    });
    container.querySelectorAll("[data-req-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-index"));
        state.requirements.splice(i, 1);
        renderExtractStep();
      });
    });
    const addBtn = container.querySelector('[data-action="add-req"]');
    const addInput = container.querySelector("#role-add-input");
    function addRequirement() {
      const value = addInput.value.trim();
      if (!value) return;
      state.requirements.push({ text: value, status: "preferred" });
      renderExtractStep();
    }
    addBtn.addEventListener("click", addRequirement);
    addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addRequirement(); } });

    attachNav(container, () => {
      const active = state.requirements.filter((r) => r.status !== "skip");
      if (active.length === 0) {
        container.querySelector(".role-error").hidden = false;
        return;
      }
      goTo(stepIndex + 1);
    });
  }

  function renderBigChoiceStep(cfg) {
    contentEl.innerHTML = `
      <div class="role-card" data-step="${cfg.step}">
        <h2 class="role-question">${cfg.question}</h2>
        <p class="role-subtext">${cfg.subtext}</p>
        <div class="role-big-grid" role="group">
          ${cfg.options.map((label) => `<button type="button" class="role-big-btn" data-value="${escapeAttr(label)}" aria-pressed="${state[cfg.field] === label}">${escapeHtml(label)}</button>`).join("")}
        </div>
        <p class="role-error" hidden>Please choose one option.</p>
        ${renderNav()}
      </div>
    `;
    const container = contentEl.querySelector(`[data-step="${cfg.step}"]`);
    container.querySelectorAll(".role-big-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state[cfg.field] = btn.getAttribute("data-value");
        container.querySelectorAll(".role-big-btn").forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      });
    });
    attachNav(container, () => {
      if (!state[cfg.field]) { container.querySelector(".role-error").hidden = false; return; }
      goTo(stepIndex + 1);
    });
  }

  function renderNotesStep() {
    contentEl.innerHTML = `
      <form class="role-card" data-step="notes">
        <h2 class="role-question">Anything else about this hire that matters?</h2>
        <p class="role-subtext">Optional. Budget range, team structure, must-have soft skills, whatever's useful.</p>
        <textarea class="role-textarea" name="notes" maxlength="600" placeholder="Type your answer here...">${escapeHtml(state.notes)}</textarea>
        ${renderNav({ label: "See My Assessment →" })}
      </form>
    `;
    const form = contentEl.querySelector("form");
    form.querySelector("textarea").addEventListener("input", (e) => { state.notes = e.target.value; });
    attachNav(form, () => {
      completed = true;
      trackEvent("role_assessment_completed", {});
      goTo(stepIndex + 1);
    });
  }

  function renderResults() {
    const result = buildResult();
    window.__roleResult = result;
    const narrative = buildNarrative(result);

    const profileRows = [
      ["Role Title", state.detectedTitle || state.titleHint || "Not specified"],
      ["Category", result.categoryLabel],
      ["Seniority Level", state.seniority || "Not specified"],
      ["Must-Have Requirements", String(result.musts.length)],
      ["Preferred Requirements", String(result.preferreds.length)],
      ["Role Clarity", result.clarity]
    ];
    const profileHTML = profileRows.map(([label, value]) => `
      <div class="role-profile-row">
        <span class="role-profile-label">${escapeHtml(label)}</span>
        <span class="role-profile-value">${escapeHtml(value)}</span>
      </div>
    `).join("");

    const pointsHTML = narrative.map((pt) => `
      <div class="role-point">
        <h4>${escapeHtml(pt.h)}</h4>
        <p>${escapeHtml(pt.p)}</p>
      </div>
    `).join("");

    const tagsHTML = result.tags.length
      ? `<div class="role-tag-list">${result.tags.map((t) => `<span class="role-tag">${escapeHtml(t)}</span>`).join("")}</div>`
      : `<div class="role-tag-list"><span class="role-tag">Not enough requirements defined yet</span></div>`;

    const qqHTML = `<ol class="role-qq-list">${result.qq.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ol>`;

    const engagementJustification = {
      "Contract Staffing": "Contract Staffing is typically the fastest way to add qualified capacity without committing to a permanent hire right away.",
      "Contract-to-Hire": "Contract-to-Hire lets your team confirm fit on real work before making a permanent decision.",
      "Direct Placement": "Direct Placement fits roles you already know you want to fill permanently from the start.",
      "Dedicated Team": "A Dedicated Team makes sense when a role's scope crosses multiple disciplines or the work is bigger than one hire."
    }[result.engagement] || "";

    contentEl.innerHTML = `
      <div class="role-card">
        <h2 class="role-results-heading">Your Role Clarity Assessment</h2>
        <p class="role-results-intro">Based on your answers, here's how clearly this role is defined and where SilverXis would start. This is a starting point, not a final qualification standard.</p>

        <div class="role-profile">${profileHTML}</div>

        <div class="role-section-block">
          <h3>What We're Seeing</h3>
          ${pointsHTML}
        </div>

        <div class="role-section-block">
          <h3>Recommended Candidate Profile</h3>
          <dl class="role-recommended-profile">
            <dt>Category</dt><dd>${escapeHtml(result.categoryLabel)}</dd>
            <dt>Seniority Level</dt><dd>${escapeHtml(state.seniority || "Not specified")}</dd>
            <dt>Engagement Model</dt><dd>${escapeHtml(result.engagement)}${result.engagementSuggested ? `<span class="role-suggestion-note">Suggested based on your answers — confirm with a SilverXis recruiter.</span>` : ""}</dd>
            <dt>Delivery Model</dt><dd>${escapeHtml(state.delivery || "Not specified")}</dd>
            <dt>Key Requirements</dt><dd>${tagsHTML}</dd>
          </dl>
          <div class="hub-links"><a class="hub-link" href="../talent-solutions/index.html">Explore IT Talent &amp; Staffing Solutions &rarr;</a></div>
        </div>

        <div class="role-section-block">
          <h3>Questions to Ask Candidates</h3>
          ${qqHTML}
        </div>

        <div class="role-engagement-note">
          <h3>Why This Engagement Model</h3>
          <p><strong>${escapeHtml(result.engagement)}</strong> ${result.engagementSuggested ? "was suggested" : "was selected"} based on your timeline (${escapeHtml(state.timeline || "not specified")}), the seniority level (${escapeHtml(state.seniority || "not specified")}), and the ${result.musts.length} must-have requirement${result.musts.length === 1 ? "" : "s"} you defined. ${engagementJustification}</p>
        </div>

        <div class="role-secondary-actions">
          <button type="button" class="role-restart" data-action="restart">Start over &rarr;</button>
          <button type="button" class="role-download" data-action="download">Download Requirements Summary &rarr;</button>
        </div>
      </div>

      <div class="role-expert-section" id="role-expert">
        <h2>Want a SilverXis Recruiter to Take It From Here?</h2>
        <p class="role-expert-quote">&ldquo;An assessment can clarify the role. A recruiter can qualify the people who fit it.&rdquo;</p>
        <p class="role-expert-copy">Have a SilverXis staffing specialist review your assessment and start identifying qualified candidates.</p>
        <form class="role-expert-form" id="role-expert-form">
          <div class="role-field-row">
            <label class="role-field">Name*<input type="text" name="name" autocomplete="name" required></label>
            <label class="role-field">Company*<input type="text" name="company" autocomplete="organization" required></label>
          </div>
          <div class="role-field-row">
            <label class="role-field">Business Email*<input type="email" name="email" autocomplete="email" required></label>
            <label class="role-field">Phone (Optional)<input type="tel" name="phone" autocomplete="tel"></label>
          </div>
          <div class="cta-group">
            <button type="submit" class="cta">Have a Recruiter Review My Assessment &rarr;</button>
          </div>
        </form>
      </div>
    `;

    trackEvent("role_recommendation_viewed", {
      category: result.categoryLabel,
      engagement: result.engagement,
      seniority: state.seniority,
      timeline: state.timeline
    });

    contentEl.querySelector('[data-action="restart"]').addEventListener("click", resetAssessment);
    contentEl.querySelector('[data-action="download"]').addEventListener("click", () => downloadSummary(result));

    let expertStarted = false;
    const expertForm = contentEl.querySelector("#role-expert-form");
    expertForm.addEventListener("focusin", () => {
      if (!expertStarted) { expertStarted = true; trackEvent("role_expert_review_started", {}); }
    });
    expertForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(expertForm);
      const contact = { name: fd.get("name"), company: fd.get("company"), email: fd.get("email"), phone: fd.get("phone") || "" };
      const lead = buildLeadRecord(contact, result);
      submitLead(lead);
      trackEvent("role_expert_review_submitted", { engagement: result.engagement, category: result.categoryLabel });
      contentEl.querySelector(".role-expert-form").outerHTML =
        `<p class="role-expert-submitted">Thank you — a SilverXis staffing specialist will review your assessment and follow up shortly.</p>`;
    });
  }

  // -----------------------------------------------------------------
  // Download + lead record. No CRM is hard-coded here; submitLead() is
  // the one integration point to wire up once a real endpoint exists
  // for this site (matching the pattern in assessment.js / audit-form.js).
  // -----------------------------------------------------------------
  function downloadSummary(result) {
    const lines = [
      "SilverXis — IT Role Assessment Summary",
      "======================================",
      "",
      `Role Title: ${state.detectedTitle || state.titleHint || "Not specified"}`,
      `Category: ${result.categoryLabel}`,
      `Seniority Level: ${state.seniority || "Not specified"}`,
      `Engagement Model: ${result.engagement}${result.engagementSuggested ? " (suggested)" : ""}`,
      `Delivery Model: ${state.delivery || "Not specified"}`,
      `Timeline: ${state.timeline || "Not specified"}`,
      "",
      "Must-Have Requirements:",
      ...(result.musts.length ? result.musts.map((r) => `  - ${r.text}`) : ["  (none marked yet)"]),
      "",
      "Preferred Requirements:",
      ...(result.preferreds.length ? result.preferreds.map((r) => `  - ${r.text}`) : ["  (none marked yet)"]),
      ""
    ];
    if (state.notes.trim()) lines.push("Additional Notes:", state.notes.trim(), "");
    lines.push(`Generated: ${new Date().toLocaleString()}`, "silverxis.com/it-staffing/role-assessment/");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "silverxis-role-assessment.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    trackEvent("role_summary_downloaded", {});
  }

  function getUTMParams() {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
      if (params.get(k)) utm[k] = params.get(k);
    });
    return utm;
  }

  function buildLeadRecord(contact, result) {
    const salesSummaryLines = [
      `Role Title: ${state.detectedTitle || state.titleHint || "Not specified"}`,
      `Category: ${result.categoryLabel}`,
      `Seniority Level: ${state.seniority || "Not specified"}`,
      `Engagement Model: ${result.engagement}${result.engagementSuggested ? " (suggested)" : ""}`,
      `Delivery Model: ${state.delivery || "Not specified"}`,
      `Timeline: ${state.timeline || "Not specified"}`,
      `Must-Have Requirements: ${result.musts.length}`,
      state.notes ? `Notes: "${state.notes}"` : null
    ].filter(Boolean);

    return {
      contact,
      assessment: {
        path: state.path,
        rawText: state.rawText,
        titleHint: state.titleHint,
        requirements: state.requirements.slice(),
        seniority: state.seniority,
        engagement: state.engagement,
        delivery: state.delivery,
        timeline: state.timeline,
        notes: state.notes
      },
      result: {
        categoryLabel: result.categoryLabel,
        engagement: result.engagement,
        engagementSuggested: result.engagementSuggested,
        clarity: result.clarity
      },
      salesSummary: salesSummaryLines.join("\n"),
      meta: {
        submittedAt: new Date().toISOString(),
        referringPage: document.referrer || null,
        pageUrl: window.location.href,
        utm: getUTMParams()
      }
    };
  }

  function submitLead(lead) {
    // Placeholder only: no backend/CRM/marketing-automation endpoint is
    // wired up for this project yet. Once one exists, replace this
    // function's body with the actual POST/webhook call — `lead` is
    // already a complete, structured record ready to send as-is.
    console.info("[SilverXis role assessment] lead record ready to send:", lead);
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------
  function resetAssessment() {
    state.path = null; state.rawText = ""; state.titleHint = "";
    state.detectedTitle = null; state.detectedSeniority = null; state.detectedCategory = null;
    state.requirements = []; state.seniority = null; state.engagement = null;
    state.delivery = null; state.timeline = null; state.notes = "";
    completed = false;
    goTo(1, { silent: true });
  }

  function startAssessment() {
    if (started) return;
    started = true;
    trackEvent("role_assessment_started", {});
    goTo(1);
  }
  window.__roleStart = startAssessment;

  let abandonFired = false;
  window.addEventListener("pagehide", () => {
    if (started && !completed && !abandonFired) {
      abandonFired = true;
      trackEvent("role_assessment_abandoned", { step: STEP_ORDER[stepIndex] });
    }
  });

  goTo(0, { silent: true });
})();
