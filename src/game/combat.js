// Combat 2.0 tuning. One place for the numbers behind the basic-attack string, chains (cancels), counter hits,
// armour, clashes, heat ("on fire") and the stamina and Ultimate economy. See docs/COMBAT.md for the design.
export const COMBAT = {
  basic: {
    startup: [7, 6, 9],          // ticks to contact for hit 1, hit 2 and the finisher
    recover: [8, 8, 20],         // ticks after the active frames before the fighter is free (the finisher hands the turn over)
    power: [0.62, 0.72, 1.3],    // share of the move's power on each hit
    kb: [0.3, 0.3, 2.6],         // knockback: the first two hits keep the target close, the finisher sends it flying
    stun: [15, 15, 22],
    link: 3,                     // ticks after contact before the next hit of the string may begin
    window: 28,                  // ticks after a hit in which pressing again continues the string
    snap: 46, snapDash: 96, snapSpecial: 26, snapSpeed: 6.5,   // how far a contact attack pulls its user to the target
    gain: 5, gainRanged: 3, gainFinisher: 4,                   // stamina back for landing basic hits
    dashPower: 1.15,
    reach: 30,                   // every contact basic attack swings at least this far, so small fighters are not out-reached
    holdDelay: 5,                // a held basic attack starts this many ticks after the foe comes into reach (a tap is instant)
    whiff: 7, whiffMax: 14,      // extra recovery for each contact basic in a row that hits nothing (mashing at the air is punishable)
  },
  // a hit can be cancelled into a different special, the Ultimate or a dodge for this many ticks; the special
  // comes out faster and the target stays stunned long enough for it to connect (until stun decay breaks the combo)
  chain: { window: 14, startup: 0.65, minStartup: 5, maxStun: 40, maxAfter: 16 },
  // damage scaling by the number of separate attacks landed in one combo (the basic string is not scaled)
  scale: [1, 1, 1, 0.85, 0.75, 0.66, 0.58, 0.52, 0.46, 0.4],
  counter: { dmg: 1.2, stun: 8, freeze: 3 },     // hitting a foe during its attack start-up
  punish: { dmg: 1.12, stun: 5, freeze: 2 },     // hitting a foe during its recovery
  armor: { taken: 0.75, extra: 6 },              // heavy and signature moves shrug off basic hits while starting up
  clash: { push: 3.4, freeze: 9, stamina: 6 },
  // break: R while being comboed (three hits in) bursts free at a stamina cost; it cannot be used again for a while
  breakOut: { hits: 3, cost: 35, cd: 150, iframes: 10, push: 3.6, immune: 40 },
  // pressure fatigue: stun builds up while a fighter is being hit and drains slowly afterwards, so a fighter that has
  // just been comboed shakes off the next combo sooner (stun fades past `soft`, and it breaks out for free)
  // healing tires: every heal is divided by 1 + tire x (share of a health bar this fighter has already healed)
  heal: { tire: 2 },
  // knockdown: a combo that contained a Finisher, an Ultimate, a wall slam or four separate attacks ends with the
  // victim getting up: it cannot attack for `lock` ticks and cannot be hit for `mercy` ticks (a clean reset)
  down: { acts: 4, lock: 20, mercy: 27 },
  stun: { drain: 0.8, soft: 50, span: 30, immune: 50 },
  stamina: { regen: 22 / 60, delay: 20, dodge: 14, perfect: 20 },
  heat: { basic: 2, finisher: 4, special: 5, effective: 2, counter: 8, perfect: 14, clash: 5, slam: 6, swat: 2, hurt: 3, hurtHeavy: 8, hold: 120, decay: 0.14, fireTicks: 420, fireRegen: 2.4, fireUlt: 1.5, fireSpeed: 1.06 },
  ult: { passive: 1.2 / 60, dealt: 110, taken: 60 },
};
