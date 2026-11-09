// Dropped client. The server owns the game; this file draws whatever state it sends.
const $ = s => document.querySelector(s);
const STYLE = 'https://tiles.openfreemap.org/styles/dark';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = n => Math.round(n).toLocaleString('en-US');
const region = new Intl.DisplayNames(['en'], { type: 'region' });
const country = cc => { try { return region.of(cc); } catch { return cc; } };
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const TIER_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const NOTES = {
  difficulty: {
    easy: 'Big cities. Street signs, shop fronts, landmarks.',
    medium: 'Towns and the roads around them.',
    hard: 'Back roads, a long way from any town.',
    mixed: 'Each round is easy, medium or hard. You find out when you land.',
  },
  timer: {
    first15: 'No clock until someone locks a guess. Then the other player has 15 seconds.',
    first30: 'No clock until someone locks a guess. Then the other player has 30 seconds.',
    fixed60: 'Every round lasts 60 seconds.', fixed90: 'Every round lasts 90 seconds.', fixed120: 'Every round lasts 2 minutes.',
    none: 'No clock. The round ends when everyone has guessed.',
  },
  camera: {
    free: 'Click the arrows on the road to walk. Drag to look around.',
    frozen: 'One view, no walking and no turning. For when easy got too easy.',
  },
};

// ---------- identity ----------
let pid = store.get('dropped.pid');
if (!pid) { pid = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()); store.set('dropped.pid', pid); }
const nameInput = $('#name');
nameInput.value = store.get('dropped.name') || '';

// ---------- maps ----------
// Repaint OpenFreeMap's dark style with our palette tokens: grey land, teal-tinted water, readable labels.
function theme(map) {
  // Colours Arham picked on 2026-11-09: blue water, lighter grey countries (a deliberate exception to the generated palette).
  const set = (id, prop, val) => map.getLayer(id) && map.setPaintProperty(id, prop, val);
  set('background', 'background-color', '#3E4247');
  set('water', 'fill-color', '#1D3E5E');
  set('waterway', 'line-color', '#1D3E5E');
  set('landuse_residential', 'fill-color', '#474B51');
  for (const id of ['landcover_wood', 'landuse_park']) set(id, 'fill-color', '#3B4540');
  for (const id of ['landcover_ice_shelf', 'landcover_glacier']) set(id, 'fill-color', '#5A5F66');
  for (const id of ['boundary_country_z0-4', 'boundary_country_z5-']) set(id, 'line-color', '#9AA0A6');
  set('boundary_state', 'line-color', '#55595F');
  for (const id of ['highway_major_inner', 'highway_motorway_inner', 'highway_minor']) set(id, 'line-color', '#6B7077');
  // place names only once you are zoomed in far enough for them to matter
  const minZoom = { place_state: 5, place_city_large: 5, place_city: 6, place_town: 8, place_village: 10, place_other: 11, place_suburb: 11 };
  for (const [id, z] of Object.entries(minZoom)) if (map.getLayer(id)) map.setLayerZoomRange(id, z, 24);
  for (const id of ['place_country_major', 'place_country_minor', 'place_country_other', 'place_state', 'place_city_large', 'place_city', 'place_town', 'place_village', 'water_name']) {
    set(id, 'text-color', id === 'water_name' ? '#8FB8DE' : '#EBEBEB');
    set(id, 'text-halo-color', '#0A0A0A');
    if (map.getLayer(id)) map.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]);
  }
}
let world, guessMap, guessMarker = null, worldMarkers = [], spinOn = false;

function initWorld() {
  world = new maplibregl.Map({
    container: 'world', style: STYLE, center: [10, 22], zoom: 1.7,
    attributionControl: { compact: true }, interactive: true, renderWorldCopies: false,
  });
  world.once('load', () => { frameHome(); collapseAttribution(world); });
  addEventListener('resize', () => { if (spinOn) frameHome(); });
  world.on('style.load', () => {
    world.setProjection({ type: 'globe' });
    theme(world);
    worldLabels(!spinOn);
    world.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    world.addLayer({ id: 'lines', type: 'line', source: 'lines', paint: { 'line-color': ['get', 'c'], 'line-width': 3, 'line-dasharray': [2, 1.2] } });
  });
  setWorldInteractive(false);
  const spin = () => {
    if (spinOn && !reduceMotion && document.visibilityState === 'visible' && world.loaded()) {
      const c = world.getCenter();
      world.setCenter([c.lng + 0.03, c.lat]);
    }
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
}
// Home and lobby: no labels on the globe. Reveal and final: country names only, so the pins stay the loudest thing.
function worldLabels(on) {
  if (!world?.getStyle()) return;
  for (const l of world.getStyle().layers) {
    if (l.type !== 'symbol') continue;
    const country = l.id.startsWith('place_country');
    world.setLayoutProperty(l.id, 'visibility', on && country ? 'visible' : 'none');
    if (country) world.setPaintProperty(l.id, 'text-color', '#B1B1B1');
  }
}
function collapseAttribution(map) {
  const a = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
  if (a) { a.classList.remove('maplibregl-compact-show'); a.removeAttribute('open'); }
}
function frameHome() {
  worldLabels(false);
  if (world.style?._loaded && world.getProjection?.()?.type !== 'globe') world.setProjection({ type: 'globe' }); // before load, style.load sets it
  const wide = innerWidth > 720;
  world.jumpTo({ padding: wide ? { left: innerWidth * 0.5, top: 0, right: 0, bottom: 0 } : { left: 0, top: innerHeight * 0.62, right: 0, bottom: 0 }, zoom: wide ? 2.15 : 1.35, center: [world.getCenter().lng, 18] });
}
function setWorldInteractive(on) {
  world.getContainer().inert = !on;
  const h = ['dragPan', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard', 'dragRotate'];
  for (const k of h) on ? world[k].enable() : world[k].disable();
}
function clearWorld() {
  worldMarkers.forEach(m => m.remove()); worldMarkers = [];
  world.getSource('lines')?.setData({ type: 'FeatureCollection', features: [] });
}

function initGuessMap() {
  if (guessMap) return;
  guessMap = new maplibregl.Map({
    container: 'guessMap', style: STYLE, center: [0, 25], zoom: 0.4,
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, renderWorldCopies: true,
  });
  guessMap.on('style.load', () => theme(guessMap));
  guessMap.once('load', () => collapseAttribution(guessMap));
  guessMap.touchZoomRotate.disableRotation();
  guessMap.keyboard.disableRotation();
  guessMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  guessMap.on('click', e => placePin(e.lngLat));
  const canvas = guessMap.getCanvas();
  canvas.setAttribute('aria-label', 'Guess map. Arrow keys move, plus and minus zoom, Enter drops your pin in the middle.');
  canvas.addEventListener('keydown', e => {
    $('.crosshair').classList.add('kbd');
    if (e.key === 'Enter') { e.preventDefault(); placePin(guessMap.getCenter()); }
  });
  new ResizeObserver(() => guessMap.resize()).observe($('#guessMap'));
}

function pinEl(color, label) {
  const wrap = document.createElement('div');
  wrap.className = 'pin-wrap';
  wrap.style.setProperty('--c', color);
  // the marker element itself is positioned by MapLibre's transform, so the drop animation goes on a child
  wrap.innerHTML = `<div class="drop">${label ? `<span class="label"></span>` : ''}<div class="pin"></div></div>`;
  if (label) wrap.querySelector('.label').textContent = label;
  return wrap;
}
function answerEl(n) {
  const el = document.createElement('div');
  el.innerHTML = `<div class="answer-pin drop${n ? ' small' : ''}"></div>`;
  if (n) el.firstChild.textContent = n;
  return el;
}

// ---------- connection ----------
let ws = null, code = null, S = null, offset = 0, retry = 0, creating = null, fatal = false;

function connect(roomCode, create) {
  code = roomCode;
  creating = create || null;
  fatal = false;
  open();
}
function open() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
  ws.onopen = () => {
    retry = 0;
    $('#conn').hidden = true;
    ws.send(JSON.stringify({ t: 'hello', pid, name: store.get('dropped.name') || 'Player', code, create: !!creating, mode: creating?.mode }));
  };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'state') { creating = null; store.set('dropped.room.' + code, '1'); onState(m); }
    else if (m.t === 'error') onError(m);
  };
  ws.onclose = () => {
    if (fatal) return;
    $('#conn').hidden = false;
    $('#conn').textContent = 'Connection dropped. Reconnecting';
    setTimeout(open, Math.min(8000, 500 * 2 ** retry++));
  };
}
const send = m => ws?.readyState === 1 && ws.send(JSON.stringify(m));
setInterval(() => send({ t: 'ping' }), 20000);

function onError(m) {
  const msgs = {
    'no-room': `There's no game with the code ${code}. Check it with your friend.`,
    full: `Game ${code} already has two players.`,
    started: `Game ${code} has already started without you.`,
  };
  if (msgs[m.code]) {
    fatal = true; ws.close();
    history.replaceState({}, '', '/');
    showHome(null);
    $('#codeErr').textContent = msgs[m.code];
    return;
  }
  if (m.code === 'need-two') return flash('#startNote', 'Your friend has to join first.');
}

// ---------- routing ----------
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return [...b].map(x => ALPHABET[x % ALPHABET.length]).join('');
}
function showHome(joinCode) {
  document.body.dataset.screen = 'home';
  spinOn = true;
  if (world) frameHome();
  renderHistory();
  $('#joinNote').hidden = !joinCode;
  $('#createActions').hidden = !!joinCode;
  $('#joinActions').hidden = !joinCode;
  $('#codeForm').hidden = !!joinCode;
  if (joinCode) $('#joinNote').innerHTML = `You're joining game <b>${joinCode}</b>.`;
}

$('#homeForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.setAttribute('aria-invalid', 'true');
    $('#nameErr').textContent = 'Type a name, so the scoreboard knows who is winning.';
    nameInput.focus();
    return;
  }
  nameInput.removeAttribute('aria-invalid');
  $('#nameErr').textContent = '';
  store.set('dropped.name', name);
  const mode = e.submitter?.dataset.mode || 'duo';
  if (mode === 'join') return connect(roomFromPath());
  const c = newCode();
  history.pushState({}, '', '/r/' + c);
  connect(c, { mode });
});
$('#codeForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = $('#code').value.trim().toUpperCase();
  if (!/^[A-Z2-9]{5}$/.test(c)) {
    $('#codeErr').textContent = 'Codes are 5 letters and numbers, like K7QXM.';
    $('#code').setAttribute('aria-invalid', 'true');
    return;
  }
  $('#code').removeAttribute('aria-invalid');
  $('#codeErr').textContent = '';
  history.pushState({}, '', '/r/' + c);
  if (nameInput.value.trim()) { store.set('dropped.name', nameInput.value.trim()); connect(c); }
  else showHome(c);
});
nameInput.addEventListener('input', () => { nameInput.removeAttribute('aria-invalid'); $('#nameErr').textContent = ''; onAir(); });
function onAir() { $('#airName').textContent = nameInput.value.trim() || 'Your name'; $('#airName').classList.toggle('empty', !nameInput.value.trim()); }
onAir();
window.addEventListener('popstate', () => location.reload());

function roomFromPath() {
  const m = location.pathname.match(/^\/r\/([A-Za-z2-9]{5})\/?$/);
  return m ? m[1].toUpperCase() : null;
}

// ---------- state ----------
let lastKey = '';
function onState(st) {
  st.players.sort((a, b) => (b.id === st.you) - (a.id === st.you));
  const prev = S;
  S = st;
  offset = st.now - Date.now();
  document.body.classList.toggle('solo', st.mode === 'solo');
  document.body.dataset.screen = st.phase;
  spinOn = st.phase === 'lobby';
  if (spinOn && prev?.phase !== 'lobby') frameHome();
  if (!spinOn && (st.phase === 'reveal' || st.phase === 'final')) { world.setPadding({ left: 0, top: 0, right: 0, bottom: 0 }); worldLabels(true); }
  if (st.phase === 'lobby') renderLobby(st);
  if (st.phase === 'round') renderRound(st, prev);
  if (st.phase === 'reveal') renderReveal(st);
  if (st.phase === 'final') renderFinal(st);
  setWorldInteractive(st.phase === 'reveal' || st.phase === 'final');
  if (st.phase === 'lobby' || st.phase === 'home') { if (lastKey !== 'lobby') { clearWorld(); lastKey = 'lobby'; } }
}
const me = st => st.players.find(p => p.id === st.you);
const them = st => st.players.find(p => p.id !== st.you);
const colorOf = (st, id) => id === st.you ? 'var(--lead)' : 'var(--support)';
const hostName = st => st.players.find(p => p.host)?.name || 'The host';

// ---------- lobby ----------
const settingsForm = $('#settings');
function renderLobby(st) {
  const isHost = st.host === st.you;
  const pg = $('#pregame');
  pg.innerHTML = `<div class="pg-tag">${st.mode === 'solo' ? 'Solo<br>run' : 'Pre<br>game'}</div><div class="pg-players"></div>${st.mode === 'duo' ? `<div class="pg-code"><span>Game</span><b>${st.code}</b></div>` : ''}`;
  const slots = [...st.players];
  if (st.mode === 'duo' && slots.length < 2) slots.push(null);
  for (const p of slots) {
    const d = document.createElement('div');
    d.className = 'pg-p' + (p ? (p.connected ? '' : ' offline') : ' waiting');
    d.style.setProperty('--c', p ? colorOf(st, p.id) : 'var(--line-strong)');
    d.innerHTML = '<span class="n"></span><span class="s"></span>';
    d.querySelector('.n').textContent = p ? (p.id === st.you ? 'You' : p.connected ? 'Opponent' : 'Offline') : 'Opponent';
    d.querySelector('.s').textContent = p ? p.name : 'Waiting';
    pg.querySelector('.pg-players').append(d);
  }
  $('#invite').hidden = st.mode === 'solo' || st.players.length >= 2 || !isHost;
  $('#settingsHint').textContent = isHost ? '' : `${hostName(st)} picks the settings.`;
  for (const [k, v] of Object.entries(st.settings)) {
    for (const r of settingsForm.elements[k]) { r.checked = String(r.value) === String(v); r.disabled = !isHost; }
  }
  $('#difficultyNote').textContent = NOTES.difficulty[st.settings.difficulty];
  $('#timerNote').textContent = NOTES.timer[st.settings.timer];
  $('#cameraNote').textContent = NOTES.camera[st.settings.camera];

  const link = `${location.origin}/r/${st.code}`;
  $('#inviteLink').value = link;
  $('#inviteCode').textContent = st.code;

  const start = $('#startBtn');
  start.hidden = !isHost;
  const ready = st.mode === 'solo' || st.players.length === 2;
  start.disabled = !ready;
  start.textContent = st.mode === 'solo' ? 'Drop me in' : 'Start the duel';
  $('#startNote').textContent = !isHost ? `Waiting for ${hostName(st)} to start.` : ready ? '' : 'Starts once your friend joins.';
}
settingsForm.addEventListener('change', () => {
  const f = settingsForm.elements;
  const pick = n => [...f[n]].find(r => r.checked)?.value;
  send({ t: 'settings', settings: { difficulty: pick('difficulty'), rounds: Number(pick('rounds')), timer: pick('timer'), camera: pick('camera') } });
});
$('#startBtn').addEventListener('click', () => send({ t: 'start' }));
$('#copyBtn').addEventListener('click', async () => {
  const btn = $('#copyBtn');
  try { await navigator.clipboard.writeText($('#inviteLink').value); btn.textContent = 'Copied'; }
  catch { $('#inviteLink').select(); btn.textContent = 'Press Ctrl+C'; }
  setTimeout(() => (btn.textContent = 'Copy link'), 1600);
});
function flash(sel, text) { const el = $(sel); el.textContent = text; setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000); }

// ---------- street view ----------
// With a Maps JavaScript API key (set on the server) we use Google's official viewer, which can hide
// road labels and the address. Without one we fall back to the keyless embed, which always shows road labels.
let mapsKey = null, gmaps = null, svPano = null, lastPano = null;
const configReady = fetch('/api/config').then(r => r.json()).then(c => { mapsKey = c.mapsKey; }).catch(() => {});
function loadGoogle() {
  gmaps ||= new Promise((resolve, reject) => {
    window.__dropGm = resolve;
    window.gm_authFailure = () => { mapsKey = null; if (lastPano) showPano(...lastPano); };
    const sc = document.createElement('script');
    sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&v=weekly&loading=async&callback=__dropGm`;
    sc.onerror = reject;
    document.head.append(sc);
  });
  return gmaps;
}
async function showPano(p, frozen) {
  lastPano = [p, frozen];
  $('#freeze').hidden = !frozen;
  $('#pano').classList.remove('loaded');
  await configReady;
  const useJs = !!mapsKey;
  $('#pano').classList.toggle('js', useJs);
  $('#panoJs').hidden = !useJs;
  $('#panoFrame').hidden = useJs;
  if (useJs) {
    try {
      await loadGoogle();
      const opts = {
        pano: p.id, pov: { heading: p.heading, pitch: 0 }, zoom: 0,
        showRoadLabels: false, addressControl: false, fullscreenControl: false, enableCloseButton: false,
        motionTracking: false, motionTrackingControl: false, imageDateControl: false,
        linksControl: !frozen, clickToGo: !frozen, scrollwheel: !frozen, panControl: !frozen, zoomControl: !frozen,
      };
      if (!svPano) svPano = new google.maps.StreetViewPanorama($('#panoJs'), opts);
      else svPano.setOptions(opts);
      $('#pano').classList.add('loaded');
      return;
    } catch { mapsKey = null; }
    $('#pano').classList.remove('js'); $('#panoJs').hidden = true; $('#panoFrame').hidden = false;
  }
  const frame = $('#panoFrame');
  frame.onload = () => $('#pano').classList.add('loaded');
  frame.src = `https://www.google.com/maps/embed?pb=!4v${Date.now()}!6m8!1m7!1s${encodeURIComponent(p.id)}!2m2!1d0!2d0!3f${p.heading}!4f0!5f0.8`;
}

// ---------- round ----------
let pin = null, locked = false, roundKey = '', pinTimer = 0;
const lockBtn = $('#lockBtn');

function renderRound(st, prev) {
  const r = st.rounds[st.round];
  const key = `${st.code}-${st.round}-${r.pano.id}`;
  initGuessMap();
  if (key !== roundKey) {
    roundKey = key;
    const mine = r.guesses[st.you];
    pin = mine?.pin || null;
    locked = !!mine?.locked;
    guessMarker?.remove(); guessMarker = null;
    if (pin) setMarker(pin);
    guessMap.jumpTo({ center: [0, 25], zoom: 0.4 });
    showPano(r.pano, st.settings.camera === 'frozen');
    $('#bug').style.animation = 'none'; void $('#bug').offsetWidth; $('#bug').style.animation = '';
    closeSheet();
  }
  if (r.guesses[st.you]?.locked) locked = true;

  $('#bugRound').textContent = st.round + 1;
  $('#bugOf').textContent = `of ${st.total}`;
  $('#bugTier').textContent = TIER_NAME[r.tier];
  $('#bugTier').dataset.tier = r.tier;
  const bp = $('#bugPlayers');
  bp.innerHTML = '';
  for (const p of st.players) {
    const d = document.createElement('div');
    d.className = 'bug-p';
    d.style.setProperty('--c', colorOf(st, p.id));
    const isLocked = p.id === st.you ? locked : r.guesses[p.id]?.locked;
    d.innerHTML = `<span class="n"></span><span class="s">${fmt(p.score)}</span>${isLocked ? '<span class="locked" title="Locked in"></span><span class="sr-only">, locked in</span>' : ''}`;
    d.querySelector('.n').textContent = p.name;
    bp.append(d);
  }
  renderStatus(st);
  renderLock();
  tick();
}

function renderStatus(st) {
  const el = $('#status');
  el.className = 'status';
  if (st.mode === 'solo') { el.textContent = ''; return; }
  const o = them(st), r = st.rounds[st.round];
  if (!o) { el.textContent = ''; return; }
  const oLocked = r.guesses[o.id]?.locked;
  if (!o.connected) { el.classList.add('warn'); el.textContent = `${o.name} lost connection. Waiting for them to come back.`; return; }
  if (oLocked && !locked) el.textContent = `${o.name} locked in. Your move.`;
  else if (locked && !oLocked) { el.classList.add('quiet'); el.textContent = `Locked. Waiting for ${o.name}.`; }
  else el.textContent = '';
}

function renderLock() {
  lockBtn.classList.toggle('locked', locked);
  if (locked) { lockBtn.disabled = true; lockBtn.textContent = 'Locked in'; return; }
  lockBtn.disabled = !pin;
  lockBtn.textContent = pin ? 'Lock guess' : 'Pin the map first';
}

function setMarker(p) {
  if (!guessMarker) guessMarker = new maplibregl.Marker({ element: pinEl('var(--lead)'), anchor: 'bottom' }).setLngLat(p).addTo(guessMap);
  else guessMarker.setLngLat(p);
}
function placePin(ll) {
  if (locked || S?.phase !== 'round') return;
  pin = { lat: ll.lat, lng: ll.lng };
  setMarker(pin);
  renderLock();
  clearTimeout(pinTimer);
  pinTimer = setTimeout(() => send({ t: 'pin', ...pin }), 250);
}
lockBtn.addEventListener('click', () => {
  if (!pin || locked) return;
  locked = true;
  send({ t: 'lock', ...pin });
  renderLock();
  if (S) { renderStatus(S); renderRound(S); }
});

// desktop: keep the map big; phone: bottom sheet
$('#sizeBtn').addEventListener('click', () => {
  const on = $('#guess').classList.toggle('big');
  $('#sizeBtn').setAttribute('aria-pressed', on);
  $('#sizeBtn').textContent = on ? 'Smaller' : 'Bigger';
});
function closeSheet() { $('#guess').classList.remove('open'); $('#mapToggle').setAttribute('aria-expanded', 'false'); $('#mapToggle').textContent = 'Open map'; }
$('#mapToggle').addEventListener('click', () => {
  const open = $('#guess').classList.toggle('open');
  $('#mapToggle').setAttribute('aria-expanded', open);
  $('#mapToggle').textContent = open ? 'Back to street' : 'Open map';
  if (open) setTimeout(() => guessMap.resize(), 260);
});

function tick() {
  if (!S || S.phase !== 'round') return;
  const r = S.rounds[S.round];
  const clock = $('#bugClock');
  if (!r.endsAt) { clock.hidden = true; return; }
  clock.hidden = false;
  const left = Math.max(0, Math.ceil((r.endsAt - (Date.now() + offset)) / 1000));
  $('#clock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  clock.classList.toggle('urgent', left <= 10);
}
setInterval(tick, 250);

// ---------- reveal ----------
const kmText = km => km == null ? 'No guess' : km < 1 ? `${Math.round(km * 1000)} m off` : km < 100 ? `${km.toFixed(1)} km off` : `${fmt(km)} km off`;

function wrapNear(lng, ref) { while (lng - ref > 180) lng -= 360; while (ref - lng > 180) lng += 360; return lng; }

function drawRounds(st, rounds, numbered, pad) {
  clearWorld();
  const pts = [], lines = [];
  rounds.forEach((r, i) => {
    const a = r.answer;
    worldMarkers.push(new maplibregl.Marker({ element: answerEl(numbered ? i + 1 : 0), opacityWhenCovered: '0' }).setLngLat([a.lng, a.lat]).addTo(world));
    pts.push([a.lng, a.lat]);
    for (const p of st.players) {
      const g = r.guesses[p.id];
      if (!g?.pin) continue;
      const lng = wrapNear(g.pin.lng, a.lng);
      const c = p.id === st.you ? '#F74E82' : '#C8F253';
      worldMarkers.push(new maplibregl.Marker({ element: pinEl(colorOf(st, p.id), numbered ? null : p.name), anchor: 'bottom', opacityWhenCovered: '0' }).setLngLat([lng, g.pin.lat]).addTo(world));
      pts.push([lng, g.pin.lat]);
      lines.push({ from: [lng, g.pin.lat], to: [a.lng, a.lat], c });
    }
  });
  // never let padding swallow the map: keep at least 140px of height and width visible
  const room = { h: innerHeight - pad.top - pad.bottom, w: innerWidth - pad.left - pad.right };
  if (room.h < 140) pad.bottom = Math.max(20, innerHeight - pad.top - 140);
  if (room.w < 140) pad.left = Math.max(20, innerWidth - pad.right - 140);
  const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
  // On a globe, a world-spanning fit shrinks to a marble. Keep the globe at least as big as the free area.
  world.setPadding({ left: 0, top: 0, right: 0, bottom: 0 });
  const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
  const wideSpread = Math.max(...lngs) - Math.min(...lngs) > 120 || Math.max(...lats) - Math.min(...lats) > 75;
  world.setProjection({ type: wideSpread ? 'mercator' : 'globe' });
  if (wideSpread) {
    world.fitBounds(b, { padding: pad, maxZoom: 13, duration: reduceMotion ? 0 : 900, essential: false });
  } else {
    // on the globe, keep it at least ~85% of the free height so it never shrinks to a marble
    const cam = world.cameraForBounds(b, { padding: pad, maxZoom: 13 }) || {};
    const free = Math.min(innerWidth - pad.left - pad.right, innerHeight - pad.top - pad.bottom);
    const minZoom = Math.log2((Math.PI * free * 0.85) / 512);
    world.easeTo({ center: b.getCenter(), zoom: Math.max(cam.zoom ?? minZoom, minZoom), padding: pad, duration: reduceMotion ? 0 : 900, essential: false });
  }
  const t0 = performance.now(), dur = reduceMotion ? 0 : 700;
  const step = now => {
    const k = dur ? Math.min(1, (now - t0 - 300) / dur) : 1;
    const e = 1 - (1 - Math.max(0, k)) ** 3;
    world.getSource('lines')?.setData({ type: 'FeatureCollection', features: lines.map(l => ({ type: 'Feature', properties: { c: l.c }, geometry: { type: 'LineString', coordinates: [l.from, [l.from[0] + (l.to[0] - l.from[0]) * e, l.from[1] + (l.to[1] - l.from[1]) * e]] } })) });
    if (k < 1) requestAnimationFrame(step);
  };
  if (world.getSource('lines')) requestAnimationFrame(step); else world.once('style.load', () => requestAnimationFrame(step));
}

function countUp(el, to, prefix = '') {
  if (reduceMotion) { el.textContent = prefix + fmt(to); return; }
  const t0 = performance.now();
  const f = now => { const k = Math.min(1, (now - t0 - 450) / 700); const e = 1 - (1 - Math.max(0, k)) ** 3; el.textContent = prefix + fmt(to * e); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

function renderReveal(st) {
  const r = st.rounds[st.round];
  const key = `reveal-${st.code}-${st.round}`;
  const fresh = lastKey !== key;
  if (fresh) lastKey = key;
  $('#revealKicker').textContent = `Round ${st.round + 1} of ${st.total} · ${TIER_NAME[r.tier]}`;
  $('#revealPlace').textContent = country(r.answer.cc);
  $('#revealSub').textContent = r.answer.label;
  const rows = $('#revealRows');
  if (fresh) {
    rows.innerHTML = '';
    const sorted = [...st.players].sort((a, b) => r.guesses[b.id].pts - r.guesses[a.id].pts);
    const best = sorted.length > 1 && r.guesses[sorted[0].id].pts > r.guesses[sorted[1].id].pts ? sorted[0].id : null;
    sorted.forEach((p, i) => {
      const g = r.guesses[p.id];
      const li = document.createElement('li');
      li.style.setProperty('--c', colorOf(st, p.id));
      li.style.animationDelay = `${450 + i * 120}ms`;
      if (p.id === best) li.classList.add('best');
      li.innerHTML = `<span class="who"><b></b><small></small></span><span class="km"></span><span class="pts">+0</span>`;
      li.querySelector('.who b').textContent = p.name;
      li.querySelector('.who small').textContent = `${fmt(p.score)} total`;
      li.querySelector('.km').textContent = kmText(g.km) + (g.timedOut && g.pin ? ', out of time' : '');
      countUp(li.querySelector('.pts'), g.pts, '+');
      rows.append(li);
    });
    const panel = $('#third').offsetHeight;
    drawRounds(st, [r], false, innerWidth <= 720
      ? { top: 90, bottom: panel + 30, left: 72, right: 72 }
      : { top: 120, bottom: panel + 48, left: 80, right: 80 });
  }
  const last = st.round + 1 >= st.total;
  const mineReady = me(st)?.ready;
  const o = them(st);
  const btn = $('#nextBtn');
  btn.disabled = !!mineReady;
  btn.textContent = mineReady ? 'Ready' : last ? 'See the results' : 'Next round';
  $('#nextNote').textContent = mineReady && o && !o.ready ? `Waiting for ${o.name}.` : (!mineReady && o?.ready ? `${o.name} is ready.` : '');
  if (fresh && !reduceMotion) setTimeout(() => btn.focus({ preventScroll: true }), 50); else if (fresh) btn.focus({ preventScroll: true });
}
$('#nextBtn').addEventListener('click', () => send({ t: 'next' }));

// ---------- final ----------
function renderFinal(st) {
  const key = `final-${st.code}-${st.rounds.length}-${st.rounds[0]?.pano.id}`;
  const fresh = lastKey !== key;
  const ps = [...st.players].sort((a, b) => b.score - a.score);
  const max = st.rounds.length * 1000;
  const slate = $('#slate');
  if (st.mode === 'solo') {
    slate.style.setProperty('--band', 'var(--lead)');
    $('#finalTitle').textContent = `${fmt(ps[0].score)} points`;
    $('#finalScore').textContent = '';
    $('#finalSub').textContent = `Out of ${fmt(max)}, ${st.rounds.length} rounds on ${st.settings.difficulty}.`;
  } else if (ps.length > 1 && ps[0].score === ps[1].score) {
    slate.style.setProperty('--band', 'var(--action)');
    $('#finalTitle').textContent = 'Dead heat';
    $('#finalScore').textContent = `${fmt(ps[0].score)}–${fmt(ps[1].score)}`;
    $('#finalSub').textContent = `Level after ${st.rounds.length} rounds.`;
  } else {
    slate.style.setProperty('--band', colorOf(st, ps[0].id));
    $('#finalTitle').textContent = ps[0].id === st.you ? 'You win' : `${ps[0].name} wins`;
    $('#finalScore').textContent = ps[1] ? `${fmt(ps[0].score)}–${fmt(ps[1].score)}` : '';
    $('#finalSub').textContent = ps[1] ? `${ps[0].name} beat ${ps[1].name} over ${st.rounds.length} rounds.` : '';
  }
  const t = $('#finalTable');
  const cols = st.players;
  t.innerHTML = '';
  const thead = t.createTHead().insertRow();
  thead.innerHTML = '<th>Rd</th><th>Where</th>';
  for (const p of cols) { const th = document.createElement('th'); th.style.setProperty('--c', colorOf(st, p.id)); th.innerHTML = '<span></span>'; th.append(p.name); thead.append(th); }
  const tb = t.createTBody();
  st.rounds.forEach((r, i) => {
    const tr = tb.insertRow();
    tr.innerHTML = `<td>${i + 1}</td><td class="place"></td>`;
    tr.querySelector('.place').textContent = country(r.answer.cc);
    tr.querySelector('.place').title = r.answer.label;
    const top = Math.max(...cols.map(p => r.guesses[p.id].pts));
    for (const p of cols) {
      const td = tr.insertCell();
      const g = r.guesses[p.id];
      td.textContent = fmt(g.pts);
      td.title = kmText(g.km);
      if (cols.length > 1 && g.pts === top && cols.some(q => r.guesses[q.id].pts < top)) { td.className = 'won'; td.style.setProperty('--c', colorOf(st, p.id)); }
    }
  });
  const tf = t.createTFoot().insertRow();
  tf.innerHTML = '<td colspan="2">Total</td>';
  for (const p of cols) tf.insertCell().textContent = fmt(p.score);

  if (fresh) {
    lastKey = key;
    saveRun(st);
    const slateH = slate.offsetHeight, panel = $('.final-panel');
    document.documentElement.style.setProperty('--slate-h', slateH + 'px');
    drawRounds(st, st.rounds, true, innerWidth <= 720
      ? { top: slateH + 30, bottom: panel.offsetHeight + 30, left: 56, right: 56 }
      : { top: slateH + 40, bottom: 40, left: panel.offsetWidth + 64, right: 48 });
  }
  const isHost = st.host === st.you;
  $('#againBtn').hidden = !isHost;
  $('#againNote').textContent = isHost ? '' : `Waiting for ${hostName(st)} to set up another game.`;
}
$('#againBtn').addEventListener('click', () => send({ t: 'again' }));

// ---------- past games (this browser only) ----------
const HKEY = 'dropped.history';
const loadRuns = () => { try { return JSON.parse(store.get(HKEY) || '[]'); } catch { return []; } };
function saveRun(st) {
  const id = `${st.code}-${st.rounds[0]?.pano.id}`;
  const runs = loadRuns();
  if (runs.some(r => r.id === id)) return;
  const you = me(st), opp = them(st);
  runs.unshift({
    id, at: Date.now(), mode: st.mode, difficulty: st.settings.difficulty, max: st.rounds.length * 1000,
    you: you.score, them: opp ? { name: opp.name, score: opp.score } : null,
    rounds: st.rounds.map(r => ({ cc: r.answer.cc, label: r.answer.label, tier: r.tier, you: r.guesses[st.you].pts, km: r.guesses[st.you].km, them: opp ? r.guesses[opp.id].pts : null })),
  });
  store.set(HKEY, JSON.stringify(runs.slice(0, 50)));
}
const DIFF = { easy: 'Easy', medium: 'Medium', hard: 'Hard', mixed: 'Mixed' };
const day = t => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
function renderHistory() {
  const runs = loadRuns();
  $('#history').hidden = !runs.length;
  if (!runs.length) return;
  const rec = {};
  for (const r of runs) if (r.them) {
    const k = r.them.name; rec[k] ||= { w: 0, l: 0, d: 0 };
    r.you > r.them.score ? rec[k].w++ : r.you < r.them.score ? rec[k].l++ : rec[k].d++;
  }
  const solo = runs.filter(r => r.mode === 'solo');
  const recs = $('#records');
  recs.innerHTML = '';
  for (const [name, x] of Object.entries(rec)) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="vs"></span><b></b>';
    li.querySelector('.vs').textContent = `You vs ${name}`;
    li.querySelector('b').textContent = `${x.w} won, ${x.l} lost${x.d ? `, ${x.d} drawn` : ''}`;
    recs.append(li);
  }
  if (solo.length) {
    const best = solo.reduce((a, b) => (b.you / b.max > a.you / a.max ? b : a));
    const li = document.createElement('li');
    li.innerHTML = '<span class="vs">Best solo run</span><b></b>';
    li.querySelector('b').textContent = `${fmt(best.you)} of ${fmt(best.max)}, ${DIFF[best.difficulty].toLowerCase()}`;
    recs.append(li);
  }
  const list = $('#runs');
  list.innerHTML = '';
  for (const r of runs) {
    const li = document.createElement('li');
    const result = !r.them ? '' : r.you > r.them.score ? 'Won' : r.you < r.them.score ? 'Lost' : 'Draw';
    li.innerHTML = `<details><summary><span class="when"></span><span class="what"></span><span class="score"></span><span class="res"></span></summary><table><thead><tr><th>Rd</th><th>Where</th><th>You</th>${r.them ? '<th class="opp"></th>' : ''}</tr></thead><tbody></tbody></table></details>`;
    li.querySelector('.when').textContent = day(r.at);
    li.querySelector('.what').textContent = `${r.them ? `vs ${r.them.name}` : 'Solo'} · ${DIFF[r.difficulty]} · ${r.rounds.length} rounds`;
    li.querySelector('.score').textContent = r.them ? `${fmt(r.you)}–${fmt(r.them.score)}` : `${fmt(r.you)} / ${fmt(r.max)}`;
    const res = li.querySelector('.res');
    res.textContent = result; res.dataset.r = result.toLowerCase();
    if (r.them) li.querySelector('.opp').textContent = r.them.name;
    const tb = li.querySelector('tbody');
    r.rounds.forEach((x, i) => {
      const tr = tb.insertRow();
      tr.innerHTML = `<td>${i + 1}</td><td class="place"></td><td>${fmt(x.you)}</td>${r.them ? `<td>${fmt(x.them)}</td>` : ''}`;
      tr.querySelector('.place').textContent = `${country(x.cc)} · ${TIER_NAME[x.tier]}`;
      tr.querySelector('.place').title = x.label;
    });
    list.append(li);
  }
}
$('#clearRuns').addEventListener('click', e => {
  const b = e.currentTarget;
  if (b.dataset.armed) { store.set(HKEY, '[]'); delete b.dataset.armed; b.textContent = 'Clear past games'; renderHistory(); return; }
  b.dataset.armed = '1'; b.textContent = `Click again to delete all ${loadRuns().length} games`;
  setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear past games'; }, 4000);
});

// ---------- boot ----------
initWorld();
const room = roomFromPath();
if (room && store.get('dropped.room.' + room) && store.get('dropped.name')) connect(room);
else if (room) showHome(room);
else showHome(null);
