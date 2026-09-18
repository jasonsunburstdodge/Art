(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Custom Software Development background: a solid, opaque cloud sits
  // just below the header (never behind it), outlined in SilverXis blue.
  // No wires are ever drawn. Scrolling makes the cloud flash internally
  // like lightning — white, blue, and SilverXis blue in turn, with the
  // SilverXis shield briefly visible inside the glow on each flash — and
  // fires tiny thin spark-dashes (no glow, one per color) down from it.
  // Each spark travels in straight horizontal/vertical hops, turning at
  // right angles, until it runs off the bottom or a side of the screen.
  //
  // When a spark exits, it fires back an "answering" spark from that
  // exit point, traveling upward the same way toward one of several
  // hidden distant clouds scattered around the scene. Those clouds are
  // otherwise invisible — outline and all — until an answering spark
  // reaches one, at which point it flashes and fades.
  //
  // Under prefers-reduced-motion: no flashing, no sparks, one static
  // render of the opaque main cloud only — nothing here moves without
  // being asked to.
  // ---------------------------------------------------------------------

  const canvas = document.getElementById("csd-wires-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shieldImg = new Image();
  shieldImg.src = "../assets/silverxis-shield.png";

  // Thin blue, white, and SilverXis-blue — the three spark/flash colors.
  const WIRE_COLORS = [
    [140, 190, 255], // thin blue
    [235, 244, 255], // white
    [47, 134, 245]   // SilverXis blue
  ];
  const SILVERXIS_BLUE = "rgba(47,134,245,0.85)";

  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // down, up, right, left
  const SEG_LEN_MIN = 40, SEG_LEN_MAX = 130;
  const MAX_SEGMENTS = 9;
  const SPARK_SPEED = 0.62; // px/ms
  const DASH_LEN = 12;
  const SPARK_WIDTH = 1.8;
  const MAX_ACTIVE = 40;
  const SPAWN_THROTTLE_MS = 140;
  const SPAWN_STAGGER_MS = 90;
  const CLOUD_FLASH_MS = 90;
  const DIST_CLOUD_COUNT = 5;
  const DIST_CLOUD_FLARE_MS = 900;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let cloudY = 0;
  let sparks = [];
  let cloudFlashes = [];
  let distantClouds = [];
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
  // runs off the canvas — down or to a side.
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
    cloudY = Math.max(H * 0.09, headerBottom + 48);

    sparks = [];
    distantClouds = [];
    for (let i = 0; i < DIST_CLOUD_COUNT; i++) {
      distantClouds.push({
        x: W * (0.1 + Math.random() * 0.8),
        y: H * (0.4 + Math.random() * 0.48),
        r: 34 + Math.random() * 26,
        litAt: -Infinity
      });
    }
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------
  function activeCloudFlash(now) {
    for (let i = cloudFlashes.length - 1; i >= 0; i--) {
      const f = cloudFlashes[i];
      if (now >= f.startAt && now < f.startAt + CLOUD_FLASH_MS) return f;
    }
    return null;
  }

  function drawCloudGlow(cx, cy, r, tint, coreAlpha) {
    const [tr, tg, tb] = tint;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.9);
    halo.addColorStop(0, `rgba(${tr},${tg},${tb},${coreAlpha})`);
    halo.addColorStop(0.3, `rgba(${tr},${tg},${tb},${(coreAlpha * 0.8).toFixed(3)})`);
    halo.addColorStop(0.65, `rgba(${Math.round(tr * 0.5 + 50)},${Math.round(tg * 0.5 + 70)},${Math.round(tb * 0.6 + 90)},${(coreAlpha * 0.4).toFixed(3)})`);
    halo.addColorStop(1, "rgba(90,150,230,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCloudOutline(cx, cy, r, alpha) {
    ctx.strokeStyle = `rgba(47,134,245,${alpha.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The one main cloud: solid/opaque at rest, outlined in SilverXis
  // blue, and briefly showing the shield inside its glow on each flash.
  function drawCloud(now) {
    const cx = W * 0.5, cy = cloudY;
    const R = Math.min(W * 0.16, 140);
    const flash = reduceMotion ? null : activeCloudFlash(now);
    const tint = flash ? WIRE_COLORS[flash.colorIdx] : [235, 244, 255];
    const coreAlpha = flash ? 1 : 0.88;

    drawCloudGlow(cx, cy, R, tint, coreAlpha);
    drawCloudOutline(cx, cy, R, 0.85);

    if (flash && shieldImg.complete && shieldImg.naturalWidth > 0) {
      const t = (now - flash.startAt) / CLOUD_FLASH_MS;
      const alpha = Math.sin(Math.PI * Math.min(1, t)) * 0.9;
      const size = R * 1.05;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.drawImage(shieldImg, cx - size / 2, cy - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
  }

  // Distant clouds: invisible, outline included, until an answering
  // spark reaches one — then a brief flash that fades back to nothing.
  function drawDistantClouds(now) {
    for (const c of distantClouds) {
      const age = now - c.litAt;
      if (age >= DIST_CLOUD_FLARE_MS) continue;
      const t = age / DIST_CLOUD_FLARE_MS;
      const alpha = 1 - t;
      drawCloudGlow(c.x, c.y, c.r, [200, 225, 255], alpha * 0.8);
      drawCloudOutline(c.x, c.y, c.r, alpha * 0.75);
    }
  }

  function drawSparks(now) {
    for (const s of sparks) {
      if (now < s.startAt || !s.pos || !s.dir) continue;
      const [r, g, b] = WIRE_COLORS[s.colorIdx];
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
    if (sparks.length >= MAX_ACTIVE || distantClouds.length === 0) return;
    const cloud = distantClouds[(Math.random() * distantClouds.length) | 0];
    const x0 = Math.max(4, Math.min(W - 4, fromPoint.x));
    const y0 = Math.max(4, Math.min(H - 4, fromPoint.y));
    const midY = y0 + (cloud.y - y0) * (0.35 + Math.random() * 0.3);
    const pts = [{ x: x0, y: y0 }, { x: x0, y: midY }, { x: cloud.x, y: midY }, { x: cloud.x, y: cloud.y }];
    sparks.push({
      pathInfo: pathWithLengths(pts),
      startAt: now,
      colorIdx: (Math.random() * WIRE_COLORS.length) | 0,
      kind: "up",
      targetCloud: cloud,
      pos: null,
      dir: null
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
        } else {
          s.targetCloud.litAt = now;
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
    }
  }

  // ---------------------------------------------------------------------
  // Scroll-triggered spawning: one random down-path per throttled tick,
  // one spark per color fired along it at staggered moments, plus a
  // burst of lightning flashes inside the cloud.
  // ---------------------------------------------------------------------
  function onScroll() {
    const now = performance.now();
    if (now - lastSpawnTime < SPAWN_THROTTLE_MS) return;
    lastSpawnTime = now;

    const x0 = W * 0.5 + (Math.random() - 0.5) * Math.min(W * 0.14, 120);
    const y0 = cloudY + 6;
    const pathInfo = pathWithLengths(generateWalk(x0, y0, true));
    for (let c = 0; c < WIRE_COLORS.length; c++) {
      if (sparks.length >= MAX_ACTIVE) break;
      const startAt = now + c * SPAWN_STAGGER_MS + Math.random() * SPAWN_STAGGER_MS * 0.6;
      sparks.push({ pathInfo, startAt, colorIdx: c, kind: "down", pos: null, dir: null });
    }

    for (let i = 0; i < 3; i++) {
      cloudFlashes.push({ startAt: now + i * 70 + Math.random() * 40, colorIdx: (Math.random() * WIRE_COLORS.length) | 0 });
    }
    cloudFlashes = cloudFlashes.filter((f) => f.startAt + CLOUD_FLASH_MS > now - 50).slice(-24);
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
    drawDistantClouds(now);
    drawCloud(now);
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
