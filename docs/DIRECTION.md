# Dropped: direction

Brief (from Arham, 2026-11-09): a geo-guessing game for him and one friend, realtime, plus a solo mode.
Feel: competitive and loud. Host picks timer, difficulty (easy / medium / hard / mixed), rounds and camera before each game.
Original identity. Same genre as GeoGuessr, none of its name, look, maps or art.

Reading this as: a two-player match game for friends on laptops (phone works), played in the evening in short bursts,
so dark, roomy over the street view, dense only in the scorebug.

## Category default refused
Geo games share: a purple/navy brand, rounded bubbly buttons, a yellow accent, a small map in the corner with a big
"Guess" button. Slop faces at risk: the Dark Dev Tool (zinc greys, stat strip) and the board rut (split-flap). Refused.

## Explorations (explore/a,b,c.html, shots/explore-*)
- A. Dropped is a live sports broadcast. Scorebug, wipes, lower thirds. Archivo expanded, near-black + hot pink + lime. WON.
- B. Dropped is a coin-op cabinet. Bungee, bevels, orange. Lost: the bevels are a costume and the boxed frame shrinks the street view.
- C. Dropped is a passport being stamped. Zilla Slab on paper, teal. Lost: calm, and a split screen halves the view. Wrong for loud.

History row: app|media|colour-field|expanded|pink|photo|canvas

## Tokens
- Colour: `node oxfords/scripts/palette.mjs --brand "#FF3D7F" --support "#C6F432" --mode dark --ground near-black`.
  Lead pink = you / the primary action. Support lime = the opponent. Pop teal = the true location. Neutrals everywhere else.
- Type: Archivo only (variable width axis). Expanded 125% black for scores, clock and headings (broadcast graphics),
  100% for UI text. Scale: 13 / 15 / 18 / 24 / 36 / 64, plus one hero wordmark.
- Radius: 0 on broadcast graphics (scorebug, lower thirds, buttons), 8 on floating map panel.
- Spacing: 4 / 8 / 12 / 16 / 24 / 40.

## Grammar (app shell: canvas)
Home (globe + name + play solo / challenge a friend / join code) -> Lobby (settings, invite link, players) ->
Round (street view full bleed, scorebug top-left, guess map bottom-right) -> Reveal (map fills screen, lower third) -> Final.

## Signature
The reveal: the scorebug wipes out, the map flies to frame the answer and both pins, a line draws from each guess to
the answer, distances and points count up in the lower third, the round winner's bar wipes in. 900ms total, ease-out.
Reduced motion: no fly or draw, the final frame appears with a 150ms fade.

## Voice
Short, sports-commentary plain. "Bilal locked in. 15 seconds." "You were 412 km off." No exclamation marks.
