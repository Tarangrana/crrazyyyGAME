# Forgotten Acorns

*A squirrel's year in four seasons. Every acorn you forget becomes a tree.*

ThunderHacks 2026 · Algoma Game Jam · Theme: **Four Seasons**

## Play it

No install or build step, and no internet connection needed.

- **Double-click `index.html`.** It runs in any modern browser with WebGL (Chrome, Edge, Firefox, Safari) on desktop, Android or iOS.
- **First time?** Pressing Play starts a one-minute guided tutorial. You can skip it, or replay it from the title screen.
- Or serve the folder with `python3 -m http.server` and open `http://localhost:8000`.
- To host it, push the folder to GitHub Pages, itch.io (HTML game) or Netlify. It's all static files.

| Action | Keyboard (remappable) | Gamepad | Touch |
|---|---|---|---|
| Move | ← → / A D | stick / d-pad | ◀ ▶ |
| Jump / swim | ↑ / W / Space | A | ▲ |
| Bury (Fall) / dig up and eat (Winter) | ↓ / S / E | X or B | ▼ |
| Pause | Esc / P | Start | II |

There are only three things to do: move, jump, bury/dig. You eat automatically. A line at the top of the screen always says what the current season wants from you.

## The idea

Real squirrels bury thousands of acorns and forget most of them. Those forgotten acorns plant oak forests.

1. **Fall:** acorns drop from the oaks. Grab them (your cheeks hold 5) and press ↓ to bury them.
2. **Winter:** nothing grows. Walk to your buried acorns (they poke out of the snow, and an arrow points to the nearest one) and press ↓ to dig one up and eat it.
3. **Spring:** every acorn you *didn't* dig up sprouts into a sapling.
4. **Summer:** eat berries. When a red ring appears under you, a hawk is about to dive, so stand under a tree. Saplings grow, and next **Fall** they drop acorns too.

So every winter you choose between eating an acorn now and letting it become a tree that feeds you next year. Keep the food bar from emptying and **survive three winters** to win, then keep going in endless mode if you like. A full game takes about 5 minutes.

## How the seasons change the rules

| | Food | Danger | Ground |
|---|---|---|---|
| **Spring** | mushrooms after the rain, a few berries | nothing, so it's a breather | the stream floods, so you swim |
| **Summer** | berries everywhere | hawks (hide under a tree); the sun makes you a little hungrier | the stream dries up |
| **Fall** | acorns fall from every grown oak | wind gusts push you | the stream is shallow |
| **Winter** | only what you buried | you get hungry faster | snow slows you, the stream freezes into slippery ice, and the ground is frozen so you can dig but not bury |

The changes between seasons are part of the game: geese honk a few seconds before winter, the first snow covers acorns you left on the ground, and the spring thaw turns buried acorns into saplings (only where there's room, so where you bury matters).

## Judging checklist

- **Playable loop:** a clear goal (3 snowflakes = 3 winters survived), a way to lose (hunger hits zero), a score, a win screen, endless mode and a best-score record.
- **Theme in the mechanics:** all four seasons play differently, choices in Fall carry into Winter and the next year, the yearly cycle has to be planned around, and movement and visibility change with the weather.
- **Consistent art & audio:** a **low-poly 3D diorama** with every model built in code: jittered, flat-shaded icosahedron foliage, faceted hills, pines, a hollow-stump den, the squirrel, hawk and jays. It has real lighting and shadows. Each season has its own palette and light that blend at the change, and winter nights are lit only by the den's fire and a glow around the squirrel. All music and sound effects are synthesized live with the Web Audio API. Each season has its own generative score and ambience (spring rain and birds, summer cicadas, fall breeze, winter wind).
- **Runs on site:** plain HTML/JS with no dependencies, no network and no build. It also works offline from a USB stick.
- **Bonus: all four seasons play differently.** See the table above.
- **Bonus: season changes are gameplay.** Geese warning, first snow, spring sprouting, fall maturing.
- **Bonus: art and audio made during the event.** 100% of the art and sound is procedural code written for this game.
- **Bonus: accessibility:** only three controls, remappable, a colour-blind friendly mode (blue/orange cues plus shape markers on berries and hazards), Easy/Normal/Hard difficulty, reduce motion, picture hints on/off, separate music and sound volumes, gamepad and touch support.
- **Bonus: tutorial.** An 8-step guided first year (about a minute): move, jump, grab acorns, bury them, dig one up in winter, watch the rest sprout in spring, hide from a hawk. Each step waits until you actually do it, and a yellow arrow shows where to go. After that, a goal line and small picture bubbles keep reminding you what to do.

## Project layout

```
index.html        page, menus, touch controls
css/style.css     menu styling
vendor/three.min.js  three.js r128 (bundled so the game runs offline)
js/art.js         constants, palettes, 2D icons for the HUD and menus
js/audio.js       Web Audio synth: generative music, ambience, SFX
js/input.js       settings storage, remappable keyboard, gamepad, touch
js/sim.js         simulation: seasons, needs, caches, sprouting, creatures
js/world3d.js     low-poly 3D renderer: models, lighting, fog, particles
js/hud.js         2D overlay: needs bars, season wheel, hints, banners
js/tutorial.js    the guided first year
js/main.js        menus, settings UI, layout, game loop
```

## Credits & third-party assets

- Design, code, art and audio: made by the team during the jam.
- **three.js r128** (MIT license, © three.js authors) for 3D rendering, bundled in `vendor/` with its license. It's the only third-party code.
- No third-party art, sound or fonts. Every model, icon, sound and piece of music is generated by our code. Fonts are the system font stack (Trebuchet MS / Segoe UI / system-ui).
- Built with three.js (WebGL), HTML5 Canvas 2D for the HUD, and the Web Audio API.
- Development help: Claude Code (AI coding assistant).
