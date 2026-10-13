import React, { useEffect, useRef } from 'react';
import { prefersReducedMotion, readBest, saveBest } from './storage';

// Books, scrolls and stars fall; move the satchel to catch them and dodge the
// red ✕ blots. Drag / tap where to go, or ← →. Three blots and the round ends.
// Until the player touches it, the satchel plays itself.

const BEST_KEY = 'nmGameBest.catch';
const W = 320, H = 200;
const BAG_Y = H - 22, BAG_W = 44;

type Kind = 'book' | 'scroll' | 'star' | 'blot';
type Drop = { x: number; y: number; v: number; kind: Kind; spin: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; c: string };
type Pop = { x: number; y: number; txt: string; life: number; bad: boolean };
const POINTS: Record<Kind, number> = { book: 1, scroll: 2, star: 5, blot: 0 };

interface State {
  manual: boolean; over: boolean; paused: boolean;
  bagX: number; target: number; keyDir: number;
  drops: Drop[]; sparks: Spark[]; pops: Pop[];
  spawnIn: number; score: number; best: number; lives: number; t: number;
  squash: number; combo: number; restartAt: number;
}

const newState = (best: number): State => ({
  manual: false, over: false, paused: false,
  bagX: W / 2, target: W / 2, keyDir: 0,
  drops: [], sparks: [], pops: [],
  spawnIn: 0.4, score: 0, best, lives: 3, t: 0,
  squash: 0, combo: 0, restartAt: 0,
});

const STARS = Array.from({ length: 30 }, () => ({
  x: Math.random() * W, y: Math.random() * (H - 50), r: Math.random() * 1.1 + 0.3, p: Math.random() * 6,
}));

export const CatchGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const reduced = prefersReducedMotion();
    const s: State = newState(readBest(BEST_KEY));
    let raf = 0;
    let last = performance.now();
    let alive = true;

    const reset = () => {
      const { best, manual } = s;
      Object.assign(s, newState(best), { manual });
    };

    const fit = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const burst = (x: number, y: number, col: string, n = 10) => {
      if (reduced) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
        s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.3, c: col });
      }
    };

    const spawn = () => {
      const r = Math.random();
      const hard = Math.min(1, s.t / 60);
      const kind: Kind = r < 0.18 + hard * 0.14 ? 'blot' : r < 0.3 + hard * 0.1 ? 'star' : r < 0.55 ? 'scroll' : 'book';
      s.drops.push({ x: 16 + Math.random() * (W - 32), y: -14, v: 70 + Math.random() * 35 + hard * 80, kind, spin: Math.random() * 6 });
      s.spawnIn = Math.max(0.35, 0.9 - hard * 0.45) * (0.7 + Math.random() * 0.6);
    };

    const autopilot = () => {
      const good = s.drops.filter(d => d.kind !== 'blot' && d.y < BAG_Y).sort((a, b) => b.y - a.y)[0];
      let x = good ? good.x : W / 2;
      const blot = s.drops.find(d => d.kind === 'blot' && d.y > BAG_Y - 60 && d.y < BAG_Y && Math.abs(d.x - x) < BAG_W);
      if (blot) x = blot.x > W / 2 ? blot.x - BAG_W * 1.3 : blot.x + BAG_W * 1.3;
      s.target = x;
    };

    const step = (dt: number, now: number) => {
      if (s.over) {
        if (!s.manual && s.restartAt && now > s.restartAt) reset();
        return;
      }
      s.t += dt;
      if (!s.manual) autopilot();
      if (s.keyDir) s.target = s.bagX + s.keyDir * 46;
      s.target = Math.max(BAG_W / 2, Math.min(W - BAG_W / 2, s.target));
      s.bagX += (s.target - s.bagX) * Math.min(1, dt * 14);
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) spawn();
      for (const d of s.drops) { d.y += d.v * dt; d.spin += dt * 3; }
      s.drops = s.drops.filter(d => {
        if (d.y >= BAG_Y - 8 && d.y <= BAG_Y + 6 && Math.abs(d.x - s.bagX) < BAG_W / 2 + 6) {
          if (d.kind === 'blot') {
            s.lives--; s.combo = 0;
            burst(d.x, BAG_Y - 6, '#f87171', 14);
            s.pops.push({ x: d.x, y: BAG_Y - 18, txt: '✕', life: 0.8, bad: true });
            if (s.lives <= 0) {
              s.over = true;
              if (s.manual && s.score > s.best) { s.best = s.score; saveBest(BEST_KEY, s.best); }
              if (!s.manual) s.restartAt = now + 900;
            }
          } else {
            s.combo++;
            const pts = POINTS[d.kind] * (s.combo >= 5 ? 2 : 1);
            s.score += pts; s.squash = 1;
            burst(d.x, BAG_Y - 6, d.kind === 'star' ? '#facc15' : d.kind === 'scroll' ? '#fbbf24' : '#5eead4');
            s.pops.push({ x: d.x, y: BAG_Y - 18, txt: `+${pts}`, life: 0.7, bad: false });
          }
          return false;
        }
        if (d.y >= H + 14 && d.kind !== 'blot') s.combo = 0;
        return d.y < H + 14;
      });
      s.squash = Math.max(0, s.squash - dt * 5);
      s.sparks.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; });
      s.sparks = s.sparks.filter(p => p.life > 0);
      s.pops.forEach(p => { p.life -= dt; p.y -= dt * 30; });
      s.pops = s.pops.filter(p => p.life > 0);
    };

    const rr = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };

    const drawDrop = (d: Drop) => {
      c.save();
      c.translate(d.x, d.y);
      c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 3;
      if (d.kind === 'book') {
        c.rotate(Math.sin(d.spin) * 0.25);
        const g = c.createLinearGradient(-10, -12, 10, 12); g.addColorStop(0, '#8affdf'); g.addColorStop(0.5, '#2ee6b6'); g.addColorStop(1, '#0f9c7b');
        c.fillStyle = g; rr(-10, -12, 20, 24, 4);
        c.shadowColor = 'transparent';
        c.fillStyle = '#0b6e57'; rr(-10, -12, 4.5, 24, 2);
        c.fillStyle = 'rgba(255,255,255,.55)'; rr(-4, -10, 12, 3, 1.5);
        c.fillStyle = 'rgba(4,38,29,.55)'; rr(-2, -4, 8, 2, 1); rr(-2, 0, 8, 2, 1);
        c.fillStyle = '#fef9e7'; c.fillRect(-5.5, 10, 14, 2);
      } else if (d.kind === 'scroll') {
        c.rotate(Math.sin(d.spin) * 0.3);
        c.fillStyle = '#fde68a'; rr(-10, -7, 20, 14, 3);
        c.shadowColor = 'transparent';
        c.fillStyle = '#d97706'; rr(-12.5, -8.5, 5, 17, 2.5); rr(7.5, -8.5, 5, 17, 2.5);
        c.fillStyle = 'rgba(255,255,255,.45)'; rr(-12, -8, 2, 15, 1);
        c.fillStyle = 'rgba(146,64,14,.5)'; c.fillRect(-5, -3, 10, 1.5); c.fillRect(-5, 1, 8, 1.5);
      } else if (d.kind === 'star') {
        c.rotate(reduced ? 0 : d.spin);
        c.shadowColor = 'rgba(250,204,21,.8)'; c.shadowBlur = 12; c.shadowOffsetY = 0;
        c.fillStyle = '#facc15';
        c.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 10.5, a = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath(); c.fill();
      } else {
        const pulse = reduced ? 1 : 1 + Math.sin(d.spin * 3) * 0.06;
        c.scale(pulse, pulse);
        c.shadowColor = 'rgba(239,68,68,.6)'; c.shadowBlur = 10; c.shadowOffsetY = 0;
        const g = c.createRadialGradient(-3, -4, 1, 0, 0, 11); g.addColorStop(0, '#fca5a5'); g.addColorStop(1, '#dc2626');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, 10.5, 0, Math.PI * 2); c.fill();
        c.shadowColor = 'transparent';
        c.strokeStyle = '#fff'; c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-4, -4); c.lineTo(4, 4); c.moveTo(4, -4); c.lineTo(-4, 4); c.stroke();
      }
      c.restore();
    };

    const heart = (x: number, y: number, full: boolean, light: boolean) => {
      c.save(); c.translate(x, y); c.scale(0.6, 0.6);
      c.beginPath();
      c.moveTo(0, 4); c.bezierCurveTo(0, 0, -8, -2, -8, 4); c.bezierCurveTo(-8, 9, -2, 12, 0, 15); c.bezierCurveTo(2, 12, 8, 9, 8, 4); c.bezierCurveTo(8, -2, 0, 0, 0, 4);
      c.fillStyle = full ? '#f43f5e' : light ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.16)'; c.fill();
      c.restore();
    };

    const draw = () => {
      const light = !document.documentElement.classList.contains('dark');
      const ac = light ? '#0fb591' : '#2ee6b6';
      const muted = light ? '#64748b' : '#9a9aa3';
      const ink = light ? '#0f172a' : '#ffffff';

      // sky: near-black with a mint glow (dark) / soft white glass (light)
      const sky = c.createLinearGradient(0, 0, 0, H);
      if (light) { sky.addColorStop(0, '#f8fafc'); sky.addColorStop(1, '#e6f7f1'); }
      else { sky.addColorStop(0, '#0b0b0e'); sky.addColorStop(1, '#06201a'); }
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const glow = c.createRadialGradient(W * 0.15, -20, 10, W * 0.15, -20, 220);
      glow.addColorStop(0, light ? 'rgba(46,230,182,.20)' : 'rgba(46,230,182,.16)'); glow.addColorStop(1, 'rgba(46,230,182,0)');
      c.fillStyle = glow; c.fillRect(0, 0, W, H);
      STARS.forEach(st => {
        c.globalAlpha = (light ? 0.22 : 0.45) + (reduced ? 0 : Math.sin(s.t * 2 + st.p) * 0.22);
        c.fillStyle = light ? '#0d9488' : '#e2e8f0';
        c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;
      // floor
      const fl = c.createLinearGradient(0, H - 12, 0, H);
      fl.addColorStop(0, 'rgba(46,230,182,.22)'); fl.addColorStop(1, 'rgba(46,230,182,0)');
      c.fillStyle = fl; c.fillRect(0, H - 12, W, 12);
      c.fillStyle = light ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.16)'; c.fillRect(0, H - 12, W, 1);

      s.drops.forEach(drawDrop);

      // satchel — glossy mint, squashes a little on a catch
      const sq = s.squash;
      const bw = BAG_W * (1 + sq * 0.18), bh = 20 * (1 - sq * 0.2);
      const x = s.bagX - bw / 2, y = BAG_Y + 10 - bh;
      c.save();
      c.shadowColor = s.over ? 'rgba(248,113,113,.6)' : 'rgba(46,230,182,.7)'; c.shadowBlur = 16;
      c.strokeStyle = s.over ? '#f87171' : ac; c.lineWidth = 2.5;
      c.beginPath(); c.arc(s.bagX, y + 1, 10, Math.PI, 0); c.stroke();
      const bg = c.createLinearGradient(0, y, 0, y + bh);
      if (s.over) { bg.addColorStop(0, '#fca5a5'); bg.addColorStop(1, '#ef4444'); }
      else { bg.addColorStop(0, '#8affdf'); bg.addColorStop(0.5, '#2ee6b6'); bg.addColorStop(1, '#12b892'); }
      c.fillStyle = bg; rr(x, y, bw, bh, 7);
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.5)'; rr(x + 4, y + 2, bw - 8, 3, 1.5);
      c.fillStyle = '#04261d'; rr(s.bagX - 3, y + 7, 6, 5, 1.5);

      // sparks + floating points
      s.sparks.forEach(p => { c.globalAlpha = Math.max(0, p.life / 0.8); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, 1.8, 0, Math.PI * 2); c.fill(); });
      c.textAlign = 'center';
      c.font = '800 13px system-ui, sans-serif';
      s.pops.forEach(p => { c.globalAlpha = Math.max(0, p.life / 0.8); c.fillStyle = p.bad ? '#f87171' : ac; c.fillText(p.txt, p.x, p.y); });
      c.globalAlpha = 1;

      // HUD: lives left, score pill right
      for (let i = 0; i < 3; i++) heart(16 + i * 14, 9, i < s.lives, light);
      c.font = '800 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      const label = `${s.score}`;
      const tw = c.measureText(label).width + 18;
      c.fillStyle = light ? 'rgba(15,23,42,.07)' : 'rgba(255,255,255,.09)'; rr(W - tw - 8, 7, tw, 20, 10);
      c.fillStyle = ink; c.textAlign = 'center'; c.fillText(label, W - 8 - tw / 2, 21);
      if (s.best) { c.font = '800 9px system-ui, sans-serif'; c.fillStyle = muted; c.textAlign = 'right'; c.fillText(`BEST ${s.best}`, W - tw - 14, 20); }
      if (s.combo >= 3 && !s.over) { c.font = '800 11px system-ui, sans-serif'; c.fillStyle = '#facc15'; c.textAlign = 'center'; c.fillText(`×${s.combo} combo`, W / 2, 20); }

      c.textAlign = 'center';
      if (s.over && s.manual) {
        c.fillStyle = light ? 'rgba(248,250,252,.78)' : 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
        c.fillStyle = ink;
        c.font = '800 20px system-ui, sans-serif';
        c.fillText(`Score ${s.score}`, W / 2, H / 2 - 4);
        c.font = '600 12px system-ui, sans-serif'; c.fillStyle = muted;
        c.fillText(s.score >= s.best && s.score > 0 ? 'New best! Tap to play again' : 'Tap to play again', W / 2, H / 2 + 18);
      } else if (!s.manual) {
        const msg = 'Tap & drag to play';
        c.font = '700 12px system-ui, sans-serif';
        const mw = c.measureText(msg).width + 28;
        c.fillStyle = light ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.1)'; rr(W / 2 - mw / 2, H / 2 - 30, mw, 26, 13);
        c.fillStyle = ink; c.fillText(msg, W / 2, H / 2 - 13);
      }
    };

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (!s.paused) step(dt, now);
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => cancelAnimationFrame(raf);

    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * W;
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      host.focus({ preventScroll: true });
      s.manual = true;
      if (s.over) { reset(); return; }
      s.target = toLocal(e);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const onMove = (e: PointerEvent) => { if (s.manual && (e.buttons || e.pointerType !== 'mouse')) s.target = toLocal(e); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      s.manual = true;
      if (e.type === 'keyup') { s.keyDir = 0; return; }
      if (s.over) { reset(); return; }
      s.keyDir = e.key === 'ArrowLeft' ? -1 : 1;
    };
    const onVis = () => { if (document.hidden) stop(); else start(); };
    const onBlur = () => { s.keyDir = 0; };

    fit();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    host.addEventListener('keydown', onKey);
    host.addEventListener('keyup', onKey);
    host.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener?.('change', fit);
    host.focus({ preventScroll: true });
    start();

    return () => {
      alive = false;
      stop();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      host.removeEventListener('keydown', onKey);
      host.removeEventListener('keyup', onKey);
      host.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener?.('change', fit);
    };
  }, []);

  return (
    <div ref={hostRef} tabIndex={0} className="nmg-area nmg-catch" aria-label="Catch game: drag or use the arrow keys to catch the books and dodge the red blots">
      <canvas ref={canvasRef} className="nmg-canvas" />
    </div>
  );
};
