# Combat 2.0

Mike Arena 2.0 replaces the 1.x fighting model. In 1.x every attack cost stamina and had a cooldown, so a battle was
mostly waiting: move, press one of four buttons, wait for stamina. In 2.0 the hands are always busy. This file is the
reference for how it works, why, and how to tune it. Every number lives in `src/game/combat.js`.

## The idea

The brief was "make the actual playing a sheer ball of fun", with Jeff Kaplan's account of how Overwatch was built
as the model. What that account says, and what was done with it here:

| What the Overwatch team did | What it meant here |
|---|---|
| Built one small "core combat" slice and played it until it was fun before adding anything | No new modes. The whole release is the 20 seconds of fighting, rebuilt |
| Gave every hero a clear identity and a clear job for each button | ✕ is always the free basic attack, □ △ ○ are that Pokémon's specials, R is its movement, L is the Ultimate |
| Made great plays visible and celebrated (Play of the Game, medals, "on fire") | Counter, Punish, Clash, Break and Finisher call-outs, a combo counter, heat and "On fire", medals and a style rank after every battle, mastery levels per Pokémon |
| Kept iterating on measurements from playtests | `tools/feel.mjs`, `tools/bots.mjs`, `tools/why.mjs` and `tools/trace.mjs` (below) measure every change |

Sources: Game Informer, "Designing Overwatch: From Titan to Torbjörn" and Game Developer, "How Blizzard is building
Overwatch out of the ashes of Titan". The exact talk the owner remembered was not found.

## Controls

| Button | 1.x | 2.0 |
|---|---|---|
| ✕ | A light move with a stamina cost | **Basic attack.** Free, no cooldown. Tap or hold. Three hits; the third is the Finisher |
| □ △ ○ | Moves with a cost and a cooldown | **Specials.** Same cost and cooldown, but they chain out of any hit |
| R | Dodge / movement ability | The same, plus **Dash strike** (✕ during a dodge) and **Break** (R while being comboed) |
| L | Ultimate at 100 % | The same; it also chains out of any hit and cannot be interrupted |

Holding ✕ only swings when the opponent is in reach, and it starts 5 ticks after the opponent comes into reach.
A tap is instant, so timing beats holding. A tap always swings, and a contact swing that hits nothing adds a
lockout of 7 to 14 ticks (mashing at the air is punishable).

**Hit-stop never eats a press.** While the action is frozen on a hit (3 to 10 ticks), presses are buffered and the
chain window does not run down. Before this was fixed, a special pressed "the moment the hit lands" was silently
dropped, and chaining out of a Finisher was impossible by hand. `tools/feel.mjs --chains` guards it.

## The rules

**Basic string.** Three hits: 7, 6 and 9 ticks of start-up. Every contact basic attack reaches at least 30 px
(`COMBAT.basic.reach`), so small Pokémon are not out-reached before the fight starts. Hits one and two keep the target close; the Finisher
sends it flying (and into a wall slam if a wall is near) but takes 20 ticks to recover, which hands the turn to the
other fighter. Contact basics pull their user up to 46 px toward the target so a press in range is a hit. Ranged
basics fire two single shots and then a fan of three; beam basics tick. Every basic hit that lands returns stamina.
A basic attack is never fully blocked by a type immunity (it does 25 %).

**Chains.** For 14 ticks after any hit lands, the attacker may cancel into a *different* special, the Ultimate, a
dodge, or (from a special) back into the basic string. A chained special starts in 65 % of its usual time and the
target stays stunned through that start-up and the time a dash, a shot or a short leap needs to arrive (up to 40
ticks). The window also opens when a projectile or beam lands after its move has ended, so fighters with ranged
basic attacks chain too. On touch, the special buttons light up while the window is open. This is the whole combo
system: ✕ ✕ □, ✕ ✕ ✕ △, □ ✕ ✕ ○ L.

**Knockdown.** A combo that contained a Finisher, an Ultimate, a wall slam or four separate attacks ends with the
victim knocked down. It gets up flickering: for 20 ticks it cannot attack and for 27 ticks it cannot be hit. Those
last 7 ticks are its turn: it can strike first and nothing can stop it. A fight is therefore a series of exchanges
with a reset between them, not one long slugfest, and getting knocked down hands you the initiative.

**Combo scaling.** Each *separate* attack in a combo after the third does less (85 %, 75 %, 66 % …). The basic
string is not scaled. Long combos are worth doing but do not delete a health bar.

**Pressure fatigue.** Stun builds while a fighter is being hit and drains when it is free. Past a threshold the
fighter shakes off stun sooner, and then breaks free on its own with a short immunity. No combo is infinite.

**Break.** After three hits of a combo, the fighter being hit can press R to burst free. It costs 35 stamina and has
a 2.5 second cooldown.

**Armour.** Heavy and signature specials ignore basic hits while they start up (they still take 75 % damage). An
Ultimate ignores every hit while it starts up. The answer to a foe who mashes ✕ is a big move straight through it.

**Counter and Punish.** A hit on a fighter that is starting an attack is a Counter (+20 % damage, +8 stun). A hit
on a fighter recovering from one is a Punish (+12 %, +5 stun). Both get a call-out, a sound and a longer freeze.

**Clash.** Two contact attacks of the same weight that meet head-on cancel. Both fighters are pushed apart and get
stamina back. A basic swing also swats small projectiles out of the air.

**Dash strike.** ✕ during a dodge (after its eighth tick) lunges up to 96 px and hits 15 % harder.

**Perfect dodge.** Unchanged in timing, but it now returns 20 stamina and a large amount of heat.

**Heat and "On fire".** Landing hits, Finishers, Counters, Clashes, wall slams and perfect dodges build heat; being
hit loses it, and it decays when nothing happens. At 100 the fighter is on fire for 7 seconds: stamina returns
2.4 times as fast, the Ultimate fills 1.5 times as fast, and it moves slightly faster.

**Stamina.** Regenerates at 22 per second after a 20-tick delay. Only specials and dodges spend it.

**Healing tires.** Every heal is divided by 1 + 2 × (the share of a health bar that fighter has already healed in
this battle). The first Recover is worth its full amount; after healing half a bar, heals are worth half. Before
this, Chansey and Ho-Oh won by healing through everything and letting the clock run out. Leech Seed's drain also
scales with the seeder's balance multiplier now, like any other damage.

**Ultimate.** Fills about 1.7 times as fast as in 1.x (passively, by dealing damage and by taking it), cannot be
interrupted, and does 3.2 times its listed power (`TUNING.ultDmg`), capped at 34 % of the target's health per use
(`TUNING.ultCap`). In 1.1 an Ultimate took about 5 % of a health bar on average; now a clean hit takes a quarter to
a third. Ultimates that rain strikes on the arena send every second or third strike after the target
(`trackEvery`), so they have to be dodged, not walked away from.

**Damage.** `TUNING.pokemonDmg` in `src/game/sim.js` scales all damage per environment so a one-on-one battle
between two Normal CPUs lasts about 45 to 50 seconds.

## The CPU

`src/game/ai.js`. Difficulty never changes stats; it changes how well the CPU uses the rules above. Each level has
these knobs (see `LEVELS`):

| Knob | What it controls |
|---|---|
| `string`, `cancel`, `ultCancel` | How often it continues the string, chains a special, chains the Ultimate |
| `rest` | How long it backs off after its own attack sequence. Resting means "I will not chase you", not "I will not defend myself" |
| `crowd` | How long it tolerates a foe standing in its reach before it ends the rest |
| `jab` | Its reaction time when both fighters are in reach of each other |
| `scramble` | How well it knows that a slow special loses to a jab at close range |
| `read` | Chance to side-step a foe walking into reach and strike out of the dodge |
| `armorRead` | Chance to answer a basic string with an armoured special |
| `breakOut`, `evade`, `dashStrike` | Break, pre-emptive dodges, dash strikes |
| `wake` | Chance to take its turn (strike at once) when it gets up from a knockdown |
| `poke` | Chance to fire a ranged basic attack while it rests |

Every level backs off from an opponent that is getting up, and uses the time for a buff or a heal if it has one.

Easy rests for one to two seconds after every sequence and almost never chains. Normal chains two times in three and
fights back at once when crowded. Hard chains nearly every hit, opens with jabs up close, reads approaches and
answers strings with armour.

## Tools

| Command | What it answers |
|---|---|
| `bun tools/feel.mjs --frames` | Start-up, length, stun and advantage of every move |
| `bun tools/feel.mjs --strings` | Does every fighter's ✕ ✕ ✕ connect, and what does it lead to |
| `bun tools/feel.mjs --chains` | Does every special connect when chained from the first hit and from the Finisher |
| `bun tools/ults.mjs` | How much of a health bar each Ultimate takes |
| `bun tests/rules.mjs` | 35 pass/fail checks of the rules in this file, run in the real simulation |
| `bun tools/feel.mjs --pace` | Match length, share of time attacking / hurt / moving, combos, Ultimates per match, lead changes |
| `bun tools/bots.mjs` | Five scripted "players" (a masher, a masher who chains, a beginner, a runner, a careful player) against Easy, Normal and Hard |
| `bun tools/why.mjs --bot masherPlus --level hard` | Who opens the exchanges and what each opening is worth |
| `bun tools/trace.mjs --bot masherPlus --level hard` | What each side was doing when it got hit |
| `bun tools/probe.mjs <fighter…>` | One fighter's win rate, damage sources and matchups |
| `bun tools/tune.mjs` | Per-fighter HP and damage multipliers toward 50 % (`--env`, `--json`, `--merge` to run environments in parallel) |
| `bun tools/tune_teams.mjs`, `bun tools/write_teams.mjs` | The same for trainer teams |

## Rules for changing it

1. Change a number in `src/game/combat.js`, not in the code that reads it.
2. The simulation stays deterministic: no `Math.random`, no clocks. Run `bun tools/replaycheck.mjs`.
3. After any change to combat or the CPU, run `bun tests/rules.mjs` and `bun tools/bots.mjs`. Easy must stay
   beatable by the `novice` bot (about 70 % or better) and the one-button `masher` bot must not beat Normal or
   Hard more than about one time in four.
4. After any change to damage, stun or kits, re-run `bun tools/tune.mjs` and then the team tuner.
