// CPU opponent. Produces the same logical input a player would. Obeys the same stamina rules.
// Difficulty changes only reaction time, decision quality and aggression — never stats.
import { clamp, angDiff, mulberry32, segDist } from '../core/util.js';
import { CONTENT, rawEffect, arenaEffect } from './content.js';
import { blankInput } from './fighter.js';
import { COMBAT } from './combat.js';

// jab: ticks the foe may stand inside its basic-attack reach before it swings (its reaction in a scramble).
// string: chance to carry on to the next hit of the basic string; cancel / ultCancel: chance to chain a special or
// the Ultimate out of a landed hit; poke: chance per thought to fire a ranged basic attack while it rests; wake: chance to take its turn (jab at once) when it gets up from a knockdown; scramble: how well it knows that a slow special loses to a jab up close; read: chance to side-step a foe that walks into its basic-attack reach; rest: ticks it backs off after finishing an attack sequence (your turn);
// dashStrike: chance to attack out of a dodge; armorRead: chance to answer a basic string with an armoured move.
export const LEVELS = {
  easy: { react: 24, think: 18, aimErr: 0.22, dodge: 0.26, perfect: 0.08, aggro: 0.45, reserve: 0, ultDelay: 240, switchQ: 0.3, decoyFool: 0.75, holdFire: 0.45, string: 0.6, cancel: 0.1, ultCancel: 0.15, rest: [60, 130], dashStrike: 0.1, armorRead: 0, evade: 0.02, breakOut: 0.08, jab: [14, 28], crowd: 999, read: 0, scramble: 0, wake: 0.1, poke: 0.08 },
  normal: { react: 14, think: 10, aimErr: 0.08, dodge: 0.5, perfect: 0.3, aggro: 0.68, reserve: 8, ultDelay: 60, switchQ: 0.65, decoyFool: 0.5, holdFire: 0.2, string: 0.9, cancel: 0.65, ultCancel: 0.65, rest: [28, 64], dashStrike: 0.5, armorRead: 0.4, evade: 0.08, breakOut: 0.4, jab: [4, 11], crowd: 4, read: 0.3, scramble: 0.55, wake: 0.55, poke: 0.35 },
  // training partner: stands still and never attacks (not offered on the difficulty screen)
  dummy: { react: 99, think: 99, aimErr: 0, dodge: 0, perfect: 0, aggro: 0, reserve: 0, ultDelay: 99999, switchQ: 0, decoyFool: 0, holdFire: 1, string: 0, cancel: 0, ultCancel: 0, rest: [0, 0], dashStrike: 0, armorRead: 0, evade: 0, breakOut: 0, jab: [999, 999], crowd: 999, read: 0, scramble: 0, wake: 0, poke: 0 },
  hard: { react: 8, think: 6, aimErr: 0.02, dodge: 0.8, perfect: 0.65, aggro: 0.82, reserve: 10, ultDelay: 0, switchQ: 0.92, decoyFool: 0.25, holdFire: 0.05, string: 1, cancel: 0.95, ultCancel: 0.95, rest: [0, 14], dashStrike: 0.9, armorRead: 0.85, evade: 0.16, breakOut: 0.8, jab: [0, 2], crowd: 0, read: 0.65, scramble: 0.85, wake: 0.95, poke: 0.5 },
};
const OFFENSIVE = new Set(['melee', 'dash', 'grab', 'leap', 'line', 'cone', 'proj', 'beam', 'lob', 'blink', 'area', 'zone']);

// Usable range of a move as an edge-to-edge gap. Melee hit checks measure from the attacker's centre to the
// target's edge, so a big body (Tyranitar, a serpent's head) needs to be closer than the raw step range says.
const RANGE_CACHE = new Map();
export function aiRange(f, m) {
  const key = m.id + '|' + f.r;
  let r = RANGE_CACHE.get(key);
  if (!r) {
    const st = m.steps.find((x) => x.k === 'melee');
    // contact moves pull their user in (see COMBAT.basic.snap), so their usable range is longer than the swing
    if (st) r = [0, Math.max(6, (m.tier === 'light' ? Math.max(st.range || 26, COMBAT.basic.reach) : st.range || 26) + (st.lunge || 0) * 0.75 - f.r + (m.tier === 'light' ? COMBAT.basic.snap : COMBAT.basic.snapSpecial) * 0.8)];
    else r = m.ai.r;
    RANGE_CACHE.set(key, r);
  }
  return r;
}

// how far a fighter's contact basic attack reaches (centre to the target's edge), as Fighter.basicInReach measures it
function contactReach(f) {
  const m = CONTENT.moves[f.kit()[0]]; if (!m || m.tier !== 'light') return 0;
  const st = m.steps.find((x) => x.k !== 'blink') || {};
  if (st.k === 'melee' || st.k === 'grab') return Math.max(st.range || 26, COMBAT.basic.reach) + COMBAT.basic.snap;
  if (st.k === 'dash') return Math.min(st.dist || 100, 78) + (st.hitR || 14);
  return 0;
}

export class AI {
  constructor(side, level, seed) {
    this.side = side; this.L = LEVELS[level] || LEVELS.normal; this.level = level;
    this.rng = mulberry32(seed >>> 0);
    this.plan = -1; this.nextThink = 0; this.strafe = 1; this.strafeT = 0;
    this.dodgeAt = -1; this.lastDodgePlan = -99; this.holdSlot = -1; this.holdUntil = 0;
    this.travHold = 0; this.ultReadyAt = -1; this.emoteAt = 600; this.wonEmote = false; this.lastHp = 1; this.lastSwitchThink = 0;
    this.state = 'neutral'; this.decoyUntil = -1; this.decoyPos = null; this.forceSlot = -1;
    this.swingAct = -1; this.swingGo = false; this.swingChain = -1; this.swingUlt = false; this.restUntil = 0; this.wasAttacking = false; this.strikeFromDodge = false;
  }
  input(S) {
    const sd = S.sides[this.side], f = sd.active, inp = blankInput();
    // replacement first: during the replace phase the side's active Pokémon is the fainted one
    // (the choice goes out as an input like everything else the CPU does, so replays reproduce it)
    if (S.phase === 'replace' && f && f.state === 'recalled') { const c = this.chooseReplacement(S); if (c >= 0) inp.choose = c; return inp; }
    if (!f || !f.alive) return inp;
    // a happy emote after winning
    if (S.phase === 'ko' && S.koFinal && S.result && S.result.winner === this.side && !this.wonEmote && S.phaseT > 40 && f.onField) { this.wonEmote = true; inp.emote = 3; return inp; }
    if (S.phase !== 'fight' || !f.onField || f.state === 'enter') return inp;
    if (this.level === 'dummy') return inp;
    const o = f.foe; if (!o || !o.onField) return inp;
    const L = this.L;
    inp.aimErr = L.aimErr * (o.hidden() ? 3 : 1);
    const hiddenFoe = o.hidden() && f.sp.passive !== 'aura' && !o.flags.revealed;
    const react = Math.round(L.react * (hiddenFoe ? 1.6 : 1));
    const tgt = S.targetPointFor(f, o);
    // Substitute decoy: the CPU can fall for it
    if (S.decoys.length && this.decoyUntil < S.tick) { const d = S.decoys.find((x) => x.owner === o && S.tick - (x.until - 150) < 4); if (d && this.rng() < L.decoyFool) { this.decoyUntil = S.tick + 50; this.decoyPos = { x: d.x, y: d.y }; } }
    const fooled = this.decoyUntil >= S.tick && S.decoys.some((x) => x.owner === o);
    if (fooled) inp.decoy = true;
    const tx = fooled ? this.decoyPos.x : tgt.x, ty = fooled ? this.decoyPos.y : tgt.y;
    const dx = tx - f.x, dy = ty - f.y, dist = Math.hypot(dx, dy), gap = dist - f.r - o.r;
    const toFoe = Math.atan2(dy, dx);

    // read the approach: a foe about to walk into its basic-attack reach is side-stepped, then struck out of the dodge
    const foeReach = contactReach(o);
    if (foeReach && f.canAct() && o.canAct() && this.dodgeAt < 0 && f.dodgeCd <= 0 && f.stamina >= COMBAT.stamina.dodge + 8 && !hiddenFoe) {
      const dMe = S.reach(f, o.x, o.y), was = this.lastDMe ?? dMe, closing = was - dMe, margin = dMe - foeReach;
      if (margin > 0 && closing > 0.8 && margin < closing * 3 + 1) {
        if (S.tick >= (this.readAt || 0)) { this.readAt = S.tick + 50; this.readGo = this.rng() < L.read; }   // one decision per approach
        if (this.readGo) { this.readGo = false; this.dodgeAt = S.tick; this.dodgeAng = toFoe + (this.rng() < 0.5 ? 1 : -1) * (1.9 + this.rng() * 0.5); this.forceStrike = f.hasBasic(); }
      }
      this.lastDMe = dMe;
    } else this.lastDMe = undefined;
    // ---------------------------------------------------------------- threats -> dodge
    const threat = this.threat(S, f, o);
    if (threat && f.canAct() && this.dodgeAt < 0 && S.tick - this.lastDodgePlan > 20) {
      this.lastDodgePlan = S.tick;
      if (this.rng() < L.dodge && f.stamina >= 12 && f.dodgeCd <= 0) {
        const perfect = this.rng() < L.perfect;
        const when = perfect ? S.tick + Math.max(react, threat.t - 5) : S.tick + react;
        if (when < S.tick + threat.t + 2) { this.dodgeAt = when; this.dodgeAng = threat.away; }
      } else if (threat.kind === 'proj' || threat.kind === 'beam') {
        // defensive moves instead (Barrier, Mirror Coat, Protect, Iron Defense, Mist)
        const ds = this.findDefense(f, threat);
        if (ds >= 0 && this.rng() < L.dodge) { this.forceSlot = ds; this.forceAt = S.tick + react; }
      }
    }
    if (this.dodgeAt >= 0 && S.tick >= this.dodgeAt) {
      this.dodgeAt = -1;
      if (f.canAct() || (f.state === 'act' && f.move && f.move.t >= f.move.cancelT)) {
        inp.dodge = true; inp.dodgeHeld = true;
        this.strikeFromDodge = this.forceStrike || (this.rng() < L.dashStrike && this.wantsClose(f)); this.forceStrike = false;
        const a = this.dodgeAng ?? toFoe + Math.PI / 2;
        inp.mx = Math.cos(a); inp.my = Math.sin(a);
        return inp;
      }
    }
    if (this.forceSlot >= 0 && S.tick >= this.forceAt) { const s = this.forceSlot; this.forceSlot = -1; if (f.canAct()) { inp.slot = s; inp.held[s] = true; this.holdSlot = s; this.holdUntil = S.tick + 50; return inp; } }
    if (this.holdSlot >= 0) { if (S.tick < this.holdUntil && f.state === 'act' && threat) inp.held[this.holdSlot] = true; else this.holdSlot = -1; }

    // caught in a combo: decide once per combo whether to pay to break free, then do it a hit or two in
    if (f.state === 'hurt' && f.cmb.n > 0) {
      if (this.breakCombo !== f.cmb.by || f.cmb.n < this.breakSeen) { this.breakCombo = f.cmb.by; this.breakWant = this.rng() < L.breakOut; this.breakN = COMBAT.breakOut.hits + Math.floor(this.rng() * 3); }
      this.breakSeen = f.cmb.n;
      if (this.breakWant && f.cmb.n >= this.breakN && f.canBreak()) { this.breakWant = false; inp.dodge = true; return inp; }
    } else if (f.cmb.n === 0) this.breakCombo = null;
    // ---------------------------------------------------------------- mid-attack: the basic string and chains
    if (f.state === 'act' && f.move && !f.move.ult) {
      const mv = f.move, landed = S.tick - Math.max(mv.landedT, f.chainT) <= COMBAT.chain.window;
      this.wasAttacking = true;
      if (this.swingAct !== mv.act) {
        // one set of decisions per swing, made when it starts
        this.swingAct = mv.act;
        this.swingGo = this.rng() < L.string;
        this.swingUlt = this.rng() < L.ultCancel;
        this.swingChain = this.rng() < L.cancel ? this.pickChain(S, f, o, gap, mv.slot) : -1;
      }
      const basicNow = mv.basic && f.hasBasic();
      // carry the string on while it is connecting (or the foe is still in reach)
      if (basicNow && mv.si < 2 && this.swingGo && (S.tick - mv.landedT <= COMBAT.chain.window || gap < 26) && mv.t >= mv.linkT - 3) { inp.slot = 0; inp.held[0] = true; return inp; }
      if (landed && S.tick - Math.max(mv.landedT, f.chainT) >= 2) {
        const stringDone = !basicNow || mv.si === 2 || !this.swingGo;
        if (stringDone && f.ult >= 100 && this.swingUlt && !f.silenced()) { inp.ult = true; return inp; }
        if (stringDone && this.swingChain >= 0 && f.canStartMove(this.swingChain)) { inp.slot = this.swingChain; inp.held[this.swingChain] = true; return inp; }
        // a special that landed can lead back into the basic string
        if (!basicNow && f.hasBasic() && this.swingGo && gap < 40 && this.wantsClose(f)) { inp.slot = 0; inp.held[0] = true; return inp; }
      }
    } else if (this.wasAttacking && f.canAct()) {
      // the sequence is over: step back for a moment (longer on easier levels), unless the foe is helpless
      this.wasAttacking = false;
      this.restUntil = S.tick + L.rest[0] + Math.floor(this.rng() * (L.rest[1] - L.rest[0] + 1));
    }
    // one of its shots landed after the move ended: chain a special (or the Ultimate) off it, one decision per hit
    if (f.canAct() && S.tick - f.chainT <= COMBAT.chain.window - 2 && S.tick - f.chainT >= 2 && this.chainSeen !== f.chainT) {
      this.chainSeen = f.chainT;
      if (f.ult >= 100 && !f.silenced() && this.rng() < L.ultCancel) { inp.ult = true; return inp; }
      if (this.rng() < L.cancel) { const c = this.pickChain(S, f, o, gap, f.chainSlot); if (c >= 0) { inp.slot = c; inp.held[c] = true; return inp; } }
    }
    // out of a dodge: strike while the foe is still swinging
    if (f.state === 'dodge' && f.st >= 8 && this.strikeFromDodge && f.hasBasic() && gap < COMBAT.basic.snapDash) { this.strikeFromDodge = false; inp.slot = 0; inp.held[0] = true; return inp; }
    // getting up from a combo also resets to neutral for a moment instead of swinging straight back
    const hurtNow = f.state === 'hurt';
    // (on getting up it may also step away at once, which beats a foe who keeps swinging)
    if (this.wasHurt && !hurtNow && f.canAct() && gap < 56 && f.dodgeCd <= 0 && f.stamina >= COMBAT.stamina.dodge + 6 && this.dodgeAt < 0 && this.rng() < L.dodge * 0.6) { this.dodgeAt = S.tick; this.dodgeAng = toFoe + Math.PI + (this.rng() - 0.5) * 1.8; }
    if (this.wasHurt && !hurtNow && f.canAct()) this.restUntil = Math.max(this.restUntil, S.tick + Math.round((L.rest[0] + this.rng() * (L.rest[1] - L.rest[0])) * 0.6));
    this.wasHurt = hurtNow;
    // while resting it only goes in for a real opening: a helpless foe or a big missed special
    const bigMiss = (o.state === 'act' && o.move && o.move.t > o.move.hitT + 2 && o.move.end - o.move.t >= (o.move.basic ? 6 : 10) && S.tick - o.move.landedT > 20) || (o.canAct() && o.basicLock > S.tick + 3);
    // ...and it does not stand there if the foe walks into its reach: it swings first
    const myReach = f.hasBasic() ? aiRange(f, CONTENT.moves[f.kit()[0]])[1] : 40;
    // (resting means "I will not chase you", not "I will not defend myself": a foe that stays close ends the rest)
    this.crowdT = gap < Math.max(Math.min(myReach, 60) * 0.85, 34) ? (this.crowdT || 0) + 1 : Math.max(0, (this.crowdT || 0) - 2);
    // knockdowns: a foe that is getting up cannot be hit yet (time to back off, buff up or heal), and while it is
    // getting up itself it cannot attack, so it moves
    const foeUp = S.tick < o.mercyUntil - 7, selfUp = S.tick < f.downUntil;
    // (attacks are back and it still cannot be hit: its turn, if it is sharp enough to take it; one roll per get-up)
    if (f.mercyUntil !== this.wakeSeen) { this.wakeSeen = f.mercyUntil; this.wakeGo = this.rng() < L.wake; }
    const wakeUp = this.wakeGo && !selfUp && S.tick < f.mercyUntil;
    const resting = foeUp || selfUp || (!wakeUp && S.tick < this.restUntil && !(o.status.sleep || o.status.freeze || bigMiss || this.crowdT > L.crowd || f.flags.stunImmune > S.tick));
    const ranged = f.hasBasic() && ['proj', 'beam'].includes(CONTENT.moves[f.kit()[0]].ai.kind);
    // out-reached: a foe whose basic attack reaches further would swing first if it just walked in, so it comes in
    // through the foe's reach with a dodge and strikes out of it (one decision per approach)
    {
      const mine = contactReach(f), T = f.T, plainDodge = !(T && (typeof T.replacesDodge === 'function' ? T.replacesDodge(f) : T.replacesDodge));
      if (mine && foeReach > mine + 5 && plainDodge && !resting && f.canAct() && o.canAct() && this.dodgeAt < 0 && f.dodgeCd <= 0 && f.stamina >= COMBAT.stamina.dodge + 8 && !hiddenFoe) {
        const dMe = S.reach(f, o.x, o.y), dFoe = S.reach(o, f.x, f.y);
        if (dMe < foeReach + 16 && dFoe > mine - 4 && dFoe < COMBAT.basic.snapDash + 30) {
          if (S.tick >= (this.inAt || 0)) { this.inAt = S.tick + 70; if (this.rng() < L.dashStrike) { this.dodgeAt = S.tick; this.dodgeAng = toFoe + (this.rng() - 0.5) * 0.5; this.forceStrike = true; } }
        }
      }
    }

    // ---------------------------------------------------------------- think: pick a plan
    if (S.tick >= this.nextThink) {
      this.nextThink = S.tick + L.think + Math.floor(this.rng() * 4);
      // (a fighter with a ranged basic attack keeps poking from a distance while it rests)
      this.plan = selfUp ? -1 : foeUp ? this.setupMove(S, f, o) : resting ? (ranged && this.rng() < L.poke ? 0 : -1) : this.pickMove(S, f, o, gap, hiddenFoe);
      // reads: step out of the foe's reach before it swings (then strike back), or answer its basic string with armour
      if (f.canAct() && gap < 44 && f.dodgeCd <= 0 && f.stamina >= 30 && this.dodgeAt < 0 && (o.canAct() || (o.state === 'act' && o.move && o.move.basic)) && this.rng() < L.evade) {
        this.dodgeAt = S.tick + 1 + Math.floor(this.rng() * 4); this.dodgeAng = toFoe + Math.PI + (this.rng() - 0.5) * 1.6;
      }
      if (f.canAct() && o.state === 'act' && o.move && o.move.basic && gap < 60 && this.rng() < L.armorRead) { const a = this.armorMove(f, gap); if (a >= 0) this.plan = a; }
      // a foe swinging at the air: step around the swing and strike out of the dodge, or poke it from range
      if (f.canAct() && o.state === 'act' && o.move && o.move.basic && S.tick - o.move.landedT > 30 && gap < 90 && gap > 20 && f.dodgeCd <= 0 && f.stamina >= 24 && this.dodgeAt < 0 && this.rng() < L.evade * 3) {
        this.dodgeAt = S.tick + 1; this.dodgeAng = toFoe + (this.rng() < 0.5 ? 1 : -1) * 0.9; this.forceStrike = true;
      }
      if (--this.strafeT <= 0) { this.strafe = this.rng() < 0.5 ? -1 : 1; this.strafeT = 8 + Math.floor(this.rng() * 10); }
      this.thinkSwitch(S, f, o);
      // emotes: after a big hit, when low on HP
      if (S.tick >= this.emoteAt && this.rng() < 0.3) {
        const hpf = f.hp / f.maxHp;
        if (hpf < 0.25 || (o.hp / o.maxHp < this.lastFoeHp - 0.18)) { inp.emote = hpf < 0.25 ? 3 : 0; this.emoteAt = S.tick + 900; }
      }
      this.lastFoeHp = o.hp / o.maxHp;
    }

    // ---------------------------------------------------------------- ultimate
    if (f.ult >= 100 && f.canAct()) {
      if (this.ultReadyAt < 0) this.ultReadyAt = S.tick + L.ultDelay + Math.floor(this.rng() * 30);
      const um = this.ultMove(f);
      const megaFirst = f.sp.mega && f.form !== 'mega' && !S.sides[f.side].megaUsed;
      const ur = um && um.ai ? aiRange(f, um) : null;
      const inRange = ur && gap >= ur[0] - 10 && gap <= ur[1];
      if (S.tick >= this.ultReadyAt && (megaFirst || inRange || this.rng() < 0.01)) { inp.ult = true; this.ultReadyAt = -1; return inp; }
    }

    // ---------------------------------------------------------------- traversal use
    const T = f.T;
    if (T && T.ai && f.canAct() && f.dodgeCd <= 0) {
      const use = T.ai.use, repl = typeof T.replacesDodge === 'function' ? T.replacesDodge(f) : T.replacesDodge;
      if (repl && (T.cost ?? 12) + L.reserve <= f.stamina && T.canStart(f)) {
        let go = false;
        if (use === 'engage' && gap > T.ai.range[0] && gap < T.ai.range[1] && this.wantsClose(f) && this.rng() < 0.04 * L.aggro) go = true;
        if (use === 'chase' && gap > 150 && this.rng() < 0.05) go = true;
        if (use === 'stealth' && gap > 90 && this.rng() < 0.015) go = true;
        if (use === 'root') { const rooted = f.tv.rooted; const far = gap > 110; if ((!rooted && far && this.rng() < 0.03) || (rooted && gap < 60 && this.rng() < 0.08)) go = true; }
        if (go) { inp.dodge = true; inp.dodgeHeld = true; this.travHold = use === 'chase' ? 40 + Math.floor(this.rng() * 50) : 0; const a = use === 'chase' || use === 'engage' ? toFoe : toFoe + Math.PI / 2 * this.strafe; inp.mx = Math.cos(a); inp.my = Math.sin(a); return inp; }
      }
    }
    if (this.travHold > 0 && f.state === 'trav') { this.travHold--; inp.dodgeHeld = true; inp.mx = Math.cos(toFoe); inp.my = Math.sin(toFoe); return inp; }
    if (f.state === 'trav') { inp.mx = Math.cos(toFoe); inp.my = Math.sin(toFoe); return inp; }

    // ---------------------------------------------------------------- scramble: the foe is in reach, swing first
    // (with a slower special in mind it still jabs if the foe is free and close enough to swing first: one roll per approach)
    const planSlow = this.plan > 0 && f.canStartMove(this.plan) && CONTENT.moves[f.kit()[this.plan]].power > 0 && !['heavy', 'sig'].includes(CONTENT.moves[f.kit()[this.plan]].tier);
    const danger = planSlow && o.canAct() && foeReach > 0 && S.reach(f, o.x, o.y) < foeReach + 10;
    if (f.hasBasic() && f.canAct() && !resting && f.basicLock <= S.tick && f.basicInReach() && (this.plan <= 0 || !f.canStartMove(this.plan) || (danger && this.jabOver))) {
      if (this.reachT === undefined || this.reachT < 0) { this.reachT = 0; this.jabAt = L.jab[0] + Math.floor(this.rng() * (L.jab[1] - L.jab[0] + 1)); }
      if (++this.reachT > (wakeUp ? Math.min(this.jabAt, 1) : this.jabAt)) { this.reachT = -1; inp.slot = 0; inp.held[0] = true; this.plan = -1; return inp; }
    } else { if (!danger) this.jabOver = this.rng() < L.scramble; this.reachT = -1; }
    // ---------------------------------------------------------------- attack
    if (this.plan >= 0 && f.canAct()) {
      const m = CONTENT.moves[f.kit()[this.plan]];
      const [r0, r1] = aiRange(f, m);
      const selfMove = m.ai.kind === 'buff' || m.ai.kind === 'heal';
      const ok = selfMove || (gap >= r0 - 6 && gap <= r1 + 4 && !foeUp);
      const facing = Math.abs(angDiff(f.aim, toFoe)) < 1.2 || m.ai.kind !== 'melee';
      if (ok && facing && f.cds[this.plan] <= 0 && f.canAct()) {
        inp.slot = this.plan; inp.held[this.plan] = true;
        if (m.hold) { this.holdSlot = this.plan; this.holdUntil = S.tick + 40 + Math.floor(this.rng() * 40); }
        this.plan = -1;
        return inp;
      }
    }

    // ---------------------------------------------------------------- movement
    let want = this.preferredRange(f, o);
    if (resting) want = Math.max(want, 78);
    let mx = 0, my = 0;
    const nx = dx / (dist || 1), ny = dy / (dist || 1);
    const err = gap - want;
    const radial = clamp(err / 40, -1, 1) * (err > 0 ? 0.6 + 0.4 * L.aggro : 1);
    mx += nx * radial; my += ny * radial;
    const sw = 0.55 + (Math.abs(err) < 30 ? 0.35 : 0);
    mx += -ny * sw * this.strafe; my += nx * sw * this.strafe;
    // walls
    const b = S.bounds, m2 = 34;
    if (f.x < b.x0 + m2) mx += (b.x0 + m2 - f.x) / m2 * 1.3; if (f.x > b.x1 - m2) mx -= (f.x - (b.x1 - m2)) / m2 * 1.3;
    if (f.y < b.y0 + m2) my += (b.y0 + m2 - f.y) / m2 * 1.3; if (f.y > b.y1 - m2) my -= (f.y - (b.y1 - m2)) / m2 * 1.3;
    for (const ob of S.obstacles) { const cx = ob.type === 'circle' ? ob.x : (ob.x0 + ob.x1) / 2, cy = ob.type === 'circle' ? ob.y : (ob.y0 + ob.y1) / 2, rr = ob.type === 'circle' ? ob.r : Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0) / 2; const d = Math.hypot(f.x - cx, f.y - cy); if (d < rr + f.r + 24) { mx += (f.x - cx) / d * 1.2; my += (f.y - cy) / d * 1.2; } }
    // hazards: telegraphed strikes, enemy zones, map hazards
    for (const z of S.zones) {
      if (z.owner === f || z.owner.side === f.side || (z.spec && !(z.spec.power > 0) && !z.spec.status && !(z.st && (z.st.pull || z.st.slow)))) continue;
      const d = Math.hypot(f.x - z.x, f.y - z.y);
      if (d < z.r + f.r + 10) { const k = 1.6 * (1 - d / (z.r + f.r + 10)) + 0.4; mx += (f.x - z.x) / (d || 1) * k * 2; my += (f.y - z.y) / (d || 1) * k * 2; }
    }
    if (S.feature) {
      for (const h of S.feature.hazards || []) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < h.r + f.r + 12) { mx += (f.x - h.x) / (d || 1) * 1.8; my += (f.y - h.y) / (d || 1) * 1.8; } }
      if (this.rng() < 0.6) for (const bo of S.feature.boosts || []) { const d = Math.hypot(f.x - bo.x, f.y - bo.y); if (d < 90 && d > 8 && bo.kind !== 'portal') { mx += (bo.x - f.x) / d * 0.25; my += (bo.y - f.y) / d * 0.25; } }
    }
    for (const t of S.traps) if (t.owner !== f) { const d = Math.hypot(f.x - t.x, f.y - t.y); if (d < 26) { mx += (f.x - t.x) / (d || 1) * 1.2; my += (f.y - t.y) / (d || 1) * 1.2; } }
    for (const c of S.coins) if (c.owner === f) { const d = Math.hypot(f.x - c.x, f.y - c.y); if (d < 70) { mx += (c.x - f.x) / (d || 1) * 0.5; my += (c.y - f.y) / (d || 1) * 0.5; } }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    inp.mx = mx; inp.my = my;
    return inp;
  }

  // ---------------------------------------------------------------- helpers
  ultMove(f) { return CONTENT.moves[(f.form === 'mega' && f.sp.mega && f.sp.mega.ult) || f.sp.ult]; }
  wantsClose(f) { const k = f.kit().map((id) => CONTENT.moves[id].ai.kind); return k.filter((x) => x === 'melee' || x === 'dash' || x === 'leap' || x === 'grab').length >= 2; }
  preferredRange(f, o) {
    if (this.plan >= 0) { const m = CONTENT.moves[f.kit()[this.plan]]; const [a, b] = aiRange(f, m); return clamp((a + Math.min(b, 170)) / 2, 0, 150); }
    // with nothing planned, stand where the basic attack works
    const b = CONTENT.moves[f.kit()[0]], bk = b.ai.kind;
    if (f.hasBasic()) return bk === 'melee' || bk === 'dash' ? 26 : bk === 'beam' ? 60 : 110;
    const kinds = f.kit().map((id) => CONTENT.moves[id].ai.kind);
    const close = kinds.filter((k) => k === 'melee' || k === 'grab').length;
    return close >= 2 ? 22 : close === 1 ? 70 : 115;
  }
  effOf(m, o) {
    let raw = rawEffect(m.type, o.types);
    if (m.dual) raw *= rawEffect(m.dual, o.types);
    if (m.type === 'Ground' && (o.sp.levitate || o.sim.env === 'air')) raw = 0;
    if (raw === 0 && m.tier === 'light' && o.foe && o.foe.kit()[0] === m.id) raw = 0.25;   // the basic attack is never fully blocked
    return arenaEffect(raw);
  }
  pickMove(S, f, o, gap, hiddenFoe) {
    const L = this.L, kit = f.kit();
    let best = -1, bestScore = 0.05;
    const hpf = f.hp / f.maxHp, foeVuln = o.state === 'hurt' || o.status.sleep || o.status.freeze || (o.state === 'act' && o.move && o.move.t > o.move.hitT + 2);
    // up close against a foe that is free to swing, a special without armour gets jabbed out of its start-up
    const fr = contactReach(o), scramble = fr > 0 && o.canAct() && !foeVuln && S.reach(f, o.x, o.y) < fr + 12;
    for (let i = 0; i < 4; i++) {
      const m = CONTENT.moves[kit[i]]; if (!m) continue;
      const basic = i === 0 && m.tier === 'light';
      if (!basic && f.cds[i] > 0 && f.cds[i] > 20) continue;
      const k = m.ai.kind;
      const reserve = foeVuln ? 0 : L.reserve;
      if (!basic && f.stamina < m.cost + reserve && !(m.cost <= f.stamina && foeVuln)) continue;
      const eff = m.power > 0 || k === 'proj' ? this.effOf(m, o) : 1;
      if (eff === 0 && m.power > 0 && this.rng() > L.holdFire) continue;   // avoid "No effect"
      const [r0, r1] = aiRange(f, m);
      const fit = gap < r0 ? Math.max(0, 1 - (r0 - gap) / 50) : gap > r1 ? Math.max(0, 1 - (gap - r1) / 90) : 1;
      let s = 0;
      // the basic string is free; it is weighed as if it cost a little so specials still open fights when stamina allows
      const dmgValue = (m.power || 0) * eff / (basic ? 15 : Math.max(10, m.cost)) * (m.cat === 'special' ? f.base.spa : f.base.atk) / 100 * (basic ? 1 : 0.75 + f.stamina / 200);
      switch (k) {
        case 'melee': case 'dash': case 'grab': case 'leap': case 'line': case 'cone':
          s = dmgValue * fit * (0.7 + L.aggro * 0.6) * (foeVuln ? 1.5 : 1); break;
        case 'proj': case 'beam': case 'lob':
          s = dmgValue * fit * (0.85 - Math.min(0.5, gap / 600)) * (hiddenFoe ? 0.5 : 1) * (foeVuln ? 1.3 : 1); break;
        case 'area': case 'zone':
          s = (dmgValue + 0.15) * fit * (o.status.slow || foeVuln ? 1.4 : 0.85); break;
        case 'buff': { const has = f.buffs.some((b) => b.tag === m.id); s = has ? 0 : (gap > 110 ? 0.9 : 0.25) * (hpf > 0.35 ? 1 : 0.4); break; }
        case 'heal': { const z = S.zones.some((z2) => z2.owner === f && z2.moveId === m.id); s = z ? 0 : hpf < 0.55 ? (1 - hpf) * 2 * (gap > 80 || foeVuln ? 1 : 0.4) : 0; break; }
        case 'defend': case 'reflect': case 'absorb': case 'counter': s = 0; break;   // used reactively
        case 'wall': s = gap > 90 && f.stamina > 50 ? 0.3 : 0; break;
        case 'trap': s = S.traps.filter((t) => t.owner === f).length < 3 ? 0.5 * fit : 0; break;
        case 'smoke': s = hpf < 0.6 && gap < 120 ? 0.5 : 0.08; break;
        case 'blink': s = dmgValue * (gap < r1 ? 1 : 0) * (0.8 + L.aggro * 0.4); break;
        default: s = dmgValue * fit;
      }
      // status-only moves (Hypnosis, Sleep Powder, Glare, Will-O-Wisp...): worth it when the foe is clean
      if (!(m.power > 0) && m.status && (k === 'proj' || k === 'cone' || k === 'area' || k === 'lob')) {
        const st = m.status, has = (st.sleep && (o.status.sleep || o.statusImmune.sleep)) || (st.para && o.status.para) || (st.burn && o.status.burn) || (st.poison && o.status.poison) || (st.confuse && o.status.confuse);
        s = has ? 0 : 0.7 * fit * (gap < 140 ? 1 : 0.6);
      }
      if (m.status && (m.status.sleep || m.status.para) && (o.status.sleep || o.status.para || o.statusImmune.sleep)) s *= 0.3;
      if (k === 'proj' && m.status && m.status.sleep && o.statusImmune.sleep) s = 0;
      if (scramble && !basic && m.power > 0) s *= 1 - L.scramble * (m.tier === 'heavy' || m.tier === 'sig' ? 0.5 : 0.75);
      s *= 0.8 + this.rng() * (0.4 + (1 - L.aggro) * 0.4);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  }
  // the best special to chain into from a landed hit: something that hurts, is ready, and reaches from here
  pickChain(S, f, o, gap, fromSlot) {
    const kit = f.kit();
    let best = -1, bestScore = 0;
    for (let i = 0; i < 4; i++) {
      const m = CONTENT.moves[kit[i]]; if (!m || i === fromSlot) continue;
      if (i === 0 && m.tier === 'light') continue;
      if (!(m.power > 0) || !OFFENSIVE.has(m.ai.kind) || !f.canStartMove(i)) continue;
      const eff = this.effOf(m, o); if (eff === 0) continue;
      const [r0, r1] = aiRange(f, m);
      if (gap > r1 + 24 || gap < r0 - 50) continue;
      // slow, telegraphed moves rarely connect out of a combo
      const st0 = m.steps[0] || {}, slow = (st0.delay || 0) > 12 || m.ai.kind === 'leap' || (m.windup && m.windup.t > 20);
      const s = m.power * eff * (slow ? 0.35 : 1) * (0.8 + this.rng() * 0.4);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  }
  // a ready heavy or signature move that reaches from here (it will not flinch from basic hits)
  // the foe is getting up and cannot be hit: a buff or a heal that is worth having, if one is ready
  setupMove(S, f, o) {
    const kit = f.kit(), hpf = f.hp / f.maxHp;
    for (let i = 1; i < 4; i++) {
      const m = CONTENT.moves[kit[i]]; if (!m || !f.canStartMove(i)) continue;
      if (m.ai.kind === 'buff' && !f.buffs.some((b) => b.tag === m.id) && this.rng() < 0.7) return i;
      if (m.ai.kind === 'heal' && hpf < 0.7 && !S.zones.some((z) => z.owner === f && z.moveId === m.id)) return i;
    }
    return -1;
  }

  armorMove(f, gap) {
    const kit = f.kit();
    for (let i = 1; i < 4; i++) {
      const m = CONTENT.moves[kit[i]]; if (!m || !(m.tier === 'heavy' || m.tier === 'sig') || !(m.power > 0) || !f.canStartMove(i)) continue;
      const [r0, r1] = aiRange(f, m);
      if (gap >= r0 - 6 && gap <= r1 + 6) return i;
    }
    return -1;
  }
  findDefense(f, threat) {
    const kit = f.kit();
    for (let i = 0; i < 4; i++) {
      const m = CONTENT.moves[kit[i]];
      if (!m || f.cds[i] > 0 || f.stamina < m.cost) continue;
      const k = m.ai.kind;
      if ((k === 'reflect' && threat.kind === 'proj' && threat.special) || k === 'absorb' && threat.kind === 'proj' || k === 'defend') return i;
      if (k === 'counter' && threat.kind === 'melee') return i;
    }
    return -1;
  }
  threat(S, f, o) {
    // incoming projectiles: closest approach within 24 ticks
    for (const p of S.projs) {
      if (p.owner.side === f.side || p.lob) continue;
      const rvx = p.vx - f.vx, rvy = p.vy - f.vy, rx = f.x - p.x, ry = f.y - p.y;
      const vv = rvx * rvx + rvy * rvy || 1e-6;
      const t = clamp((rx * rvx + ry * rvy) / vv, 0, 24);
      const cx = p.x + rvx * t - f.x, cy = p.y + rvy * t - f.y;
      if (Math.hypot(cx, cy) < p.r + f.r + 6 && t > 0) {
        const a = Math.atan2(p.vy, p.vx) + Math.PI / 2 * (this.rng() < 0.5 ? 1 : -1);
        return { kind: 'proj', t: Math.round(t), away: a, special: p.reflectable };
      }
    }
    // enemy move about to connect
    if (o.state === 'act' && o.move && o.move.t < o.move.hitT) {
      const m = o.move.def, k = m.ai ? m.ai.kind : 'melee';
      const gap = Math.hypot(o.x - f.x, o.y - f.y) - f.r - o.r;
      const reach = m.ai ? m.ai.r[1] + 20 : 60;
      if (gap < reach && k !== 'buff' && k !== 'heal' && k !== 'defend' && k !== 'reflect') {
        const a = Math.atan2(f.y - o.y, f.x - o.x) + (this.rng() < 0.5 ? 1 : -1) * 1.2;
        return { kind: k === 'proj' || k === 'beam' ? k : 'melee', t: o.move.hitT - o.move.t, away: a, special: m.cat === 'special' };
      }
    }
    // beams sweeping toward me
    for (const r of o.beams || []) if (segDist(f.x, f.y, r.x0, r.y0, r.x1, r.y1) < r.w / 2 + f.r + 10) return { kind: 'beam', t: 2, away: r.ang + Math.PI / 2 };
    // telegraphed strike under me
    for (const z of S.zones) if (z.owner !== f && z.owner.side !== f.side && z.t < z.delay && z.delay - z.t < 20 && Math.hypot(f.x - z.x, f.y - z.y) < z.r + f.r) return { kind: 'area', t: z.delay - z.t, away: Math.atan2(f.y - z.y, f.x - z.x) };
    return null;
  }
  matchup(S, f, o) {
    // + is good for f
    let best = 0;
    for (const id of f.kit()) { const m = CONTENT.moves[id]; if (m.power > 0) best = Math.max(best, this.effOf(m, o)); }
    let worst = 0;
    for (const id of o.kit()) { const m = CONTENT.moves[id]; if (m.power > 0) worst = Math.max(worst, this.effOf(m, f)); }
    return best - worst;
  }
  thinkSwitch(S, f, o) {
    if (S.format !== 'trainer' || S.tick - this.lastSwitchThink < 90) return;
    this.lastSwitchThink = S.tick;
    const sd = S.sides[this.side];
    if (sd.switchCd > 0 || !f.canAct()) return;
    const cur = this.matchup(S, f, o), hpf = f.hp / f.maxHp;
    let best = -1, bestScore = cur + (hpf < 0.25 ? -0.6 : 0) + 0.45;
    sd.team.forEach((x, i) => {
      if (x === f || !x.alive) return;
      const sc = this.matchup(S, x, o) + (x.hp / x.maxHp) * 0.3;
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    if (best >= 0 && this.rng() < this.L.switchQ * 0.5) this.wantSwitch = best;
  }
  takeSwitch() { const s = this.wantSwitch; this.wantSwitch = undefined; return s; }
  chooseReplacement(S) {
    const sd = S.sides[this.side];
    if (sd.pendingSwitch >= 0) return -1;
    if (this.replaceDelay === undefined) this.replaceDelay = S.tick + 40 + Math.floor(this.rng() * 40);
    if (S.tick < this.replaceDelay) return -1;
    this.replaceDelay = undefined;
    const o = S.activeOf(1 - this.side);
    let best = -1, bestScore = -99;
    sd.team.forEach((x, i) => { if (!x.alive) return; const sc = (o ? this.matchup(S, x, o) : 0) + x.hp / x.maxHp * 0.4 + (this.rng() - 0.5) * (1 - this.L.switchQ); if (sc > bestScore) { bestScore = sc; best = i; } });
    return best;
  }
}
