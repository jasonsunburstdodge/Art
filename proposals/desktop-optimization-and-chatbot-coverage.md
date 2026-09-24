# Proposal: Desktop layout optimization + full-site chatbot coverage

**Status:** Implemented on `claude/synapses-scroll-animation-f7otnz`, proposed here for review.

This repo had no `main` branch and no prior pull requests, so there was no
base to diff the recent work against. This document summarizes the two
most recent changes for review; the commits themselves are listed at the
bottom with their SHAs for direct inspection.

## 1. Desktop layout optimization

**Problem:** the site was built mobile-first, and several content
containers were hard-capped at mobile/tablet widths with no upward
scaling for laptop or desktop viewports — `.page-section-inner` at
760px, `.pillar-grid` at 1180px, and both interactive assessment tools'
shells (`.assess-shell`, `.role-shell`) at 760px. On a 1920px screen this
left large unused margins on both sides of every page's content.

**Fix:** widened those four containers with fluid `clamp()` max-widths
that hold mobile/tablet behavior unchanged below ~1280px and scale up
smoothly on wider screens:

- `.page-section-inner`: `760px` → up to `1200px`
- `.pillar-grid` (homepage Build/Connect/Find sections): `1180px` → up to `1560px`
- `.assess-shell` / `.role-shell` (Software Needs Assessment, IT Role Assessment): `760px` → up to `960px`
- Header logo gets a modest size bump on very large screens

Paragraph text and quote/form widths (`.page-copy`, `.faq-list`, etc.)
kept their own character-width caps, so line length for actual reading
text didn't get worse — only the surrounding layout gained room, and
grid components (`cluster-grid`, `list-plain`, `audit-list`) picked up
more columns automatically.

**Follow-up fix — sparse grid over-stretch:** the width increase had a
side effect: `.cluster-grid`'s auto-fit track grows to fill 100% of the
row when there are only one or two cards. On the wider desktop
container, that meant the Locations page's single "Dallas-Fort Worth,
TX" card spanned the full ~1200px row, and the homepage's two
case-study cards each ballooned to ~570px with mostly empty space
inside.

Capped `.cluster-card` at `max-width: 420px` to fix this. The first
attempt capped the grid track's own `minmax()` max instead
(`minmax(230px, 420px)`), which turned out to be wrong: it changes how
the browser's `auto-fit` algorithm decides column count — once a
track's max is a fixed length rather than `1fr`, auto-fit bases the
fit calculation on that max instead of the min, which silently
collapsed the two-card row down to a single column in testing. Capping
the card itself instead leaves the track flexible, so column count is
unaffected.

**Verification:** screenshotted before/after at 1920px and 1440px on
the homepage, IT Staffing, SEO, About, Dallas-Fort Worth, Locations,
and both assessment tools, then ran an automated check across all 30
pages at 1920/1440/375px confirming zero horizontal overflow and zero
console errors before and after each change, including the sparse-grid
fix (verified the 1-card, 2-card, 3-card, 5-card, 6-card, 8-card, and
13-card `.cluster-grid` instances sitewide render correctly).

## 2. Full-site chatbot coverage

**Problem:** the "Ask SilverXis" chat widget's knowledge base
(`chatbot.js`) only covered Digital Marketing topics (SEO/AEO/GEO,
design, messaging) — roughly 20 topics — even though the site also
covers Custom Software Development, IT Staffing, Workday, and company
information, each with its own published FAQPage content.

**Fix:** rebuilt the topic-matching knowledge base from the 150 FAQ
Q&A pairs already published in FAQPage JSON-LD across every page,
deduplicated and grouped into 75 topics spanning:

- Custom Software Development (custom apps, systems integration,
  modernization, scalable/cloud, AI & automation, the Software Needs
  Assessment)
- IT Staffing (staff augmentation, contract/contract-to-hire/direct
  placement, dedicated teams, onshore/nearshore/offshore, the IT Role
  Assessment)
- Workday (implementation, integrations, Extend, ongoing support)
- Company/locations/Insights/client results
- The existing SEO/AEO/GEO/design/messaging content

**Verification:** ran the widget end-to-end through a broad set of
real-phrasing questions across every pillar and found (then fixed)
several keyword-matching gaps along the way: hyphenated phrasing like
"mobile-first" not matching a space-separated keyword (fixed by
normalizing hyphens to spaces before matching), a few overly literal
multi-word keyword phrases that broke on natural rewording, a
topic-ordering issue where a general "Workday" answer was winning a
tie over a more specific "Workday Extend" answer, and one topic that
had been drafted but was accidentally left out of the final file
entirely. Re-verified the same test set clean afterward, plus a
gibberish query still correctly falls through to the human handoff
prompt.

## Commits

```
b8f8b11  Expand the chatbot to cover the whole site, not just digital marketing
30e66c7  Scale content containers up for desktop, not just mobile/tablet
5e74e3a  Cap cluster-card width so sparse grids don't over-stretch on desktop
```
