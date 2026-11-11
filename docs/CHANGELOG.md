# Changelog

## Mike Arena 2.0.0 — 2026-11-11 — Combat 2.0 and the League Atelier look

The fighting itself was rebuilt, and ChatGPT's visual overhaul was merged on top. No new modes: the whole release is
about what happens between "Fight!" and the knockout. Full rules in `docs/COMBAT.md`, the reasons in
`docs/DECISIONS.md`.

**How it plays now**
- **✕ is a free basic attack** for every Pokémon: a three-hit string, tap or hold, no stamina, no cooldown. The
  third hit is a Finisher. □ △ ○ are the specials (stamina and cooldown as before), R is the dodge or movement
  ability, L is the Ultimate.
- **Chains.** The moment any hit lands, the special buttons light up: press a different special, or L with a full
  ring, to cancel straight into it. That is the combo system, for melee and ranged fighters alike.
- **Knockdown.** A Finisher, an Ultimate, a wall slam or a four-attack combo knocks the target down. It gets up
  flickering, cannot be hit, and gets the next move. Fights are a series of exchanges, not one long slugfest.
- **Break** (R after three hits of a combo, 35 stamina), **armour** (heavy and signature moves shrug off basic hits
  while they start up), **Counter** and **Punish** bonuses, **clashes**, **dash strikes** (✕ out of a dodge), a
  **heat gauge** that sets a fighter **on fire**, and perfect dodges that give stamina back.
- **Ultimates matter.** They fill about 1.7× as fast, cannot be interrupted, and a clean hit takes a quarter to a
  third of a health bar (it was about 5 % on average). Rain-type Ultimates chase the target.
- **After the battle:** a style rank from D to S, up to four medals for what you actually did, and mastery levels per
  Pokémon (shown on the select screen and in Records).
- **Training has goals** that teach the string, chains, dash strikes, Break and the rest one at a time.
- **The CPU was rewritten for all of it.** Easy rests between sequences and rarely chains; Hard chains nearly every
  hit, jabs first up close, side-steps approaches and takes its turn after a knockdown. Difficulty never changes
  stats.

**The look (ChatGPT's "League Atelier" pass, merged)**
- Painted title stadium and twelve high-resolution arena paintings, drawn under the pixel fighters. They are
  repaints of the existing arenas and were checked against every arena's walls, pillars and hazards.
- Official character artwork in the menus, the VS card, the HUD and the Ultimate cut-ins.
- Navy, ivory and gold menus throughout, plus an icon and type-medallion set for later use.
- Fixed on the way in: a broken image on the Random arena card, two lines glued together in the pause-menu move
  list, and the results table running off the screen. Portraits deploy as WebP (7.2 MB → 1.6 MB).

**Fixed (these were in 1.x too)**
- Presses made during hit-stop were dropped, so a special pressed "the moment the hit lands" often did nothing.
- A basic hit could knock an Ultimate out of its start-up and waste the meter.
- Chansey and Ho-Oh could out-heal a fight and win on the clock. Healing now tires.
- Small Pokémon had shorter swings and lost every race to hit first. Every contact basic now reaches the same.

**Measured (Normal CPU against Normal CPU unless noted)**
- One-on-one battles: median 47 s on ground, 42 s on water, 45 s on air (900 battles each); 94–99 % end in a
  knockout. Each fighter fires 1.3 Ultimates per battle; the lead changes 2 to 3 times; a third to a half of
  battles are won with under 30 % health left. Trainer Battles: about 2.0 to 2.3 minutes.
- Balance after re-tuning all 44 fighter/environment pairs and all 33 trainer teams: every Pokémon wins 39–57 % of
  its battles; trainer teams 42–59 %.
- Chains that connect when pressed on the first hit or the Finisher: 182 of 218 (64 before the hit-stop fix). The
  rest are charge moves, lobbed moves and dashes that are out of range after a ranged Finisher.
- Scripted players against the CPU (46 battles per cell, win rate of the scripted player):

  | Scripted player | Easy | Normal | Hard |
  |---|---|---|---|
  | Holds ✕ and nothing else | 83–96 % | 2–26 % | 4–17 % |
  | Random buttons | 87–89 % | 28–35 % | 17–24 % |
  | Holds ✕, chains every hit, fires the Ultimate | 96–100 % | 63–70 % | 57–59 % |
  | The same, plus frame-perfect dodges and Break | 98–100 % | 70–72 % | 57–70 % |

**Known limits**
- Hard is beatable more than half the time by a script that chains every single hit without fail. People will not
  be that consistent on a touch screen, but Hard is not yet a wall for a strong player.
- Feel, sound and frame rate on a real iPhone were not checked here (the tests run in headless Chromium).
- 36 of 218 chains do not connect (see above); a charge move pressed after a Finisher passes through the
  opponent while it gets up.
- Weezing sits at the bottom of the ground table (about 40–45 %) and Meowth needs a 4.5× damage multiplier to
  compete. Both want kit changes more than numbers.

## Mike Arena 1.1.0 — 2026-11-09 — Arcade, Training and Records

One large addition, three medium ones and ten small ones. Pokémon Battles play exactly as in 1.0.0; Trainer Battles
change only through the new team balance.

**Large**
- **Arcade mode.** Pick an environment and a Pokémon or a trainer, then fight six battles in a row: two on Easy, two
  on Normal, two on Hard, the last against a Legendary (or the Champion, in Trainer Battles). HP is restored between
  stages and one loss ends the run. Every stage is scored (difficulty, HP left, time left, perfect dodges, a bonus
  for taking no damage), a cleared run gets a rank from C to S, and the best run per environment and format is kept.
  The run is saved before and after every battle, so it can be closed and resumed from the main menu.

**Medium**
- **Training mode.** No clock and no knockouts; HP refills after 3 seconds without taking damage. The opponent
  stands still until you ask it to fight back from the pause menu. Nothing in Training counts toward the records.
- **Records screen.** Battles, wins, losses, draws, win rate, best winning streak, championships, fastest win, a
  table of every Pokémon you have used, and your best Arcade runs.
- **Fair trainer teams.** Every trainer's team now has its own HP and damage multiplier per environment
  (`src/content/teambalance.js`, written by `tools/tune_teams.mjs`). CPU-vs-CPU team win rates went from 20–87 % to
  41–58 % (200 battles per team per environment; a second, smaller sample gave 39–62 %). Multipliers stay between 0.85 and 1.18.

**Small**
- **Move list in the pause menu:** the four moves of the Pokémon on the field, their cost and cooldown, its Ultimate
  and what R does.
- **Cinematics setting:** Full, Light (shorter freezes, no inverted flash frames) or Off (no camera work, freezes,
  black bars or cut-ins).
- **Skip the intro before each battle** setting: straight from the loading screen to the send-outs.
- **Next opponent** on the results screen: same side and difficulty, a different random opponent and arena.
- **Surprise battle** on the main menu: a random Pokémon, opponent, arena and environment in one tap.
- **Random pick for your own side** on the fighter and trainer select screens.
- **Winning streak** on the main menu and the results screen.
- **Your record with each Pokémon** on the fighter select screen.
- **Battle time** on the results screen, with a note when it is your fastest win.
- **Loading tips about your Pokémon:** half the time the tip explains its R ability; four new general tips.

Also: the main menu groups Training, Surprise battle, Records, Settings, Controls and Credits into two compact rows;
the pause menu is more compact so every entry fits an iPhone screen; settings save version 3 (older saves migrate).

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
