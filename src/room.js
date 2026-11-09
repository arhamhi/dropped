// One game room. Holds the whole game; clients only ever see what they are allowed to see.
// During a round a client gets the panorama id and heading, never the coordinates.
import easy from './data/easy.json';
import medium from './data/medium.json';
import hard from './data/hard.json';

const POOLS = { easy, medium, hard };
const TIERS = ['easy', 'medium', 'hard'];
const TIMERS = {
  first15: { kind: 'first', s: 15 }, first30: { kind: 'first', s: 30 },
  fixed60: { kind: 'fixed', s: 60 }, fixed90: { kind: 'fixed', s: 90 }, fixed120: { kind: 'fixed', s: 120 },
  none: { kind: 'none' },
};
const LOAD_GRACE_MS = 2500; // street view takes a moment to appear
const MAX_NAME = 24;

export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// 1000 points for a perfect pin, falling off with distance: 100 km off = 936, 500 km = 717, 2000 km = 264.
export function points(km) {
  if (km == null) return 0;
  if (km < 0.05) return 1000;
  return Math.round(1000 * Math.exp(-km / 1500));
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Player';
const validLatLng = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90;
const normLng = lng => ((((lng + 180) % 360) + 360) % 360) - 180;

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.socks = new Map(); // WebSocket -> pid
    this.s = null;
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get('s')) || null; });
  }

  async fetch(request) {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    server.addEventListener('message', e => this.onMessage(server, e.data).catch(err => this.send(server, { t: 'error', code: 'server', msg: String(err) })));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  async save() { await this.ctx.storage.put('s', this.s); }

  async onMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const s = this.s;
    if (m.t === 'ping') return this.send(ws, { t: 'pong', now: Date.now() });

    if (m.t === 'hello') {
      const pid = String(m.pid || '').slice(0, 40);
      if (!pid) return this.send(ws, { t: 'error', code: 'bad-hello' });
      if (!s) {
        if (!m.create) return this.send(ws, { t: 'error', code: 'no-room' });
        this.s = {
          code: String(m.code || ''), mode: m.mode === 'solo' ? 'solo' : 'duo', host: pid, phase: 'lobby',
          settings: { difficulty: 'mixed', rounds: 5, timer: m.mode === 'solo' ? 'none' : 'first15', camera: 'free' },
          players: {}, order: [], round: -1, rounds: [], used: [], createdAt: Date.now(),
        };
      }
      const st = this.s;
      if (!st.players[pid]) {
        const cap = st.mode === 'solo' ? 1 : 2;
        if (st.order.length >= cap) return this.send(ws, { t: 'error', code: 'full' });
        if (st.phase !== 'lobby') return this.send(ws, { t: 'error', code: 'started' });
        st.players[pid] = { name: cleanName(m.name), score: 0, ready: false };
        st.order.push(pid);
      } else if (m.name) {
        st.players[pid].name = cleanName(m.name);
      }
      for (const [w, p] of this.socks) if (p === pid && w !== ws) { this.socks.delete(w); try { w.close(4000, 'replaced'); } catch {} }
      this.socks.set(ws, pid);
      await this.checkTimer();
      await this.save();
      return this.broadcast();
    }

    const pid = this.socks.get(ws);
    if (!s || !pid || !s.players[pid]) return this.send(ws, { t: 'error', code: 'not-joined' });
    const isHost = pid === s.host;

    switch (m.t) {
      case 'settings': {
        if (!isHost || s.phase !== 'lobby') return;
        const v = m.settings || {};
        if (['easy', 'medium', 'hard', 'mixed'].includes(v.difficulty)) s.settings.difficulty = v.difficulty;
        if ([3, 5, 10].includes(v.rounds)) s.settings.rounds = v.rounds;
        if (TIMERS[v.timer] && !(s.mode === 'solo' && TIMERS[v.timer].kind === 'first')) s.settings.timer = v.timer;
        if (['free', 'frozen'].includes(v.camera)) s.settings.camera = v.camera;
        break;
      }
      case 'name': s.players[pid].name = cleanName(m.name); break;
      case 'start': {
        if (!isHost || s.phase !== 'lobby') return;
        if (s.mode === 'duo' && s.order.length < 2) return this.send(ws, { t: 'error', code: 'need-two' });
        this.newGame();
        break;
      }
      case 'pin': {
        const r = s.rounds[s.round];
        if (s.phase !== 'round' || !r || !validLatLng(m)) return;
        const g = r.guesses[pid] || (r.guesses[pid] = {});
        if (g.locked) return;
        g.pin = { lat: m.lat, lng: normLng(m.lng) };
        await this.save();
        return; // pins are private, nobody else needs an update
      }
      case 'lock': {
        const r = s.rounds[s.round];
        if (s.phase !== 'round' || !r || !validLatLng(m)) return;
        const g = r.guesses[pid] || (r.guesses[pid] = {});
        if (g.locked) return;
        g.pin = { lat: m.lat, lng: normLng(m.lng) };
        g.locked = true;
        g.at = Date.now();
        const t = TIMERS[s.settings.timer];
        const everyone = s.order.every(p => r.guesses[p]?.locked);
        if (everyone) { this.endRound(); break; }
        if (t.kind === 'first' && !r.firstLockAt) {
          r.firstLockAt = Date.now();
          const ends = Date.now() + t.s * 1000;
          r.endsAt = r.endsAt ? Math.min(r.endsAt, ends) : ends;
          await this.ctx.storage.setAlarm(r.endsAt);
        }
        break;
      }
      case 'next': {
        if (s.phase !== 'reveal') return;
        s.players[pid].ready = true;
        if (this.connectedPids().every(p => s.players[p].ready)) this.advance();
        break;
      }
      case 'again': {
        if (s.phase !== 'final' || !isHost) return;
        s.phase = 'lobby';
        s.round = -1; s.rounds = [];
        for (const p of s.order) { s.players[p].score = 0; s.players[p].ready = false; }
        break;
      }
      default: return;
    }
    await this.save();
    this.broadcast();
  }

  async onClose(ws) {
    const pid = this.socks.get(ws);
    this.socks.delete(ws);
    if (!this.s || !pid) return;
    const s = this.s;
    // Someone left the lobby before the game: free the seat (the host keeps theirs).
    if (s.phase === 'lobby' && pid !== s.host && !this.connectedPids().includes(pid)) {
      delete s.players[pid];
      s.order = s.order.filter(p => p !== pid);
    }
    // In a reveal, a disconnected player should not hold the other one up.
    if (s.phase === 'reveal' && this.connectedPids().length && this.connectedPids().every(p => s.players[p].ready)) this.advance();
    await this.save();
    this.broadcast();
  }

  connectedPids() { return [...new Set(this.socks.values())]; }

  pickTiers(n, difficulty) {
    if (difficulty !== 'mixed') return Array(n).fill(difficulty);
    const out = [];
    while (out.length < n) out.push(...shuffle([...TIERS]));
    return shuffle(out.slice(0, n));
  }

  pickLocation(tier, avoidCc) {
    const used = new Set(this.s.used);
    let pool = POOLS[tier].filter(l => !used.has(l.id));
    if (pool.length < 5) { // ran through the pool: start over, minus this game's spots
      const thisGame = new Set(this.s.rounds.map(r => r.loc.id));
      this.s.used = this.s.used.filter(id => thisGame.has(id));
      pool = POOLS[tier].filter(l => !thisGame.has(l.id));
    }
    const fresh = pool.filter(l => l.cc !== avoidCc);
    const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh : pool).length)];
    this.s.used.push(pick.id);
    return pick;
  }

  newGame() {
    const s = this.s;
    s.tiers = this.pickTiers(s.settings.rounds, s.settings.difficulty);
    s.rounds = [];
    s.round = -1;
    for (const p of s.order) { s.players[p].score = 0; s.players[p].ready = false; }
    this.startRound();
  }

  startRound() {
    const s = this.s;
    s.round += 1;
    const tier = s.tiers[s.round];
    const prev = s.rounds[s.round - 1];
    const loc = this.pickLocation(tier, prev?.loc.cc);
    const t = TIMERS[s.settings.timer];
    const startedAt = Date.now();
    const endsAt = t.kind === 'fixed' ? startedAt + LOAD_GRACE_MS + t.s * 1000 : null;
    s.rounds.push({ tier, loc, startedAt, endsAt, guesses: {} });
    s.phase = 'round';
    for (const p of s.order) s.players[p].ready = false;
    if (endsAt) this.ctx.storage.setAlarm(endsAt);
  }

  endRound() {
    const s = this.s;
    const r = s.rounds[s.round];
    if (!r || s.phase !== 'round') return;
    for (const p of s.order) {
      const g = r.guesses[p] || (r.guesses[p] = {});
      g.km = g.pin ? distanceKm(g.pin, r.loc) : null;
      g.pts = points(g.km);
      g.timedOut = !g.locked;
      s.players[p].score += g.pts;
    }
    r.endedAt = Date.now();
    s.phase = 'reveal';
    this.ctx.storage.deleteAlarm();
  }

  advance() {
    const s = this.s;
    if (s.round + 1 >= s.tiers.length) {
      s.phase = 'final';
      for (const p of s.order) s.players[p].ready = false;
    } else {
      this.startRound();
    }
  }

  async checkTimer() {
    const r = this.s?.rounds[this.s.round];
    if (this.s?.phase === 'round' && r?.endsAt && Date.now() >= r.endsAt) this.endRound();
  }

  async alarm() {
    if (!this.s) return;
    await this.checkTimer();
    await this.save();
    this.broadcast();
  }

  view(pid) {
    const s = this.s;
    const connected = new Set(this.connectedPids());
    const players = s.order.map(p => ({ id: p, name: s.players[p].name, score: s.players[p].score, ready: s.players[p].ready, connected: connected.has(p), host: p === s.host }));
    const showAnswer = r => s.phase !== 'round' || r !== s.rounds[s.round];
    const rounds = s.rounds.map(r => {
      const open = showAnswer(r);
      const guesses = {};
      for (const p of s.order) {
        const g = r.guesses[p] || {};
        guesses[p] = open
          ? { pin: g.pin || null, km: g.km ?? null, pts: g.pts ?? 0, timedOut: !!g.timedOut }
          : { locked: !!g.locked, pin: p === pid ? g.pin || null : null };
      }
      return {
        tier: r.tier, startedAt: r.startedAt, endsAt: r.endsAt, guesses,
        pano: { id: r.loc.id, heading: r.loc.heading },
        answer: open ? { lat: r.loc.lat, lng: r.loc.lng, cc: r.loc.cc, label: r.loc.label } : null,
      };
    });
    return { t: 'state', now: Date.now(), you: pid, code: s.code, mode: s.mode, phase: s.phase, host: s.host, settings: s.settings, players, round: s.round, total: s.tiers?.length || s.settings.rounds, rounds };
  }

  broadcast() {
    if (!this.s) return;
    for (const [ws, pid] of this.socks) this.send(ws, this.view(pid));
  }
}
