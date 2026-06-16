/* ─────────────────────────────────────────────────────────────
   Vietnam trip — app shell, renderers, map, sheet, guide, PWA.
   Renders entirely from TRIP (data.js). Icons from ICON_PATHS (icons.js).
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cityById = id => TRIP.cities.find(c => c.id === id) || {};
  const colorOf  = id => (cityById(id).color || "ink");
  const cityImg  = id => `img/${id}.jpg`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = name => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-0.125em">${(typeof ICON_PATHS !== "undefined" && ICON_PATHS[name]) || ""}</svg>`;
  const catIcon = { coffee: "coffee", food: "food", shopping: "shopping", sights: "sights", nightlife: "nightlife", stay: "stay" };

  const gmapsDir    = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const gmapsSearch = (name, lat, lng) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}%20${lat},${lng}`;

  /* ─────────── TOAST ─────────── */
  let toastTimer;
  function toast(msg, actionLabel, onAction, sticky) {
    const el = $("#toast");
    el.innerHTML = esc(msg) + (actionLabel ? ` <button id="toastBtn">${esc(actionLabel)}</button>` : "");
    el.classList.add("show");
    if (actionLabel) $("#toastBtn").addEventListener("click", () => { hideToast(); onAction && onAction(); });
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast() { $("#toast").classList.remove("show"); }

  /* ─────────── THEME ─────────── */
  let tileLayer = null;
  const theme = () => document.documentElement.getAttribute("data-theme") || "light";
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("#themeToggle").innerHTML = `<span class="ic">${icon(t === "dark" ? "sun" : "moon")}</span>`;
    const m = document.querySelector('meta[name="theme-color"]:not([media*="dark"])');
    if (m) m.setAttribute("content", t === "dark" ? "#15110C" : "#F2EEDF");
    if (tileLayer) tileLayer.setUrl(tileUrl());
  }
  function initTheme() {
    const saved = localStorage.getItem("vn-theme");
    const sysDark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (sysDark ? "dark" : "light"));
    $("#themeToggle").addEventListener("click", () => {
      const next = theme() === "dark" ? "light" : "dark";
      localStorage.setItem("vn-theme", next); applyTheme(next);
    });
  }

  /* ─────────── STATIC ICONS in chrome ─────────── */
  function paintChromeIcons() {
    $$(".tab").forEach(t => { t.querySelector(".tab-ico").innerHTML = icon(t.dataset.ico); });
    const set = (id, name) => { const el = $("#" + id); if (el) el.innerHTML = icon(name); };
    set("locateBtn", "locate"); set("routeLabelIco", "plane");
    set("stayLabelIco", "stay"); set("mapLabelIco", "map"); set("daysLabelIco", "days");
    set("placesLabelIco", "places"); set("packLabelIco", "pack"); set("guideLabelIco", "guide");
    set("curIco", "wallet"); set("phrIco", "languages"); set("emIco", "alert"); set("scrollCue", "chevron");
    // scrollCue keeps its text; prepend chevron below
    const sc = $("#scrollCue"); if (sc) sc.innerHTML = `<span>Scroll to explore</span><span class="ic">${icon("chevron")}</span>`;
  }

  /* ─────────── IMAGES ─────────── */
  function preload(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = src; }); }
  async function loadCover() {
    if (await preload("img/hero.jpg")) { $("#coverBg").style.backgroundImage = "url(img/hero.jpg)"; $("#coverBg").classList.add("loaded"); }
  }

  /* ─────────── VISITED (reward) ─────────── */
  const visitedKey = "vn-visited";
  function getVisited() { try { return new Set(JSON.parse(localStorage.getItem(visitedKey) || "[]")); } catch (_) { return new Set(); } }
  function setVisited(set) { localStorage.setItem(visitedKey, JSON.stringify([...set])); }

  /* ─────────── HERO "UP NEXT" CARD ─────────── */
  const shortDate = d => { const p = d.split(" "); return p[1] + " " + p[2]; };
  function renderHero() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(TRIP.meta.start + "T00:00:00");
    const end = new Date(TRIP.meta.end + "T00:00:00");
    const c = $("#heroCard");
    let accent, top, headline, sub, rows = [], ctaLabel, ctaView, ctaDay;

    if (today < start) {
      const days = Math.round((start - today) / 86400000);
      const d1 = TRIP.days[0], stay1 = TRIP.stays[0], f = TRIP.flights;
      accent = colorOf(d1.city);
      top = `${icon("sparkle")} Counting down`;
      headline = `<span class="count">${days}</span> day${days === 1 ? "" : "s"} to go`;
      sub = `Wheels up ${esc(f.outbound.airline.split("·")[0].trim())}`;
      rows = [
        ["plane", `<strong>${esc(f.outbound.route)}</strong> · ${esc(f.outbound.time)}`],
        ["stay", `First nights at <strong>${esc(stay1.name.split(",")[0])}</strong>`],
        ["calendar", `Day 1 — ${esc(d1.title)}, ${esc(d1.date)}`],
      ];
      ctaLabel = "Open Day 1"; ctaView = "daysView"; ctaDay = 1;
    } else if (today > end) {
      accent = "lilac";
      top = `${icon("sparkle")} The trip`;
      headline = `Welcome home`;
      sub = `Eleven days, five cities, countless bowls of pho.`;
      rows = [["map", `Relive the route any time`]];
      ctaLabel = "Revisit the days"; ctaView = "daysView"; ctaDay = 1;
    } else {
      const dN = TRIP.days.find(d => new Date(d.iso + "T00:00:00").getTime() === today.getTime()) || TRIP.days[0];
      accent = colorOf(dN.city);
      const stay = TRIP.stays.find(s => s.name === dN.stay);
      top = `${icon("clock")} Today · Day ${dN.n} of 11`;
      headline = esc(dN.title);
      sub = esc(dN.date);
      rows = [];
      if (stay) rows.push(["stay", `Tonight: <strong>${esc(stay.name.split(",")[0])}</strong>`]);
      rows.push(["days", `${dN.cols.length} parts planned`]);
      ctaLabel = "Open today"; ctaView = "daysView"; ctaDay = dN.n;
    }

    c.innerHTML =
      `<div class="hero-accent ${accent}" style="background:var(--${accent})"></div>
       <div class="hero-pad">
         <div class="hero-top">${top}</div>
         <div class="hero-headline">${headline}</div>
         <div class="hero-sub">${sub}</div>
         <div class="hero-rows">${rows.map(([ic, html]) => `<div class="hero-row"><span class="ic">${icon(ic)}</span><span>${html}</span></div>`).join("")}</div>
         <button class="hero-cta" id="heroCta"><span class="ic">${icon("arrowright")}</span>${esc(ctaLabel)}</button>
       </div>`;
    $("#heroCta").addEventListener("click", () => { switchView(ctaView); setTimeout(() => scrollToDay(ctaDay), 260); });
  }

  /* ─────────── OVERVIEW ─────────── */
  function renderOverview() {
    $("#routeDots").innerHTML = TRIP.cities.map((c, i) =>
      `<span class="dot ${c.color}">${esc(c.name)}</span>` + (i < TRIP.cities.length - 1 ? `<span class="dot-arrow">→</span>` : "")
    ).join("");

    $("#statsGrid").innerHTML = TRIP.stats.map(s =>
      `<div class="stat-card"><div class="num ${s.color}">${esc(s.num)}</div><div class="label">${esc(s.label)}</div></div>`
    ).join("");

    const f = TRIP.flights;
    const leg = l => `<div class="flight-leg"><h4>${esc(l.label)}</h4><div class="airline">${esc(l.airline)}</div><div class="route">${esc(l.route)}</div><div class="time">${esc(l.time)}</div></div>`;
    const legs = [f.outbound];
    if (f.domestic) legs.push(f.domestic);
    legs.push(f.inbound);
    $("#flightsWrap").innerHTML =
      `<div class="card"><h3><span class="ic">${icon("plane")}</span> Flights</h3>
        <div class="label-group"><span class="pink">${esc(f.airline)}</span><span class="blush">Ref: ${esc(f.ref)}</span></div>
        <div class="flight-details">${legs.map(leg).join("")}</div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin-top:0.75rem;">${esc(f.note)}</p></div>`;

    $("#routeTimeline").innerHTML = TRIP.cities.map((c, i) =>
      `<div class="route-stop"><div class="rdot ${c.color}"></div><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.nights)}</div>${i < TRIP.cities.length - 1 ? '<div class="connector"></div>' : ""}</div>`
    ).join("");

    $("#staysList").innerHTML = TRIP.stays.map((s, i) =>
      `<div class="booking-card ${colorOf(s.city)}" data-stay="${i}" tabindex="0" role="button">
        <div class="booking-thumb" style="background-image:url(${cityImg(s.city)})"></div>
        <div class="booking-main">
          <div class="booking-name">${esc(s.name.split(",")[0])}</div>
          <div class="booking-loc">${esc(s.loc)}</div>
          <div class="booking-dates">${esc(s.dates)}</div>
        </div>
        <span class="booking-check ic" title="Booked">${icon("circlecheck")}</span>
      </div>`
    ).join("");
    $$("#staysList .booking-card").forEach(el => {
      const open = () => openStaySheet(TRIP.stays[+el.dataset.stay]);
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });

    const rows = TRIP.stays.map(s => `<tr><td>${esc(s.loc)}</td><td>${esc(s.nights)}</td><td>${esc(s.est)}</td></tr>`).join("");
    $("#budgetWrap").innerHTML =
      `<div class="card" style="margin-top:1rem;"><h3><span class="ic">${icon("wallet")}</span> Accommodation</h3>
        <p style="font-size:0.84rem;color:var(--ink-soft);margin-bottom:0.6rem;">${esc(TRIP.budgetNote)}</p>
        <div class="table-wrap"><table class="compare-table">
          <thead><tr><th>Location</th><th>Nights</th><th>Est.</th></tr></thead>
          <tbody>${rows}<tr class="total"><td><strong>Total</strong></td><td>11</td><td><strong>${esc(TRIP.budgetTotal)}</strong></td></tr></tbody>
        </table></div></div>`;
  }

  /* ─────────── DAYS ─────────── */
  // ── itinerary item helpers (checkable + parsed) ──
  const doneKey = "vn-done";
  function getDone() { try { return new Set(JSON.parse(localStorage.getItem(doneKey) || "[]")); } catch (_) { return new Set(); } }
  function setDoneSet(s) { localStorage.setItem(doneKey, JSON.stringify([...s])); }
  // item sub-categories — colour + icon shown per itinerary line so each
  // Morning/Afternoon/Evening block is scannable by type.
  const CATS = {
    coffee:   { ic: "coffee",   col: "lemon", label: "Cafe" },
    food:     { ic: "food",     col: "blush", label: "Food" },
    shopping: { ic: "shopping", col: "pink",  label: "Shopping" },
    sights:   { ic: "sights",   col: "sage",  label: "Sights" },
    activity: { ic: "sparkle",  col: "lilac", label: "Activity" },
    travel:   { ic: "plane",    col: "soft",  label: "Travel" },
  };
  const catVar = cat => (CATS[cat] || CATS.activity).col === "soft" ? "var(--ink-soft)" : `var(--${(CATS[cat] || CATS.activity).col})`;
  function inferCat(text) {
    const s = text.toLowerCase();
    if (/check[\s-]?in|check[\s-]?out|\bfly\b|flight|\bgrab\b|transfer|depart|disembark|pick ?up|shuttle|driver|board cruise|return to|hotel pickup|airport|\b(sgn|han|dad|doh|jnb)\b|land early/.test(s)) return "travel";
    if (/market|tailor|shopping|souvenir|silk|fashion|boutique|leather|clothing|lacquer|sweep|\bstore\b|vintage|jewell?ery|streetwear|concept store/.test(s)) return "shopping";
    if (/coffee|caf[eé]|matcha/.test(s)) return "coffee";
    if (/banh mi|\bbun |\bpho\b|noodle|dumpling|dinner|lunch|brunch|breakfast|beer|\bbia\b|drink|cocktail|restaurant|cao lau|seafood|street food|cooking|\bfood\b|buffet|bbq|brew/.test(s)) return "food";
    if (/lake|temple|pagoda|bridge|museum|citadel|cave|tomb|mausoleum|\bpass\b|assembly hall|train street|old town|ancient town|imperial|prison|square|cathedral|statue|buddha|peninsula|post office/.test(s)) return "sights";
    if (/kayak|show|\bride\b|crawl|massage|tai chi|boat|walk|wander|fishing|puppet|lantern|demonstration|class/.test(s)) return "activity";
    return "activity";
  }
  function parseItem(raw) {
    let s = String(raw);
    let optional = false;
    const opt = s.match(/^\s*\?\s+/);
    if (opt) { optional = true; s = s.slice(opt[0].length); }
    let cat = null;
    const m = s.match(/^\s*(food|coffee|shop|shopping|see|sights|do|activity|go|travel)\s*\|\s*/i);
    if (m) { cat = ({ shop: "shopping", see: "sights", do: "activity", go: "travel" })[m[1].toLowerCase()] || m[1].toLowerCase(); s = s.slice(m[0].length); }
    const highlight = /[⭐🌟★]/.test(s);
    const text = s.replace(/[⭐🌟★✅]/g, "").replace(/\(conf:[^)]*\)/gi, "").replace(/\s{2,}/g, " ").trim();
    if (!cat && text) cat = inferCat(text);
    return { text, highlight, cat, optional };
  }
  const dayTotals = d => { let t = 0; d.cols.forEach(c => c.items.forEach(it => { if (parseItem(it).text) t++; })); return t; };
  const dayDoneCount = (d, set) => { let n = 0; d.cols.forEach((c, ci) => c.items.forEach((it, ii) => { if (parseItem(it).text && set.has(`${d.n}:${ci}:${ii}`)) n++; })); return n; };
  function progressHTML(d, set) {
    const total = dayTotals(d), done = dayDoneCount(d, set);
    const label = (done === total && total) ? `All ${total} done 🎉` : `${done} of ${total} done`;
    return `<div class="day-progress" id="prog-${d.n}"><span class="bar"><div style="width:${total ? done / total * 100 : 0}%"></div></span><span class="ptxt">${label}</span></div>`;
  }
  function toggleDone(key, btn) {
    const s = getDone();
    if (s.has(key)) s.delete(key); else { s.add(key); btn.classList.add("pop"); setTimeout(() => btn.classList.remove("pop"), 400); }
    setDoneSet(s);
    btn.classList.toggle("on", s.has(key));
    btn.closest(".tl-item").classList.toggle("done", s.has(key));
    updateDayProgress(+key.split(":")[0]);
  }
  function updateDayProgress(n) {
    const d = TRIP.days.find(x => x.n === n); if (!d) return;
    const set = getDone(), total = dayTotals(d), done = dayDoneCount(d, set);
    const el = $("#prog-" + n); if (!el) return;
    el.querySelector(".ptxt").textContent = (done === total && total) ? `All ${total} done 🎉` : `${done} of ${total} done`;
    el.querySelector(".bar>div").style.width = (total ? done / total * 100 : 0) + "%";
  }

  function dayCardHTML(d, isToday) {
    const set = getDone();
    const tags = d.tags.map(([t, c]) => `<span class="day-tag ${c}">${esc(t)}</span>`).join("");
    const col = colorOf(d.city);
    const sections = d.cols.map((c, ci) => {
      const items = c.items.map((raw, ii) => {
        const { text, highlight, cat, optional } = parseItem(raw); if (!text) return "";
        const key = `${d.n}:${ci}:${ii}`, on = set.has(key);
        const c0 = CATS[cat] || CATS.activity;
        return `<li class="tl-item ${on ? "done" : ""} ${optional ? "is-optional" : ""}" data-cat="${cat}">
          <button class="item-tick ${on ? "on" : ""}" data-done="${key}" aria-label="Mark done"><span class="ic">${icon("check")}</span></button>
          <span class="item-cat ic" title="${esc(c0.label)}" style="color:${catVar(cat)}">${icon(c0.ic)}</span>
          <span class="item-text ${highlight ? "hl" : ""}">${highlight ? `<span class="item-star ic">${icon("sparkle")}</span>` : ""}${esc(text)}${optional ? `<span class="opt-tag">optional</span>` : ""}</span>
        </li>`;
      }).join("");
      return `<div class="tl-section"><div class="tl-rail"><span class="tl-dot" style="background:var(--${col})"></span></div><div class="tl-content"><h4>${esc(c.h)}</h4><ul class="tl-items">${items}</ul></div></div>`;
    }).join("");

    let foot = "";
    if (d.stay) foot += `<div class="day-foot"><span class="stay-link" data-staylink="${esc(d.stay)}" tabindex="0" role="button"><span class="ic">${icon("stay")}</span>${esc(d.stay.split(",")[0])}</span></div>`;
    d.foot.forEach(x => {
      if (/^\s*🌧️/.test(x) || /backup/i.test(x)) foot += `<div class="rain-note"><span>🌧️</span><span>${esc(x.replace(/^\s*🌧️\s*/, ""))}</span></div>`;
      else foot += `<div class="day-note">${esc(x)}</div>`;
    });

    const city = cityById(d.city);
    return `<div class="day-card ${isToday ? "is-today" : ""}" id="day-${d.n}">
      <div class="day-hero" style="background-image:url(${cityImg(d.city)})">
        ${isToday ? '<span class="dh-today">Today</span>' : ""}
        <span class="dh-num">Day ${d.n}</span>
        <span class="dh-city">${esc(city.name)}</span>
      </div>
      <div class="day-pad">
        <div class="day-head"><h3>${esc(d.title)} · <span style="color:var(--ink-soft);font-size:0.85em;">${esc(d.date)}</span></h3></div>
        <div class="day-tags">${tags}</div>
        ${progressHTML(d, set)}
        <div class="day-timeline">${sections}</div>
        ${foot}
      </div></div>`;
  }
  function renderDays() {
    const todayN = currentDayNumber();
    const legend = $("#catLegend");
    if (legend) legend.innerHTML = ["coffee", "food", "shopping", "sights", "activity", "travel"].map(k => {
      const c = CATS[k];
      return `<span class="legend-item"><span class="ic" style="color:${catVar(k)}">${icon(c.ic)}</span>${esc(c.label)}</span>`;
    }).join("");
    $("#dayDeck").innerHTML = TRIP.days.map(d => dayCardHTML(d, d.n === todayN)).join("");
    $("#dateStrip").innerHTML = TRIP.days.map(d => {
      const p = d.date.split(" ");
      return `<div class="date-chip ${d.n === todayN ? "today-chip" : ""}" data-day="${d.n}" tabindex="0" role="button"><span class="d-day">D${d.n}</span><span class="d-wday">${esc(p[0])}</span><span class="d-date">${esc(p[1])} ${esc(p[2])}</span></div>`;
    }).join("");
    $$("#dayDeck .stay-link").forEach(el => {
      const open = () => { const s = TRIP.stays.find(x => x.name === el.dataset.staylink); if (s) openStaySheet(s); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    $$("#dateStrip .date-chip").forEach(chip => chip.addEventListener("click", () => scrollToDay(+chip.dataset.day)));
    $$("#dayDeck .item-tick").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); toggleDone(btn.dataset.done, btn); }));
    const deck = $("#dayDeck"); let raf;
    deck.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateActiveChip); });
  }
  function updateActiveChip() {
    const deck = $("#dayDeck"); const center = deck.scrollLeft + deck.clientWidth / 2;
    let best = 1, bd = Infinity;
    TRIP.days.forEach(d => { const el = $("#day-" + d.n); if (!el) return; const c = el.offsetLeft + el.offsetWidth / 2; const dist = Math.abs(c - center); if (dist < bd) { bd = dist; best = d.n; } });
    $$("#dateStrip .date-chip").forEach(chip => chip.classList.toggle("active", +chip.dataset.day === best));
  }
  function scrollToDay(n) { const el = $("#day-" + n); if (!el) return; const deck = $("#dayDeck"); deck.scrollTo({ left: el.offsetLeft - (deck.clientWidth - el.offsetWidth) / 2, behavior: "smooth" }); }
  function currentDayNumber() {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const m = TRIP.days.find(d => new Date(d.iso + "T00:00:00").getTime() === today.getTime()); return m ? m.n : null;
  }

  /* ─────────── PLACES (by city + reward ticks) ─────────── */
  function renderPlaces() {
    const visited = getVisited();
    const wishlist = TRIP.places.filter(p => p.wishlist !== false);
    let html = "";
    TRIP.cities.forEach(city => {
      const items = wishlist.filter(p => p.city === city.id);
      if (!items.length) return;
      html += `<div class="city-band" style="background-image:url(${cityImg(city.id)})"><span class="cb-name">${esc(city.name)}</span><span class="cb-count">${items.length} spot${items.length === 1 ? "" : "s"}</span></div>`;
      html += `<div class="places-grid">` + items.map(p => {
        const on = visited.has(p.name);
        return `<div class="place-card ${on ? "visited" : ""}" data-place="${esc(p.name)}" tabindex="0" role="button">
          <span class="cat-pill"><span class="ic">${icon(catIcon[p.cat] || "places")}</span>${esc(p.cat)}</span>
          <h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>
          <button class="tick-btn ${on ? "on" : ""}" data-tick="${esc(p.name)}" aria-label="Mark as visited"><span class="ic">${icon("check")}</span></button>
        </div>`;
      }).join("") + `</div>`;
    });
    $("#placesWrap").innerHTML = html;
    $$("#placesWrap .place-card").forEach(el => {
      const open = e => { if (e.target.closest(".tick-btn")) return; const p = TRIP.places.find(x => x.name === el.dataset.place); if (p) openPlaceSheet(p); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter") { const p = TRIP.places.find(x => x.name === el.dataset.place); if (p) openPlaceSheet(p); } });
    });
    $$("#placesWrap .tick-btn").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); toggleVisited(btn.dataset.tick, btn); }));
    updatePlacesProgress();
  }
  function toggleVisited(name, btn) {
    const v = getVisited();
    if (v.has(name)) v.delete(name); else { v.add(name); btn.classList.add("pop"); setTimeout(() => btn.classList.remove("pop"), 400); }
    setVisited(v);
    btn.classList.toggle("on", v.has(name));
    btn.closest(".place-card").classList.toggle("visited", v.has(name));
    updatePlacesProgress();
  }
  function updatePlacesProgress() {
    const total = TRIP.places.filter(p => p.wishlist !== false).length;
    const done = getVisited().size;
    $("#placesProgress").innerHTML = `<div class="progress-pill"><span class="ic">${icon("circlecheck")}</span> ${done} of ${total} visited <span class="bar"><div style="width:${total ? done / total * 100 : 0}%"></div></span></div>`;
  }

  /* ─────────── PACKING ─────────── */
  function renderPacking() {
    $("#packingList").innerHTML = TRIP.packing.map((it, i) => `<label class="packing-item"><input type="checkbox" data-pack="${i}"> ${esc(it.label)}</label>`).join("");
    $$("#packingList input").forEach((cb, i) => {
      const saved = localStorage.getItem("vietnam-packing-" + i);
      cb.checked = saved !== null ? saved === "true" : !!TRIP.packing[i].checked;
      cb.addEventListener("change", () => { localStorage.setItem("vietnam-packing-" + i, cb.checked); updatePackProgress(); });
    });
    updatePackProgress();
  }
  function updatePackProgress() {
    const b = $$("#packingList input"), done = b.filter(x => x.checked).length;
    $("#packProgress").textContent = `${done} of ${b.length} packed`;
    $("#packBar").style.width = (b.length ? done / b.length * 100 : 0) + "%";
  }

  /* ─────────── GUIDE ─────────── */
  function renderCurrency() {
    const cur = TRIP.currency; let rate = cur.fallbackRate, live = false;
    try { const o = JSON.parse(localStorage.getItem("vn-rate") || "null"); if (o && o.rate) { rate = o.rate; live = true; } } catch (_) {}
    const zar = $("#zarInput"), vnd = $("#vndInput"), note = $("#rateNote"), cg = $("#cheatGrid");
    const fmt = n => Math.round(n).toLocaleString("en-US");
    const fromZar = () => vnd.value = Math.round((parseFloat(zar.value) || 0) * rate);
    const fromVnd = () => zar.value = ((parseFloat(vnd.value) || 0) / rate).toFixed(2);
    const cheats = () => cg.innerHTML = cur.cheats.map(v => `<div class="cheat"><div class="vnd">${fmt(v)} ₫</div><div class="zar">≈ R${(v / rate).toFixed(2)}</div></div>`).join("");
    const noteText = () => note.textContent = live ? `Live rate · R1 ≈ ${fmt(rate)} ₫` : `Offline · approx R1 ≈ ${fmt(rate)} ₫`;
    zar.addEventListener("input", () => { fromZar(); cheats(); });
    vnd.addEventListener("input", fromVnd);
    fromZar(); cheats(); noteText();
    fetch("https://open.er-api.com/v6/latest/ZAR").then(r => r.json()).then(d => {
      const v = d && d.rates && d.rates.VND;
      if (v) { rate = v; live = true; localStorage.setItem("vn-rate", JSON.stringify({ rate: v, t: Date.now() })); fromZar(); cheats(); noteText(); }
    }).catch(() => {});
  }
  function renderPhrases() {
    $("#phrasesWrap").innerHTML = TRIP.phrases.map(g =>
      `<div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;margin:1rem 0 0.3rem;">${esc(g.g)}</div>` +
      g.items.map(([en, vi, ph]) => `<div class="phrase-row"><div class="phrase-en">${esc(en)}</div><div><div class="phrase-vi">${esc(vi)}</div><div class="phrase-ph">${esc(ph)}</div></div></div>`).join("")
    ).join("");
  }
  function renderEmergency() {
    const e = TRIP.emergency;
    $("#emergGrid").innerHTML = e.numbers.map(n => `<a class="emerg-num" href="tel:${esc(n.num)}"><span class="ic" style="font-size:1.3rem;color:var(--pink);">${icon("phone")}</span><span class="e-num">${esc(n.num)}</span><span class="e-lbl">${esc(n.label)}</span></a>`).join("");
    $("#emergNotes").innerHTML = e.notes.map(n => `<div class="phrase-row"><div><div style="font-weight:600;">${esc(n.label)}${n.verify ? ' <span style="font-size:0.7rem;color:var(--ink-soft);font-style:italic;">(verify)</span>' : ""}</div><div style="font-size:0.82rem;color:var(--ink-soft);">${esc(n.detail)}</div></div><div style="align-self:center;text-align:right;"><a class="s-btn" style="min-width:auto;padding:0.4rem 0.8rem;" href="tel:${esc(n.tel)}"><span class="ic">${icon("phone")}</span> Call</a></div></div>`).join("");
    $("#emergTip").textContent = e.tip;
  }

  /* ─────────── SHEET ─────────── */
  const sheet = $("#sheet"), scrim = $("#sheetScrim");
  function openSheet(html) { $("#sheetBody").innerHTML = html; sheet.classList.add("open"); scrim.classList.add("open"); wireSheetButtons(); }
  function closeSheet() { sheet.classList.remove("open"); scrim.classList.remove("open"); }
  scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
  function actionsHTML(name, lat, lng, phone) {
    let b = `<a class="s-btn primary" target="_blank" rel="noopener" href="${gmapsDir(lat, lng)}"><span class="ic">${icon("directions")}</span> Directions</a>`;
    b += `<a class="s-btn" target="_blank" rel="noopener" href="${gmapsSearch(name, lat, lng)}"><span class="ic">${icon("search")}</span> Google Maps</a>`;
    b += `<button class="s-btn" data-showmap="${lat},${lng}"><span class="ic">${icon("showmap")}</span> Our map</button>`;
    if (phone) b += `<a class="s-btn" href="tel:${esc(phone)}"><span class="ic">${icon("phone")}</span> Call</a>`;
    return `<div class="sheet-actions">${b}</div>`;
  }
  function openPlaceSheet(p) {
    openSheet(`<div class="s-cat"><span class="ic">${icon(catIcon[p.cat] || "places")}</span> ${esc(p.catLabel)}</div><h3>${esc(p.name)}</h3>
      <p class="s-desc">${esc(p.desc)}</p>${actionsHTML(p.name, p.lat, p.lng, null)}
      ${p.approx ? `<p class="s-approx">Pin is approximate — verify the exact spot before relying on it.</p>` : ""}`);
  }
  function openStaySheet(s) {
    openSheet(`<div class="s-cat"><span class="ic">${icon("stay")}</span> ${esc(s.loc)}</div><h3>${esc(s.name)}</h3>
      <p class="s-meta"><span class="ic">${icon("calendar")}</span> <strong>${esc(s.dates)}</strong></p>
      <p class="s-meta">Confirmation: <strong>${esc(s.confirm)}</strong> <button class="s-btn" style="flex:0;min-width:auto;padding:0.2rem 0.6rem;font-size:0.72rem;margin-left:0.4rem;" data-copy="${esc(s.confirm)}"><span class="ic">${icon("copy")}</span> Copy</button></p>
      ${actionsHTML(s.name, s.lat, s.lng, s.phone)}
      ${s.approx ? `<p class="s-approx">Map pin is approximate — verify exact location.</p>` : ""}`);
  }
  function wireSheetButtons() {
    $$("#sheetBody [data-copy]").forEach(b => b.addEventListener("click", () => { navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.innerHTML = `<span class="ic">${icon("check")}</span> Copied`; b.classList.add("copied"); }); }));
    $$("#sheetBody [data-showmap]").forEach(b => b.addEventListener("click", () => { const [lat, lng] = b.dataset.showmap.split(",").map(Number); closeSheet(); switchView("mapView"); setTimeout(() => { ensureMap(); map.setView([lat, lng], 15); flashAt(lat, lng); }, 300); }));
  }

  /* ─────────── MAP ─────────── */
  let map = null, mapInited = false, markerLayer = null, userMarker = null, allMarkers = [];
  const tileUrl = () => theme() === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  function makeIcon(color, cat, visited) {
    return L.divIcon({ className: "", html: `<div class="pin ${color} ${visited ? "visited" : ""}"><span class="ic">${icon(catIcon[cat] || "places")}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
  }
  function ensureMap() {
    if (mapInited) { map.invalidateSize(); return; }
    mapInited = true;
    map = L.map("map", { zoomControl: true, attributionControl: true });
    tileLayer = L.tileLayer(tileUrl(), { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 }).addTo(map);
    tileLayer.on("load", () => { const sk = $("#mapSkeleton"); if (sk) sk.style.display = "none"; });
    setTimeout(() => { const sk = $("#mapSkeleton"); if (sk) sk.style.display = "none"; }, 4000);
    markerLayer = L.layerGroup().addTo(map);
    L.polyline(TRIP.cities.map(c => [c.lat, c.lng]), { color: "#8a7d63", weight: 2, opacity: 0.55, dashArray: "6 8" }).addTo(map);
    const visited = getVisited();
    TRIP.stays.forEach(s => addMarker(s.name, s.lat, s.lng, "stay", colorOf(s.city), false, `<strong>${esc(s.name)}</strong><br>${esc(s.loc)}`, () => openStaySheet(s)));
    TRIP.places.forEach(p => addMarker(p.name, p.lat, p.lng, p.cat, colorOf(p.city), visited.has(p.name), `<strong>${esc(p.name)}</strong><br>${esc(p.catLabel)}`, () => openPlaceSheet(p)));
    map.fitBounds(L.latLngBounds(allMarkers.map(m => m.marker.getLatLng())), { padding: [30, 30] });
  }
  function addMarker(name, lat, lng, cat, color, visited, popup, onClick) {
    const m = L.marker([lat, lng], { icon: makeIcon(color, cat, visited) });
    m.bindPopup(popup); m.on("click", () => setTimeout(onClick, 60)); m.addTo(markerLayer);
    allMarkers.push({ marker: m, cat });
  }
  function applyFilter(cat) {
    allMarkers.forEach(({ marker, cat: c }) => { if (cat === "all" || c === cat) marker.addTo(markerLayer); else markerLayer.removeLayer(marker); });
    $$("#mapFilters .filter-chip").forEach(ch => ch.classList.toggle("active", ch.dataset.cat === cat));
  }
  function flashAt(lat, lng) {
    const c = L.circleMarker([lat, lng], { radius: 18, color: "#D4655F", weight: 3, fill: false }).addTo(map);
    let r = 18; const iv = setInterval(() => { r += 4; c.setRadius(r); c.setStyle({ opacity: Math.max(0, 1 - (r - 18) / 40) }); if (r > 58) { clearInterval(iv); map.removeLayer(c); } }, 40);
  }
  function renderMapFilters() {
    const cats = [["all", "All", "sparkle"], ["sights", "Sights", "sights"], ["food", "Food", "food"], ["coffee", "Coffee", "coffee"], ["shopping", "Shopping", "shopping"], ["nightlife", "Nightlife", "nightlife"], ["stay", "Stays", "stay"]];
    $("#mapFilters").innerHTML = cats.map(([c, label, ic]) => `<div class="filter-chip ${c === "all" ? "active" : ""}" data-cat="${c}" tabindex="0" role="button"><span class="ic">${icon(ic)}</span>${esc(label)}</div>`).join("");
    $$("#mapFilters .filter-chip").forEach(ch => ch.addEventListener("click", () => applyFilter(ch.dataset.cat)));
  }
  function locateMe() {
    if (!navigator.geolocation) { toast("Location isn't available on this device."); return; }
    toast("Finding you…");
    navigator.geolocation.getCurrentPosition(pos => {
      hideToast(); const { latitude, longitude } = pos.coords;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([latitude, longitude], { radius: 8, color: "#fff", weight: 2, fillColor: "#D4655F", fillOpacity: 1 }).addTo(map);
      map.setView([latitude, longitude], 14);
    }, () => toast("Couldn't get your location — check permissions."), { enableHighAccuracy: true, timeout: 8000 });
  }

  /* ─────────── ANIMATION STORYBOARD ───────────
     0ms   view becomes active (whole view fades via CSS)
    60ms   first [data-reveal] block rises + fades in
   +90ms   each following block staggers in
     pin   drops on map render (CSS .pin keyframe)
     tick  pops on "been there" toggle (CSS .pop)
  ───────────────────────────────────────────── */
  const REVEAL_START = 60, REVEAL_STAGGER = 90;
  function revealView(view) {
    const items = $$("[data-reveal]", view);
    items.forEach(el => el.classList.remove("in"));
    requestAnimationFrame(() => items.forEach((el, i) => setTimeout(() => el.classList.add("in"), REVEAL_START + i * REVEAL_STAGGER)));
  }

  /* ─────────── ROUTER ─────────── */
  function switchView(id) {
    const view = $("#" + id);
    const go = () => {
      $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
      $$(".tab").forEach(t => { const on = t.dataset.view === id; t.classList.toggle("active", on); t.setAttribute("aria-selected", on ? "true" : "false"); });
      window.scrollTo({ top: 0 });
      updateCoverMode();
      revealView(view);
      if (id === "mapView") setTimeout(ensureMap, 80);
      if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    };
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go); else go();
  }
  function updateCoverMode() {
    const onOverview = $("#overviewView").classList.contains("active");
    const high = window.scrollY < window.innerHeight * 0.7;
    document.body.classList.toggle("cover-mode", onOverview && high);
  }

  /* ─────────── SERVICE WORKER ─────────── */
  function initSW() {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (refreshing) return; refreshing = true; location.reload(); });
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) toast("New version available", "Update", () => nw.postMessage({ type: "SKIP_WAITING" }), true); });
      });
    }).catch(() => {});
  }

  /* ─────────── INIT ─────────── */
  function init() {
    initTheme();
    paintChromeIcons();
    renderHero();
    renderOverview();
    renderDays();
    renderPlaces();
    renderPacking();
    renderMapFilters();
    renderCurrency();
    renderPhrases();
    renderEmergency();
    $("#locateBtn").addEventListener("click", locateMe);
    $$(".tab").forEach(t => t.addEventListener("click", () => switchView(t.dataset.view)));
    window.addEventListener("scroll", updateCoverMode, { passive: true });
    loadCover();

    const startView = (location.hash || "").replace("#", "");
    if (startView && $("#" + startView)) switchView(startView);
    else { updateCoverMode(); revealView($("#overviewView")); }

    const n = currentDayNumber();
    setTimeout(() => { if (n) scrollToDay(n); updateActiveChip(); }, 300);
    initSW();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
