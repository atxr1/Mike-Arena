// Cinematic director: everything that makes a match play like a broadcast cut rather than a fixed camera.
// It never touches the simulation. It reads sim events and decides
//   - the camera: dynamic zoom (one integer step closer while both fighters fit, punch-ins for big moments,
//     a short zoom kick on heavy hits) and a focus point blended into the world camera;
//   - presentation holds: the battle scene stops stepping the sim while an Ultimate cut-in or the deciding
//     knockout lands (the sim only advances on recorded inputs, so replays stay exact);
//   - full-screen treatment: letterbox bars, stage dimming, anime impact frames (inverted for a frame or two),
//     a vignette, the Ultimate / Mega cut-in band, the K.O. / Fight! / Time! stamps, the arena title card and the
//     winner's lower third.
// Drawing here is device-resolution vector UI on top of the pixel world, like the HUD (brief §10).
import { TYPE_COLORS } from '../core/util.js';
import { CONTENT } from '../game/content.js';

const F_COND = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", sans-serif';
const F_SEMI = '"Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", sans-serif';
const INK = '#05030c', GOLD = '#ffd25a', CREAM = '#fff6e6', DIM = '#b9b0d6';
const easeOut = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
const easeBack = (u) => { u = Math.min(1, Math.max(0, u)); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const approach = (v, t, rate, dt) => v + (t - v) * (1 - Math.pow(1 - rate, dt));

const PORTRAIT_PREF = {
  ult: ['Shouting', 'Determined', 'Angry', 'Inspired', 'Normal'],
  win: ['Joyous', 'Happy', 'Inspired', 'Determined', 'Normal'],
  ko: ['Pain', 'Sad', 'Surprised', 'Normal'],
};

export class Director {
  constructor(app, opts = {}) {
    this.app = app; this.g = app.gfx;
    this.reduced = !!opts.reduced;          // Settings → reduced motion: no impact frames, gentler kicks
    this.replay = !!opts.replay;            // Play of the Match: permanent letterbox, replay chrome
    this.keff = 0; this.gameK = 0; this.fitFrames = 0; this.kick = 0;
    this.focus = { x: 0, y: 0, w: 0 };
    this.shot = null; this.intro = null;
    this.letter = this.replay ? 1 : 0; this.dim = 0;
    this.hold = 0; this.invert = 0; this.lastInvert = -999; this.frames = 0;
    this.cut = null; this.stamp = null; this.lower = null; this.card = null;
    this.victory = false;
  }
  // ------------------------------------------------------------------------------------------ events
  event(S, ev, me) {
    switch (ev.e) {
      case 'ultimate': {
        const f = ev.f, m = f.move && f.move.def;
        const type = (m && m.type) || f.types[0];
        const hold = this.reduced ? 28 : 46;
        this.hold = Math.max(this.hold, hold);
        // the band starts sliding out as the hold ends, so it never covers live play
        this.cut = { kind: 'ult', f, side: f.side, name: ev.name, label: 'Ultimate', type, col: TYPE_COLORS[type] || '#ff8a3d', t: 0, dur: hold + 9, mine: f.side === me };
        this.shotOn({ f, dk: 1, frames: hold + 9, letter: true, dim: true });
        this.dimFor = f; this.kickZoom(0.1);
        break;
      }
      case 'mega': {
        const f = ev.f;
        this.cut = { kind: 'mega', f, side: f.side, name: ev.name, label: ev.primal ? 'Primal Reversion' : 'Mega Evolution', type: f.types[0], col: ev.primal ? '#3a7bff' : '#c46bff', t: 0, dur: 64, mine: f.side === me };
        this.shotOn({ f, dk: 1, frames: 64, letter: true, dim: true });
        break;
      }
      case 'hit': {
        if (ev.multi || ev.statusOnly || !(ev.dmg > 0) || !ev.heavy) break;
        this.kickZoom(ev.ult ? 0.12 : 0.06);
        if (ev.ult || ev.eff > 1) this.flashInvert(2);
        break;
      }
      case 'faint': {
        if (ev.final) {
          this.flashInvert(3, true);
          this.hold = Math.max(this.hold, this.reduced ? 8 : 16);
          this.shotOn({ f: ev.f, dk: 1, frames: 150, letter: true, dy: -26 });   // subject low in frame, the K.O. above it
          this.stamp = { text: 'K.O.', col: GOLD, t: 0, dur: 120, high: true };
          this.dimFor = null;
        } else this.shotOn({ f: ev.f, dk: 1, frames: 70 });
        break;
      }
      case 'victory': {
        const f = ev.f, sd = S.sides[f.side], tr = sd && sd.trainer ? CONTENT.trainers[sd.trainer] : null;
        this.victory = true;
        this.shotOn({ f, dk: 1, frames: 99999, letter: true });
        const how = S.result && S.result.reason === 'time' ? 'on time' : S.result && S.result.reason === 'sudden' ? 'in sudden death' : 'by knockout';
        const you = f.side === me ? 'You win' : 'You lose';
        this.lower = { f, title: tr ? tr.name : f.sp.name, sub: tr ? `${how === 'by knockout' ? `${f.sp.name} lands the last knockout` : `Wins ${how}`} · ${you}` : `Wins ${how} · ${you}`, col: TYPE_COLORS[f.types[0]] || GOLD, t: 0, win: f.side === me };
        break;
      }
      case 'timeup': this.stamp = { text: 'Time!', col: CREAM, t: 0, dur: 90 }; this.shotOn({ frames: 120, letter: true }); break;
      case 'draw': this.stamp = { text: 'Draw', col: CREAM, t: 0, dur: 90 }; break;
      case 'perfect': this.kickZoom(0.08); if (!this.shot) this.shotOn({ f: ev.f, dk: 1, frames: 28 }); break;
      // a Pokémon coming in mid-match (replacement or switch) gets its moment on camera
      case 'sendOut': if (this.live && !this.victory) { this.shotOn({ f: ev.f, dk: 1, frames: 46 }); this.trainerCall(S, ev.f, ev.f.sp.name === 'Pikachu' && S.sides[ev.f.side].trainer === 'ash' ? 'Pikachu, I choose you!' : `Go, ${ev.f.sp.name}!`); } break;
      case 'recallStart': this.trainerCall(S, ev.f, `${ev.f.sp.name}, come back!`); break;
      case 'wallSlam': this.kickZoom(0.09); break;
      case 'clash': this.kickZoom(0.07); break;
      // mid-match announcements: high on screen, no letterbox, the HUD stays up (the clock keeps running)
      case 'sudden': this.stamp = { text: 'Sudden death', sub: 'The next hit wins', col: '#ff5a5a', t: 0, dur: 80, small: true, top: true }; this.kickZoom(0.06); break;
      case 'overtime': this.stamp = { text: 'Overtime', sub: 'Double stamina: it refills twice as fast', col: '#ffb347', t: 0, dur: 80, small: true, top: true }; break;
    }
  }
  shotOn(s) { this.shot = Object.assign({ t: 0, dk: 0 }, s); }
  // Trainer Battles: the trainer calls their Pokémon in and out, anime style
  trainerCall(S, f, line) {
    const sd = S.sides[f.side], T = sd && sd.trainer ? CONTENT.trainers[sd.trainer] : null;
    if (!T) return;
    if (sd.trainer === 'red') line = '…';
    this.call = { img: this.g.trainers.get(T.portrait), name: T.name, line, side: f.side, col: T.color || GOLD, t: 0, dur: 100 };
  }
  kickZoom(a) { this.kick = Math.max(this.kick, this.reduced ? a * 0.4 : a); }
  flashInvert(n, force) {
    if (this.reduced) return;
    if (!force && this.frames - this.lastInvert < 90) return;   // never strobe: at most one impact frame every 1.5 s
    this.invert = n; this.lastInvert = this.frames;
  }
  // establishing shot before the send-outs: a slow push across the arena under the title card
  startIntro(S, setup) {
    const map = S.map, P = map.play;
    const fmt = setup.format === 'trainer' ? 'Trainer Battle' : 'Pokémon Battle';
    const env = { ground: 'Ground', water: 'Water', air: 'Air' }[setup.env] || '';
    this.intro = { t: 0, dur: 104, x0: P.x0 + (P.x1 - P.x0) * 0.22, x1: (P.x0 + P.x1) / 2, y: (P.y0 + P.y1) / 2 - 6 };
    this.card = { title: map.name, sub: `${map.region} · ${env} · ${fmt}${setup.title ? ' · ' + setup.title : ''}`, t: 0, dur: 150 };
    this.letter = 1;
  }
  get introDone() { return !this.intro || this.intro.t >= this.intro.dur; }
  endIntro() { this.intro = null; this.introOut = 600; }   // letterbox stays until the send-outs land and Fight! is called
  fight() { this.stamp = { text: 'Fight!', col: '#ffb347', t: 0, dur: 52 }; this.introOut = 0; this.live = true; }
  // ------------------------------------------------------------------------------------------ per frame
  // dt: real frames elapsed (60 Hz units, already multiplied by the test speed)
  frame(dt, S) {
    this.frames += 1;
    this.hold = Math.max(0, this.hold - dt);
    if (this.invert > 0) this.invert--;
    if (this.intro) this.intro.t += dt;
    if (this.introOut > 0) this.introOut -= dt;
    const sh = this.shot;
    if (sh) { sh.t += dt; if (sh.t >= sh.frames) this.shot = null; }
    if (this.dimFor && !(this.dimFor.move && this.dimFor.move.ult) && !(this.shot && this.shot.dim)) this.dimFor = null;
    for (const k of ['cut', 'stamp', 'card', 'call']) { const o = this[k]; if (o) { o.t += dt; if (o.t >= o.dur) this[k] = null; } }
    if (this.lower) this.lower.t += dt;
    const wantLetter = this.replay || this.intro || this.introOut > 0 || this.cut || this.victory || (this.shot && this.shot.letter) || this.hold > 0;
    this.letter = approach(this.letter, wantLetter ? 1 : 0, wantLetter ? 0.22 : 0.12, dt);
    const wantDim = (this.shot && this.shot.dim) || this.dimFor ? 0.5 : 0;
    this.dim = approach(this.dim, wantDim, 0.2, dt);
    this.kick *= Math.pow(0.84, dt);
    if (this.kick < 0.002) this.kick = 0;
  }
  // camera for this frame: effective pixel scale (integer at rest) and a focus point for the world camera
  camera(S, v, dt) {
    const k = v.k;
    if (!this.keff) { this.keff = k; this.gameK = k; }
    // gameplay framing: one step closer while everything on the field fits between the HUD bands
    const fs = S.fighters().filter((f) => f.onField || f.state === 'faint');
    let want = k;
    if (fs.length && !this.intro) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const f of fs) {
        const r = f.serpent ? 60 : 30;
        x0 = Math.min(x0, f.x - r); x1 = Math.max(x1, f.x + r);
        y0 = Math.min(y0, f.y - 52 - (f.z || 0)); y1 = Math.max(y1, f.y + 14);
      }
      const kz = k + 1, vw = v.cw / kz, vh = v.ch / kz, bands = (v.bandTop + v.bandBottom) * v.dpr / kz;
      const fits = x1 - x0 <= vw * 0.84 && y1 - y0 <= (vh - bands) * 0.9;
      this.fitFrames = fits ? this.fitFrames + dt : 0;
      want = this.gameK > k ? (fits ? k + 1 : k) : (this.fitFrames > 45 ? k + 1 : k);
    }
    this.gameK = want;
    let target = want;
    if (this.shot && this.shot.dk) target = Math.max(target, k + this.shot.dk);
    if (this.intro) target = k;
    this.keff = approach(this.keff, target, target < this.keff ? 0.2 : 0.14, dt);
    if (Math.abs(this.keff - target) < 0.015) this.keff = target;
    // focus: the shot's subject, or the establishing pan
    let fx = 0, fy = 0, fw = 0;
    if (this.intro) {
      const u = easeOut(this.intro.t / this.intro.dur);
      fx = this.intro.x0 + (this.intro.x1 - this.intro.x0) * u; fy = this.intro.y; fw = 1;
    } else if (this.shot && this.shot.f) {
      const f = this.shot.f; fx = f.x; fy = f.y - 18 - (f.z || 0) * 0.5 + (this.shot.dy || 0); fw = this.shot.t < 6 ? this.shot.t / 6 : 1;
    }
    this.focus.w = approach(this.focus.w, fw, 0.18, dt);
    if (fw > 0) { this.focus.x = fx; this.focus.y = fy; }
    return { keff: this.keff + this.kick, focus: this.focus.w > 0.01 ? this.focus : null };
  }
  // ------------------------------------------------------------------------------------------ drawing
  // vignette over the pixel world (below the HUD)
  drawVignette(c, v) {
    const a = 0.26 + 0.24 * this.letter;
    const key = v.w + 'x' + v.h;
    if (this.vigKey !== key) {
      const g = c.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h / 2, Math.hypot(v.w, v.h) * 0.62);
      g.addColorStop(0, 'rgba(5,3,12,0)'); g.addColorStop(1, 'rgba(5,3,12,1)');
      this.vig = g; this.vigKey = key;
    }
    c.save(); c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.globalAlpha = a; c.fillStyle = this.vig; c.fillRect(0, 0, v.w, v.h);
    // low HP: the edges pulse red (the heartbeat of a close match)
    this.dangerA = approach(this.dangerA || 0, this.danger ? 1 : 0, 0.08, 1);
    if (this.dangerA > 0.02) {
      if (!this.vigR || this.vigRKey !== key) { const g = c.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.42, v.w / 2, v.h / 2, Math.hypot(v.w, v.h) * 0.6); g.addColorStop(0, 'rgba(200,20,40,0)'); g.addColorStop(1, 'rgba(200,20,40,1)'); this.vigR = g; this.vigRKey = key; }
      c.globalAlpha = this.dangerA * (0.18 + 0.14 * Math.sin(this.frames * 0.12)); c.fillStyle = this.vigR; c.fillRect(0, 0, v.w, v.h);
    }
    c.restore();
  }
  barH(v) { return Math.round(v.h * 0.105 * this.letter); }
  // letterbox, cut-ins, stamps, title card, lower third (above the HUD)
  drawOverlay(c, v) {
    c.save(); c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.textBaseline = 'alphabetic';
    const bh = this.barH(v);
    if (bh > 0) {
      c.fillStyle = INK; c.fillRect(0, 0, v.w, bh); c.fillRect(0, v.h - bh, v.w, bh);
      c.fillStyle = 'rgba(255,210,90,0.35)'; c.fillRect(0, bh - 1, v.w, 1); c.fillRect(0, v.h - bh, v.w, 1);
    }
    if (this.replay) this.drawReplayChrome(c, v, bh);
    if (this.card) this.drawCard(c, v, bh);
    if (this.cut) this.drawCut(c, v);
    if (this.stamp) this.drawStamp(c, v);
    if (this.lower) this.drawLower(c, v, bh);
    if (this.call && this.letter < 0.5) this.drawCall(c, v);
    c.restore();
  }
  portrait(f, kind) {
    const id = f.spriteId || f.sp.sprite;
    const img = this.g.portraits.get(id) || this.g.portraits.get(f.sp.sprite);
    const meta = CONTENT.sprites[id] || CONTENT.sprites[f.sp.sprite];
    if (!img || !meta || !meta.portraits) return null;
    for (const n of PORTRAIT_PREF[kind]) { const i = meta.portraits.indexOf(n); if (i >= 0) return { img, sx: i * 40 }; }
    return { img, sx: 0 };
  }
  drawCut(c, v) {
    const C = this.cut, t = C.t, inT = 9, outT = 9;
    const u = t < inT ? easeOut(t / inT) : t > C.dur - outT ? 1 - easeOut((t - (C.dur - outT)) / outT) : 1;
    const fromLeft = C.side === 0;
    const H = Math.min(156, v.h * 0.4), y = v.h * 0.5 - H / 2, sk = H * 0.32;
    const off = (1 - u) * (v.w + sk) * (fromLeft ? -1 : 1);
    c.save();
    c.translate(off, 0);
    // band
    c.beginPath(); c.moveTo(-sk, y); c.lineTo(v.w + sk, y); c.lineTo(v.w, y + H); c.lineTo(-sk * 2, y + H); c.closePath();
    const g = c.createLinearGradient(0, y, 0, y + H);
    g.addColorStop(0, shade(C.col, 0.55)); g.addColorStop(0.5, shade(C.col, 0.32)); g.addColorStop(1, shade(C.col, 0.18));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    // speed lines racing across the band
    c.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 22; i++) {
      const ly = y + ((i * 37) % 100) / 100 * H, len = 60 + (i * 53) % 140;
      const lx = ((i * 211 + C.t * (26 + (i % 5) * 7)) % (v.w + 300)) - 150;
      c.fillRect(fromLeft ? lx : v.w - lx - len, ly, len, i % 3 ? 1 : 2);
    }
    // portrait, framed in a slanted window
    const P = this.portrait(C.f, 'ult');
    const ps = H * 1.02, px = fromLeft ? v.w * 0.07 : v.w * 0.93 - ps, py = y + (H - ps) / 2;
    if (P) {
      c.save();
      c.beginPath(); c.moveTo(px + sk * 0.5, py); c.lineTo(px + ps + sk * 0.5, py); c.lineTo(px + ps - sk * 0.5, py + ps); c.lineTo(px - sk * 0.5, py + ps); c.closePath();
      c.clip();
      c.imageSmoothingEnabled = false;
      const zoom = 1 + 0.06 * Math.min(1, t / 40);
      const d = ps * zoom;
      c.drawImage(P.img, P.sx, 0, 40, 40, px + (ps - d) / 2, py + (ps - d) / 2, d, d);
      c.restore();
      c.strokeStyle = GOLD; c.lineWidth = 3;
      c.beginPath(); c.moveTo(px + sk * 0.5, py); c.lineTo(px + ps + sk * 0.5, py); c.lineTo(px + ps - sk * 0.5, py + ps); c.lineTo(px - sk * 0.5, py + ps); c.closePath(); c.stroke();
    }
    c.restore();
    // edges
    c.fillStyle = GOLD; c.fillRect(-sk * 2, y, v.w + sk * 3, 3); c.fillRect(-sk * 2, y + H - 3, v.w + sk * 3, 3);
    // text block
    const tx = fromLeft ? px + ps + 26 : px - 26;
    c.textAlign = fromLeft ? 'left' : 'right';
    c.font = `italic 700 ${Math.round(H * 0.13)}px ${F_COND}`; c.fillStyle = GOLD;
    c.fillText(`${C.f.sp.name} · ${C.label}`, tx, y + H * 0.3);
    const size = C.size || (C.size = fitFont(c, C.name, Math.round(H * 0.42), Math.max(120, (fromLeft ? v.w - tx : tx) - 24), `italic 900 #px ${F_COND}`));
    c.font = `italic 900 ${size}px ${F_COND}`;
    const nameY = y + H * 0.3 + size * 0.98;
    c.fillStyle = shade(C.col, 0.12); c.fillText(C.name, tx + (fromLeft ? 4 : -4), nameY + 4);
    c.fillStyle = CREAM; c.fillText(C.name, tx, nameY);
    c.restore();
  }
  drawStamp(c, v) {
    const S = this.stamp, t = S.t;
    const inT = 9, u = easeBack(t / inT), out = t > S.dur - 12 ? (t - (S.dur - 12)) / 12 : 0;
    const scale = 2.3 - 1.3 * u;
    const size = S.small ? Math.min(78, v.h * 0.2) : Math.min(150, v.h * 0.34);
    c.save();
    c.globalAlpha = 1 - out;
    // the K.O. lands above the falling fighter (who is centred by the shot), Fight!/Time! mid-screen
    c.translate(v.w / 2, (S.top ? v.h * 0.3 : S.high ? v.h * 0.36 : v.h / 2) + size * 0.32);
    // slash bars wiping behind the word
    const wipe = easeOut(t / 10);
    c.save(); c.rotate(-0.12);
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(-v.w * 0.6, -size * 0.62, v.w * 1.2 * wipe, size * 0.08);
    c.fillStyle = S.col === GOLD ? '#e8333c' : shade(S.col, 0.5); c.fillRect(v.w * 0.6 - v.w * 1.2 * wipe, -size * 0.08, v.w * 1.2 * wipe, size * 0.14);
    c.restore();
    c.scale(scale, scale); c.rotate(-0.07);
    c.font = `italic 900 ${size}px ${F_COND}`; c.textAlign = 'center';
    c.lineJoin = 'round'; c.lineWidth = Math.max(6, size * 0.09); c.strokeStyle = INK;
    c.fillStyle = '#e8333c'; c.fillText(S.text, 6, 6);
    c.strokeText(S.text, 0, 0);
    c.fillStyle = S.col; c.fillText(S.text, 0, 0);
    if (S.sub) { c.rotate(0.07); c.font = `600 ${Math.round(size * 0.24)}px ${F_SEMI}`; c.lineWidth = 4; c.strokeText(S.sub, 0, size * 0.42); c.fillStyle = CREAM; c.fillText(S.sub, 0, size * 0.42); }
    c.restore();
  }
  drawCard(c, v, bh) {
    const C = this.card, t = C.t;
    const u = easeOut(t / 18), out = t > C.dur - 16 ? (t - (C.dur - 16)) / 16 : 0;
    const x = v.w * 0.05 + (1 - u) * -40, y = v.h - Math.max(bh, 30) - 22;
    c.save(); c.globalAlpha = Math.min(u, 1 - out);
    c.textAlign = 'left';
    c.fillStyle = GOLD; c.fillRect(x, y - 62, 4, 66);
    c.font = `italic 900 ${Math.round(Math.min(52, v.h * 0.12))}px ${F_COND}`; c.fillStyle = CREAM;
    c.fillText(C.title, x + 16, y - 18);
    c.font = `600 ${Math.round(Math.min(17, v.h * 0.042))}px ${F_SEMI}`; c.fillStyle = DIM;
    c.fillText(C.sub, x + 18, y + 2);
    c.restore();
  }
  drawLower(c, v, bh) {
    const L = this.lower, u = easeOut((L.t - 20) / 16);
    if (u <= 0) return;
    const H = Math.min(84, v.h * 0.2), x = v.insets ? v.insets.l : 0, y = v.h - Math.max(bh, 24) - H - 14;
    const W = Math.min(v.w * 0.62, 460), sk = 18, off = (1 - u) * -(W + 40);
    c.save(); c.translate(off, 0);
    c.beginPath(); c.moveTo(0, y); c.lineTo(W + sk, y); c.lineTo(W, y + H); c.lineTo(0, y + H); c.closePath();
    c.fillStyle = 'rgba(22,18,46,0.94)'; c.fill();
    c.fillStyle = L.col; c.fillRect(0, y, 8, H);
    c.fillStyle = GOLD; c.fillRect(0, y + H - 3, W, 3);
    const P = this.portrait(L.f, 'win');
    let tx = 24;
    if (P) { c.imageSmoothingEnabled = false; c.drawImage(P.img, P.sx, 0, 40, 40, 20, y + 8, H - 16, H - 16); c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(20, y + 8, H - 16, H - 16); tx = H + 16; }
    c.textAlign = 'left';
    c.font = `italic 900 ${Math.round(H * 0.46)}px ${F_COND}`; c.fillStyle = CREAM; c.fillText(L.title, tx, y + H * 0.52);
    c.font = `600 ${Math.round(H * 0.2)}px ${F_SEMI}`; c.fillStyle = L.win ? GOLD : DIM; c.fillText(L.sub, tx + 2, y + H * 0.82);
    c.restore();
  }
  drawCall(c, v) {
    const C = this.call, u = easeOut(C.t / 10), out = C.t > C.dur - 12 ? (C.t - (C.dur - 12)) / 12 : 0;
    // bottom-left, clear of the HUD panels, the switch strip, the move banners and the touch buttons
    const left = true, H = 44, W = Math.min(260, v.w * 0.3), ins = v.insets || { l: 0, r: 0, t: 0, b: 0 };
    const y = v.h - (ins.b || 0) - 62 - H, x0 = (ins.l || 0) + 10, off = (1 - u) * -(W + 30);
    c.save(); c.globalAlpha = 1 - out; c.translate(off, 0);
    c.beginPath();
    if (left) { c.moveTo(x0, y); c.lineTo(x0 + W, y); c.lineTo(x0 + W - 12, y + H); c.lineTo(x0, y + H); }
    else { c.moveTo(x0 + 12, y); c.lineTo(x0 + W, y); c.lineTo(x0 + W, y + H); c.lineTo(x0, y + H); }
    c.closePath(); c.fillStyle = 'rgba(22,18,46,0.92)'; c.fill();
    c.fillStyle = C.col; c.fillRect(left ? x0 : x0 + W - 4, y, 4, H);
    const px = left ? x0 + 8 : x0 + W - 8 - (H - 8);
    if (C.img) { c.save(); c.beginPath(); c.rect(px, y + 4, H - 8, H - 8); c.clip(); const ar = C.img.width / C.img.height; c.drawImage(C.img, px, y + 4, (H - 8) * Math.max(1, ar), H - 8); c.restore(); }
    c.textAlign = left ? 'left' : 'right';
    const tx = left ? px + H : px - 8;
    c.font = `600 11px ${F_SEMI}`; c.fillStyle = C.col; c.fillText(C.name, tx, y + 16);
    c.font = `italic 800 ${fitFont(c, C.line, 19, W - H - 22, `italic 800 #px ${F_COND}`)}px ${F_COND}`; c.fillStyle = CREAM; c.fillText(C.line, tx, y + 36);
    c.restore();
  }
  drawReplayChrome(c, v, bh) {
    if (bh < 14) return;
    c.save();
    c.font = `italic 800 ${Math.round(bh * 0.5)}px ${F_COND}`; c.textAlign = 'left'; c.fillStyle = GOLD;
    const y = bh * 0.68, x = (v.insets ? v.insets.l : 0) + 18;
    c.fillText('Play of the Match', x, y);
    c.textAlign = 'right';
    const blink = (this.frames >> 4) % 2 === 0;
    c.fillStyle = blink ? '#ff4d4d' : 'rgba(255,77,77,0.35)'; c.fillRect(v.w - (v.insets ? v.insets.r : 0) - 86, y - bh * 0.3, bh * 0.3, bh * 0.3);
    c.fillStyle = CREAM; c.font = `600 ${Math.round(bh * 0.4)}px ${F_SEMI}`; c.fillText('Replay', v.w - (v.insets ? v.insets.r : 0) - 18, y);
    c.textAlign = 'center'; c.fillStyle = DIM; c.fillText('Tap or ✕ to skip', v.w / 2, v.h - bh * 0.32);
    c.restore();
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1, 7), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}
function fitFont(c, text, size, maxW, tmpl) {
  for (let s = size; s > 14; s -= 2) { c.font = tmpl.replace('#', s); if (c.measureText(text).width <= maxW) return s; }
  return 14;
}
