(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Knowledge base: simple keyword matching over the site's own content
  // (Digital Marketing, Custom Software Development, IT Staffing, Workday,
  // company/location info, and the free assessment tools). This is not a
  // live AI model, it's a small local FAQ matcher, anything it can't
  // confidently match falls through to the human handoff flow below.
  // ---------------------------------------------------------------------
  const TOPICS = [
    // ---- Digital Marketing: Search Visibility (SEO / AEO / GEO) --------
    {
      keywords: ["difference between seo aeo and geo", "seo vs aeo vs geo", "seo aeo geo difference", "what's the difference between seo"],
      answer: "SEO helps search engines rank your site in results. AEO helps you get chosen as the direct answer, in a featured snippet, AI Overview, or voice response. GEO helps you get named and recommended inside AI chat platforms like ChatGPT, Gemini, and Perplexity. All three rely on the same foundation but target different moments in how people search."
    },
    {
      keywords: ["seo", "search engine optimization", "google ranking", "rank on google", "organic traffic", "keyword research"],
      answer: "SEO is the foundation: technical health, on-page optimization, content built around real customer questions, entity signals, and authority-building. It's also what AEO and GEO build on, so getting it right helps you rank on Google and get cited by AI platforms."
    },
    {
      keywords: ["seo mistake", "biggest seo mistake", "seo vs paid ads", "seo versus ads"],
      answer: "SEO earns organic rankings that keep working after you stop paying for the work, unlike paid ads, which stop the moment you stop paying. The biggest mistake is chasing keywords that don't match buying intent, or treating SEO as something bolted on after the site is built instead of designed in from the start."
    },
    {
      keywords: ["aeo", "answer engine", "featured snippet", "ai overview"],
      answer: "AEO (Answer Engine Optimization) is about winning the direct answer, a featured snippet, an AI Overview, or a voice response, instead of just a ranked link someone has to click through to. It's optimizing for the answer itself, not just the click."
    },
    {
      keywords: ["how does aeo work", "structure content for answers", "optimize for answer engines", "how to win a featured snippet"],
      answer: "Answer engines look for a clear, self-contained answer near the top of a section, ideally the first sentence or two after a heading that matches the question being asked. Structure content around real customer questions, use that question as a heading, answer it directly, use lists and short paragraphs, and add FAQ structured data so machines can parse the question-and-answer pairing directly."
    },
    {
      keywords: ["geo", "generative engine", "chatgpt", "perplexity", "ai search", "ai visibility", "cited by ai", "gemini"],
      answer: "GEO (Generative Engine Optimization) builds the entity clarity, topical authority, and citation signals that make ChatGPT, Gemini, or Perplexity name and recommend your business when someone asks a question you can answer. It shares the same technical/content foundation as SEO, with structured data and consistent brand mentions layered on."
    },
    {
      keywords: ["influence chatgpt", "control what ai says about my business", "chatgpt says about my business"],
      answer: "Not directly, but you can influence the sources it trusts. Building entity clarity, topical authority, and citation signals makes it far more likely an AI platform names and accurately describes you when someone asks."
    },
    {
      keywords: ["is geo working", "measure geo", "track ai visibility", "will geo replace seo", "geo instead of seo"],
      answer: "Ask the platforms directly, check whether ChatGPT, Gemini, and Perplexity can name your business and accurately describe what it does, and track that over time the same way you'd track a keyword ranking. GEO won't replace SEO, they're complementary: SEO governs indexing and rankings, GEO governs whether an AI system trusts you enough to cite you. You need both."
    },
    {
      keywords: ["small business compete ai", "small business ai visibility", "is geo only for big brands", "compete with bigger companies online"],
      answer: "Yes, small businesses with clear, well-structured, authoritative content around their specific niche often get cited more reliably than large brands publishing generic content at scale. AI platforms and local search reward clarity and relevance, not just size."
    },
    {
      keywords: ["will ai replace google", "is google going away", "ai overviews replacing search"],
      answer: "No, but it's changing what a first-page ranking is worth. Google now embeds AI Overviews directly into results, and a growing share of research starts on ChatGPT, Gemini, or Perplexity instead. Businesses need to be visible across both systems, not choose one."
    },
    {
      keywords: ["local search", "google business profile", "gbp", "near me", "maps", "local seo", "single most important local seo factor"],
      answer: "The single most important factor is an accurate, complete, and actively managed Google Business Profile, it's usually the first thing a nearby customer sees. Local search also covers reviews, citations, and the relevance signals that get you found on Maps, in the local pack, and in AI local recommendations."
    },
    {
      keywords: ["reviews", "how many reviews", "customer reviews seo"],
      answer: "There's no magic number. A steady stream of recent reviews consistently outperforms a large but stagnant total, recency and response rate matter as much as raw volume, for both ranking and AI recommendations."
    },
    {
      keywords: ["citations", "business listings consistency", "name address phone", "nap consistency"],
      answer: "A citation is your business name, address, and phone number listed consistently across directories. They still matter as a trust and verification signal, even though their direct ranking weight has declined over the years."
    },
    {
      keywords: ["service area business seo", "local seo without a storefront", "no physical location seo"],
      answer: "No physical location is required. Service-area businesses can still optimize for local search, though certain features, map pack prominence in particular, work differently without a storefront customers can visit."
    },
    {
      keywords: ["visibility audit", "free audit", "audit my", "website health check"],
      answer: "A Visibility Audit evaluates Google, local search, AI search, technical SEO, content, brand consistency, messaging, and conversion, with specific findings, not a generic scorecard. It's free, and results usually come back within a few business days. Want me to help you start one?"
    },
    // ---- Digital Marketing: Design ---------------------------------------
    {
      keywords: ["website", "web design", "web development", "site design", "new site", "redesign my site"],
      answer: "Every site we build starts with fast, mobile-first performance, clean semantic markup, and technical SEO built in from day one, then layers in brand identity, messaging, and conversion-focused UX on top. The platform is chosen based on your actual needs, not whatever's easiest for an agency to resell."
    },
    {
      keywords: ["mobile first", "mobile friendly website", "responsive design", "which platform", "which cms"],
      answer: "Every site we build starts with the mobile experience and scales up, since most visitors meet your business on a phone before they ever see a desktop screen. The platform is chosen based on your business's actual needs, content volume, and growth plans, not whatever's easiest for an agency to resell."
    },
    {
      keywords: ["migrate website", "site migration", "redesign without losing seo", "move to new website"],
      answer: "Yes, with a proper migration plan: mapping every existing URL to its new destination, preserving or improving on-page SEO, and redirecting old pages correctly so search engines don't lose what you've already earned."
    },
    {
      keywords: ["website maintenance", "ongoing website support", "after launch support", "website updates"],
      answer: "Yes. Sites need updates as your business grows, new pages, new offerings, security and performance maintenance, and that's supported ongoing rather than disappearing after launch."
    },
    {
      keywords: ["website cost", "how much does a website cost", "web design pricing", "cost of a new website", "website"],
      answer: "It depends on scope: page count, custom functionality, and whether brand identity work is included. We scope and quote based on your specific site, not a one-size template price."
    },
    {
      keywords: ["brand", "branding", "logo", "visual identity", "brand identity"],
      answer: "Brand Identity work builds a consistent visual presence across your website, social, campaigns, and everywhere else customers encounter you, so every impression builds recognition instead of starting over. We work with businesses building a brand from scratch and ones sharpening an existing one."
    },
    {
      keywords: ["ux", "ui", "user experience", "usability", "navigation"],
      answer: "UX/UI Design is about clear visual hierarchy, intuitive navigation, and purposeful interactions, so once you've got someone's attention, the experience keeps them moving instead of creating friction."
    },
    {
      keywords: ["design review", "redesign or rebuild"],
      answer: "A Design Review looks at whether your current site, brand, and digital presence actually reflect the value you deliver, and whether a redesign or a full rebuild makes more sense based on your site's technical foundation. Want me to start one for you?"
    },
    // ---- Digital Marketing: Strategy --------------------------------------
    {
      keywords: ["messaging", "positioning", "differentiation", "value proposition", "brand voice", "what makes us different"],
      answer: "Messaging and Positioning defines what makes you different, why that difference matters, and what customers gain by choosing you, then turns that into clear messaging across your site, campaigns, and every place customers encounter your brand."
    },
    {
      keywords: ["customer language research", "voice of customer", "how do you find our customer language"],
      answer: "We look at reviews, search queries, sales calls, and support conversations to pull the actual words customers use to describe their problem, then build messaging around that language instead of internal jargon."
    },
    {
      keywords: ["generic messaging", "avoid generic marketing", "stand out from competitors messaging"],
      answer: "By pressure-testing your positioning against what your actual competitors are saying, so your differentiation is specific to you, not a version of \"quality service\" every business in your category also claims."
    },
    {
      keywords: ["messaging vs copywriting", "will you write our website copy", "does messaging include copywriting"],
      answer: "Messaging is the strategy, what you say, to whom, and why it matters. Copywriting is the execution of that strategy into the actual words on a page, ad, or email. Messaging Strategy can be paired with Website Design & Development so it's written directly into your site."
    },
    {
      keywords: ["content strategy", "content marketing", "blog", "what to write"],
      answer: "Content Strategy determines what to say, where to say it, and why, so every page and piece of content earns visibility, answers a real question, or moves someone closer to a decision."
    },
    {
      keywords: ["conversion", "cta", "call to action", "conversion rate", "funnel"],
      answer: "Conversion Strategy connects your messaging to the calls to action, offers, forms, and follow-up that turn attention into an actual inquiry, not just traffic."
    },
    {
      keywords: ["where do i start with marketing", "which marketing service do i need first", "do i need visibility design and strategy"],
      answer: "You don't need all three at once. We evaluate where the strongest opportunity is first, being found, being noticed, or being chosen, and recommend where to start before expanding into the rest. A Visibility Audit is usually the fastest way to see where the gap actually is."
    },
    {
      keywords: ["measure marketing results", "marketing kpis", "how do you report results", "how do i know digital marketing is working"],
      answer: "We agree on success criteria before work begins and report against your actual business objectives, qualified traffic, leads, conversion rate, and revenue, not just impressions or rankings."
    },
    // ---- Custom Software Development --------------------------------------
    {
      keywords: ["custom software", "off the shelf software", "when do i need custom software", "software development company"],
      answer: "Off-the-shelf software makes sense when your needs closely match what the product was designed to do. Custom software becomes valuable when your workflows, integrations, data, customer experience, or growth requirements need significant workarounds or compromises, not simply because you can build it custom."
    },
    {
      keywords: ["custom software cost", "cost of custom software", "software development cost", "how much does custom software"],
      answer: "Cost depends on what you're building, its complexity, required integrations, infrastructure, and security requirements. We start by understanding the problem and requirements so you can evaluate approach and value before committing to a larger development investment."
    },
    {
      keywords: ["custom application development", "custom app", "build an app", "custom app development"],
      answer: "Custom application development is designing and building software around the specific requirements, workflows, users, data, and objectives of your business, rather than relying entirely on prebuilt software designed for a broader market."
    },
    {
      keywords: ["integrate custom application", "connect custom app to existing software", "custom app integration"],
      answer: "Yes. APIs and systems integration can let a custom application exchange information with existing platforms, databases, cloud services, third-party applications, and legacy systems. Specific options depend on the technologies involved."
    },
    {
      keywords: ["systems integration", "integrate our systems", "connect our systems", "what is an api", "api integration"],
      answer: "Systems integration connects separate applications, platforms, databases, and technology so they can exchange information and support connected business processes, instead of employees manually moving data between systems. An API (Application Programming Interface) is the defined way those applications communicate, request information, or trigger actions in each other."
    },
    {
      keywords: ["integrate legacy systems", "connect legacy software", "legacy integration", "do we need to replace our software before integrating", "integrate"],
      answer: "Often, yes, legacy applications can be connected through existing APIs, custom APIs, integration layers, middleware, or modernization of specific components. If your existing technology still performs its core function well, integration can preserve that investment instead of requiring a replacement."
    },
    {
      keywords: ["modernize", "modernization", "legacy software", "legacy system", "outdated software", "rebuild vs modernize"],
      answer: "Application Modernization can mean improving functionality or UX, modernizing architecture, moving components to the cloud, updating databases, adding APIs and integrations, or replacing individual components incrementally, often a better option than a full rebuild. It depends on the condition and architecture of what you already have."
    },
    {
      keywords: ["scalable software", "what makes software scalable", "scale our software"],
      answer: "Scalable software is designed so increasing users, data, transactions, or functionality doesn't require rebuilding the whole application. It depends on architecture, infrastructure, databases, integrations, and how the software is deployed and maintained."
    },
    {
      keywords: ["cloud migration", "move to the cloud", "cloud modernization", "should we move to the cloud"],
      answer: "Cloud migration can make sense when you need greater flexibility, scalability, accessibility, or resilience. Cloud migration generally means moving applications or data into a cloud environment; cloud modernization goes further, changing how they're designed to actually take advantage of cloud capabilities and automation."
    },
    {
      keywords: ["devops", "containerization", "cloud architecture for ai"],
      answer: "DevOps improves how software is developed, tested, deployed, and maintained, while containerization makes applications and their dependencies more portable and consistent across environments. Together with the right architecture, they make it easier to deploy changes and respond to changing demand, and a well-designed cloud/data architecture is also the foundation AI and automation need."
    },
    {
      keywords: ["ai in custom software", "add ai", "machine learning in software", "automation in software", "rpa"],
      answer: "Yes, when there's a useful business case and the underlying systems and data can support it. AI, Machine Learning, and Automation can be incorporated to automate processes, analyze information, assist users, or improve decision-making, connected systems, accessible data, and scalable infrastructure make that foundation stronger."
    },
    {
      keywords: ["free software assessment", "software needs assessment", "software assessment tool", "technology opportunity assessment"],
      answer: "The Free Software Needs Assessment is a short, guided set of questions about how your business works today and where technology is creating friction. You'll get a personalized Technology Opportunity Assessment before you're ever asked for contact info, it's informational, not a technical diagnosis. Want me to point you to it?"
    },
    // ---- IT Staffing --------------------------------------------------------
    {
      keywords: ["it staff augmentation", "staff augmentation", "add developers", "augment our team", "what is staff augmentation"],
      answer: "IT staff augmentation lets you add qualified external technology professionals to your existing team for a specific skill, project, or period of time without immediately adding permanent headcount, giving you flexibility to adjust resources as requirements change."
    },
    {
      keywords: ["staff augmentation vs outsourcing", "outsourcing vs staffing", "difference between staffing and outsourcing"],
      answer: "With staff augmentation, outside professionals become an extension of your existing team while you retain control over the work and priorities. With project outsourcing, responsibility for delivering a defined outcome is generally assigned to an outside provider. SilverXis offers both, so the engagement can be structured around what the work actually requires."
    },
    {
      keywords: ["how do you qualify candidates", "how do you vet candidates", "candidate qualification process", "vetting process"],
      answer: "We start with the actual requirements of the role rather than searching resumes for keywords. Candidates are qualified based on relevant experience, technical capabilities, communication, and the requirements you establish, with the evidence behind that qualification shown to you before anyone reaches your team."
    },
    {
      keywords: ["how fast can you find candidates", "how quickly can you provide candidates", "time to fill a role", "how long to staff a role"],
      answer: "Timing depends on the role, required skills, experience level, location, and availability. Clearly defining the role at the beginning, which is exactly what our Free IT Role Assessment helps with, lets recruiting focus on qualified candidates instead of candidate volume."
    },
    {
      keywords: ["contract to hire", "direct placement", "hire your contractor permanently", "convert contractor to employee", "contract staffing"],
      answer: "Contract Staffing adds talent for a defined period or ongoing need without immediately creating a permanent position. Contract-to-Hire lets you work with a professional before making a permanent decision. Direct Placement is for positions you intend to fill permanently from the start."
    },
    {
      keywords: ["dedicated team", "dedicated it team"],
      answer: "A dedicated IT team brings multiple technology professionals together around a project, product, or ongoing requirement, combining different technical disciplines based on the skills, scope, and delivery model the work requires."
    },
    {
      keywords: ["onshore", "nearshore", "offshore", "delivery location for developers", "where are your developers located"],
      answer: "Onshore talent works within your country. Nearshore talent works from a nearby country or region, often with greater time-zone overlap. Offshore talent works from more distant global delivery locations. The right model depends on expertise, collaboration, coverage, and economics."
    },
    {
      keywords: ["types of it professionals", "what roles can you fill", "developers you provide", "it roles you staff"],
      answer: "SilverXis recruits across software development, cloud, infrastructure, DevOps, data, AI and machine learning, QA, automation, business analysis, project management, architecture, and technology leadership, qualified against the specific role's requirements rather than a predetermined job title."
    },
    {
      keywords: ["one role or a team", "individual professional or team", "single hire or dedicated team"],
      answer: "Staffing can be structured around one specialized role, several professionals, a permanent position, or a full dedicated team, whatever fits what you need to accomplish and where the gap actually is."
    },
    {
      keywords: ["who manages the contractor", "who directs the daily work", "daily management of augmented staff"],
      answer: "Your team directs daily priorities, assignments, and delivery expectations. SilverXis manages the employment and engagement-administration responsibilities defined in your agreement."
    },
    {
      keywords: ["remote hybrid onsite", "can they work onsite", "remote it professional", "in person or remote staffing"],
      answer: "Engagements can be structured around the location and collaboration requirements of the role, subject to talent availability, onsite, hybrid, or remote, confirmed along with work-authorization requirements before qualifying professionals."
    },
    {
      keywords: ["contractor leaves", "replacement policy", "doesn't work out", "backfill a role"],
      answer: "SilverXis follows the replacement terms documented in your engagement agreement. Because the original role requirements and qualification context are retained, the replacement process can begin without redefining the position from scratch."
    },
    {
      keywords: ["free it role assessment", "role assessment tool", "define a job description", "what does this role need", "role clarity assessment"],
      answer: "The Free IT Role Assessment turns a rough job description, or a plain description of who you need, into a clear set of must-have and preferred requirements, plus a recommended seniority level, engagement model, and interview questions. Want me to point you to it?"
    },
    // ---- Workday ---------------------------------------------------------
    // More specific Workday topics are listed before the general overview
    // so a tie on the bare "workday" keyword resolves to the specific one.
    {
      keywords: ["already use workday", "existing workday", "workday support", "post implementation workday"],
      answer: "Yes, a Workday engagement doesn't need to start with a new implementation. SilverXis helps organizations integrate, extend, optimize, and support existing Workday environments, including ongoing enhancements, as requirements change."
    },
    {
      keywords: ["workday integration", "integrate workday with our systems"],
      answer: "Yes. SilverXis supports integrations between Workday and other enterprise applications and data sources, including APIs, data migration, transformation, and integration development."
    },
    {
      keywords: ["workday extend", "custom workday application", "build workday app"],
      answer: "SilverXis has experience developing custom Workday Extend applications around organization-specific requirements, giving you a way to build additional applications and workflows while staying connected to the Workday environment."
    },
    {
      keywords: ["workday consultant", "dedicated workday resource", "workday staffing"],
      answer: "Yes, SilverXis can provide specialized Workday expertise to supplement an internal team, in addition to broader Workday consulting and implementation engagements."
    },
    {
      keywords: ["workday", "workday implementation", "workday services", "hcm", "workday financial management", "workday payroll"],
      answer: "SilverXis supports Workday implementation, integrations, HCM, Financial Management, payroll, Workday Extend, Prism Analytics, data migration, reporting, optimization, advisory, and ongoing platform enhancement."
    },
    // ---- Assessments (router) ---------------------------------------------
    {
      keywords: ["which assessment should i take", "free assessment", "what free tools do you offer", "free tools"],
      answer: "SilverXis offers three free tools: the Software Needs Assessment (for technology gaps), the IT Role Assessment (for a role you're trying to fill), and the Visibility Audit (for search, AI, and marketing visibility). Tell me which area you're looking at and I can point you to the right one."
    },
    // ---- Company / About --------------------------------------------------
    {
      keywords: ["who are you", "what is silverxis", "about silverxis", "what does silverxis do", "how long has silverxis been in business", "founded", "how long has silverxis", "years in business", "how many years"],
      answer: "SilverXis is a technology solutions company providing Custom Software Development, IT Staff Augmentation, and Digital Marketing, capabilities that work independently or together depending on the problem being solved. Founded in 2005, we're headquartered in Irving, Texas, with additional delivery capabilities in India and clients across the U.S. and internationally."
    },
    {
      keywords: ["business sizes", "small business or enterprise", "do you work with small businesses", "company size", "only for large companies"],
      answer: "No, SilverXis works with small businesses, growing mid-market companies, and larger organizations. Fit is determined by the complexity of the challenge and the expertise it requires, not company size, and each engagement is scaled to what you actually need."
    },
    {
      keywords: ["three services together", "software staffing marketing together", "coordinate multiple services", "one vendor multiple services", "staffing and marketing together", "software and marketing together", "one accountable partner"],
      answer: "Yes. Business challenges often cross those boundaries, a software initiative may need specialized talent, growth may expose system limits, a new product may need a marketing strategy. SilverXis can coordinate software development, staffing, and digital marketing within one engagement, planned across the right teams while you keep one clear point of accountability, instead of managing three disconnected vendors."
    },
    {
      keywords: ["why should i choose", "why choose silverxis", "competitors", "other agencies"],
      answer: "Most agencies and vendors treat technology, talent, and marketing as separate line items handled by separate providers. SilverXis connects all three around one outcome, so decisions in one area inform the others instead of happening in isolation."
    },
    {
      keywords: ["what do you do", "what services", "services do you offer", "what can you help with"],
      answer: "Four things: Custom Software Development (applications, integrations, modernization, cloud, AI/automation), IT Staffing (contract, contract-to-hire, direct placement, dedicated teams), Digital Marketing (SEO/AEO/GEO, design, messaging strategy), and specialized Workday consulting. Ask me about any of them."
    },
    // ---- Locations ----------------------------------------------------------
    {
      keywords: ["dallas", "fort worth", "dfw", "service area", "where are you based", "where are you located", "location", "office address", "outside texas", "clients outside", "serve nationally", "remote clients", "work remotely"],
      answer: "SilverXis is headquartered at 100 East Royal Lane, Suite #224, Irving, Texas, in the Dallas-Fort Worth metro, with in-person meetings available for local clients. That said, most work is delivered remotely, so businesses outside DFW and outside Texas work with us regularly, and we also have delivery capabilities in India."
    },
    // ---- Insights -------------------------------------------------------
    {
      keywords: ["insights", "blog", "articles", "content on your site", "research articles"],
      answer: "Insights is where SilverXis publishes original articles and research on search intelligence, brand and design, messaging and strategy, and Dallas business, not syndicated or generic industry content. New content goes up on an ongoing basis, and you can request a topic directly."
    },
    // ---- Client Results / Case studies -------------------------------------
    {
      keywords: ["case studies", "client results", "client references", "proof of results", "guarantee results", "testimonials"],
      answer: "Case studies are based on approved client information and documented evidence, including the measurement period and source of the metric, and clearly labeled as DFW-based or not. References are available in many cases with the client's permission. Past performance demonstrates experience but doesn't guarantee an identical outcome, every engagement starts from your specific goals and starting point."
    },
    // ---- General / conversational -----------------------------------------
    {
      keywords: ["price", "pricing", "cost", "how much", "budget", "fee", "rates"],
      answer: "Pricing depends on scope, since every engagement is built around your specific gaps. The fastest way to get real numbers is a quick Visibility, Software, or Role Assessment, or just talk to us directly. Want me to help set that up?"
    },
    {
      keywords: ["how long", "timeline", "when will i see results", "how fast"],
      answer: "Technical fixes and Google Business Profile improvements can show measurable movement within weeks. Competitive rankings, AI Overview appearances, and brand/design or messaging work typically build over two to six months, since they depend on authority and consistency that accumulate over time."
    },
    {
      keywords: ["contact", "phone number", "email address", "reach you", "call you", "talk to someone", "get in touch", "how do we get started", "next steps"],
      answer: "You can reach SilverXis at (817) 393-9001, info@silverxis.com, or 100 East Royal Lane, Suite #224, Irving, Texas 75039. We'll discuss your objective and current situation, then recommend the right next step. Want me to open the contact form for you?"
    },
    {
      keywords: ["hi", "hello", "hey"],
      answer: "Hi! I'm the SilverXis assistant. Ask me about custom software, IT staffing, Workday, or search/AI visibility and marketing, or anything else about what we do."
    },
    {
      keywords: ["thanks", "thank you", "appreciate it"],
      answer: "Happy to help! Anything else you'd like to know?"
    }
  ];

  const GREETING = "Hi, I'm the SilverXis assistant. Ask me about custom software development, IT staffing, Workday, SEO/AI visibility and marketing, or anything else about what we do.";
  const FALLBACK = "I don't have a confident answer for that. Would you like someone from SilverXis to get back to you with a better one?";

  function matchTopic(message) {
    // Hyphens normalized to spaces so phrasing like "mobile-first" or
    // "contract-to-hire" still matches space-separated keyword phrases.
    const text = message.toLowerCase().replace(/[-–—]/g, " ");
    let best = null;
    let bestScore = 0;
    for (const topic of TOPICS) {
      let score = 0;
      for (const kw of topic.keywords) {
        if (kw.includes(" ")) {
          if (text.includes(kw)) score++;
        } else if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = topic;
      }
    }
    return bestScore > 0 ? best : null;
  }

  // ---------------------------------------------------------------------
  // Widget
  // ---------------------------------------------------------------------
  let btn, icon, panel, messagesEl, form, input;
  let open = false;
  let awaitingHandoff = false;
  let pendingQuestion = "";

  function getBadgeSrc() {
    const logoImg = document.querySelector("header .logo img");
    const raw = logoImg ? logoImg.getAttribute("src") || "" : "";
    if (raw) return raw.replace(/silverxis-logo\.png$/, "silverxis-badge.png");
    return "assets/silverxis-badge.png";
  }

  function addMessage(role, html) {
    const div = document.createElement("div");
    div.className = role === "user" ? "ask-msg ask-msg-user" : "ask-msg ask-msg-bot";
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addBotText(text) {
    addMessage("bot", `<p>${text}</p>`);
  }

  function addHandoffPrompt(question) {
    const div = addMessage("bot", `<p>${FALLBACK}</p>`);
    const actions = document.createElement("div");
    actions.className = "ask-msg-actions";
    actions.innerHTML = `<button type="button" data-handoff="yes">Yes</button><button type="button" data-handoff="no">No</button>`;
    div.appendChild(actions);
    awaitingHandoff = true;
    pendingQuestion = question;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function handleUserMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    addMessage("user", escapeHtml(trimmed));

    if (awaitingHandoff) {
      awaitingHandoff = false;
      addBotText("Got it, let me know what else I can help with.");
    }

    const topic = matchTopic(trimmed);
    if (topic) {
      addBotText(topic.answer);
    } else {
      addHandoffPrompt(trimmed);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function buildWidget() {
    const badgeSrc = getBadgeSrc();

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ask-silverxis-btn";
    btn.setAttribute("aria-label", "Ask SilverXis");
    btn.innerHTML = `
      <img class="ask-silverxis-icon" src="${badgeSrc}" alt="">
      <span class="ask-silverxis-label">Ask SilverXis</span>
    `;
    icon = btn.querySelector(".ask-silverxis-icon");
    document.body.appendChild(btn);

    panel = document.createElement("div");
    panel.className = "ask-silverxis-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Ask SilverXis chat");
    panel.innerHTML = `
      <div class="ask-silverxis-header">
        <img src="${badgeSrc}" alt="">
        <h2>Ask SilverXis</h2>
        <button type="button" class="ask-silverxis-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="ask-silverxis-messages"></div>
      <form class="ask-silverxis-form">
        <input type="text" placeholder="Ask about software, staffing, marketing..." autocomplete="off">
        <button type="submit">Send &rarr;</button>
      </form>
    `;
    document.body.appendChild(panel);

    messagesEl = panel.querySelector(".ask-silverxis-messages");
    form = panel.querySelector(".ask-silverxis-form");
    input = form.querySelector("input");

    panel.querySelector(".ask-silverxis-close").addEventListener("click", closePanel);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = "";
      handleUserMessage(text);
    });

    messagesEl.addEventListener("click", (e) => {
      const handoffBtn = e.target.closest("[data-handoff]");
      if (!handoffBtn) return;
      const choice = handoffBtn.getAttribute("data-handoff");
      handoffBtn.closest(".ask-msg-actions").remove();
      awaitingHandoff = false;
      if (choice === "yes") {
        addBotText("Sure, opening the contact form with your question included.");
        closePanel();
        if (window.SilverXisContact) {
          window.SilverXisContact.openWithMessage(pendingQuestion);
        }
      } else {
        addBotText("No problem. Closing this up, feel free to come back anytime.");
        setTimeout(closePanel, 900);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) closePanel();
    });

    document.addEventListener("click", (e) => {
      if (!open) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      closePanel();
    });

    btn.addEventListener("click", () => {
      if (open) closePanel();
      else openPanel();
    });
  }

  function openPanel() {
    if (!btn) buildWidget();
    open = true;
    panel.hidden = false;
    if (!messagesEl.children.length) addBotText(GREETING);
    input.focus();
  }

  function closePanel() {
    open = false;
    if (panel) panel.hidden = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();
