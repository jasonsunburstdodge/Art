(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Custom Software Development background: no wires, no clouds — just
  // sparks. Scrolling fires a burst of tiny, bright, single-color spark
  // dashes (white, blue, SilverXis blue, orange) from near the top of
  // the screen, each one traveling the same randomly generated path,
  // staggered a moment apart. Each spark moves in straight horizontal/
  // vertical hops, turning at right angles, until it runs off the
  // bottom or a side of the screen.
  //
  // The leading dash itself is crisp and flat — no glow — but it drags
  // a short trail behind it in the same color that glows briefly and
  // fades quickly.
  //
  // When a spark exits the screen, it fires an "answering" spark back
  // from that exit point, traveling upward the same way until it too
  // runs off screen.
  //
  // Occasionally, as a spark passes a point along its path, a circuit
  // component lights up there — a blue capacitor, microchip, or
  // inductor carrying a short software-success term, or a diode in
  // random orange or blue with no label — then fades back to
  // invisible. Most sparks light up nothing at all.
  //
  // Under prefers-reduced-motion: no sparks at all, one static (empty)
  // render — nothing here moves without being asked to.
  // ---------------------------------------------------------------------

  const canvas = document.getElementById("csd-wires-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // White, blue, SilverXis blue, and orange — each spark is a single
  // flat one of these, never a blend.
  const SPARK_COLORS = [
    [235, 244, 255], // white
    [140, 190, 255], // blue
    [47, 134, 245],  // SilverXis blue
    [255, 150, 60]   // orange
  ];

  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // down, up, right, left
  const SEG_LEN_MIN = 40, SEG_LEN_MAX = 130;
  const MAX_SEGMENTS = 9;
  const SPARK_SPEED = 0.62; // px/ms
  const DASH_LEN = 12;
  const SPARK_WIDTH = 1.8;
  const TRAIL_MS = 170; // short, fades quickly
  const TRAIL_WIDTH = 1.3;
  const MAX_ACTIVE = 40;
  const SPAWN_THROTTLE_MS = 140;
  const SPAWN_STAGGER_MS = 90;
  const ORIGIN_MARGIN = 48; // spawn point clear of the header

  const CIRCUIT_BLUE = [120, 180, 255];
  const DIODE_COLORS = [[255, 150, 60], [120, 180, 255]]; // random orange or blue
  const LABELED_TYPES = ["capacitor", "microchip", "inductor"];
  const SUCCESS_TERMS = ["BUILD", "SCALE", "SHIP", "SECURE", "DEPLOY", "AUTOMATE", "INTEGRATE", "OPTIMIZE", "MODERNIZE", "CONNECT"];
  const LABELED_CHANCE = 0.12; // "some" sparks
  const DIODE_CHANCE = 0.10; // "some" sparks — most (78%) light up nothing
  const COMPONENT_FADE_IN_MS = 160;
  const COMPONENT_HOLD_MS = 550;
  const COMPONENT_FADE_OUT_MS = 550;
  const MAX_COMPONENTS = 16;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let originY = 0;
  let sparks = [];
  let components = [];
  let lastSpawnTime = 0;

  function pathWithLengths(points) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 0.001;
      segs.push({ a, b, len, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, start: total });
      total += len;
    }
    return { segs, total };
  }

  // Random orthogonal walk: mostly continues in the biased direction,
  // occasionally jogs left/right (or up/down) at a right angle, until it
  // runs off the canvas — down (or up) or to a side.
  function generateWalk(x0, y0, biasDown) {
    const biasIdx = biasDown ? 0 : 1;
    const pts = [{ x: x0, y: y0 }];
    let x = x0, y = y0;
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      const d = Math.random() < 0.58 ? biasIdx : 2 + ((Math.random() * 2) | 0);
      const [dx, dy] = DIRS[d];
      const segLen = SEG_LEN_MIN + Math.random() * (SEG_LEN_MAX - SEG_LEN_MIN);
      x += dx * segLen;
      y += dy * segLen;
      pts.push({ x, y });
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) break;
    }
    return pts;
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const headerEl = document.querySelector("header");
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
    originY = Math.max(H * 0.09, headerBottom + ORIGIN_MARGIN);

    sparks = [];
    components = [];
  }

  // ---------------------------------------------------------------------
  // Circuit components: most paths light up nothing. When one does, it
  // picks a point along the path and times its reveal to when a spark
  // would actually reach that point.
  // ---------------------------------------------------------------------
  function maybeSpawnComponent(pathInfo, baseStartAt) {
    if (pathInfo.total < 80 || components.length >= MAX_COMPONENTS) return;
    const r = Math.random();
    let type, color, label = null;
    if (r < LABELED_CHANCE) {
      type = LABELED_TYPES[(Math.random() * LABELED_TYPES.length) | 0];
      color = CIRCUIT_BLUE;
      label = SUCCESS_TERMS[(Math.random() * SUCCESS_TERMS.length) | 0];
    } else if (r < LABELED_CHANCE + DIODE_CHANCE) {
      type = "diode";
      color = DIODE_COLORS[(Math.random() * DIODE_COLORS.length) | 0];
    } else {
      return; // most sparks: nothing
    }

    const dist = pathInfo.total * (0.25 + Math.random() * 0.55);
    let seg = pathInfo.segs[pathInfo.segs.length - 1];
    for (const sg of pathInfo.segs) {
      if (dist <= sg.start + sg.len) { seg = sg; break; }
    }
    const local = dist - seg.start;
    components.push({
      type, color, label,
      x: seg.a.x + seg.dx * local,
      y: seg.a.y + seg.dy * local,
      litAt: baseStartAt + dist / SPARK_SPEED
    });
  }

  function componentAlpha(age) {
    if (age < COMPONENT_FADE_IN_MS) return age / COMPONENT_FADE_IN_MS;
    if (age < COMPONENT_FADE_IN_MS + COMPONENT_HOLD_MS) return 1;
    const t2 = age - COMPONENT_FADE_IN_MS - COMPONENT_HOLD_MS;
    if (t2 < COMPONENT_FADE_OUT_MS) return 1 - t2 / COMPONENT_FADE_OUT_MS;
    return -1;
  }

  function drawComponentShape(type, label) {
    ctx.lineWidth = 1.3;
    if (type === "capacitor") {
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(-5, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, -8); ctx.lineTo(5, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(16, 0); ctx.stroke();
    } else if (type === "inductor") {
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-14, 0);
      for (let i = 0; i < 4; i++) ctx.arc(-14 + 7 + i * 7, 0, 3.5, Math.PI, 0, false);
      ctx.lineTo(18, 0);
      ctx.stroke();
    } else if (type === "microchip") {
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, 0); ctx.stroke();
      ctx.strokeRect(-12, -9, 24, 18);
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(16, 0); ctx.stroke();
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 6, -9); ctx.lineTo(i * 6, -13); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i * 6, 9); ctx.lineTo(i * 6, 13); ctx.stroke();
      }
    } else if (type === "diode") {
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-6, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-6, 6); ctx.lineTo(6, 0); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -7); ctx.lineTo(6, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(16, 0); ctx.stroke();
    }
    if (label) {
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, type === "microchip" ? 0 : 17);
    }
  }

  function drawComponents(now) {
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i];
      const age = now - c.litAt;
      if (age < 0) continue;
      const alpha = componentAlpha(age);
      if (alpha < 0) { components.splice(i, 1); continue; }
      const [r, g, b] = c.color;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      drawComponentShape(c.type, c.label);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------
  function drawSparks(now) {
    for (const s of sparks) {
      if (now < s.startAt || !s.pos || !s.dir) continue;
      const [r, g, b] = SPARK_COLORS[s.colorIdx];

      // Trail first, glowing and fading, behind the leading dash.
      if (s.trail.length > 1) {
        ctx.lineWidth = TRAIL_WIDTH;
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        for (let i = 1; i < s.trail.length; i++) {
          const age = now - s.trail[i].t;
          if (age >= TRAIL_MS) continue;
          const alpha = (1 - age / TRAIL_MS) * 0.55;
          ctx.shadowBlur = 5 * (1 - age / TRAIL_MS);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y);
          ctx.lineTo(s.trail[i].x, s.trail[i].y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      // Leading dash: crisp, flat, no glow.
      const half = DASH_LEN / 2;
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = SPARK_WIDTH;
      ctx.beginPath();
      ctx.moveTo(s.pos.x - s.dir.dx * half, s.pos.y - s.dir.dy * half);
      ctx.lineTo(s.pos.x + s.dir.dx * half, s.pos.y + s.dir.dy * half);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------
  // Spark travel
  // ---------------------------------------------------------------------
  function spawnAnswer(fromPoint, now) {
    if (sparks.length >= MAX_ACTIVE) return;
    const x0 = Math.max(4, Math.min(W - 4, fromPoint.x));
    const y0 = Math.max(4, Math.min(H - 4, fromPoint.y));
    const pathInfo = pathWithLengths(generateWalk(x0, y0, false));
    sparks.push({
      pathInfo,
      startAt: now,
      colorIdx: (Math.random() * SPARK_COLORS.length) | 0,
      kind: "up",
      pos: null,
      dir: null,
      trail: []
    });
    maybeSpawnComponent(pathInfo, now);
  }

  function updateSparks(now) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (now < s.startAt) continue;
      const dist = SPARK_SPEED * (now - s.startAt);
      const segs = s.pathInfo.segs;
      if (dist >= s.pathInfo.total || segs.length === 0) {
        if (s.kind === "down") {
          spawnAnswer(segs.length ? segs[segs.length - 1].b : s.pathInfo.segs[0].a, now);
        }
        sparks.splice(i, 1);
        continue;
      }
      let seg = segs[segs.length - 1];
      for (const sg of segs) {
        if (dist <= sg.start + sg.len) { seg = sg; break; }
      }
      const localDist = dist - seg.start;
      s.pos = { x: seg.a.x + seg.dx * localDist, y: seg.a.y + seg.dy * localDist };
      s.dir = { dx: seg.dx, dy: seg.dy };

      s.trail.push({ x: s.pos.x, y: s.pos.y, t: now });
      while (s.trail.length > 1 && now - s.trail[0].t > TRAIL_MS) s.trail.shift();
    }
  }

  // ---------------------------------------------------------------------
  // Scroll-triggered spawning: one random down-path per throttled tick,
  // one spark per color fired along it at staggered moments.
  // ---------------------------------------------------------------------
  function onScroll() {
    const now = performance.now();
    if (now - lastSpawnTime < SPAWN_THROTTLE_MS) return;
    lastSpawnTime = now;

    const x0 = W * 0.5 + (Math.random() - 0.5) * Math.min(W * 0.14, 120);
    const y0 = originY;
    const pathInfo = pathWithLengths(generateWalk(x0, y0, true));
    for (let c = 0; c < SPARK_COLORS.length; c++) {
      if (sparks.length >= MAX_ACTIVE) break;
      const startAt = now + c * SPAWN_STAGGER_MS + Math.random() * SPAWN_STAGGER_MS * 0.6;
      sparks.push({ pathInfo, startAt, colorIdx: c, kind: "down", pos: null, dir: null, trail: [] });
    }
    maybeSpawnComponent(pathInfo, now);
  }
  if (!reduceMotion) {
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    updateSparks(now);
    drawComponents(now);
    drawSparks(now);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) frame(performance.now());
  }, { passive: true });

  resize();
  if (reduceMotion) {
    frame(performance.now());
  } else {
    requestAnimationFrame(frame);
  }
})();
