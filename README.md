# Forgotten Acorns

*A squirrel's year in four seasons. Every acorn you forget becomes a tree.*

ThunderHacks 2026 · Algoma Game Jam · Theme: **Four Seasons**

## Play it

No install or build step, and no internet connection needed.

- **Double-click `index.html`.** It runs in any modern browser (Chrome, Edge, Firefox, Safari) on desktop, Android or iOS.
- Or serve the folder with `python3 -m http.server` and open `http://localhost:8000`.
- To host it, push the folder to GitHub Pages, itch.io (HTML game) or Netlify. It's all static files.

| Action | Keyboard (remappable) | Gamepad | Touch |
|---|---|---|---|
| Move | ← → / A D | stick / d-pad | ◀ ▶ |
| Jump / swim | ↑ / W / Space | A | ▲ |
| Bury / dig up | ↓ / S | X | ▼ |
| Eat a carried acorn | E | B | acorn button |
| Sniff for buried caches | Q | Y | nose button |
| Pause | Esc / P | Start | II |

## The idea

Real squirrels bury thousands of acorns and forget most of them. Those forgotten acorns plant oak forests.

That's the whole game:

1. **Fall:** oaks drop acorns. Your cheeks hold 3, so you bury the rest wherever you like.
2. **Winter:** nothing grows and snow hides every cache. You're cold and hungry, so you have to remember where you buried things (or sniff for them) and dig them up to eat.
3. **Spring:** every cache you *didn't* dig up sprouts into a sapling.
4. **Summer:** saplings grow. By next **Fall** they are oaks that drop acorns, give shade from the summer sun, and give cover from hawks.

So every winter you face the same choice: **eat it now, or let it become the forest that feeds you next year.** Survive **three winters** to win, then keep going in endless mode if you like.

## How the seasons change the rules

| | Resources | Hazards | Movement / visibility | What you can do |
|---|---|---|---|---|
| **Spring** | mushrooms after the rain, a few berries | hawks (hide under leaves or in the den) | the stream floods, so you have to swim and paddle | forgotten caches sprout |
| **Summer** | berries everywhere | hawks hunt more often; **unshaded sun makes you hungry 1.5× faster** | the stream bed is dry and you can walk across | saplings grow |
| **Fall** | acorns fall from every mature oak | **blue jays** raid any cache they can see, so chase them off; wind gusts push you | the stream is shallow and slows you | cheeks hold 3, bury the rest |
| **Winter** | nothing grows | cold drains warmth, and at zero warmth hunger drains 2.4× faster; blizzards; each winter is longer and harsher | deep snow slows you; dark, short sight range; the stream freezes into **slippery ice** | the ground is **frozen**, so you can only dig up, not bury. Caches are **invisible** unless you sniff. Warm up in the den |

Season changes are part of the gameplay:
- **Geese fly south** and honk a few seconds before winter. That's your last chance to bury.
- **First snow** buries any acorn still lying on the ground, and you lose it.
- **Spring thaw** turns caches into saplings, but only where there's room (not next to another tree, the den or the stream). Where you bury matters.
- **Fall** promotes saplings to acorn-dropping oaks, so the more you left behind, the more food there is.
- The season wheel at the top of the screen always shows how far you are through the year.

## Judging checklist

- **Playable loop:** a clear goal (3 snowflakes = 3 winters survived), a way to lose (hunger hits zero), a score, a win screen, endless mode and a best-score record.
- **Theme in the mechanics:** all four seasons play differently, choices in Fall carry into Winter and the next year, the yearly cycle has to be planned around, and movement and visibility change with the weather.
- **Consistent art & audio:** every sprite is drawn in code in one flat, outlined, storybook style with one palette per season that blends smoothly at each change. All music and sound effects are synthesized live with the Web Audio API. Each season has its own generative score and ambience (spring rain and birds, summer cicadas, fall breeze, winter wind).
- **Runs on site:** plain HTML/JS with no dependencies, no network and no build. It also works offline from a USB stick.
- **Bonus: all four seasons play differently.** See the table above.
- **Bonus: season changes are gameplay.** Geese warning, first snow, spring sprouting, fall maturing.
- **Bonus: art and audio made during the event.** 100% of the art and sound is procedural code written for this game.
- **Bonus: accessibility:** remappable controls, a colour-blind friendly mode (blue/orange cues plus shape markers on berries and hazards), Easy/Normal/Hard difficulty, reduce motion, picture hints on/off, separate music and sound volumes, gamepad and touch support.
- **Bonus: wordless tutorial.** The first acorn drops right in front of you, and picture bubbles with key caps teach move, bury, eat, sniff, hiding from hawks and going home to warm up, each shown at the moment it's needed.

## Project layout

```
index.html        page, menus, touch controls
css/style.css     menu styling
js/art.js         constants, palettes, all sprite/icon drawing
js/audio.js       Web Audio synth: generative music, ambience, SFX
js/input.js       settings storage, remappable keyboard, gamepad, touch
js/game.js        world simulation, seasons, creatures, renderer, HUD
js/main.js        menus, settings UI, game loop
```

## Credits & third-party assets

- Design, code, art and audio: made by the team during the jam.
- **No third-party assets, libraries, fonts or tools are used at runtime.** Fonts are the system font stack (Trebuchet MS / Segoe UI / system-ui).
- Built with plain HTML5 Canvas 2D and the Web Audio API.
- Development help: Claude Code (AI coding assistant).
