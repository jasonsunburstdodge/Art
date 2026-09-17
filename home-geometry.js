(() => {
  "use strict";

  // Homepage-only background: abstract kinetic geometry ("Moving Forward").
  // Scattered lines/circles/arcs/squares/triangles drift in a shared ambient
  // field, then scroll position blends in four foreground behaviors, one per
  // pillar section, all sharing the same thin-line/blue-cyan-white vocabulary
  // (no per-pillar colors, no node webs): BUILD assembles a structure,
  // CONNECT snaps matching shapes into open sockets, FIND prunes a field of
  // bezier paths down to a few that converge, and SCALE pulls back to reveal
  // one large abstract form with three paths sweeping through it.

  const canvas = document.getElementById("synapse-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const CYAN = [95, 205, 251];
  const BLUE = [47, 134, 245];
  const WHITE = [242, 246, 255];
  const WARM = [255, 176, 110];

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smoothstep(a, b, x) {
    if (a === b) return x < a ? 0 : 1;
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function windowAlpha(y, start, end, feather) {
    if (end <= start) end = start + 1;
    const rampIn = smoothstep(start - feather, start, y);
    const rampOut = 1 - smoothstep(end, end + feather, y);
    return Math.max(0, Math.min(rampIn, rampOut));
  }
  function localProgress(y, start, end) {
    if (end <= start) return y >= start ? 1 : 0;
    return clamp01((y - start) / (end - start));
  }

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;
  let bounds = { heroEnd: 800, build: [0, 800], connect: [800, 1600], find: [1600, 2400], scaleStart: 2400, scaleEnd: 3200 };

  // ---------------------------------------------------------------------
  // Ambient field: independent drifting geometry, present at every phase.
  // ---------------------------------------------------------------------
  let ambient = [];
  let convergeLines = [];

  function makeAmbient() {
    const depth = 0.3 + Math.random() * 0.7;
    const roll = Math.random();
    const type = roll < 0.30 ? "line" : roll < 0.55 ? "circle" : roll < 0.70 ? "arc"
      : roll < 0.85 ? "square" : roll < 0.95 ? "triangle" : "plane";
    const colorRoll = Math.random();
    const color = colorRoll < 0.05 ? WARM : colorRoll < 0.45 ? CYAN : colorRoll < 0.75 ? BLUE : WHITE;
    return {
      type, depth, color,
      x: Math.random() * width * 1.3 - width * 0.15,
      y: Math.random() * height * 1.6 - height * 0.3,
      angle: (Math.random() * 40 - 20) * Math.PI / 180 - Math.PI / 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() * 0.4 - 0.2) * 0.01,
      size: 18 + Math.random() * 46,
      vx: (Math.random() * 0.3 - 0.15) * depth,
      vy: -(0.12 + Math.random() * 0.22) * depth,
      baseAlpha: 0.10 + depth * 0.22,
      phase: Math.random() * Math.PI * 2
    };
  }

  function buildAmbient() {
    ambient = [];
    for (let i = 0; i < 70; i++) ambient.push(makeAmbient());
    convergeLines = ambient.filter(e => e.type === "line").slice(0, 5);
  }

  let burstUntil = 0;
  window.fireAllSynapses = function fireBurst() {
    if (reduceMotion) return;
    burstUntil = performance.now() + 650;
  };

  function drawAmbient(now, dim) {
    const boosted = now < burstUntil ? 1.5 : 1;
    for (const el of ambient) {
      if (!reduceMotion) {
        el.x += el.vx;
        el.y += el.vy;
        el.rot += el.rotSpeed;
        const margin = 80;
        if (el.y < -margin) { el.y = height + margin; el.x = Math.random() * width; }
        if (el.x < -margin) el.x = width + margin;
        if (el.x > width + margin) el.x = -margin;
      }
      const twinkle = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(now * 0.0006 + el.phase);
      const a = el.baseAlpha * dim * twinkle * boosted;
      if (a <= 0.01) continue;
      ctx.strokeStyle = rgba(el.color, a);
      ctx.fillStyle = rgba(el.color, a * 0.5);
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(el.x, el.y);
      switch (el.type) {
        case "line": {
          const len = el.size * (0.9 + el.depth * 0.6);
          ctx.rotate(el.angle);
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.lineTo(len / 2, 0);
          ctx.stroke();
          break;
        }
        case "circle": {
          ctx.beginPath();
          ctx.arc(0, 0, el.size * 0.28, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case "arc": {
          ctx.rotate(el.rot);
          ctx.beginPath();
          ctx.arc(0, 0, el.size * 0.32, 0, Math.PI * 0.6);
          ctx.stroke();
          break;
        }
        case "square": {
          ctx.rotate(el.rot);
          const s = el.size * 0.32;
          ctx.strokeRect(-s / 2, -s / 2, s, s);
          break;
        }
        case "triangle": {
          ctx.rotate(el.rot);
          const s = el.size * 0.34;
          ctx.beginPath();
          ctx.moveTo(0, -s / 2);
          ctx.lineTo(s / 2, s / 2);
          ctx.lineTo(-s / 2, s / 2);
          ctx.closePath();
          ctx.stroke();
          break;
        }
        case "plane": {
          ctx.rotate(el.rot * 0.3);
          const w = el.size * 0.5, h = el.size * 0.32;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          break;
        }
      }
      ctx.restore();
    }
  }

  function drawHeroConverge(strength) {
    if (strength <= 0.02) return;
    const targetAngle = -Math.PI / 2 - 0.12;
    for (const el of convergeLines) {
      const angle = lerp(el.angle, targetAngle, strength * 0.85);
      const len = el.size * 1.6;
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate(angle);
      ctx.strokeStyle = rgba(WHITE, 0.18 * strength);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------
  // BUILD: geometry becomes structure.
  // ---------------------------------------------------------------------
  function drawBuildModule(alpha, prog, now) {
    if (alpha <= 0.01) return;
    const cx = width * 0.52, cy = height * 0.46;
    const S = Math.min(width * 0.46, height * 0.5, 460);
    const half = S / 2;
    ctx.save();
    ctx.globalAlpha = alpha;

    const outerA = smoothstep(0, 0.10, prog);
    if (outerA > 0.01) {
      ctx.strokeStyle = rgba(WHITE, 0.5 * outerA);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(cx - half, cy - half, S, S);
    }

    const divT = smoothstep(0.10, 0.34, prog);
    if (divT > 0.01) {
      const len = S * divT;
      ctx.strokeStyle = rgba(CYAN, 0.55 * outerA);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - len / 2);
      ctx.lineTo(cx, cy + len / 2);
      ctx.moveTo(cx - len / 2, cy);
      ctx.lineTo(cx + len / 2, cy);
      ctx.stroke();
    }

    const braceT = smoothstep(0.34, 0.5, prog);
    if (braceT > 0.01) {
      const x0 = cx - half, y0 = cy + half;
      const x1 = lerp(x0, cx + half, braceT), y1 = lerp(y0, cy - half, braceT);
      ctx.strokeStyle = rgba(BLUE, 0.5 * braceT);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    const circT = smoothstep(0.45, 0.62, prog);
    if (circT > 0.01) {
      ctx.strokeStyle = rgba(WHITE, 0.55 * circT);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx - half / 2, cy - half / 2, (half / 2) * 0.62 * circT, 0, Math.PI * 2);
      ctx.stroke();
    }

    const triT = smoothstep(0.55, 0.7, prog);
    if (triT > 0.01) {
      const s = half * 0.5 * triT;
      const bx = cx + half, by = cy + half;
      ctx.strokeStyle = rgba(CYAN, 0.55 * triT);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by - s);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx - s, by);
      ctx.closePath();
      ctx.stroke();
    }

    const planeT = smoothstep(0.5, 0.72, prog);
    if (planeT > 0.01) {
      ctx.fillStyle = rgba(BLUE, 0.06 * planeT);
      ctx.fillRect(cx - half + 14, cy - half + 18, S, S);
    }

    const doneT = smoothstep(0.75, 0.92, prog);
    if (doneT > 0.02) {
      const peri = 4 * S;
      const t = (now * 0.00018) % 1;
      const d = t * peri;
      let px, py;
      if (d < S) { px = cx - half + d; py = cy - half; }
      else if (d < 2 * S) { px = cx + half; py = cy - half + (d - S); }
      else if (d < 3 * S) { px = cx + half - (d - 2 * S); py = cy + half; }
      else { px = cx - half; py = cy + half - (d - 3 * S); }
      ctx.fillStyle = rgba(WHITE, 0.85 * doneT);
      ctx.beginPath();
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fill();

      const scanY = cy - half + ((now * 0.00028) % 1) * S;
      ctx.strokeStyle = rgba(CYAN, 0.16 * doneT);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - half, scanY);
      ctx.lineTo(cx + half, scanY);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // CONNECT: structures find their counterparts.
  // ---------------------------------------------------------------------
  function drawSocketShape(key, x, y, r) {
    ctx.beginPath();
    if (key === "circle") {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else if (key === "triangle") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.8);
      ctx.lineTo(x - r, y + r * 0.8);
      ctx.closePath();
    } else {
      ctx.rect(x - r, y - r, r * 2, r * 2);
    }
    ctx.stroke();
  }

  function drawConnectModule(alpha, prog) {
    if (alpha <= 0.01) return;
    const cx = width * 0.5, cy = height * 0.46;
    const S = Math.min(width * 0.42, height * 0.46, 420);
    const half = S / 2;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = rgba(WHITE, 0.4);
    ctx.lineWidth = 1.1;
    ctx.strokeRect(cx - half, cy - half, S, S);

    const sockets = [
      { key: "circle", x: cx - half, y: cy - half * 0.4, snapAt: 0.32, testAt: 0.14 },
      { key: "triangle", x: cx, y: cy + half, snapAt: 0.58, testAt: 0.4 },
      { key: "square", x: cx + half, y: cy - half * 0.1, snapAt: 0.82, testAt: 0.64 }
    ];

    const measureT = 1 - smoothstep(0.14, 0.26, prog);
    if (measureT > 0.02) {
      ctx.strokeStyle = rgba(CYAN, 0.3 * measureT);
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      for (const s of sockets) {
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - 10);
        ctx.lineTo(s.x + 10, s.y - 10);
        ctx.moveTo(s.x - 10, s.y + 10);
        ctx.lineTo(s.x + 10, s.y + 10);
        ctx.moveTo(s.x - 10, s.y - 10);
        ctx.lineTo(s.x - 10, s.y + 10);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    for (const s of sockets) {
      const filled = smoothstep(s.snapAt, s.snapAt + 0.05, prog);
      const dashed = 1 - filled;

      if (dashed > 0.02) {
        ctx.strokeStyle = rgba(CYAN, 0.35 * dashed);
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        drawSocketShape(s.key, s.x, s.y, 15);
        ctx.setLineDash([]);
      }

      if (filled > 0.02 && filled < 1) {
        const flash = 1 - smoothstep(0, 0.28, (prog - s.snapAt) * (1 / 0.05));
        if (flash > 0.02) {
          ctx.strokeStyle = rgba(WHITE, 0.6 * flash);
          ctx.lineWidth = 1;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(s.x + Math.cos(a) * 12, s.y + Math.sin(a) * 12);
            ctx.lineTo(s.x + Math.cos(a) * (12 + 8 * flash), s.y + Math.sin(a) * (12 + 8 * flash));
            ctx.stroke();
          }
        }
      }

      if (filled > 0.02) {
        ctx.strokeStyle = rgba(WHITE, 0.6 * filled);
        ctx.lineWidth = 1.2;
        drawSocketShape(s.key, s.x, s.y, 15);
      } else {
        const spiral = clamp01((prog - s.testAt) / Math.max(0.01, s.snapAt - s.testAt));
        if (spiral > 0.01) {
          const angle = spiral * Math.PI * 2 * 2.4;
          const decoyDip = Math.sin(spiral * Math.PI * 1.4) * (1 - spiral) * 0.5 + 0.5;
          const radius = lerp(70, 0, Math.pow(spiral, 1.6)) * (0.4 + 0.6 * decoyDip);
          const px = s.x + Math.cos(angle) * radius;
          const py = s.y + Math.sin(angle) * radius * 0.7;
          ctx.strokeStyle = rgba(BLUE, 0.45);
          ctx.lineWidth = 1;
          drawSocketShape(s.key, px, py, 10);
        }
      }
    }

    const allDone = smoothstep(0.85, 0.95, prog);
    if (allDone > 0.02) {
      ctx.strokeStyle = rgba(CYAN, 0.3 * allDone);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + half, cy - half * 0.6);
      ctx.lineTo(cx + half + 30 * allDone, cy - half * 0.6 - 14 * allDone);
      ctx.moveTo(cx + half, cy);
      ctx.lineTo(cx + half + 36 * allDone, cy - 6 * allDone);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // FIND: geometry becomes direction.
  // ---------------------------------------------------------------------
  const FIND_STRONG_COUNT = 4;
  let findCurves = [];
  let findDots = [];

  function buildFind() {
    findCurves = [];
    const originX = width * 0.26, originY = height * 0.64;
    const destX = width * 0.76, destY = height * 0.32;
    const total = 44;
    for (let i = 0; i < total; i++) {
      const strong = i < FIND_STRONG_COUNT;
      const angle = (i / total) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 120 + Math.random() * 260;
      let ex, ey;
      if (strong) {
        ex = destX + (Math.random() - 0.5) * 18;
        ey = destY + (Math.random() - 0.5) * 18;
      } else if (Math.random() < 0.4) {
        ex = originX + Math.cos(angle) * (width + 200);
        ey = originY + Math.sin(angle) * (height + 200);
      } else {
        ex = originX + Math.cos(angle) * dist * 1.6;
        ey = originY + Math.sin(angle) * dist * 1.6 - 60;
      }
      const c1x = originX + Math.cos(angle) * dist * 0.5;
      const c1y = originY + Math.sin(angle) * dist * 0.5 - 80;
      const c2x = lerp(c1x, ex, 0.6);
      const c2y = lerp(c1y, ey, 0.6) - 40;
      findCurves.push({ ox: originX, oy: originY, c1x, c1y, c2x, c2y, ex, ey, strong });
    }
    findDots = [];
    for (let i = 0; i < 28; i++) {
      findDots.push({
        curve: Math.floor(Math.random() * findCurves.length),
        seed: Math.random(),
        speed: 0.35 + Math.random() * 0.5,
        switchProg: 0.5 + Math.random() * 0.4,
        strongPick: Math.floor(Math.random() * FIND_STRONG_COUNT)
      });
    }
  }

  function bezierAt(c, t) {
    const u = 1 - t;
    return {
      x: u * u * u * c.ox + 3 * u * u * t * c.c1x + 3 * u * t * t * c.c2x + t * t * t * c.ex,
      y: u * u * u * c.oy + 3 * u * u * t * c.c1y + 3 * u * t * t * c.c2y + t * t * t * c.ey
    };
  }

  function drawFindModule(alpha, prog, now) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    for (const c of findCurves) {
      const a = c.strong ? lerp(0.12, 0.6, prog) : lerp(0.18, 0, smoothstep(0.25, 0.7, prog));
      if (a <= 0.01) continue;
      ctx.strokeStyle = rgba(c.strong ? CYAN : WHITE, a);
      ctx.lineWidth = c.strong ? lerp(1, 1.8, prog) : 1;
      ctx.beginPath();
      ctx.moveTo(c.ox, c.oy);
      ctx.bezierCurveTo(c.c1x, c.c1y, c.c2x, c.c2y, c.ex, c.ey);
      ctx.stroke();
    }

    const shimmer = reduceMotion ? 0 : now * 0.00006;
    for (const d of findDots) {
      const useStrong = prog >= d.switchProg;
      const c = findCurves[useStrong ? d.strongPick : d.curve];
      if (!c) continue;
      const t = ((d.seed + prog * d.speed + shimmer) % 1 + 1) % 1;
      const p = bezierAt(c, t);
      ctx.fillStyle = rgba(WHITE, 0.7);
      ctx.beginPath();
      ctx.arc(p.x, p.y, useStrong ? 2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const destGlow = smoothstep(0.3, 1, prog);
    if (destGlow > 0.02 && findCurves[0]) {
      ctx.fillStyle = rgba(WHITE, 0.5 * destGlow);
      ctx.beginPath();
      ctx.arc(findCurves[0].ex, findCurves[0].ey, 3 + 3 * destGlow, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // SCALE: the reveal. One abstract forward-moving form, three paths through it.
  // ---------------------------------------------------------------------
  const SCALE_SEGMENTS = [
    { p0: [-1, 0.15], p1: [-0.55, -0.6], p2: [-0.15, -0.6], p3: [0, -0.38] },
    { p0: [0, -0.38], p1: [0.32, -0.05], p2: [0.42, 0.22], p3: [0.55, 0.35] },
    { p0: [0.55, 0.35], p1: [0.8, 0.5], p2: [0.98, 0.18], p3: [1.15, -0.05] }
  ];

  function scalePathPoint(t) {
    const n = SCALE_SEGMENTS.length;
    const tt = clamp01(t) * n;
    const idx = Math.min(n - 1, Math.floor(tt));
    const local = tt - idx;
    const s = SCALE_SEGMENTS[idx];
    const u = 1 - local;
    return {
      x: u * u * u * s.p0[0] + 3 * u * u * local * s.p1[0] + 3 * u * local * local * s.p2[0] + local * local * local * s.p3[0],
      y: u * u * u * s.p0[1] + 3 * u * u * local * s.p1[1] + 3 * u * local * local * s.p2[1] + local * local * local * s.p3[1]
    };
  }

  function drawScaleModule(alpha, prog, now) {
    if (alpha <= 0.01) return;
    const cx = width * 0.5, cy = height * 0.48;
    const scale = Math.min(width, height) * 0.62;
    const reveal = smoothstep(0, 0.5, prog);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    const miniA = 0.14 * reveal;
    if (miniA > 0.01) {
      ctx.strokeStyle = rgba(WHITE, miniA);
      ctx.lineWidth = 1;
      ctx.strokeRect(-scale * 0.42, -scale * 0.1, scale * 0.16, scale * 0.16);
      ctx.strokeStyle = rgba(CYAN, miniA);
      ctx.beginPath();
      ctx.arc(0, scale * 0.02, scale * 0.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(BLUE, miniA);
      ctx.beginPath();
      ctx.moveTo(scale * 0.26, -scale * 0.06);
      ctx.bezierCurveTo(scale * 0.34, -scale * 0.16, scale * 0.4, scale * 0.02, scale * 0.46, -scale * 0.02);
      ctx.stroke();
    }

    for (const offset of [0, 3]) {
      ctx.strokeStyle = rgba(CYAN, (offset === 0 ? 0.34 : 0.16) * reveal);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const seg of SCALE_SEGMENTS) {
        ctx.moveTo(seg.p0[0] * scale, seg.p0[1] * scale + offset);
        ctx.bezierCurveTo(
          seg.p1[0] * scale, seg.p1[1] * scale + offset,
          seg.p2[0] * scale, seg.p2[1] * scale + offset,
          seg.p3[0] * scale, seg.p3[1] * scale + offset
        );
      }
      ctx.stroke();
    }

    const t0 = reduceMotion ? 0.15 : (now * 0.00007) % 1;
    const travelers = [
      { off: 0, shape: "square" },
      { off: 0.33, shape: "circle" },
      { off: 0.66, shape: "comet" }
    ];
    for (const tr of travelers) {
      const t = (t0 + tr.off) % 1;
      const p = scalePathPoint(t);
      const px = p.x * scale, py = p.y * scale;
      ctx.fillStyle = rgba(WHITE, 0.75 * reveal);
      ctx.strokeStyle = rgba(WHITE, 0.75 * reveal);
      ctx.lineWidth = 1;
      if (tr.shape === "circle") {
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (tr.shape === "square") {
        ctx.strokeRect(px - 3, py - 3, 6, 6);
      } else {
        const behind = scalePathPoint((t - 0.02 + 1) % 1);
        ctx.beginPath();
        ctx.moveTo(behind.x * scale, behind.y * scale);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawVignette() {
    const r = Math.max(width, height) * 0.75;
    const g = ctx.createRadialGradient(width / 2, height / 2, r * 0.35, width / 2, height / 2, r);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(2,3,8,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // ---------------------------------------------------------------------
  // Scroll-driven phase weights
  // ---------------------------------------------------------------------
  function measure() {
    const buildEl = document.getElementById("build");
    const connectEl = document.getElementById("connect");
    const findEl = document.getElementById("find");
    const scaleEl = document.getElementById("scale");
    const contactEl = document.getElementById("contact");

    const buildStart = buildEl ? buildEl.offsetTop : height;
    const connectStart = connectEl ? connectEl.offsetTop : buildStart + height;
    const findStart = findEl ? findEl.offsetTop : connectStart + height;
    const scaleStart = scaleEl ? scaleEl.offsetTop : findStart + height;
    const scaleEnd = contactEl ? contactEl.offsetTop : scaleStart + height;

    bounds = {
      heroEnd: buildStart,
      build: [buildStart, connectStart],
      connect: [connectStart, findStart],
      find: [findStart, scaleStart],
      scaleStart, scaleEnd
    };
  }

  function computeProgress() {
    const y = window.scrollY + height * 0.5;
    const feather = Math.max(200, height * 0.55);

    const heroAlpha = clamp01(1 - smoothstep(bounds.heroEnd - feather * 0.3, bounds.heroEnd + feather * 0.3, y));
    const heroConverge = smoothstep(bounds.heroEnd * 0.55, bounds.heroEnd, y);

    const buildAlpha = windowAlpha(y, bounds.build[0], bounds.build[1], feather);
    const buildProg = localProgress(y, bounds.build[0], bounds.build[1]);

    const connectAlpha = windowAlpha(y, bounds.connect[0], bounds.connect[1], feather);
    const connectProg = localProgress(y, bounds.connect[0], bounds.connect[1]);

    const findAlpha = windowAlpha(y, bounds.find[0], bounds.find[1], feather);
    const findProg = localProgress(y, bounds.find[0], bounds.find[1]);

    const scaleAlpha = smoothstep(bounds.scaleStart - feather, bounds.scaleStart, y);
    const scaleProg = localProgress(y, bounds.scaleStart, bounds.scaleEnd);

    const dim = Math.max(0.22, 1 - Math.max(buildAlpha, connectAlpha, findAlpha, scaleAlpha) * 0.72);

    return { heroAlpha, heroConverge, buildAlpha, buildProg, connectAlpha, connectProg, findAlpha, findProg, scaleAlpha, scaleProg, dim };
  }

  // ---------------------------------------------------------------------
  // Setup / loop
  // ---------------------------------------------------------------------
  function measureAndRebuild() {
    measure();
    buildAmbient();
    buildFind();
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureAndRebuild();
  }

  function frame(now) {
    const animNow = reduceMotion ? 0 : now;
    const p = computeProgress();
    ctx.clearRect(0, 0, width, height);
    drawAmbient(animNow, p.dim);
    drawHeroConverge(p.heroAlpha * p.heroConverge);
    drawBuildModule(p.buildAlpha, p.buildProg, animNow);
    drawConnectModule(p.connectAlpha, p.connectProg);
    drawFindModule(p.findAlpha, p.findProg, animNow);
    drawScaleModule(p.scaleAlpha, p.scaleProg, animNow);
    drawVignette();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", measureAndRebuild);
  requestAnimationFrame(frame);
})();
