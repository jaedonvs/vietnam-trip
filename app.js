/* ─────────────────────────────────────────────────────────────
   Vietnam trip — app shell, renderers, map, detail sheet.
   Renders entirely from TRIP (data.js).
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cityById = id => TRIP.cities.find(c => c.id === id) || {};
  const colorOf  = id => (cityById(id).color || "ink");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const gmapsDir    = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const gmapsSearch = (name, lat, lng) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}%20${lat},${lng}`;

  /* ─────────── RENDER: OVERVIEW ─────────── */
  function renderOverview() {
    // route dots
    $("#routeDots").innerHTML = TRIP.cities.map((c, i) =>
      `<span class="dot ${c.color}">${c.emoji} ${esc(c.name)}</span>` +
      (i < TRIP.cities.length - 1 ? `<span class="dot-arrow">→</span>` : "")
    ).join("");

    // stats
    $("#statsGrid").innerHTML = TRIP.stats.map(s =>
      `<div class="stat-card"><div class="num ${s.color}">${esc(s.num)}</div><div class="label">${esc(s.label)}</div></div>`
    ).join("");

    // flights
    const f = TRIP.flights;
    const leg = l => `<div class="flight-leg"><h4>${esc(l.label)}</h4><div class="airline">${esc(l.airline)}</div><div class="route">${esc(l.route)}</div><div class="time">${esc(l.time)}</div></div>`;
    $("#flightsWrap").innerHTML =
      `<div class="card"><h3 style="font-size:1.35rem;">✈️ Flights</h3>
        <div class="label-group"><span class="pink">${esc(f.airline)}</span><span class="blush">Ref: ${esc(f.ref)}</span></div>
        <div class="flight-details">${leg(f.outbound)}${leg(f.inbound)}</div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin-top:0.75rem;">${esc(f.note)}</p></div>`;

    // route timeline
    $("#routeTimeline").innerHTML = TRIP.cities.map((c, i) =>
      `<div class="route-stop"><div class="rdot ${c.color}"></div><div class="name">${esc(c.name)}</div><div class="sub">${esc(c.nights)}</div>${i < TRIP.cities.length - 1 ? '<div class="connector"></div>' : ""}</div>`
    ).join("");

    // stays
    $("#staysList").innerHTML = TRIP.stays.map((s, i) =>
      `<div class="booking-card" data-stay="${i}">
        <div>
          <div class="booking-name">${esc(s.name)}</div>
          <div class="booking-loc">📍 ${esc(s.loc)}</div>
          <div class="booking-dates">📅 ${esc(s.dates)}</div>
          <div class="booking-confirm">Confirmation: <strong>${esc(s.confirm)}</strong></div>
        </div>
        <div class="booking-status">✅ BOOKED</div>
      </div>`
    ).join("");
    $$("#staysList .booking-card").forEach(el =>
      el.addEventListener("click", () => openStaySheet(TRIP.stays[+el.dataset.stay])));

    // budget
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

  /* ─────────── RENDER: DAYS ─────────── */
  function dayCardHTML(d, isToday) {
    const tags = d.tags.map(([t, c]) => `<span class="day-tag ${c}">${esc(t)}</span>`).join("");
    const cols = d.cols.map(col =>
      `<div class="day-col"><h4>${esc(col.h)}</h4><ul>${col.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`
    ).join("");
    let foot = "";
    const footBits = [];
    if (d.stay) footBits.push(`<span class="stay-link" data-staylink="${esc(d.stay)}">🛏️ ${esc(d.stay)}</span>`);
    d.foot.forEach(x => footBits.push(`<span>${esc(x)}</span>`));
    if (footBits.length) foot = `<div class="day-foot">${footBits.join("")}</div>`;
    const badge = isToday ? `<span class="today-badge">Today</span>` : "";
    return `<div class="day-card ${isToday ? "is-today" : ""}" id="day-${d.n}">
      <div class="day-head"><h3>Day ${d.n} · ${esc(d.title)}</h3><span class="day-date">${badge} ${esc(d.date)}</span></div>
      <div class="day-tags">${tags}</div>
      <div class="day-body">${cols}</div>${foot}</div>`;
  }

  function renderDays() {
    const todayN = currentDayNumber();
    $("#dayDeck").innerHTML = TRIP.days.map(d => dayCardHTML(d, d.n === todayN)).join("");
    $("#dateStrip").innerHTML = TRIP.days.map(d => {
      const [dow, dnum, mon] = d.date.split(" ");
      const isT = d.n === todayN;
      return `<div class="date-chip ${isT ? "today-chip" : ""}" data-day="${d.n}">
        <span class="d-day">D${d.n}</span><span class="d-date">${esc(dnum)} ${esc(mon)}</span></div>`;
    }).join("");

    // stay links inside day cards
    $$("#dayDeck .stay-link").forEach(el => el.addEventListener("click", () => {
      const stay = TRIP.stays.find(s => s.name === el.dataset.staylink);
      if (stay) openStaySheet(stay);
    }));

    // date chip -> scroll to day
    $$("#dateStrip .date-chip").forEach(chip => chip.addEventListener("click", () => scrollToDay(+chip.dataset.day)));

    // highlight active chip while swiping
    const deck = $("#dayDeck");
    let raf;
    deck.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActiveChip);
    });
  }

  function updateActiveChip() {
    const deck = $("#dayDeck");
    const center = deck.scrollLeft + deck.clientWidth / 2;
    let best = 1, bestDist = Infinity;
    TRIP.days.forEach(d => {
      const el = $("#day-" + d.n);
      if (!el) return;
      const c = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(c - center);
      if (dist < bestDist) { bestDist = dist; best = d.n; }
    });
    $$("#dateStrip .date-chip").forEach(chip =>
      chip.classList.toggle("active", +chip.dataset.day === best));
  }

  function scrollToDay(n) {
    const el = $("#day-" + n);
    if (!el) return;
    const deck = $("#dayDeck");
    deck.scrollTo({ left: el.offsetLeft - (deck.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }

  // which day is "today" — clamps before/after trip
  function currentDayNumber() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const match = TRIP.days.find(d => {
      const dd = new Date(d.iso + "T00:00:00");
      return dd.getTime() === today.getTime();
    });
    return match ? match.n : null;
  }

  function tripStatus() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(TRIP.meta.start + "T00:00:00");
    const end   = new Date(TRIP.meta.end + "T00:00:00");
    const dayMs = 86400000;
    if (today < start) {
      const days = Math.round((start - today) / dayMs);
      return `<div class="trip-status"><span class="big">${days}</span><span>day${days === 1 ? "" : "s"} to go ✈️</span></div>`;
    }
    if (today > end) return `<div class="trip-status"><span>Welcome home 🇿🇦 — what a trip</span></div>`;
    const n = currentDayNumber();
    return `<div class="trip-status"><span>📍 You're here — Day ${n || "·"} of 11</span></div>`;
  }

  /* ─────────── RENDER: PLACES ─────────── */
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
         return `<div class="place-card" data-place="${esc(p.name)}">
           <div class="place-cat">${esc(p.catLabel)}</div>
           <h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>
           <span class="place-city ${col}">${esc(cityById(p.city).name)}</span></div>`;
       }).join("")}</div>`
    ).join("");
    $$("#placesWrap .place-card").forEach(el => el.addEventListener("click", () => {
      const p = TRIP.places.find(x => x.name === el.dataset.place);
      if (p) openPlaceSheet(p);
    }));
  }

  /* ─────────── RENDER: PACKING ─────────── */
  function renderPacking() {
    const list = $("#packingList");
    list.innerHTML = TRIP.packing.map((it, i) =>
      `<label class="packing-item"><input type="checkbox" data-pack="${i}"> ${esc(it.label)}</label>`
    ).join("");
    $$("#packingList input").forEach((cb, i) => {
      const saved = localStorage.getItem("vietnam-packing-" + i);
      cb.checked = saved !== null ? saved === "true" : !!TRIP.packing[i].checked;
      cb.addEventListener("change", () => {
        localStorage.setItem("vietnam-packing-" + i, cb.checked);
        updatePackProgress();
      });
    });
    updatePackProgress();
  }
  function updatePackProgress() {
    const boxes = $$("#packingList input");
    const done = boxes.filter(b => b.checked).length;
    $("#packProgress").textContent = `${done} of ${boxes.length} packed`;
  }

  /* ─────────── DETAIL SHEET ─────────── */
  const sheet = $("#sheet"), scrim = $("#sheetScrim");
  function openSheet(html) { $("#sheetBody").innerHTML = html; sheet.classList.add("open"); scrim.classList.add("open"); wireSheetButtons(); }
  function closeSheet() { sheet.classList.remove("open"); scrim.classList.remove("open"); }
  scrim.addEventListener("click", closeSheet);

  function actionsHTML(name, lat, lng, phone) {
    let btns = `<a class="s-btn primary" target="_blank" rel="noopener" href="${gmapsDir(lat, lng)}">🧭 Directions</a>`;
    btns += `<a class="s-btn" target="_blank" rel="noopener" href="${gmapsSearch(name, lat, lng)}">🔍 View on Google Maps</a>`;
    btns += `<button class="s-btn" data-showmap="${lat},${lng}">🗺️ Show on our map</button>`;
    if (phone) btns += `<a class="s-btn" href="tel:${esc(phone)}">📞 Call</a>`;
    return `<div class="sheet-actions">${btns}</div>`;
  }

  function openPlaceSheet(p) {
    openSheet(
      `<div class="s-cat">${esc(p.catLabel)}</div><h3>${esc(p.name)}</h3>
       <p class="s-desc">${esc(p.desc)}</p>
       ${actionsHTML(p.name, p.lat, p.lng, null)}
       ${p.approx ? `<p class="s-approx">📌 Pin is approximate — verify the exact spot before relying on it.</p>` : ""}`
    );
  }

  function openStaySheet(s) {
    openSheet(
      `<div class="s-cat">${esc(s.loc)}</div><h3>${esc(s.name)}</h3>
       <p class="s-meta">📅 <strong>${esc(s.dates)}</strong></p>
       <p class="s-meta">Confirmation: <strong>${esc(s.confirm)}</strong> <button class="s-btn" style="flex:0;min-width:auto;padding:0.2rem 0.6rem;font-size:0.72rem;margin-left:0.4rem;" data-copy="${esc(s.confirm)}">Copy</button></p>
       ${actionsHTML(s.name, s.lat, s.lng, s.phone)}
       ${s.approx ? `<p class="s-approx">📌 Map pin is approximate — verify exact location.</p>` : ""}`
    );
  }

  function wireSheetButtons() {
    $$("#sheetBody [data-copy]").forEach(b => b.addEventListener("click", () => {
      const txt = b.dataset.copy;
      navigator.clipboard?.writeText(txt).then(() => { b.textContent = "Copied ✓"; b.classList.add("copied"); });
    }));
    $$("#sheetBody [data-showmap]").forEach(b => b.addEventListener("click", () => {
      const [lat, lng] = b.dataset.showmap.split(",").map(Number);
      closeSheet();
      switchView("mapView");
      setTimeout(() => { ensureMap(); map.setView([lat, lng], 15); flashAt(lat, lng); }, 250);
    }));
  }

  /* ─────────── MAP ─────────── */
  let map = null, mapInited = false, markerLayer = null, userMarker = null;
  let allMarkers = []; // {marker, cat}
  let activeFilter = "all";

  function makeIcon(color, emoji) {
    return L.divIcon({ className: "", html: `<div class="pin ${color}"><span>${emoji}</span></div>`,
      iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
  }
  const catEmoji = { coffee: "☕", food: "🍜", shopping: "🛍️", sights: "📷", nightlife: "🍺", stay: "🛏️" };

  function ensureMap() {
    if (mapInited) { map.invalidateSize(); return; }
    mapInited = true;
    map = L.map("map", { zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: "abcd", maxZoom: 19,
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    // route line through the cities
    const line = TRIP.cities.map(c => [c.lat, c.lng]);
    L.polyline(line, { color: "#5C5345", weight: 2, opacity: 0.5, dashArray: "6 8" }).addTo(map);

    // markers: stays + places
    TRIP.stays.forEach(s => addMarker(s.name, s.lat, s.lng, "stay", colorOf(s.city),
      `<strong>🛏️ ${esc(s.name)}</strong><br>${esc(s.loc)}`, () => openStaySheet(s)));
    TRIP.places.forEach(p => addMarker(p.name, p.lat, p.lng, p.cat, colorOf(p.city),
      `<strong>${esc(p.name)}</strong><br>${esc(p.catLabel)}`, () => openPlaceSheet(p)));

    const bounds = L.latLngBounds(allMarkers.map(m => m.marker.getLatLng()));
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  function addMarker(name, lat, lng, cat, color, popup, onClick) {
    const m = L.marker([lat, lng], { icon: makeIcon(color, catEmoji[cat] || "📍") });
    m.bindPopup(popup);
    m.on("click", () => { setTimeout(onClick, 60); });
    m.addTo(markerLayer);
    allMarkers.push({ marker: m, cat });
  }

  function applyFilter(cat) {
    activeFilter = cat;
    allMarkers.forEach(({ marker, cat: c }) => {
      const show = cat === "all" || c === cat;
      if (show) marker.addTo(markerLayer); else markerLayer.removeLayer(marker);
    });
    $$("#mapFilters .filter-chip").forEach(ch => ch.classList.toggle("active", ch.dataset.cat === cat));
  }

  function flashAt(lat, lng) {
    const c = L.circleMarker([lat, lng], { radius: 18, color: "#D4655F", weight: 3, fill: false });
    c.addTo(map);
    let r = 18;
    const iv = setInterval(() => { r += 4; c.setRadius(r); c.setStyle({ opacity: Math.max(0, 1 - (r - 18) / 40) }); if (r > 58) { clearInterval(iv); map.removeLayer(c); } }, 40);
  }

  function renderMapFilters() {
    const cats = [
      ["all", "All", "ink"], ["sights", "Sights", "lilac"], ["food", "Food", "blush"],
      ["coffee", "Coffee", "sage"], ["shopping", "Shopping", "lemon"], ["nightlife", "Nightlife", "pink"], ["stay", "Stays", "ink"],
    ];
    $("#mapFilters").innerHTML = cats.map(([c, label, col]) =>
      `<div class="filter-chip ${c === "all" ? "active" : ""}" data-cat="${c}"><span class="swatch" style="background:var(--${col})"></span>${esc(label)}</div>`
    ).join("");
    $$("#mapFilters .filter-chip").forEach(ch => ch.addEventListener("click", () => applyFilter(ch.dataset.cat)));
  }

  function locateMe() {
    if (!navigator.geolocation) { alert("Location not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([latitude, longitude], { radius: 8, color: "#fff", weight: 2, fillColor: "#D4655F", fillOpacity: 1 }).addTo(map);
      map.setView([latitude, longitude], 14);
    }, () => alert("Couldn't get your location. Check permissions."), { enableHighAccuracy: true, timeout: 8000 });
  }

  /* ─────────── ROUTER / TABS ─────────── */
  function switchView(id) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === id));
    if (id === "mapView") setTimeout(ensureMap, 60);
    window.scrollTo({ top: 0 });
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => switchView(t.dataset.view)));

  /* ─────────── INIT ─────────── */
  function init() {
    renderOverview();
    $("#tripStatusWrap").innerHTML = tripStatus();
    renderDays();
    renderPlaces();
    renderPacking();
    renderMapFilters();
    $("#locateBtn").addEventListener("click", locateMe);

    // honour hash on load, else focus today's day
    const startView = (location.hash || "").replace("#", "");
    if (startView && $("#" + startView)) switchView(startView);

    // center day deck on today after layout settles
    const n = currentDayNumber();
    setTimeout(() => { if (n) scrollToDay(n); updateActiveChip(); }, 200);

    // register service worker (offline / installable)
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
