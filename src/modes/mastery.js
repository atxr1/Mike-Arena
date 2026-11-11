// Style and mastery: what a battle's play was worth, the medals it earned, and the per-Pokémon level it feeds.
// Presentation-side only (nothing here touches the simulation).
const TITLES = [[20, 'Champion'], [16, 'Master'], [12, 'Ace'], [8, 'Expert'], [5, 'Skilled'], [3, 'Trained'], [1, 'Rookie']];
// level n starts at 150 * (n-1) * n / 2 points: 150, 450, 900, 1500...
export function levelFor(xp) {
  let level = 1;
  while (150 * level * (level + 1) / 2 <= xp && level < 50) level++;
  const base = 150 * (level - 1) * level / 2, next = 150 * level * (level + 1) / 2;
  return { level, into: xp - base, need: next - base, title: TITLES.find(([n]) => level >= n)[1] };
}
// one side's play in a finished match -> style points, rank and up to four medals
// (level: the CPU difficulty faced. Easy scores a little less and Hard a little more, so an S means something)
const LEVEL_STYLE = { easy: 0.8, normal: 1, hard: 1.15 };
export function styleOf(S, side, won, level) {
  const team = S.sides[side].team;
  const sum = (k) => team.reduce((a, f) => a + (f.stats[k] || 0), 0), top = (k) => Math.max(...team.map((f) => f.stats[k] || 0));
  const hp = S.hpScores()[side], secs = S.fightTicks / 60;
  const st = { combo: top('maxCombo'), comboDmg: Math.round(top('maxComboDmg')), counters: sum('counters'), punishes: sum('punishes'), perfect: sum('perfect'), finishers: sum('finishers'), chains: sum('chains'), ultChains: sum('ultChains'),
    fires: sum('fires'), clashes: sum('clashes'), slams: sum('slams'), dash: sum('dashStrikes'), breaks: sum('breaks'), armors: sum('armors'), swats: sum('swats'), taken: sum('taken') };
  // Points reward quality, not length: each kind of play counts up to a cap (scaled to the number of opponents
  // faced, so a three-on-three battle is judged like three one-on-ones), plus the win and how one-sided it was.
  const n = Math.max(1, S.sides[1 - side].team.length), cap = (v, c) => Math.min(v, c * n) / n;
  const dealt = sum('dealt'), share = dealt + st.taken > 0 ? dealt / (dealt + st.taken) : 0.5;
  const points = Math.round((LEVEL_STYLE[level] || 1) * (Math.min(st.combo, 12) * 4 + cap(st.ultChains, 2) * 12 + cap(st.perfect, 5) * 8 + cap(st.fires, 3) * 10 + cap(st.counters + st.punishes, 15) * 2
    + cap(st.chains, 20) * 1.5 + cap(st.finishers, 12) + cap(st.clashes, 5) * 2 + cap(st.slams, 6) * 2 + cap(st.dash, 5) * 2 + cap(st.breaks, 4) * 3 + cap(st.armors, 5) * 2
    + share * 40 + (won ? 30 + hp * 30 : 0)));
  const rank = points >= 245 ? 'S' : points >= 200 ? 'A' : points >= 155 ? 'B' : points >= 110 ? 'C' : 'D';
  const medals = [];
  const add = (score, title, sub) => medals.push({ score, title, sub });
  if (won && st.taken === 0) add(100, 'Flawless', 'No damage taken');
  if (won && hp < 0.15) add(90, 'Close call', 'Won on the last sliver of HP');
  if (won && S.result && S.result.reason === 'ko' && secs < 25) add(70, 'Lightning win', `Knockout in ${Math.round(secs)} seconds`);
  if (st.combo >= 4) add(40 + st.combo * 4, `${st.combo}-hit combo`, `${st.comboDmg} damage`);
  if (st.ultChains >= 1) add(75, 'Ultimate cancel', 'Chained a hit into the Ultimate');
  if (st.fires >= 1) add(60 + st.fires * 8, st.fires > 1 ? `On fire ×${st.fires}` : 'On fire', 'Filled the heat gauge');
  if (st.perfect >= 1) add(45 + st.perfect * 10, st.perfect > 1 ? `${st.perfect} perfect dodges` : 'Perfect dodge', 'Dodged at the last moment');
  if (st.counters + st.punishes >= 3) add(35 + (st.counters + st.punishes) * 3, `${st.counters + st.punishes} counter hits`, 'Caught the foe mid-attack');
  if (st.slams >= 2) add(30 + st.slams * 5, `${st.slams} wall slams`, 'Used the arena');
  if (st.clashes >= 2) add(28 + st.clashes * 5, `${st.clashes} clashes`, 'Met attack with attack');
  if (st.finishers >= 5) add(20 + st.finishers * 2, `${st.finishers} finishers`, 'Completed basic strings');
  if (st.breaks >= 2) add(26, `${st.breaks} breaks`, 'Burst out of combos');
  if (st.armors >= 2) add(26, `Armoured ×${st.armors}`, 'Powered through basic hits');
  medals.sort((a, b) => b.score - a.score);
  return { points, rank, medals: medals.slice(0, 4), st };
}
