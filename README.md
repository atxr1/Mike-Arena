# Mike Arena

A Pokémon arena fighter. It started as the cinematic edition of Arena 1.0.1 (42 fighters, 12 arenas, a directing
camera, Ultimate cut-ins, knockout and victory shots). **2.0 rebuilt the fighting**: a free three-hit basic attack
on ✕, specials that chain out of any hit, knockdowns, Break, armour, counters, clashes and a heat gauge
(`docs/COMBAT.md`), under painted arenas and a navy, ivory and gold menu theme (`docs/VISUAL-HANDOFF.md`).
A real-time arena fighter in pixel art for iPhone (landscape Home Screen web app), desktop Safari and Chrome.
42 fighters, 12 arenas over ground, water and air, Pokémon Battles (1v1) and Trainer Battles (3v3, switching),
Quick Battle and Tournament (4, 8 or 16 entrants). Personal, non-commercial fan project.

Live: https://atxr1.github.io/Mike-Arena/ (the original Arena 1.0.1 stays at https://atxr1.github.io/Polish.-/)

## Build

Requirements: Bun, Python 3 with Pillow and NumPy, git, ffmpeg (audio step), zip. Playwright with Chromium for the tests.

```
bun tools/build.mjs --all        # fetch pinned sources → asset pipeline → site/ → mike-arena-src-<version>.zip
bun tools/build.mjs              # just re-bundle the code into site/ (fast)
cd site && python3 -m http.server 8078      # the tests use PORT (default 8078)
```

`tools/sources.json` pins every open-source input; `tools/fetch_sources.sh` clones them into `vendor/`.
The user-provided inputs (PSP build files, map paintings) live in `inputs/`.

## Checks

| Command | What it proves |
|---|---|
| `bun tools/validate.mjs` | every effect/sound/sprite reference exists, tier rules, and every move, Ultimate and Mega Ultimate of all 42 fighters runs to completion and connects in the real sim |
| `bun tools/replaycheck.mjs` | 24 CPU matches (every environment and format) replay to an identical final state, which Play of the Match depends on |
| `bun tools/shapelint.mjs` | the world renderer and effects use no vector shapes, gradients, blur or smoothing |
| `bun tools/harness.mjs --runs 300 --format both` | AI-vs-AI balance: win-rate spread, match-length medians, Ultimate timing, stamina per move, no stalls |
| `bun tests/serpent_metrics.mjs` | serpent speed, reversal time, turn radius, body length, coil timing |
| `node tests/contact.mjs` | contact sheets of every move of every fighter in each environment (`shots/contact/`) |
| `node tests/captures.mjs` | serpents, all traversals, every Mega/Primal sequence, all 12 maps mid-battle (`shots/captures/`) |
| `node tests/e2e.mjs` | Playwright at 844×390 and 932×430 with touch: every screen, all 12 mode combinations, touch, switching, pause, skips, tournament + reload + championship, save export/import, corrupt-save recovery |
| `node tests/cine.mjs [env fighter foe map]` | full-screen shots of a real match: VS card, establishing shot, Fight!, framing, Ultimate cut-in, K.O., victory, Play of the Match, results (`shots/cine/`) |
| `node tests/cine_trainer.mjs` | Trainer Battle: knockout, replacement send-out with the trainer's call |
| `bun tests/rules.mjs` | Combat 2.0 rules in the real sim: string, hold and tap, chain, armour, Ultimate armour, counter, clash, Break, heat, dash strike, knockdown and get-up, no infinite combos |
| `node tests/v20.mjs` | Combat 2.0 by hand through the touch hook: Training goals, the string, the chain window lighting up, knockdown, results with style rank, medals and mastery, Records (`shots/v20/`) |
| `node tests/combat.mjs` | captures of a Finisher, a long combo, counter hit, armour, clash, on fire, chains, Break and a dash strike in a real battle (`shots/combat/`) |
| `bun tools/feel.mjs --frames --strings --chains --pace` | frame data, basic strings, the chain matrix and pacing (match length, time split, combos, Ultimates per match) |
| `bun tools/bots.mjs` | five scripted players against Easy, Normal and Hard (difficulty acceptance test) |
| `bun tools/ults.mjs` | how much of a health bar each Ultimate takes |
| `node tests/v11.mjs` | Arcade (full run, reload and resume, scoring, rank), Training, Records, pause-menu move list, Cinematics setting, Surprise battle, Next opponent (`shots/v11/`) |
| `node tests/menus.mjs` | title, main menu (with the screen wipe), fighter and trainer select, loading card, VS card |
| `node tests/soak.mjs 10` | 10-minute soak: frame time, heap and particle growth |
| `bun tools/sizes.mjs` | first-load and worst-case per-match download sizes |

URL test hooks (used by the tests only): `?test` exposes the app as `window.__app`, `?autoplay` lets the CPU play
your side, `?speed=N` runs the simulation N× faster, `?lab=1` opens the capture lab.

## Layout

`src/core` fixed step, RNG, util · `src/game` simulation (sim, fighter, mechanics = move library, serpent,
traversal, features, ai, content) · `src/content` data (species, moves, maps, trainers, balance) ·
`src/render` pixel renderer and effects · `src/ui` HUD, touch, screens, glyphs · `src/modes` battle, match/replay,
tournament · `src/audio` · `src/saves` · `src/platform` input · `src/dev` lab · `tools` build and analysis ·
`tests` · `docs` STATUS, DECISIONS, CHANGELOG, CONTENT, CREDITS.
