# "Never Miss a Customer" — Interactive Demo (ROOFING)

A fictional US roofing company (**Coppervalley Roofing — Storm-Ready Roofing,
Oklahoma City, OK**; web-searched 2026-10-12 to confirm no real business by
that name exists) with an embedded AI coordinator (**Cole**) that demonstrates
Tameer Ali's **"Never Miss a Customer"** automation system to a roofing
business owner in ~60 seconds.

**100% static. No backend, no build step, zero external requests, zero tracking.**
Works from `file://` and any static host.

Part of the multi-niche demo factory (see `~/workspace/outreach/demo-links.md`).
Sibling demos: `~/workspace/outreach/demo-dental/` (primary pattern reference),
`~/workspace/outreach/demo-realestate/` (most advanced example — inbox panel pilot).

## What it demonstrates (the 4 flows)

1. **Services / pricing Q&A** — roof replacement (honest $8k–$18k range,
   1–3 day timeline), repairs (leak tracing, typical few-hundred-dollar fixes),
   storm & hail damage (insurance-ready documentation, file within a year),
   free inspections, and metal vs. shingle consults (lifespan/cost/hail
   trade-offs, straight talk).
2. **Free-inspection booking** — interest (storm damage / full replacement /
   repairs / metal vs. shingle consult) → name → optional text reminder →
   preferred day → time → confirmation card with booking reference
   (e.g. `CR-X7Q2M`).
3. **After-hours lead capture** *(the money flow)* — tap "🌙 After-hours demo":
   a notice reads *"It's 11:42 PM — the office is closed right now, but I'm
   Cole, Coppervalley Roofing's coordinator, and I'm still here."* Pick storm /
   replacement / repair → name + phone (validated) + details → "Saved! The
   morning crew will follow up first thing" → a mini **"Saved to your
   dashboard"** card appears. Leads persist in the browser only
   (`localStorage` key `nmc_roofing_leads`) — no server, no external
   requests. A prospect-visible **"Captured leads" inbox preview panel** in
   the hours/location section shows every captured lead newest-first.
4. **Review request** — tap "⭐ Rate your experience" → tap the stars:
   - **5 stars** → "Would you share that on Google?" + Google review button.
   - **1–4 stars** → "What could we do better?" → feedback captured (saved as a
     private lead) → "Our owner will personally follow up."

Plus: graceful fallbacks for off-script input (never dead-ends), quick-reply
chips, typing indicator with realistic delays, auto-open nudge after ~8s, and
the site's "Book a free inspection" buttons (plus the "Hail damage help" hero
button → storm-damage Q&A) jump straight into flows.

Copy is in **homeowner language** ("never miss a storm lead", "after-hours",
"free inspections") — never "AI chatbot" jargon. Widget header/footer carries
a small credit: *"Live demo by Tameer Ali · AI Automation"*. Footer:
*"Interactive demo experience — bookings and messages shown here are
simulated."*

## Personalize per prospect

Append query params — the company name, tagline, city, address and phone
swap everywhere (page + widget + booking-reference prefix):

```
index.html?biz=Sooner%20Roof%20Pros&tagline=Hail%20Country%20Experts&city=Norman%2C%20OK&address=900%20Main%20St%2C%20Norman%2C%20OK%2073069&phone=%28405%29%20555-0119
```

| Param     | Default                          |
|-----------|----------------------------------|
| `biz`     | Coppervalley Roofing             |
| `tagline` | Storm-Ready Roofing              |
| `city`    | Oklahoma City, OK                |
| `address` | 4521 N Western Ave, Oklahoma City, OK 73118 |
| `phone`   | (405) 555-0184                   |

`?fast=1` skips animation delays (used by the automated test harness).

**Outreach workflow:** for each roofing prospect, generate their link with
`?biz=<Their Company Name>` so the demo greets them as *their own*
roofing company.

## Hosting options

- **Fastest (recommended):** GitHub Pages / Netlify / Vercel — drag the
  `demo-roofing/` folder, get a public HTTPS link in ~1 minute. (Deploy
  target for the fleet: `https://tameerali21.github.io/roofing-demo-upgrade/`.)
- **Any static host** works — it's plain HTML/CSS/JS.
- **Local preview:** `python3 -m http.server` inside `demo-roofing/`.

Hosting is handled by the parent agent — this subagent builds and verifies only.

## Verification

End-to-end harness at `~/workspace/outreach/demo-deploy-zips/roofing-verify-2026-10-12.js`
(puppeteer + bundled Chromium): walks all 4 flows, the 5-star and 3-star
review branches, bad-phone rejection in both phone fields (incl. the
digit-less "notaphone" case), router regression probes (word-start standard:
"foreclosure"/"recall"/"anywhere" negative probes + positive prefix probes),
full `?biz=&city=&tagline=&phone=&addr=&services=&hours=` personalization
(8/6 caps, XSS escaping, chat-host row preserved, no fictional leaks), the
captured-leads inbox panel (toggle/empty-state/XSS/live-update-after-captures/
reload persistence/mobile 390px), hero-CTA booking jump, storm CTA jump, lead
persistence in localStorage incl. raw audit, mobile 390px — and fails on
**any** console/page error or any external network request.

Last run: **see the fleet nightly log** (all checks passed, zero console
errors, zero page errors, zero external network requests).

## Files

- `index.html` — roofing company site (hero, services, how-it-works,
  "What Cole does", hours/location + captured-leads inbox, footer) + widget markup
- `assets/style.css` — deep charcoal slate + safety orange/amber theme
  (system fonts only, no external requests)
- `assets/widget.js` — Cole conversation engine (intents,
  booking/after-hours/review state machines, personalization, lead
  persistence, inbox render, test hooks via `window.__maya`)
- `og-preview.jpg` — 1200×630 social preview graphic

*Note: bookings, leads and reviews in this demo are simulated in the browser —
the footer says so. A real client build wires these to the roofer's actual
scheduling/CRM/notification stack.*
