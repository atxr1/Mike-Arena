# Mike Arena: League Atelier visual overhaul

> **Status: merged and published in Mike Arena 2.0.0 (2026-11-11).** ChatGPT built this layer on the 1.1.0 source and
> could not push it. It was three-way merged onto the Combat 2.0 branch (nine changed files, no conflicts) and then
> adjusted in four places:
> 1. Portraits deploy as WebP copies (`inputs/visual-overhaul/portraits-web/`, made by `tools/visual_portraits.py`),
>    about a fifth of the PNG size. The PNG sources stay in `inputs/visual-overhaul/portraits/` and are not deployed.
>    Code references `assets/visual/portraits/<id>.webp`.
> 2. The Random arena card had a broken placeholder image.
> 3. `.mv br{display:none}` glued two lines of the pause-menu move list together; that list no longer uses `<br>`.
> 4. A block at the end of `src/ui/visual.css` themes the screens that did not exist in 1.1.0 (style rank, medals,
>    mastery, the wider result table) and removes the gold focus ring from scroll panels.
>
> The paintings were checked against every arena's collision shapes (play area, pillars, vents, portals): they are
> repaints of the existing layouts and line up. The rest of this file is ChatGPT's original handoff note; where it
> says "unpublished" or "1.1.0", the block above is the current state.

## Start here, Claude

This is a presentation-only branch based on source commit `2c9c3061d7c915eecd9081a9e5ffc4b0a6a498a0`. The original published build is `a004da8715022ea4e3951d3f5fd893e1a01bde3e`. GitHub rejected writes from the available connection, so nothing has been pushed or deployed. Review and import this branch in your authenticated environment. Do not overwrite newer work blindly.

The delivery ZIP contains `source/`, a complete `site/` build, and `visual-overhaul.bundle`. The bundle carries the visual branch and the original source ancestry. To import into an existing clone:

```sh
git fetch /absolute/path/visual-overhaul.bundle visual/anime-overhaul-2026-11-10:visual/anime-overhaul-2026-11-10
git switch visual/anime-overhaul-2026-11-10
```

If your source branch has advanced, merge or cherry-pick the visual commit onto a fresh branch and resolve presentation changes there. The original game version stays 1.1.0 because this is an unpublished visual branch.

## Build and run

The included `site/` is ready to serve over HTTP. Do not open index.html using file://. Copy that directory into the source checkout as `site/` before building if you need its existing runtime audio and sprites. Then run `bun tools/build.mjs`. This bundles JavaScript, concatenates the original CSS plus `src/ui/visual.css`, and copies `inputs/visual-overhaul/` into `site/assets/visual/`. Normal builds need no asset downloads. The original `--all` pipeline remains available but requires its upstream dependencies.

## What changed

- Painted title stadium, 12 painted battle maps, 12 optimized map previews.
- 53 transparent official character illustrations: all 42 fighters and 11 special forms. Sources are recorded in `portrait-sources.json`.
- 66 editable SVG assets: 34 general/environment symbols, 18 type medallions, six panel frames and eight effect overlays. Most are extension assets, not currently used by gameplay.
- Navy, ivory and gold menu system, character selection portraits, trainer team illustrations, arena cards, loading screens, results, bracket styling, settings, records and landscape spacing.
- HD HUD portraits and cinematic character cut-ins.
- Full-resolution map compositing under the original pixel animation layer. Camera coordinates, map dimensions, collision, movement and combat timing are unchanged. Missing HD battle assets fall back to the old renderer.

`inputs/visual-overhaul/gallery.html` is an offline visual catalog. `manifest.json` includes dimensions, hashes and integration status. `tokens.json` contains shared colors. `tools/visual_assets.py` regenerates the SVG library without modifying paintings or portraits.

## Modularity and art rules

Keep simulation files, content tables and input handling independent of this theme. Extend `src/ui/visual.css` for UI styling. Add paintings under `inputs/visual-overhaul/maps/` using existing map IDs. Map images normalize to the existing logical map size, so preserve the overhead composition and perimeter alignment. Never infer collision geometry from paintings. Keep central combat areas readable. Preview thumbnails are presentation derivatives, not extra arenas.

Add character PNGs under `portraits/` using exact sprite IDs. Preserve transparency. `Gfx.characterArt` handles HUD/cinematic artwork, while `Gfx.atlas` retains actual combat animation. The paintings were generated specifically for this visual pass. Official character artwork is from PokeAPI/sprites; original ownership and attribution remain with the respective rights holders. Existing trainer anime portraits and combat sprites retain their prior source credits.

The SVG effects are optional future presentation assets. They are not per-move animations and do not change attack timing, hitboxes or visibility rules. Preserve reduced-motion handling when integrating them.

## Restore safely

The separate `Mike-Arena-Before-Visual-Overhaul.bundle` was made before edits and contains full original repository history, including source and published-site backup refs. It does not contain player browser saves. No save format or storage key was changed.

Clone the backup into a NEW directory, leaving current work intact:

```sh
git clone -b backup/pre-visual-overhaul-2026-11-10-src /absolute/path/Mike-Arena-Before-Visual-Overhaul.bundle Mike-Arena-Restored
cd Mike-Arena-Restored
git log -1 --oneline
```

The restored source HEAD must be `2c9c3061d7c915eecd9081a9e5ffc4b0a6a498a0`. For the original published site, clone the same bundle with `-b backup/pre-visual-overhaul-2026-11-10-site` into a different directory. Its HEAD must be `a004da8715022ea4e3951d3f5fd893e1a01bde3e`.

## Validation and limits

- Build passes.
- Content validator passes: 192 moves, 42 species, 12 maps, 229 move runs.
- Original `src/game`, `src/content`, `src/core`, `src/data`, match, arcade and tournament logic compare byte-for-byte unchanged against the source baseline.
- Browser visual checks: title, main menu, format/fighter selection, loading and painted arena rendering. Compact landscape checked in an 844×390 CSS-pixel iframe.
- This is not a physical iPhone/Safari performance certification. Full touch-device, all-arena and long-session checks remain appropriate before release.
- Combat actors still use the existing pixel sprite animations. This pass upgrades scenery and presentation, not every animation frame into anime drawings.
