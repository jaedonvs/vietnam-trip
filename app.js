/* ─────────────────────────────────────────────────────────────
   Vietnam trip — app shell, renderers, map, sheet, guide, PWA.
   Renders entirely from TRIP (data.js).
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cityById = id => TRIP.cities.find(c => c.id === id) || {};
  const colorOf  = id => (cityById(id).color || "ink");
  const cityImg  = id => `img/${id}.jpg`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
  function currentTheme() { return document.documentElement.getAttribute("data-theme") || "light"; }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("#themeToggle").textContent = t === "dark" ? "☀️" : "🌙";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#1E1A14" : "#F2EEDF");
    if (tileLayer) tileLayer.setUrl(tileUrl());
  }
  function initTheme() {
    const saved = localStorage.getItem("vn-theme");
    const sysDark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (sysDark ? "dark" : "light"));
    $("#themeToggle").addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      localStorage.setItem("vn-theme", next);
      applyTheme(next);
    });
  }

  /* ─────────── IMAGES (progressive, optional) ─────────── */
  function preload(src) {
    return new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });
  }
  async function loadCover() {
    const ok = await preload("img/hero.jpg");
    if (!ok) return;
    $("#coverBg").style.backgroundImage = "url(img/hero.jpg)";
    $("#coverBg").classList.add("loaded");
    $("#coverGrad").style.display = "block";
    $("#cover").classList.add("has-photo");
  }
  async function loadDayHeroes() {
    const loaded = {};
    await Promise.all(TRIP.cities.map(async c => { loaded[c.id] = await preload(cityImg(c.id)); }));
    TRIP.days.forEach(d => {
      if (!loaded[d.city]) return;
      const card = $("#day-" + d.n); if (!card) return;
      const hero = document.createElement("div");
      hero.className = "day-hero";
      hero.style.backgroundImage = `url(${cityImg(d.city)})`;
      hero.innerHTML = `<span class="day-hero-city">${esc(cityById(d.city).emoji)} ${esc(cityById(d.city).name)}</span>`;
      card.insertBefore(hero, card.firstChild);
    });
  }

  /* ─────────── OVERVIEW ─────────── */
  function renderOverview() {
    $("#routeDots").innerHTML = TRIP.cities.map((c, i) =>
      `<span class="dot ${c.color}">${c.emoji} ${esc(c.name)}</span>` +
      (i < TRIP.cities.length - 1 ? `<span class="dot-arrow">→</span>` : "")
    ).join("");

    $("#statsGrid").innerHTML = TRIP.stats.map(s =>
      `<div class="stat-card"><div class="num ${s.color}">${esc(s.num)}</div><div class="label">${esc(s.label)}</div></div>`
    ).join("");

    const f = TRIP.flights;
    const leg = l => `<div class="flight-leg"><h4>${esc(l.label)}</h4><div class="airline">${esc(l.airline)}</div><div class="route">${esc(l.route)}</div><div class="time">${esc(l.time)}</div></div>`;
    $("#flightsWrap").innerHTML =
      `<div class="card"><h3 style="font-size:1.35rem;">✈️ Flights</h3>
        <div class="label-group"><span class="pink">${esc(f.airline)}</span><span class="blush">Ref: ${esc(f.ref)}</span></div>
        <div class="flight-details">${leg(f.outbound)}${leg(f.inbound)}</div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin-top:0.75rem;">${esc(f.note)}</p></div>`;

    $("#routeTimeline").innerHTML = TRIP.cities.map((c, i) =>
      `<div class="route-stop"><div class="rdot ${c.color}"></div><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.nights)}</div>${i < TRIP.cities.length - 1 ? '<div class="connector"></div>' : ""}</div>`
    ).join("");

    $("#staysList").innerHTML = TRIP.stays.map((s, i) =>
      `<div class="booking-card" data-stay="${i}" tabindex="0" role="button">
        <div>
          <div class="booking-name">${esc(s.name)}</div>
          <div class="booking-loc">📍 ${esc(s.loc)}</div>
          <div class="booking-dates">📅 ${esc(s.dates)}</div>
          <div class="booking-confirm">Confirmation: <strong>${esc(s.confirm)}</strong></div>
        </div>
        <div class="booking-status">✅ BOOKED</div>
      </div>`
    ).join("");
    $$("#staysList .booking-card").forEach(el => {
      const open = () => openStaySheet(TRIP.stays[+el.dataset.stay]);
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });

    const rows = TRIP.stays.map(s =>
      `<tr><td>📍 ${esc(s.loc)}</td><td>${esc(s.nights)}</td><td>${esc(s.name)} ✅</td><td>${esc(s.est)}</td></tr>`
    ).join("");
    $("#budgetWrap").innerHTML =
      `<div class="card" style="margin-top:1.25rem;">
        <h3 style="font-size:1.3rem;margin-bottom:0.6rem;">💰 Accommodation Cost Summary</h3>
        <p style="font-size:0.84rem;color:var(--ink-soft);margin-bottom:0.6rem;">${esc(TRIP.budgetNote)}</p>
        <div class="table-wrap"><table class="compare-table">
          <thead><tr><th>Location</th><th>Nights</th><th>Booked</th><th>Est. Total</th></tr></thead>
          <tbody>${rows}<tr class="total"><td><strong>Total</strong></td><td>11</td><td></td><td><strong>${esc(TRIP.budgetTotal)}</strong></td></tr></tbody>
        </table></div></div>`;
  }

  /* ─────────── WEATHER ─────────── */
  const WMO = c => {
    if (c === 0) return ["☀️", "Clear"];
    if (c <= 2) return ["🌤️", "Sunny"];
    if (c === 3) return ["☁️", "Cloudy"];
    if (c <= 48) return ["🌫️", "Fog"];
    if (c <= 57) return ["🌦️", "Drizzle"];
    if (c <= 67) return ["🌧️", "Rain"];
    if (c <= 77) return ["🌨️", "Snow"];
    if (c <= 82) return ["🌧️", "Showers"];
    if (c <= 86) return ["🌨️", "Snow"];
    return ["⛈️", "Storm"];
  };
  async function renderWeather() {
    const strip = $("#weatherStrip");
    strip.innerHTML = TRIP.cities.map(c =>
      `<div class="wx-card skeleton"><div class="wx-city">${esc(c.name)}</div><div class="wx-ico">·</div><div class="wx-temp">··</div></div>`
    ).join("");
    try {
      const lats = TRIP.cities.map(c => c.lat).join(",");
      const lngs = TRIP.cities.map(c => c.lng).join(",");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code&timezone=Asia%2FBangkok`;
      const res = await fetch(url);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      strip.innerHTML = TRIP.cities.map((c, i) => {
        const cur = (arr[i] && arr[i].current) || {};
        const [ico, label] = WMO(cur.weather_code ?? -1);
        const t = cur.temperature_2m != null ? Math.round(cur.temperature_2m) + "°" : "—";
        return `<div class="wx-card"><div class="wx-city">${esc(c.name)}</div><div class="wx-ico" title="${esc(label)}">${ico}</div><div class="wx-temp">${t}</div></div>`;
      }).join("");
    } catch (_) {
      strip.innerHTML = TRIP.cities.map(c =>
        `<div class="wx-card"><div class="wx-city">${esc(c.name)}</div><div class="wx-ico">📡</div><div class="wx-temp" style="font-size:0.8rem;">offline</div></div>`
      ).join("");
    }
  }

  /* ─────────── DAYS ─────────── */
  function dayCardHTML(d, isToday) {
    const tags = d.tags.map(([t, c]) => `<span class="day-tag ${c}">${esc(t)}</span>`).join("");
    const cols = d.cols.map(col =>
      `<div class="day-col"><h4>${esc(col.h)}</h4><ul>${col.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`
    ).join("");
    const footBits = [];
    if (d.stay) footBits.push(`<span class="stay-link" data-staylink="${esc(d.stay)}" tabindex="0" role="button">🛏️ ${esc(d.stay)}</span>`);
    d.foot.forEach(x => footBits.push(`<span>${esc(x)}</span>`));
    const foot = footBits.length ? `<div class="day-foot">${footBits.join("")}</div>` : "";
    const badge = isToday ? `<span class="today-badge">Today</span> ` : "";
    return `<div class="day-card ${isToday ? "is-today" : ""}" id="day-${d.n}">
      <div class="day-pad">
        <div class="day-head"><h3>Day ${d.n} · ${esc(d.title)}</h3><span class="day-date">${badge}${esc(d.date)}</span></div>
        <div class="day-tags">${tags}</div>
        <div class="day-body">${cols}</div>${foot}
      </div></div>`;
  }

  function renderDays() {
    const todayN = currentDayNumber();
    $("#dayDeck").innerHTML = TRIP.days.map(d => dayCardHTML(d, d.n === todayN)).join("");
    $("#dateStrip").innerHTML = TRIP.days.map(d => {
      const parts = d.date.split(" ");
      const dnum = parts[1], mon = parts[2];
      return `<div class="date-chip ${d.n === todayN ? "today-chip" : ""}" data-day="${d.n}" tabindex="0" role="button">
        <span class="d-day">D${d.n}</span><span class="d-date">${esc(dnum)} ${esc(mon)}</span></div>`;
    }).join("");

    $$("#dayDeck .stay-link").forEach(el => {
      const open = () => { const s = TRIP.stays.find(x => x.name === el.dataset.staylink); if (s) openStaySheet(s); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    $$("#dateStrip .date-chip").forEach(chip => chip.addEventListener("click", () => scrollToDay(+chip.dataset.day)));

    const deck = $("#dayDeck");
    let raf;
    deck.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateActiveChip); });
  }

  function updateActiveChip() {
    const deck = $("#dayDeck");
    const center = deck.scrollLeft + deck.clientWidth / 2;
    let best = 1, bestDist = Infinity;
    TRIP.days.forEach(d => {
      const el = $("#day-" + d.n); if (!el) return;
      const c = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(c - center);
      if (dist < bestDist) { bestDist = dist; best = d.n; }
    });
    $$("#dateStrip .date-chip").forEach(chip => chip.classList.toggle("active", +chip.dataset.day === best));
  }
  function scrollToDay(n) {
    const el = $("#day-" + n); if (!el) return;
    const deck = $("#dayDeck");
    deck.scrollTo({ left: el.offsetLeft - (deck.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }
  function currentDayNumber() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const m = TRIP.days.find(d => new Date(d.iso + "T00:00:00").getTime() === today.getTime());
    return m ? m.n : null;
  }
  function tripStatus() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(TRIP.meta.start + "T00:00:00");
    const end = new Date(TRIP.meta.end + "T00:00:00");
    if (today < start) {
      const days = Math.round((start - today) / 86400000);
      return `<div class="trip-status"><span class="big">${days}</span><span>day${days === 1 ? "" : "s"} to go ✈️</span></div>`;
    }
    if (today > end) return `<div class="trip-status"><span>Welcome home 🇿🇦 — what a trip</span></div>`;
    const n = currentDayNumber();
    return `<div class="trip-status"><span>📍 You're here — Day ${n || "·"} of 11</span></div>`;
  }

  /* ─────────── PLACES ─────────── */
  function renderPlaces() {
    const groups = [];
    TRIP.places.filter(p => p.wishlist !== false).forEach(p => {
      let g = groups.find(x => x.name === p.group);
      if (!g) { g = { name: p.group, items: [] }; groups.push(g); }
      g.items.push(p);
    });
    $("#placesWrap").innerHTML = groups.map(g =>
      `<div class="places-subhead">${esc(g.name)}</div>
       <div class="places-grid">${g.items.map(p => {
         const col = colorOf(p.city);
         return `<div class="place-card" data-place="${esc(p.name)}" tabindex="0" role="button">
           <div class="place-cat">${esc(p.catLabel)}</div>
           <h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>
           <span class="place-city ${col}">${esc(cityById(p.city).name)}</span></div>`;
       }).join("")}</div>`
    ).join("");
    $$("#placesWrap .place-card").forEach(el => {
      const open = () => { const p = TRIP.places.find(x => x.name === el.dataset.place); if (p) openPlaceSheet(p); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  /* ─────────── PACKING ─────────── */
  function renderPacking() {
    $("#packingList").innerHTML = TRIP.packing.map((it, i) =>
      `<label class="packing-item"><input type="checkbox" data-pack="${i}"> ${esc(it.label)}</label>`
    ).join("");
    $$("#packingList input").forEach((cb, i) => {
      const saved = localStorage.getItem("vietnam-packing-" + i);
      cb.checked = saved !== null ? saved === "true" : !!TRIP.packing[i].checked;
      cb.addEventListener("change", () => { localStorage.setItem("vietnam-packing-" + i, cb.checked); updatePackProgress(); });
    });
    updatePackProgress();
  }
  function updatePackProgress() {
    const boxes = $$("#packingList input");
    const done = boxes.filter(b => b.checked).length;
    $("#packProgress").textContent = `${done} of ${boxes.length} packed`;
    $("#packBar").style.width = (boxes.length ? (done / boxes.length * 100) : 0) + "%";
  }

  /* ─────────── GUIDE: currency / phrases / emergency ─────────── */
  function renderCurrency() {
    const cur = TRIP.currency;
    let rate = cur.fallbackRate, live = false;
    const cached = localStorage.getItem("vn-rate");
    if (cached) { try { const o = JSON.parse(cached); if (o.rate) { rate = o.rate; live = true; } } catch (_) {} }

    const zar = $("#zarInput"), vnd = $("#vndInput"), note = $("#rateNote"), cg = $("#cheatGrid");
    const fmt = n => Math.round(n).toLocaleString("en-US");
    function fromZar() { vnd.value = Math.round((parseFloat(zar.value) || 0) * rate); }
    function fromVnd() { zar.value = ((parseFloat(vnd.value) || 0) / rate).toFixed(2); }
    function cheats() {
      cg.innerHTML = cur.cheats.map(v => `<div class="cheat"><div class="vnd">${fmt(v)} ₫</div><div class="zar">≈ R${(v / rate).toFixed(2)}</div></div>`).join("");
    }
    function noteText() { note.textContent = live ? `Live rate · R1 ≈ ${fmt(rate)} ₫` : `Offline · approx R1 ≈ ${fmt(rate)} ₫`; }
    zar.addEventListener("input", () => { fromZar(); cheats(); });
    vnd.addEventListener("input", fromVnd);
    fromZar(); cheats(); noteText();

    // refresh live rate
    fetch("https://open.er-api.com/v6/latest/ZAR").then(r => r.json()).then(d => {
      const v = d && d.rates && d.rates.VND;
      if (v) { rate = v; live = true; localStorage.setItem("vn-rate", JSON.stringify({ rate: v, t: Date.now() })); fromZar(); cheats(); noteText(); }
    }).catch(() => {});
  }
  function renderPhrases() {
    $("#phrasesWrap").innerHTML = TRIP.phrases.map(g =>
      `<div class="places-subhead" style="font-size:1.1rem;margin:1rem 0 0.4rem;">${esc(g.g)}</div>` +
      g.items.map(([en, vi, ph]) =>
        `<div class="phrase-row"><div class="phrase-en">${esc(en)}</div><div><div class="phrase-vi">${esc(vi)}</div><div class="phrase-ph">${esc(ph)}</div></div></div>`
      ).join("")
    ).join("");
  }
  function renderEmergency() {
    const e = TRIP.emergency;
    $("#emergGrid").innerHTML = e.numbers.map(n =>
      `<a class="emerg-num" href="tel:${esc(n.num)}"><span class="e-ico">${n.icon}</span><span class="e-num">${esc(n.num)}</span><span class="e-lbl">${esc(n.label)}</span></a>`
    ).join("");
    $("#emergNotes").innerHTML = e.notes.map(n =>
      `<div class="phrase-row"><div><div style="font-weight:500;">${esc(n.label)}${n.verify ? ' <span style="font-size:0.7rem;color:var(--ink-soft);font-style:italic;">(verify)</span>' : ''}</div><div style="font-size:0.82rem;color:var(--ink-soft);">${esc(n.detail)}</div></div><div style="align-self:center;text-align:right;"><a class="s-btn" style="min-width:auto;padding:0.4rem 0.8rem;" href="tel:${esc(n.tel)}">📞 Call</a></div></div>`
    ).join("");
    $("#emergTip").textContent = e.tip;
  }

  /* ─────────── DETAIL SHEET ─────────── */
  const sheet = $("#sheet"), scrim = $("#sheetScrim");
  function openSheet(html) { $("#sheetBody").innerHTML = html; sheet.classList.add("open"); scrim.classList.add("open"); wireSheetButtons(); }
  function closeSheet() { sheet.classList.remove("open"); scrim.classList.remove("open"); }
  scrim.addEventListener("click", closeSheet);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

  function actionsHTML(name, lat, lng, phone) {
    let b = `<a class="s-btn primary" target="_blank" rel="noopener" href="${gmapsDir(lat, lng)}">🧭 Directions</a>`;
    b += `<a class="s-btn" target="_blank" rel="noopener" href="${gmapsSearch(name, lat, lng)}">🔍 View on Google Maps</a>`;
    b += `<button class="s-btn" data-showmap="${lat},${lng}">🗺️ Show on our map</button>`;
    if (phone) b += `<a class="s-btn" href="tel:${esc(phone)}">📞 Call</a>`;
    return `<div class="sheet-actions">${b}</div>`;
  }
  function openPlaceSheet(p) {
    openSheet(`<div class="s-cat">${esc(p.catLabel)}</div><h3>${esc(p.name)}</h3>
      <p class="s-desc">${esc(p.desc)}</p>${actionsHTML(p.name, p.lat, p.lng, null)}
      ${p.approx ? `<p class="s-approx">📌 Pin is approximate — verify the exact spot before relying on it.</p>` : ""}`);
  }
  function openStaySheet(s) {
    openSheet(`<div class="s-cat">${esc(s.loc)}</div><h3>${esc(s.name)}</h3>
      <p class="s-meta">📅 <strong>${esc(s.dates)}</strong></p>
      <p class="s-meta">Confirmation: <strong>${esc(s.confirm)}</strong> <button class="s-btn" style="flex:0;min-width:auto;padding:0.2rem 0.6rem;font-size:0.72rem;margin-left:0.4rem;" data-copy="${esc(s.confirm)}">Copy</button></p>
      ${actionsHTML(s.name, s.lat, s.lng, s.phone)}
      ${s.approx ? `<p class="s-approx">📌 Map pin is approximate — verify exact location.</p>` : ""}`);
  }
  function wireSheetButtons() {
    $$("#sheetBody [data-copy]").forEach(b => b.addEventListener("click", () => {
      navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = "Copied ✓"; b.classList.add("copied"); });
    }));
    $$("#sheetBody [data-showmap]").forEach(b => b.addEventListener("click", () => {
      const [lat, lng] = b.dataset.showmap.split(",").map(Number);
      closeSheet(); switchView("mapView");
      setTimeout(() => { ensureMap(); map.setView([lat, lng], 15); flashAt(lat, lng); }, 280);
    }));
  }

  /* ─────────── MAP ─────────── */
  let map = null, mapInited = false, markerLayer = null, userMarker = null;
  let allMarkers = [];
  function tileUrl() {
    return currentTheme() === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  }
  const catEmoji = { coffee: "☕", food: "🍜", shopping: "🛍️", sights: "📷", nightlife: "🍺", stay: "🛏️" };
  function makeIcon(color, emoji) {
    return L.divIcon({ className: "", html: `<div class="pin ${color}"><span>${emoji}</span></div>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
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

    TRIP.stays.forEach(s => addMarker(s.name, s.lat, s.lng, "stay", colorOf(s.city), `<strong>🛏️ ${esc(s.name)}</strong><br>${esc(s.loc)}`, () => openStaySheet(s)));
    TRIP.places.forEach(p => addMarker(p.name, p.lat, p.lng, p.cat, colorOf(p.city), `<strong>${esc(p.name)}</strong><br>${esc(p.catLabel)}`, () => openPlaceSheet(p)));

    map.fitBounds(L.latLngBounds(allMarkers.map(m => m.marker.getLatLng())), { padding: [30, 30] });
  }
  function addMarker(name, lat, lng, cat, color, popup, onClick) {
    const m = L.marker([lat, lng], { icon: makeIcon(color, catEmoji[cat] || "📍") });
    m.bindPopup(popup);
    m.on("click", () => setTimeout(onClick, 60));
    m.addTo(markerLayer);
    allMarkers.push({ marker: m, cat });
  }
  function applyFilter(cat) {
    allMarkers.forEach(({ marker, cat: c }) => {
      if (cat === "all" || c === cat) marker.addTo(markerLayer); else markerLayer.removeLayer(marker);
    });
    $$("#mapFilters .filter-chip").forEach(ch => ch.classList.toggle("active", ch.dataset.cat === cat));
  }
  function flashAt(lat, lng) {
    const c = L.circleMarker([lat, lng], { radius: 18, color: "#D4655F", weight: 3, fill: false }).addTo(map);
    let r = 18; const iv = setInterval(() => { r += 4; c.setRadius(r); c.setStyle({ opacity: Math.max(0, 1 - (r - 18) / 40) }); if (r > 58) { clearInterval(iv); map.removeLayer(c); } }, 40);
  }
  function renderMapFilters() {
    const cats = [["all", "All", "ink"], ["sights", "Sights", "lilac"], ["food", "Food", "blush"], ["coffee", "Coffee", "sage"], ["shopping", "Shopping", "lemon"], ["nightlife", "Nightlife", "pink"], ["stay", "Stays", "ink"]];
    $("#mapFilters").innerHTML = cats.map(([c, label, col]) =>
      `<div class="filter-chip ${c === "all" ? "active" : ""}" data-cat="${c}" tabindex="0" role="button"><span class="swatch" style="background:var(--${col})"></span>${esc(label)}</div>`
    ).join("");
    $$("#mapFilters .filter-chip").forEach(ch => ch.addEventListener("click", () => applyFilter(ch.dataset.cat)));
  }
  function locateMe() {
    if (!navigator.geolocation) { toast("Location isn't available on this device."); return; }
    toast("Finding you…");
    navigator.geolocation.getCurrentPosition(pos => {
      hideToast();
      const { latitude, longitude } = pos.coords;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([latitude, longitude], { radius: 8, color: "#fff", weight: 2, fillColor: "#D4655F", fillOpacity: 1 }).addTo(map);
      map.setView([latitude, longitude], 14);
    }, () => toast("Couldn't get your location — check permissions."), { enableHighAccuracy: true, timeout: 8000 });
  }

  /* ─────────── ROUTER / TABS ─────────── */
  function switchView(id) {
    const go = () => {
      $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
      $$(".tab").forEach(t => { const on = t.dataset.view === id; t.classList.toggle("active", on); t.setAttribute("aria-selected", on ? "true" : "false"); });
      if (id === "mapView") setTimeout(ensureMap, 60);
      window.scrollTo({ top: 0 });
      if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    };
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go);
    else go();
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => switchView(t.dataset.view)));

  /* ─────────── SERVICE WORKER + UPDATE FLOW ─────────── */
  function initSW() {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (refreshing) return; refreshing = true; location.reload(); });
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            toast("New version available", "Update", () => nw.postMessage({ type: "SKIP_WAITING" }), true);
          }
        });
      });
    }).catch(() => {});
  }

  /* ─────────── INIT ─────────── */
  function init() {
    initTheme();
    renderOverview();
    $("#tripStatusWrap").innerHTML = tripStatus();
    renderWeather();
    renderDays();
    renderPlaces();
    renderPacking();
    renderMapFilters();
    renderCurrency();
    renderPhrases();
    renderEmergency();
    $("#locateBtn").addEventListener("click", locateMe);

    loadCover();
    loadDayHeroes();

    const startView = (location.hash || "").replace("#", "");
    if (startView && $("#" + startView)) switchView(startView);

    const n = currentDayNumber();
    setTimeout(() => { if (n) scrollToDay(n); updateActiveChip(); }, 250);

    initSW();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
