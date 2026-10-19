/* Cole — "Never Miss a Customer" demo chat engine (roofing edition).
   100% client-side. No network calls, no tracking. Works from file:// .
   Leads persist in the browser only (localStorage key "nmc_roofing_leads").
   Test hooks: ?fast=1 skips delays; window.__maya exposes state + send(). */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var FAST = qs.get('fast') === '1';
  var NO_NUDGE = qs.get('nonudge') === '1'; /* test affordance: skip the proactive auto-open nudge */
  var LEAD_KEY = 'nmc_roofing_leads';

  /* ---------- business profile (personalizable via ?biz= etc.) ---------- */
  var BIZ = {
    name:    qs.get('biz')     || 'Coppervalley Roofing',
    tagline: qs.get('tagline') || 'Storm-Ready Roofing',
    city:    qs.get('city')    || 'Oklahoma City, OK',
    address: qs.get('addr') || qs.get('address') || '4521 N Western Ave, Oklahoma City, OK 73118',
    phone:   qs.get('phone')   || '(405) 555-0184',
    host: 'Cole'
  };
  // short ref prefix from the name's initials, e.g. "Coppervalley Roofing" -> "CR"
  BIZ.refPrefix = (BIZ.name.split(/\s+/).map(function (w) { return w.charAt(0); }).filter(function (c) { return /[A-Za-z]/.test(c); }).join('').slice(0, 2).toUpperCase()) || 'CR';

  /* apply personalization to the page */
  function personalize() {
    document.querySelectorAll('[data-biz="name"]').forEach(function (el) { el.textContent = BIZ.name; });
    document.querySelectorAll('[data-biz="tagline"]').forEach(function (el) { el.textContent = BIZ.tagline; });
    document.querySelectorAll('[data-biz="city"]').forEach(function (el) { el.textContent = BIZ.city; });
    document.querySelectorAll('[data-biz="address"]').forEach(function (el) { el.textContent = BIZ.address; });
    document.querySelectorAll('[data-biz="phone"]').forEach(function (el) { el.textContent = BIZ.phone; });
    /* tap-to-call must dial the personalized number, not the hardcoded default (fleet standard 2026-10-16):
       digits-and-plus-only in the href so a hostile ?phone= param can't smuggle markup/JS. */
    document.querySelectorAll('#call-cta, a[data-biz="phone"]').forEach(function (el) { el.setAttribute('href', 'tel:' + String(BIZ.phone).replace(/[^+\d]/g, '')); });
    document.querySelectorAll('[data-biz="host"]').forEach(function (el) { el.textContent = BIZ.host; });
    document.querySelectorAll('[data-biz="host-initial"]').forEach(function (el) { el.textContent = BIZ.host.charAt(0); });
    document.title = BIZ.name + ' — ' + BIZ.tagline + ' | ' + BIZ.city;
  }
  /* ---------- deep personalization: ?services= ?hours= ----------
     services: pipe-separated REAL service names -> rendered into the services grid (max 8).
     hours: pipe-separated "Day(s): time" pairs -> rendered into the hours table (max 6).
     Graceful fallback: the page keeps its built-in fictional content when a param is absent. */
  function dpEsc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deepPersonalize() {
    var svc = qs.get('services');
    if (svc) {
      var items = svc.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 8);
      var grid = document.querySelector('#services .menu-grid, #menu .menu-grid, #rooms .menu-grid, #practice .menu-grid, #services .cards');
      if (grid && items.length) {
        var isCards = grid.classList.contains('cards');
        grid.innerHTML = items.map(function (name) {
          var n = dpEsc(name);
          if (isCards) {
            return '<div class="card"><div class="ico">&#10003;</div><h3>' + n + '</h3>' +
              '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; chat below for details &amp; pricing.</p></div>';
          }
          return '<div class="menu-card"><div class="cat">Service</div><h3>' + n + '</h3>' +
            '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; ask ' + dpEsc(BIZ.host) + ' below for details &amp; pricing.</p></div>';
        }).join('');
      }
    }
    var hrs = qs.get('hours');
    if (hrs) {
      var rows = hrs.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 6);
      var table = document.querySelector('table.hours') || document.querySelector('#visit table');
      if (table && rows.length) {
        var chatCell = null;
        Array.prototype.forEach.call(table.rows, function (r) {
          if (/chat/i.test(r.textContent) && r.cells[1]) chatCell = r.cells[1].innerHTML;
        });
        var html = rows.map(function (r) {
          var i = r.indexOf(':');
          var day = (i > 0 ? r.slice(0, i) : r).trim();
          var time = (i > 0 ? r.slice(i + 1) : '').trim();
          return '<tr><td>' + dpEsc(day) + '</td><td>' + dpEsc(time) + '</td></tr>';
        }).join('');
        if (chatCell) html += '<tr><td>Chat with ' + dpEsc(BIZ.host) + '</td><td>' + chatCell + '</td></tr>';
        table.innerHTML = html;
      }
    }
  }


  /* ---------- leads (localStorage only) ---------- */
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem(LEAD_KEY) || '[]'); } catch (e) { leads = []; }
  function saveLead(l) {
    l.at = new Date().toISOString(); l.biz = BIZ.name;
    leads.push(l);
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(leads)); } catch (e) {}
    renderInbox(); /* keep the prospect-visible inbox panel live */
  }

  /* ---------- captured-leads inbox preview (prospect-visible panel) ----------
     The after-hours card promises "Saved to your dashboard" — this panel makes
     that claim visible on the page. Reads localStorage only, everything escaped. */
  var inboxEls = null;
  function inboxDom() {
    if (!inboxEls) {
      var panel = document.getElementById('inbox-panel');
      var list = document.getElementById('inbox-list');
      var toggle = document.getElementById('inbox-toggle');
      var count = document.getElementById('inbox-count');
      if (!panel || !list || !toggle) return null;
      inboxEls = { panel: panel, list: list, toggle: toggle, count: count };
    }
    return inboxEls;
  }
  function fmtLeadTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso || '';
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return iso || ''; }
  }
  function renderInbox() {
    var dom = inboxDom();
    if (!dom) return;
    if (dom.count) dom.count.textContent = String(leads.length);
    if (!leads.length) {
      dom.list.innerHTML = '<div class="inbox-empty"><b>No leads yet.</b><br>' +
        'Try the &#127769; 11:42 PM after-hours flow in the chat &mdash; the captured lead will appear right here.</div>';
      return;
    }
    dom.list.innerHTML = leads.slice().reverse().map(function (l) {
      var when = l.at
        ? '<time datetime="' + escapeHtml(l.at) + '">' + escapeHtml(fmtLeadTime(l.at)) + '</time>'
        : '&mdash;';
      var detail = (l.details && l.details !== '\u2014' && l.details !== '-')
        ? '<div class="lead-detail">&ldquo;' + escapeHtml(l.details) + '&rdquo;</div>'
        : '';
      return '<div class="lead-row">' +
        '<span class="lead-name">' + escapeHtml(l.name || '\u2014') + '</span>' +
        '<span class="lead-tag">' + escapeHtml(l.topic || 'Lead') + '</span>' +
        '<span class="lead-phone">' + escapeHtml(l.phone || '\u2014') + '</span>' +
        '<span class="lead-src">' + escapeHtml(l.source || '') + '</span>' +
        '<div class="lead-when">Captured ' + when + '</div>' +
        detail +
        '</div>';
    }).join('');
  }

  /* ---------- dom ---------- */
  var panel, msgs, chipsBox, input, bubble, unread, closeBtn;
  var opened = false, autoOpened = false, greeted = false;

  /* conversation state */
  var S = {
    mode: 'idle',          // idle | booking | afterhours | review
    step: 0,
    booking: {},
    ah: {},
    lastTopic: null
  };

  function $(id) { return document.getElementById(id); }

  function delay(ms) {
    return new Promise(function (res) { setTimeout(res, FAST ? 0 : ms); });
  }

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  /* ---------- rendering ---------- */
  function addUser(text) {
    var row = el('div', 'mrow user');
    row.appendChild(el('div', 'bubble', escapeHtml(text)));
    msgs.appendChild(row); scrollDown();
  }

  function addBot(html, opts) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble', html);
    row.appendChild(b);
    msgs.appendChild(row);
    if (opts && opts.notice) b.classList.add('notice');
    scrollDown();
    return b;
  }

  function addNotice(html) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'notice', html));
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function addDashCard(rows) {
    var row = el('div', 'mrow bot');
    var card = el('div', 'dashcard');
    card.appendChild(el('div', 'dl-head', '&#128203; Saved to your dashboard'));
    rows.forEach(function (r) {
      card.appendChild(el('div', 'dl-row', '<span>' + r[0] + ':</span> <b>' + escapeHtml(r[1]) + '</b>'));
    });
    row.appendChild(card);
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function showTyping() {
    var row = el('div', 'mrow bot', '');
    row.id = 'maya-typing-row';
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble typing', '<i></i><i></i><i></i>');
    row.appendChild(b);
    msgs.appendChild(row); scrollDown();
  }
  function hideTyping() {
    var t = $('maya-typing-row');
    if (t) t.remove();
  }

  function setChips(list) {
    chipsBox.innerHTML = '';
    (list || []).forEach(function (c) {
      var btn = el('button', 'chip', c.label);
      btn.type = 'button';
      btn.addEventListener('click', function () { userSays(c.value || c.label, c.silent); });
      chipsBox.appendChild(btn);
    });
    scrollDown();
  }

  function showStars() {
    chipsBox.innerHTML = '';
    var wrap = el('div', 'stars-row');
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var s = el('button', 'star-btn', '&#11088;');
        s.type = 'button';
        s.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
        s.addEventListener('click', function () { pickStars(n); });
        wrap.appendChild(s);
      })(i);
    }
    chipsBox.appendChild(wrap);
    scrollDown();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- tap-to-call helper (fleet standard, 2026-10-16) ----------
     href is digits-and-plus-only (XSS-safe even from a hostile ?phone= param);
     the visible text reuses the normal phone escaping. */
  function callLinkHtml() {
    var href = 'tel:' + String(BIZ.phone).replace(/[^+\d]/g, '');
    return '<a class="call-link" href="' + escapeHtml(href) + '">&#128222; Call ' + escapeHtml(BIZ.phone) + '</a>';
  }

  /* ---------- bot speech ---------- */
  function say(html, chips, opts) {
    showTyping();
    var wait = Math.min(700 + html.length * 6, 1900);
    return delay(wait).then(function () {
      hideTyping();
      addBot(html);
      setChips(chips);
    });
  }

  function sayMany(items) {
    // items: [{html, chips, notice, dash}]
    var p = Promise.resolve();
    items.forEach(function (it) {
      p = p.then(function () {
        showTyping();
        var wait = Math.min(600 + (it.html || '').length * 5, 1700);
        return delay(wait).then(function () {
          hideTyping();
          if (it.dash) { addDashCard(it.dash); }
          else if (it.notice) { addNotice(it.html); }
          else { addBot(it.html); }
          setChips(it.chips);
        });
      });
    });
    return p;
  }

  /* ---------- helpers ---------- */
  function makeRef() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 5; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return BIZ.refPrefix + '-' + r;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* word-start keyword match (proven standard, 2026-10-03): "foreclosure" must not
     trip a "close" keyword, "recall" must not trip "call". Prefix keywords like
     'inspect'/'replac' still match; phrases keep word-start match. */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function has(t) {
    var words = Array.prototype.slice.call(arguments, 1);
    return words.some(function (w) { return new RegExp('(^|[^a-z])' + escRe(w)).test(t); });
  }

  function digitsOf(s) { return String(s).replace(/\D/g, ''); }

  /* ---------- intent answers ---------- */
  function servicesHtml() {
    return 'Storm-first roofing, start to finish. &#127968;<br><br>' +
      '<b>Full roof replacement</b> &mdash; tear-off to final walkthrough in 1&ndash;3 days on most homes<br>' +
      '<b>Storm &amp; hail repair</b> &mdash; damage documented photo-by-photo for your insurance claim<br>' +
      '<b>Free inspections</b> &mdash; an honest read on your roof&rsquo;s real condition, in writing<br>' +
      '<b>Metal vs. shingle consults</b> &mdash; straight talk, no upsell<br><br>' +
      'Which one sounds like you?';
  }

  function replacementHtml() {
    return 'Honest numbers on a full replacement. &#129309;<br><br>' +
      'Most homes in ' + escapeHtml(BIZ.city) + ' land around <b>$8k&ndash;$18k</b> depending on size, pitch, tear-off layers, and material. ' +
      'Architectural shingles typically run <b>20&ndash;25 years</b>; standing-seam metal costs roughly <b>2&ndash;3x more</b> but can last <b>40&ndash;70 years</b>.<br><br>' +
      'Most installs finish in <b>1&ndash;3 days</b>, and you&rsquo;ll know the exact number <i>before</i> anything comes off your roof. Want a free inspection and a real written number?';
  }

  function repairHtml() {
    return 'Leaks don&rsquo;t fix themselves &mdash; but most are smaller than people fear. &#128167;<br><br>' +
      'Typical fixes &mdash; lifted or missing shingles, cracked flashing, boot repairs &mdash; usually run <b>a few hundred dollars</b>. ' +
      'The trick is finding the <i>actual</i> entry point, because water travels: a stain on the ceiling can start 10 feet away on the roof.<br><br>' +
      'That&rsquo;s exactly what our free inspection does &mdash; trace, photograph, and show you. Book one below and see what you&rsquo;re really dealing with.';
  }

  function stormHtml() {
    return 'Storm damage is our home turf. &#127787;<br><br>' +
      'Here&rsquo;s the playbook: <b>1)</b> we walk the roof and photograph <i>everything</i> &mdash; bruised shingles, lifted ridges, damaged vents &mdash; with measurements; ' +
      '<b>2)</b> you get an <b>insurance-ready report</b> you can hand straight to your adjuster; <b>3)</b> we meet the adjuster on-site if you want backup.<br><br>' +
      'One tip from experience: file sooner rather than later &mdash; most policies expect the claim within <b>a year</b> of the storm. Want us out there this week for a free post-storm inspection?';
  }

  function inspectionHtml() {
    return 'Our inspections are free, and they&rsquo;re thorough. &#128269;<br><br>' +
      'We check <b>shingle condition, flashing, vents, valleys, gutters, and attic signs of moisture</b> &mdash; then hand you a written read: what&rsquo;s urgent, what can wait, and what it&rsquo;d cost to fix. ' +
      'No pressure, no mystery line items.<br><br>' +
      'Pick a day below and I&rsquo;ll lock it in:';
  }

  function metalHtml() {
    return 'The metal vs. shingle question, answered straight. &#129693;<br><br>' +
      '<b>Architectural shingle:</b> lower upfront cost, 20&ndash;25 year lifespan, solid hail performance in Class 4 impact-rated lines.<br>' +
      '<b>Standing-seam metal:</b> roughly 2&ndash;3x the price, 40&ndash;70 year lifespan, shrugs off hail and high wind, reflects heat.<br><br>' +
      'Honest take: metal wins long-term in hail country <i>if</i> you&rsquo;re staying put. Selling in a few years? Quality shingles are the smarter spend. Want a consult on your specific roof?';
  }

  function priceHtml() {
    return 'Here&rsquo;s what things actually run around here: &#129309;<br><br>' +
      'Targeted <b>repairs</b> &mdash; usually a few hundred dollars.<br>' +
      'Full <b>replacements</b> &mdash; roughly <b>$8k&ndash;$18k</b> depending on size, pitch, and material.<br>' +
      '<b>Inspections</b> &mdash; free. Always.<br><br>' +
      'The number that matters is the one for <i>your</i> roof &mdash; and that&rsquo;s exactly what the free inspection produces, in writing, before any work starts.';
  }

  function hoursHtml() {
    return '<b>Our hours:</b><br>Mon&ndash;Fri &middot; 8 AM &ndash; 6 PM<br>Saturday &middot; 9 AM &ndash; 2 PM<br>Sunday &middot; closed<br><br>' +
      'But here&rsquo;s the thing &mdash; <b>I&rsquo;m here 24/7</b>, so storm damage, leaks and inspection bookings never have to wait for morning. Want to book one?';
  }

  function defaultChips() {
    return [
      { label: '&#127968; Our services' },
      { label: '&#128197; Book free inspection' },
      { label: '&#127769; After-hours demo' },
      { label: '&#11088; Rate your experience' }
    ];
  }

  function greet() {
    greeted = true;
    return say(
      'Hi there! I\'m <b>' + escapeHtml(BIZ.host) + '</b>, ' + escapeHtml(BIZ.name) + '\'s coordinator. &#127968;<br><br>' +
      'Ask me about <b>storm damage</b>, <b>replacements</b> or <b>repair costs</b> &mdash; or I can <b>book your free inspection</b> right now. What can I help with?',
      defaultChips()
    );
  }

  /* ---------- booking flow (free inspection) ---------- */
  var INTERESTS = ['Storm damage', 'Full replacement', 'Repairs', 'Metal vs shingle consult'];

  function startBooking() {
    S.mode = 'booking'; S.step = 0; S.booking = {};
    return say('Love it &mdash; let&rsquo;s get you on the schedule. <b>What brings you in?</b>',
      INTERESTS.map(function (r) { return { label: r }; }));
  }

  function bookingStep(text) {
    var t = text.toLowerCase().trim();
    if (S.step === 0) {
      var interest = 'Free inspection';
      if (has(t, 'storm', 'hail', 'tornado', 'wind')) interest = 'Storm damage';
      else if (has(t, 'replac', 'new roof')) interest = 'Full replacement';
      else if (has(t, 'repair', 'leak', 'fix', 'patch')) interest = 'Repairs';
      else if (has(t, 'metal', 'shingle', 'consult')) interest = 'Metal vs shingle consult';
      S.booking.interest = interest; S.step = 1;
      return say('<b>' + escapeHtml(interest) + '</b> &mdash; got it. <b>What&rsquo;s your name?</b>');
    }
    if (S.step === 1) {
      var name = text.trim();
      if (name.length < 2 || name.length > 40) {
        return say('And your <b>name</b> for the inspection?');
      }
      S.booking.name = name; S.step = 2;
      return say('Thanks, ' + escapeHtml(cap(name.split(' ')[0])) +
        '! Want a <b>text reminder</b> before your inspection? Drop your number &mdash; or skip it.',
        [{ label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      var digits = digitsOf(t);
      if (t !== 'skip' && digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(or tap Skip)</i>',
          [{ label: 'Skip', value: 'skip' }]);
      }
      if (t !== 'skip') S.booking.phone = text.trim();
      S.step = 3;
      return say('<b>Which day</b> works best for your inspection?',
        [{ label: 'Tomorrow' }, { label: 'Saturday' }, { label: 'Monday' }, { label: 'Wednesday' }]);
    }
    if (S.step === 3) {
      var day = 'Saturday';
      if (has(t, 'tomorrow', 'today')) day = 'Tomorrow';
      else {
        var dm = t.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/);
        if (dm) day = cap(dm[0]);
      }
      S.booking.day = day; S.step = 4;
      return say('<b>' + escapeHtml(day) + '</b> it is. <b>Morning or afternoon</b> &mdash; what time suits you?',
        [{ label: '9:00 AM' }, { label: '12:30 PM' }, { label: '3:00 PM' }]);
    }
    if (S.step === 4) {
      var tm = t.match(/\d{1,2}(:\d{2})?\s*(am|pm)?/);
      if (!tm) {
        return say('What <b>time</b> should I hold for you? <i>(e.g. 3:00 PM)</i>',
          [{ label: '9:00 AM' }, { label: '3:00 PM' }]);
      }
      var time = text.trim();
      if (!/am|pm/i.test(time)) time += ' PM';
      var ref = makeRef();
      S.booking.ref = ref;
      var line = '<b>&#9989; You\'re booked!</b><br><br><b>Free inspection</b> &middot; ' +
        escapeHtml(S.booking.day) + ' at <b>' + escapeHtml(time) + '</b><br>For: <b>' + escapeHtml(S.booking.interest) + '</b><br>Name: <b>' + escapeHtml(S.booking.name) + '</b><br>' +
        'Reference: <span class="ref">' + ref + '</span><br><br>';
      if (S.booking.phone) line += 'We\'ll text your reminder. ';
      line += 'Our crew brings the ladder &mdash; you just bring the questions. Anything else I can help with?<br><br>Prefer to talk it through? ' + callLinkHtml();
      S.mode = 'idle'; S.step = 0;
      return say(line, [{ label: '&#127968; Our services' }, { label: '&#128336; Hours & location' }]);
    }
  }

  /* ---------- after-hours lead capture (the money flow) ---------- */
  var AH_TOPICS = {
    storm:       { label: 'Storm damage',      prompt: 'Tell me about the damage &mdash; <i>hail, missing shingles, leaks, fallen branches &mdash; anything you saw</i>' },
    replacement: { label: 'Replacement quote', prompt: 'Tell me about the roof &mdash; <i>age, material, any leaks</i> &mdash; and the morning crew will come prepared' },
    repair:      { label: 'Repair',            prompt: 'What needs fixing? <i>leaks, missing shingles, gutters &mdash; anything helps</i>' }
  };

  function startAfterHours() {
    S.mode = 'afterhours'; S.step = 0; S.ah = {};
    return sayMany([
      {
        notice: true,
        html: '&#127769; <b>It\'s 11:42 PM</b> &mdash; the office is closed right now, but I\'m ' + escapeHtml(BIZ.host) +
          ', ' + escapeHtml(BIZ.name) + '\'s coordinator, and I\'m still here. <b>Storm damage doesn&rsquo;t wait till morning &mdash; neither do we.</b>'
      },
      {
        html: 'What can I capture for the morning crew?',
        chips: [
          { label: '&#127787; Storm damage', value: 'storm' },
          { label: '&#127968; Replacement quote', value: 'replacement' },
          { label: '&#128295; Repair', value: 'repair' }
        ]
      }
    ]);
  }

  function afterHoursStep(text) {
    var t = text.trim();
    if (S.step === 0) {
      var key = 'storm';
      var tl = t.toLowerCase();
      if (has(tl, 'replac', 'new roof', 'quote')) key = 'replacement';
      else if (has(tl, 'repair', 'leak', 'fix')) key = 'repair';
      else if (has(tl, 'storm', 'hail', 'damage')) key = 'storm';
      S.ah.topic = AH_TOPICS[key].label; S.ah.key = key; S.step = 1;
      return say('<b>' + escapeHtml(S.ah.topic) + '</b> &mdash; noted. What <b>name</b> should I save this under?');
    }
    if (S.step === 1) {
      if (t.length < 2 || t.length > 40 || /\d/.test(t)) {
        return say('What <b>name</b> should I save this under?');
      }
      S.ah.name = t; S.step = 2;
      return say('Thanks, ' + escapeHtml(cap(t.split(' ')[0])) + '! And the best <b>number</b> for the morning crew to reach you?');
    }
    if (S.step === 2) {
      var digits = digitsOf(t);
      if (digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(digits only is fine)</i>');
      }
      S.ah.phone = t; S.step = 3;
      return say('Got it. ' + AH_TOPICS[S.ah.key].prompt,
        [{ label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 3) {
      S.ah.details = (t.toLowerCase() === 'skip') ? '—' : t;
      saveLead({ name: S.ah.name, phone: S.ah.phone, topic: S.ah.topic, details: S.ah.details, source: 'after-hours 11:42 PM' });
      S.mode = 'idle'; S.step = 0;
      return sayMany([
        { html: '<b>&#9989; Saved!</b> The morning crew will follow up <b>first thing</b> &mdash; storm calls go to the front of the day&rsquo;s route. No need to wonder if anyone saw your message.' },
        {
          dash: [
            ['New lead', S.ah.name],
            ['Phone', S.ah.phone],
            ['Topic', S.ah.topic],
            ['Details', S.ah.details],
            ['Captured', '11:42 PM (after hours)']
          ]
        },
        {
          html: 'That&rsquo;s the whole point &mdash; <b>every late-night inquiry becomes a morning follow-up</b>, not a job lost to the roofer down the street. Anything else tonight?',
          chips: defaultChips()
        }
      ]);
    }
  }

  /* ---------- review routing ---------- */
  function startReview() {
    S.mode = 'review'; S.step = 0;
    return say('We\'d love to hear it &mdash; <b>how was your experience?</b> Tap the stars:').then(function () {
      showStars();
    });
  }

  function pickStars(n) {
    chipsBox.innerHTML = '';
    addUser('\u2B50'.repeat(n));
    if (n === 5) {
      S.mode = 'idle';
      say('That made our whole crew&rsquo;s day! &#128525;<br><br>Would you <b>share that on Google</b>? It genuinely keeps a local roofer like us thriving.',
        [{ label: 'Not now', value: 'not now' }]).then(function () {
          var row = document.querySelector('#maya-msgs .mrow.bot:last-child .bubble');
          if (row) {
            var a = document.createElement('a');
            a.className = 'gbtn'; a.href = 'https://www.google.com/maps'; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = '\u2B50 Leave a Google review';
            row.appendChild(document.createElement('br'));
            row.appendChild(a); scrollDown();
          }
        });
    } else {
      S.mode = 'review'; S.step = 1;
      say('Thank you for being honest &mdash; that&rsquo;s how we get better. <b>What could we do better</b> next time?');
    }
  }

  function reviewStep(text) {
    S.mode = 'idle'; S.step = 0;
    saveLead({ name: '(review feedback)', phone: '—', topic: 'Private feedback', details: text.trim(), source: 'review routing' });
    return say('<b>Noted &mdash; truly.</b> Our owner will personally follow up on this.<br><br>' +
      'We&rsquo;d love a second chance to earn those last stars. Can I book you a free inspection?',
      [{ label: '&#128197; Book free inspection' }, { label: 'No thanks', value: 'no thanks' }]);
  }

  /* ---------- main router ---------- */
  function route(text) {
    var t = text.toLowerCase().trim();

    if (S.mode === 'booking') return bookingStep(text);
    if (S.mode === 'afterhours') return afterHoursStep(text);
    if (S.mode === 'review' && S.step === 1) return reviewStep(text);

    if (has(t, 'book', 'schedul', 'appoint', 'sign me up', 'slot', 'i need an inspection', 'need an inspection', 'get a quote', 'need a quote', 'want a quote', 'get an estimate', 'check my roof', 'look at my roof', 'free inspection')) return startBooking();
    if (has(t, 'after hour', 'after-hour', 'closed', 'late night', 'midnight', '11:42')) return startAfterHours();
    if (has(t, 'storm', 'hail', 'tornado', 'wind damage', 'hurricane', 'insurance', 'claim', 'adjuster')) return say(stormHtml(), [{ label: '&#128197; Book free inspection' }, { label: '&#127968; Our services' }]);
    if (has(t, 'metal', 'shingle', 'standing seam', 'material', 'what kind of roof', 'asphalt')) return say(metalHtml(), [{ label: '&#128197; Book free inspection' }, { label: '&#127968; Our services' }]);
    if (has(t, 'replac', 'new roof', 'old roof', 'roof age', 'how old', 'lifespan', 'reroof')) return say(replacementHtml(), [{ label: '&#128197; Book free inspection' }, { label: '&#129309; Pricing' }]);
    if (has(t, 'repair', 'fix', 'leak', 'drip', 'patch', 'missing', 'curling', 'flashing', 'gutter')) return say(repairHtml(), [{ label: '&#128197; Book free inspection' }, { label: '&#129309; Pricing' }]);
    if (has(t, 'inspect', 'checkup', 'assessment', 'estimate')) return say(inspectionHtml(), [{ label: '&#128197; Book free inspection' }]);
    if (has(t, 'review', 'rate', 'stars', 'feedback')) return startReview();
    if (has(t, 'price', 'cost', 'how much', 'expensive', 'cheap', '$$', 'what does it run', 'financ')) return say(priceHtml(), [{ label: '&#127968; Our services' }, { label: '&#128197; Book free inspection' }]);
    if (has(t, 'hour', 'open', 'close', 'when do you', 'what time')) return say(hoursHtml(), [{ label: '&#128197; Book free inspection' }]);
    if (has(t, 'where', 'address', 'location', 'direction', 'find you', 'service area', 'based', 'serve')) {
      return say('Find us at <b>' + escapeHtml(BIZ.address) + '</b> &mdash; free parking out front. &#128205;<br><br>' + callLinkHtml() + ' &mdash; we&rsquo;re happy to help anytime.',
        [{ label: '&#128197; Book free inspection' }]);
    }
    if (has(t, 'human', 'person', 'real person', 'call you', 'phone number', 'speak to', 'crew', 'owner')) return say('Of course &mdash; ' + callLinkHtml() + ' during open hours and a real human picks up. But honestly? I can handle <b>inspections, pricing, and storm claims</b> right here, even at 2 AM. &#128521;', defaultChips());
    if (has(t, 'thank', 'thanks', 'thx', 'great', 'awesome', 'perfect')) return say('Anytime! That&rsquo;s what I&rsquo;m here for. &#127968;', defaultChips());
    if (has(t, 'bye', 'goodbye', 'see you', 'later')) { S.mode = 'idle'; return say('Stay dry up there &mdash; see you soon at ' + escapeHtml(BIZ.name) + '! &#127968;'); }
    if (/\b(hi+|hello|hey+|hola|yo)\b/.test(t) || has(t, 'good morning', 'good evening')) return say('Hey hey! &#128075; What can I do for you &mdash; <b>storm damage</b>, <b>replacements</b>, or shall I <b>book your free inspection</b>?', defaultChips());
    if (has(t, 'no thanks', 'not now', 'nope', "i'm good", 'im good')) { S.mode = 'idle'; return say('No worries at all! I&rsquo;m here whenever you need me. &#127968;', defaultChips()); }

    /* graceful fallback — never dead-ends */
    S.lastTopic = text;
    return say('Great question &mdash; let me have the crew confirm that for you. &#128172;<br><br>Meanwhile, can I help with a <b>free inspection</b>, our <b>services</b>, or <b>storm damage</b>?',
      [{ label: '&#128197; Book free inspection' }, { label: '&#127968; Our services' }, { label: '&#128336; Hours & location' }]);
  }

  function userSays(text, silent) {
    if (!text || !text.trim()) return Promise.resolve();
    text = text.trim();
    setChips([]);
    if (!silent) addUser(text);
    return route(text);
  }

  /* ---------- open / close ---------- */
  function openPanel(silent) {
    opened = true;
    panel.classList.add('open');
    bubble.classList.add('hidden');
    unread.classList.add('hidden');
    if (!greeted && !silent) greet();
  }
  function closePanel() {
    opened = false;
    panel.classList.remove('open');
    bubble.classList.remove('hidden');
  }

  function init() {
    panel = $('maya-panel'); msgs = $('maya-msgs'); chipsBox = $('maya-chips');
    input = $('maya-input'); bubble = $('maya-bubble'); unread = $('maya-unread'); closeBtn = $('maya-close');
    personalize();
    deepPersonalize();

    /* bubble click greets normally; hero CTA passes silent=true to skip straight to booking */
    bubble.addEventListener('click', function () { openPanel(); });
    closeBtn.addEventListener('click', closePanel);
    $('maya-send').addEventListener('click', function () { userSays(input.value); input.value = ''; input.focus(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { userSays(input.value); input.value = ''; }
    });

    /* site CTAs jump into flows */
    document.querySelectorAll('[data-action="book"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(true); /* silent: goes straight to booking, no greeting */
        setTimeout(function () { if (S.mode === 'idle') startBooking(); }, FAST ? 50 : 600);
      });
    });
    document.querySelectorAll('[data-action="storm"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(true);
        setTimeout(function () { if (S.mode === 'idle') userSays('storm damage help', true); }, FAST ? 50 : 600);
      });
    });

    /* captured-leads inbox toggle (prospect-visible "Saved to your dashboard") */
    var idom = inboxDom();
    if (idom) {
      renderInbox();
      idom.toggle.addEventListener('click', function () {
        var isHidden = idom.panel.hasAttribute('hidden');
        if (isHidden) { idom.panel.removeAttribute('hidden'); renderInbox(); }
        else { idom.panel.setAttribute('hidden', ''); }
        idom.toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    /* proactive nudge — once, ~8s in (?nonudge=1 skips it for the bubble-click test) */
    if (!NO_NUDGE) setTimeout(function () {
      if (!opened && !autoOpened) {
        autoOpened = true;
        unread.classList.remove('hidden');
        bubble.classList.add('hidden');
        panel.classList.add('open');
        opened = true;
        if (!greeted) greet();
      }
    }, FAST ? 600 : 8000);

    /* test hooks */
    window.__maya = {
      BIZ: BIZ, S: S,
      send: function (t) { openPanel(); return userSays(t); },
      open: openPanel, close: closePanel,
      pickStars: pickStars,
      saveLead: saveLead,
      renderInbox: renderInbox,
      getLeads: function () { return leads; },
      clearLeads: function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} renderInbox(); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
