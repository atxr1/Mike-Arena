# Changelog

## Mike Arena 1.0.0 — 2026-10-14 — cinematic edition

Built from Arena 1.0.1 (kept unchanged at https://atxr1.github.io/Polish.-/). The simulation, content and balance
are identical; everything below is presentation.

- **Directing camera:** moves one pixel-scale step closer whenever both fighters fit between the HUD bands (bigger
  sprites, tighter action) and pulls back when they separate; punch-ins on Ultimates, Mega Evolution, knockouts,
  send-outs and perfect dodges; a zoom kick on heavy hits. At rest the scale is always a whole number, so pixels stay crisp.
- **Match intro:** the VS card (speed streaks, a flash and a jolt as VS lands, team sprites or type chips) cuts to an
  establishing shot that drifts across the arena under its title card, then the send-outs and a Fight! stamp.
- **Ultimates and Mega Evolution:** the action holds for a moment while a cut-in band crosses the screen with the
  Pokémon's portrait and the move's name, the arena falls into shadow, the music muffles under a riser.
- **Hits:** anime impact frames (the picture inverts for a frame or two on Ultimate and super-effective hits, never
  more than once every 1.5 s), impact stars, debris coloured like the ground under the hit, droplets on water, shock
  rings, a type-coloured flash, charge auras on Signature moves and Ultimates, afterimages when someone is sent flying,
  footwork dust and wind streaks.
- **Knockouts:** the deciding hit holds the frame, a gold shockwave and a K.O. stamp land over the fallen fighter in
  letterbox; the winner gets a closing shot and a lower third with their portrait. Mid-match knockouts and send-outs
  get their own camera beat, and trainers call their Pokémon in and out.
- **Atmosphere:** a light colour grade per arena, a vignette that pulses red when you're low on HP, camera flashes in
  the Indigo Plateau stands, Overtime and Sudden-death stamps, Play of the Match in letterbox with replay chrome.
- **Sound:** synthesized boom, stamp and riser hits; the music muffles under cut-ins and the deciding knockout.
- **Menus:** a sweeping wipe between screens, a slow push on the title art with a sheen across the new wordmark, the
  main menu arrives in one staggered sweep, base-stat bars and a type-coloured glow on the fighter preview, a loading
  card painted with the arena itself, a results screen with a spotlight on the winner, rows that arrive one by one,
  damage that counts up and an MVP star.
- **Its own app:** named Mike Arena on the Home Screen, with its own saves (copied once from Arena on first launch) and
  its own offline cache, so both games live side by side.
- "Reduce motion and flashes" (Settings) turns off impact frames, softens camera kicks and stills the menu animations.

## 1.0.1 — 2026-10-14

- **Lumiose Skyline** now uses the full city image (the original file was cut off, so the map had been painted in code). Prism Tower sits at the centre, where its beacon sweeps from.
- **Serpent tails:** Gyarados and Milotic use the tail fins from the ChatGPT sheets; the bodies stay drawn in code (the sheet pieces looked like separate beads) and the heads stay the real sprites.
- **Build fixes:** the serpent-sheet tool cut off the last piece of each sheet; maps that aren't clean pixel art are snapped to the set's 3×3 pixels and 40 colours.

## 1.0.0 — 2026-10-13 — browser edition

The PSP homebrew becomes a static web app for iPhone (Home Screen, landscape), Safari and Chrome.

- **Roster:** 42 fighters (23 ground, 8 water, 13 air; Charizard and Greninja in two environments), 168 moves plus Ultimates, 8 Mega/Primal forms with their own Ultimates, Deoxys formes, roles (Tank, Bruiser, Skirmisher, Zoner, Sustain).
- **Combat:** fixed 60 Hz deterministic sim; stamina with move tiers instead of most cooldowns; dodge roll with perfect dodges; clashes; type chart compressed for real time; statuses; wall slams; hit-stop, shake, speed lines; stun decay with Breakout; juggle limits.
- **Environments:** ground footwork with obstacles, water gliding with waterlines and sinking faints, air flight on a raised plane with drifting clouds; 19 unique traversals on R; three serpents (Gyarados, Milotic, Rayquaza) with path-following bodies that coil to attack.
- **12 arenas**, 4 per environment, each (except Indigo Plateau) with an interactive feature: Bell Tower bell, Mt. Chimney vents, Spear Pillar rifts, Cerulean inlets, Whirl Islands whirlpool, Sootopolis rain, Azure Bay waves, Kanto Skies wind lanes, Sky Pillar updrafts, Dragonspiral snow gusts, Lumiose beacon.
- **Modes:** Quick Battle and Tournament (4/8/16, saved after every match, resumable, championship screen) for Pokémon Battles (1v1, 99 s) and Trainer Battles (3v3 with switching, 4 min) in every environment; 11 trainers with teams for every environment; CPU Easy/Normal/Hard.
- **Fun systems:** Ultimate meter → Mega Evolution, Double Stamina overtime and sudden death, emotes with PMD portraits, Play of the Match replay.
- **Presentation:** everything in the world is pixel art at one texel per world unit with integer upscaling; PMDO particle, beam and weather sheets with type palette swaps; authored pixel sprites for telegraphs, shields, waves, meteors and more; full faint sequence (the PSP sprites' faint poses fill in for the 35 species SpriteCollab has no Faint for; a fainted Mega or Primal reverts to its base form); broadcast-style HUD; PlayStation button glyphs; touch controls with floating stick.
- **Audio:** PMDO battle sounds, the PSP build's sound effects, looping PMD music, ambience, low-HP beep; works with the silent switch on (audioSession playback).
- **Saves:** checksummed, versioned, backed up, recoverable; export/import code.
- **Offline:** service worker caches what you've played.
- **Balance:** AI-vs-AI tuning per environment with HP multipliers held to 0.8–1.25 so roles keep their shape; buffs and heal-over-time moves can no longer be kept up permanently.
- **Fixes found by the new checks before release:** instant area attacks never connected; single-pulse beams missed at range; pause → Settings left the game stuck paused; the championship screen's button did nothing; touch had no way to go back from menus; quick taps could be dropped; long CPU stun loops; pellet sprays stun-locked foes and cancelled every incoming attack; Dragon Dance, Swords Dance, Calm Mind, Coil and Aqua Ring lasted longer than their cooldowns; the save backup now keeps the previous copy as the brief asks; the effect caches no longer grow over a long session; the asset build no longer depended on files outside the source zip; Play of the Match replays diverged (raw stick values were simulated but rounded ones recorded, and the CPU picked replacements outside its inputs), so it was silently skipped; switching Pokémon in Trainer Battles could throw; the results screen could be replaced by the main menu when Play of the Match was skipped; Start pressed after the deciding knockout opened Pause, where Quit or Forfeit threw the result away (it now skips, and a pause at that point only offers Skip to results); Ho-Oh could revive teammates on every Ultimate.
