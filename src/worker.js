// Dropped: Cloudflare Worker entry. Static files come from public/ (assets binding).
// /ws/<CODE> upgrades to a WebSocket handled by the Room Durable Object for that code.
export { Room } from './room.js';

const CODE_RE = /^[A-Z2-9]{5}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([A-Za-z0-9]+)$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!CODE_RE.test(code)) return new Response('Bad room code', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(request);
    }
    if (url.pathname === '/api/config') {
      // A Maps JavaScript API key is public by design (lock it to your domain in Google Cloud).
      // With one, Street View runs with road labels and the address box turned off. Without one, the free embed is used.
      return Response.json({ mapsKey: env.GOOGLE_MAPS_KEY || null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
