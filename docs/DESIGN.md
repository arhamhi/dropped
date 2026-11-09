# Dropped design record

- **Palette:** `node oxfords/scripts/palette.mjs --brand "#FF3D7F" --support "#C6F432" --mode dark --ground near-black`.
  The tokens live at the top of `public/style.css`.
- **Colour jobs:** pink (`--lead`) = you and the main action, lime (`--support`) = your friend, teal (`--pop`) = the
  true location. You are always pink on your own screen.
- **Mode:** dark only. The street view is the picture, so the UI stays black and quiet around it.
- **Type:** Archivo variable. Expanded 125% black for scores, clock and headings, normal width for body text.
- **Radius:** 0 on broadcast graphics (scorebug, lower third, slate, buttons), 8 on the floating guess map.
- **Buttons:** 2px transparent border so they keep their shape in Windows High Contrast.
- **Map exceptions (Arham's call, 2026-11-09):** water `#1D3E5E`, land `#3E4247`, borders `#9AA0A6`. City labels
  from zoom 6 (big cities 5), towns 8, villages 10. Country names only on the reveal and full-time screens.
- **Projection:** globe on home, lobby and reveal. Flat mercator when a game's spots spread over more than 120° of
  longitude or 75° of latitude, so every round fits on one screen.
- **Signature:** the reveal. The map flies to the answer, lines draw from each guess, the lower third wipes in row
  by row and the points count up.
