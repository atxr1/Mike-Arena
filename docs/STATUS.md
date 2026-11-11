# Status — handoff for the next update session

**Mike Arena 2.0.0 (2026-11-11).** Combat 2.0 plus the League Atelier visual layer (see `docs/CHANGELOG.md`,
`docs/COMBAT.md`, `docs/VISUAL-HANDOFF.md`), published to https://atxr1.github.io/Mike-Arena/ from `main` of
`atxr1/Mike-Arena`; source on that repository's `src` branch and in `mike-arena-src-2.0.0.zip`. Checkpoints:
`release-2.0.0` / `release-2.0.0-src` (and `release-1.1.0` / `release-1.1.0-src` for the previous version).
The original Arena 1.0.1 stays frozen at https://atxr1.github.io/Polish.-/ (`atxr1/Polish.-`, branches
`release-1.0.1` and `release-1.0.1-src`). **From 2.0 the simulation is no longer shared with it.**

## Start here
1. `git clone -b src https://github.com/atxr1/Mike-Arena mike-arena && cd mike-arena` (or unzip the source zip).
2. `bun tools/build.mjs --all` — fetches the pinned sources (tools/sources.json), rebuilds every asset into `site/`, writes the zip.
3. `cd site && python3 -m http.server 8078`, open `http://localhost:8078/` (`?lab=1` for the capture lab; tests read `PORT`).
4. Before shipping a change: `bun tools/validate.mjs && bun tests/rules.mjs && bun tools/replaycheck.mjs && bun tools/shapelint.mjs && node tests/e2e.mjs && node tests/v20.mjs`; after any change to combat or the CPU also `bun tools/bots.mjs` (compare with the table below); for balance changes `bun tools/harness.mjs --runs 300 --format both` (and `bun tools/tune.mjs` to re-even win rates).
5. Publish: copy `site/` to the root of `main` (keep `.nojekyll`), push, then load the live URL and check the version stamp in `app.js?v=`.

## Where things are
- Content data: `src/content/` (species, moves, maps, trainers, balance multipliers). How to add content: `docs/CONTENT.md`.
- Simulation: `src/game/` (sim, fighter, mechanics = the move library, serpent, traversal, features, ai). **Every Combat 2.0 number is in `src/game/combat.js`.**
- Visual layer: `inputs/visual-overhaul/` (paintings, portraits, icons, tokens), `src/ui/visual.css` (the theme, appended to the base stylesheet by the build), `Gfx.paintings` / `Gfx.characterArt` and `World.drawScenery`.
- Rendering: `src/render/` (world, fx, gfx loader, authored pixel art, serpent art). HUD and menus: `src/ui/`.
- Cinematics: `src/ui/cinema.js` (the director: camera, holds, letterbox, cut-ins, stamps, lower thirds) and its hooks in `src/modes/battle.js` `render()` / `frame()`.
- Tests and captures write to `shots/` (contact sheets, captures, e2e screenshots, soak report).

## Last verification (2026-11-11, Mike Arena 2.0.0)
- `bun tests/rules.mjs`: 35 rule checks in the real simulation, all pass. Validator (191 moves, 42 species, 12 maps,
  229 move runs), replay determinism (36/36) and shape lint (0) pass.
- `node tests/v20.mjs` (new): Training goals, the string by hand, the chain window lighting up, knockdown, results
  with style rank, medals and mastery, Records. `node tests/v11.mjs` and `tests/e2e.mjs` at 844×390 and 932×430 pass
  on the merged build. Screens reviewed at 844×390: title, menus, fighter and trainer select, arenas, VS, battle,
  pause, results, records, controls.
- Pacing (`tools/feel.mjs --pace`, Normal vs Normal): ground 45 s, air 47 s, water 41 s; 1.3 Ultimates per fighter per
  battle; 1.8–3.3 lead changes; 33–48 % of battles won under 30 % health; Ultimates are 13–15 % of all damage.
- Balance (`tools/harness.mjs --runs 900 --format pokemon`): medians 47.5 / 42.5 / 45.3 s (ground / water / air), 0
  errors, 0 stalls; every fighter 39–57 %. Trainer Battles: medians 2.0 / 2.3 / 2.2 min; trainer teams
  (`tools/tune_teams.mjs`, 100–160 battles per team) ground 47–54 %, water 42–59 %, air 43–59 %.
- Soak (`node tests/soak.mjs 4`, painted arenas on): frame average 1.9 ms, worst p95 5.5 ms, heap 7 → 12 MB, no errors.
- Ultimates (`tools/ults.mjs`): mean 11.8 % of the target's health per use, 90th percentile 25.8 %, cap 34 %; 21 % miss.
- Chain matrix (`tools/feel.mjs --chains`): 182 of 218 connect.
- Difficulty (`tools/bots.mjs`, 46 battles per cell, bot win %; ground / air / water):

  | Bot | Easy | Normal | Hard |
  |---|---|---|---|
  | masher (holds ✕) | 96 / 83 / 96 | 24 / 26 / 2 | 15 / 17 / 4 |
  | novice (random buttons) | 87 / 87 / 89 | 28 / 28 / 35 | 17 / 24 / 24 |
  | masherPlus (chains every hit) | 96 / 98 / 100 | 70 / 63 / 63 | 59 / 59 / 57 |
  | runner (keeps away, pokes) | 39 / 35 / 65 | 11 / 17 / 7 | 11 / 17 / 11 |
  | solid (chains, dodges, Break) | 98 / 98 / 100 | 72 / 72 / 70 | 57 / 67 / 70 |

- Not checked: feel, sound and frame rate on a real iPhone.

## Last verification (2026-11-09, Mike Arena 1.1.0)
- `node tests/v11.mjs` (new): main menu, Records, a full six-stage Arcade run with a reload and resume in the middle,
  scored results and the rank screen, Training (never ends, clock stopped, HP refills, opponent switched to fight
  back, records untouched), the pause-menu move list, Cinematics Off with Skip intro through a whole battle, Surprise
  battle and Next opponent. All checks pass, no page errors; screenshots in `shots/v11/` reviewed at 844×390.
- `tests/e2e.mjs` at 844×390 and 932×430: all checks pass. Validator, replay determinism (36/36) and shape lint (0) pass.
- Trainer teams (`tools/tune_teams.mjs`, final check of 200 battles per team per environment): ground 41–56 %,
  water 42–58 %, air 44–56 %. An independent run of `tools/harness.mjs` (about 80 battles per team, so noisier) gave 39–62 %.
- Pokémon Battles are unchanged from 1.0.0: the training rule and the passive `dummy` CPU level are off unless a
  match asks for them, and the team table only applies to Trainer Battles.

## Earlier verification (2026-10-14, Mike Arena 1.0.0)
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
- **Trainer teams** are evened out with a per-team multiplier (`src/content/teambalance.js`). After changing a team or a fighter's balance, re-run `bun tools/tune_teams.mjs --env <env> --rounds 4 --seeds 6 --out x.json` for each environment and `bun tools/write_teams.mjs x.json …`.
- **Arcade ranks** (`arcadeRank` in `src/modes/arcade.js`) are a first guess at thresholds; adjust once real scores are known.
- **Hard CPU** loses 57–70 % to the scripted players that chain every hit. Next steps that the traces point to: swat
  or dodge ranged basic pokes while approaching, stop whiffing dash strikes into a punish, and bait the wake-up jab.
- **Meowth and Weezing** sit at the bottom of the ground table and want kit changes, not bigger multipliers.
- **36 chains** (charge moves, lobs, out-of-range dashes) still miss a target that is getting up; either let a chain
  that is already in flight through the get-up protection or leave it as route knowledge.
- **Visual layer extras** not used yet: 34 symbols, 18 type medallions, 6 panel frames and 8 effect overlays in
  `inputs/visual-overhaul/` (see its `manifest.json` for integration status).
- The backlog in `docs/IMPROVEMENTS.md` is done except where it says otherwise at its top.
- **Deoxys formes** have no faint pose of their own (no PSP sprite); they use Sleep.
- Only the user can verify on the iPhone: Home Screen install, landscape layout, sound with the silent switch on, touch feel, frame rate, save persistence.
