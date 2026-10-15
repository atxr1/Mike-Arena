# Status — handoff for the next update session

**Mike Arena 1.0.0 (2026-10-14).** The cinematic edition, published to https://atxr1.github.io/Mike-Arena/ from
`main` of `atxr1/Mike-Arena`; source on that repository's `src` branch and in `mike-arena-src-1.0.0.zip`.
It is built from Arena 1.0.1, which stays frozen at https://atxr1.github.io/Polish.-/ (`atxr1/Polish.-`, branches
`release-1.0.1` and `release-1.0.1-src`). Gameplay code is shared and identical; only presentation differs.

## Start here
1. `git clone -b src https://github.com/atxr1/Mike-Arena mike-arena && cd mike-arena` (or unzip the source zip).
2. `bun tools/build.mjs --all` — fetches the pinned sources (tools/sources.json), rebuilds every asset into `site/`, writes the zip.
3. `cd site && python3 -m http.server 8078`, open `http://localhost:8078/` (`?lab=1` for the capture lab; tests read `PORT`).
4. Before shipping a change: `bun tools/validate.mjs && bun tools/replaycheck.mjs && bun tools/shapelint.mjs && node tests/e2e.mjs`; for balance changes `bun tools/harness.mjs --runs 300 --format both` (and `bun tools/tune.mjs` to re-even win rates).
5. Publish: copy `site/` to the root of `main` (keep `.nojekyll`), push, then load the live URL and check the version stamp in `app.js?v=`.

## Where things are
- Content data: `src/content/` (species, moves, maps, trainers, balance multipliers). How to add content: `docs/CONTENT.md`.
- Simulation: `src/game/` (sim, fighter, mechanics = the move library, serpent, traversal, features, ai).
- Rendering: `src/render/` (world, fx, gfx loader, authored pixel art, serpent art). HUD and menus: `src/ui/`.
- Cinematics: `src/ui/cinema.js` (the director: camera, holds, letterbox, cut-ins, stamps, lower thirds) and its hooks in `src/modes/battle.js` `render()` / `frame()`.
- Tests and captures write to `shots/` (contact sheets, captures, e2e screenshots, soak report).

## Last verification (2026-10-14, Mike Arena 1.0.0)
- `src/game/`, `src/content/` and `src/modes/match.js` are byte-identical to Arena 1.0.1 (checked with `diff -r`), so
  the balance figures below carry over unchanged.
- Content validator: every reference resolves; all 229 move/Ultimate/Mega-Ultimate runs complete and connect; no buff or heal-over-time outlasts its cooldown.
- Replay determinism: 36/36 CPU matches (every environment and format) replay to identical end states (`tools/replaycheck.mjs`).
- Shape lint: 0 violations (cinematic overlays are vector UI; rings, debris and impact stars are authored pixel shapes).
- Playwright e2e at 844×390 and 932×430 with touch, all checks passing, including a real Play of the Match, pausing
  during the establishing shot, and corrupt-save recovery under the `mikearena.` namespace.
- 10-minute soak on the final build: frame average 1.38 ms, worst p95 5.1 ms, heap 6.0 → 10.9 MB, no page errors.
- Cinematic captures reviewed (`tests/cine.mjs`, `tests/cine_trainer.mjs`, `tests/menus.mjs`): VS card, establishing
  shot, Fight!, close-camera gameplay, Ultimate cut-in, K.O. stamp, victory lower third and results in ground, water and
  air; trainer send-out calls; every menu screen. Contact sheets (45) and the capture suite ran without errors.
- An independent review of the cinematic code; its findings (faded controls blocking taps, Mega skip leaving the cut-in
  up, the establishing shot not pausing in portrait, time-win wording) are fixed.

Carried over from Arena 1.0.1 (same simulation):
- Balance (`tools/harness.mjs`, Normal vs Normal, 0 errors, 0 stalls):
  - Pokémon Battles, 1,100 matches per environment (balanced round-robin): medians ground 53.7 s, water 59.1 s, air 51.2 s; every fighter 41–56 %; first Ultimate at ~51–53 s.
  - Trainer Battles, 600 matches per environment: medians ground 2.9 min, water 3.1 min, air 2.8 min.
- Captures reviewed: contact sheets for every move, serpents, traversals, Mega sequences, faint sequences, all 12 maps.

## Known limits / next steps
- **Serpent bodies** are drawn in code as one continuous body, with the real SpriteCollab heads. The user's ChatGPT sheets (`inputs/serpents/`, processed by `python3 -I tools/serpent_sheets.py`) were reviewed on 2026-10-14: their body pieces drew as separate beads and the heads don't match the sprites, so only the Gyarados and Milotic tail fins ship (`inputs/serpents/use.json`). ChatGPT's image tool refused Gyarados and Rayquaza (it drew those with code), so better sheets are unlikely from it.
- **Missing Mega sprites** in SpriteCollab (Venusaur, Blastoise, Gyarados, Scizor, Sceptile, Blaziken, Salamence, Metagross, Garchomp): those fighters use Ultimate moves instead of Mega Evolution. New sprite sheets from ChatGPT could add them (`species.js` → `mega`).
- Headless Chromium can't decode AAC, so automated runs are silent; sound must be checked on a real device.
- **Trainer team strength varies.** Each fighter is balanced 1v1, but whole teams differ: in Trainer Battles, team win rates range about 24–76 % (ground), 29–68 % (water) and 20–87 % (air; Nurse Joy's Ho-Oh/Latias/Articuno team is strongest, Paul's weakest). A per-team handicap or team edits are the next step if that matters.
- **Deoxys formes** have no faint pose of their own (no PSP sprite); they use Sleep.
- Only the user can verify on the iPhone: Home Screen install, landscape layout, sound with the silent switch on, touch feel, frame rate, save persistence.
