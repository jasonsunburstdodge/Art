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

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let originY = 0;
  let sparks = [];
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
    sparks.push({
      pathInfo: pathWithLengths(generateWalk(x0, y0, false)),
      startAt: now,
      colorIdx: (Math.random() * SPARK_COLORS.length) | 0,
      kind: "up",
      pos: null,
      dir: null,
      trail: []
    });
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
