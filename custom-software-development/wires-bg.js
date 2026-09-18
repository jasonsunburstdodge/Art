(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Custom Software Development background: a glowing cloud at the top
  // of the screen (positioned clear of the header, not behind it) with
  // an invisible upside-down-tree of branch paths hanging beneath it.
  // The branches themselves are never drawn — only the many tiny white
  // dots of light that travel down them are visible, each one riding
  // its own branch path, firing at staggered times.
  //
  // The tree geometry (trunk, crown of root branches, forking twigs)
  // still exists under the hood; it just determines where the dots are
  // allowed to travel, rather than being drawn as wires.
  //
  // Idle, the cloud breathes gently and no dots move. Scrolling fires
  // one dot per color, each starting a moment apart, traveling down a
  // random root-to-tip path and flashing briefly on arrival.
  //
  // Under prefers-reduced-motion: no breathing, no dots, one static
  // render — nothing here moves without being asked to.
  // ---------------------------------------------------------------------

  const canvas = document.getElementById("csd-wires-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TRUNK_LEVELS = 2; // unsplit twisted trunk before the crown of root branches
  const BRANCH_LEVELS = 4; // further binary-ish forking below the crown
  const MAX_DEPTH = TRUNK_LEVELS + BRANCH_LEVELS;
  const DEPTH_WEIGHTS = [1.6, 1.3, 1.0, 0.9, 0.8, 0.7]; // trunk runs long; branches get shorter

  const EDGE_TRAVEL_MS = 210; // time for a pulse to cross one branch
  const FLARE_MS = 650; // box flare duration on arrival
  const MAX_PULSES = 30;
  const SPAWN_THROTTLE_MS = 140; // each tick spawns one pulse per color, staggered
  const SPAWN_STAGGER_MS = 90; // gap between each color's start within one spawn burst
  const STRAND_CAP = 45; // max thin wires twisted together in any one cable (5x the original 9)

  // Thin blue, white, and SilverXis-blue — cycled across a bundle's strands.
  const WIRE_COLORS = [
    [140, 190, 255], // thin blue
    [235, 244, 255], // white
    [47, 134, 245]   // SilverXis blue
  ];

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let cloudY = 0;
  let edges = [];
  let leaves = [];
  let pulses = [];
  let lastSpawnTime = 0;

  function bezierPoint(edge, t) {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
      x: a * edge.p0.x + b * edge.c1.x + c * edge.c2.x + d * edge.p1.x,
      y: a * edge.p0.y + b * edge.c1.y + c * edge.c2.y + d * edge.p1.y
    };
  }

  function bezierTangent(edge, t) {
    const mt = 1 - t;
    const dx = 3 * mt * mt * (edge.c1.x - edge.p0.x) + 6 * mt * t * (edge.c2.x - edge.c1.x) + 3 * t * t * (edge.p1.x - edge.c2.x);
    const dy = 3 * mt * mt * (edge.c1.y - edge.p0.y) + 6 * mt * t * (edge.c2.y - edge.c1.y) + 3 * t * t * (edge.p1.y - edge.c2.y);
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function makeEdge(ax, ay, bx, by, depth) {
    const dx = bx - ax, dy = by - ay;
    return {
      p0: { x: ax, y: ay },
      c1: { x: ax + dx * (0.22 + Math.random() * 0.22) + (Math.random() - 0.5) * 30, y: ay + dy * (0.12 + Math.random() * 0.18) },
      c2: { x: ax + dx * (0.62 + Math.random() * 0.22) + (Math.random() - 0.5) * 30, y: ay + dy * (0.72 + Math.random() * 0.18) },
      p1: { x: bx, y: by },
      strands: [],
      leafCount: 1
    };
  }

  // A cable feeding many leaves is several thin wires twisted around the
  // same path (the rope-like trunk/branch look); one feeding a single
  // leaf is the one loose, gently wavy wire that actually reaches it.
  // Sampled to a polyline once at build time, not re-jittered per frame.
  const SAMPLE_STEPS = 14;
  function makeStrands(edge, count, depth) {
    const twisted = count > 1;
    const freq = twisted ? 2.2 + Math.random() * 0.6 : 0.9 + Math.random() * 0.5;
    const amp = twisted ? 3.2 + Math.random() * 1.4 : 4.5 + Math.random() * 3;
    const strands = [];
    for (let i = 0; i < count; i++) {
      const phase = twisted ? (Math.PI * 2 * i) / count : Math.random() * Math.PI * 2;
      const points = [];
      for (let s = 0; s <= SAMPLE_STEPS; s++) {
        const t = s / SAMPLE_STEPS;
        const base = bezierPoint(edge, t);
        const tan = bezierTangent(edge, t);
        const nx = -tan.y, ny = tan.x;
        const taper = Math.sin(Math.PI * t); // 0 at both ends so wires meet cleanly at nodes/boxes
        const wave = Math.sin(t * freq * Math.PI * 2 + phase) * amp * taper;
        points.push({ x: base.x + nx * wave, y: base.y + ny * wave });
      }
      strands.push({ points, color: WIRE_COLORS[i % WIRE_COLORS.length] });
    }
    return strands;
  }

  // ---------------------------------------------------------------------
  // Tree build: a long unsplit trunk (TRUNK_LEVELS), then a crown of
  // several major root branches, each forking roughly in two the rest
  // of the way down. Slot-partitioning keeps siblings spread across the
  // width while still allowing a little overlap to read as tangled.
  // ---------------------------------------------------------------------
  function buildTree() {
    edges = [];
    leaves = [];

    const marginX = W * 0.05;
    const rootX = W * 0.5, rootY = cloudY;
    const totalY = H - rootY - H * 0.08;
    const weightSum = DEPTH_WEIGHTS.reduce((a, b) => a + b, 0);
    const yStepAt = DEPTH_WEIGHTS.map((w) => (totalY * w) / weightSum);

    function branch(x, y, depth, xMin, xMax, parentEdge) {
      if (depth >= MAX_DEPTH) {
        leaves.push({ x, y, path: buildPath(parentEdge), flareStart: 0 });
        return 1;
      }
      let k;
      if (depth < TRUNK_LEVELS) {
        k = 1; // straight twisted trunk, no split yet
      } else if (depth === TRUNK_LEVELS) {
        k = 4 + ((Math.random() * 2) | 0); // crown: 4-5 major root branches fan out here
      } else {
        k = Math.random() < 0.16 ? 1 : 2; // mostly binary, occasional early stop for irregularity
      }

      const range = xMax - xMin;
      const slot = range / k;
      const overlap = range * 0.03;
      const yStep = yStepAt[depth];
      let leafTotal = 0;
      for (let i = 0; i < k; i++) {
        const slotMin = xMin + i * slot;
        const slotMax = slotMin + slot;
        const pad = slot * 0.16;
        const cx = k === 1 ? (slotMin + slotMax) / 2 + (Math.random() - 0.5) * slot * 0.25
          : slotMin + pad + Math.random() * Math.max(1, slot - pad * 2);
        const cy = y + yStep + (Math.random() - 0.5) * yStep * 0.25;
        const edge = makeEdge(x, y, cx, cy, depth);
        edge.parent = parentEdge;
        edges.push(edge);
        const leafCount = branch(cx, cy, depth + 1, slotMin - overlap, slotMax + overlap, edge);
        edge.leafCount = leafCount;
        edge.strands = makeStrands(edge, Math.min(leafCount, STRAND_CAP), depth);
        leafTotal += leafCount;
      }
      return leafTotal;
    }

    function buildPath(edge) {
      const path = [];
      let e = edge;
      while (e) { path.unshift(e); e = e.parent; }
      return path;
    }

    branch(rootX, rootY, 0, marginX, W - marginX, null);
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

    buildTree();
  }

  // ---------------------------------------------------------------------
  // Drawing — the branch geometry itself is never stroked; only the
  // cloud and the traveling dots are visible.
  // ---------------------------------------------------------------------
  function drawCloud(now) {
    const cx = W * 0.5, cy = cloudY;
    const breathe = reduceMotion ? 0.5 : Math.sin(now * 0.0009) * 0.5 + 0.5;
    const R = Math.min(W * 0.16, 140) * (0.94 + breathe * 0.08);

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
    halo.addColorStop(0, "rgba(255,255,255,0.85)");
    halo.addColorStop(0.25, "rgba(190,225,255,0.5)");
    halo.addColorStop(0.6, "rgba(110,180,255,0.16)");
    halo.addColorStop(1, "rgba(110,180,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2);
    ctx.fill();

    const lumps = [[-0.55, 0.05, 0.55], [-0.2, -0.15, 0.62], [0.2, -0.12, 0.6], [0.55, 0.05, 0.5], [0, 0.1, 0.7]];
    for (const [ox, oy, scale] of lumps) {
      const lx = cx + ox * R, ly = cy + oy * R * 0.6, lr = R * 0.55 * scale;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lg.addColorStop(0, "rgba(230,242,255,0.55)");
      lg.addColorStop(1, "rgba(230,242,255,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A tip only appears as a brief flash the instant a dot arrives —
  // otherwise, like the branches, it's invisible.
  function drawLeaves(now) {
    for (const leaf of leaves) {
      const age = leaf.flareStart ? now - leaf.flareStart : Infinity;
      if (age >= FLARE_MS) continue;
      const t = age / FLARE_MS;
      const boost = 1 - t;

      const dot = ctx.createRadialGradient(leaf.x, leaf.y, 0, leaf.x, leaf.y, 4 + boost * 6);
      dot.addColorStop(0, `rgba(255,255,255,${(0.85 * boost).toFixed(3)})`);
      dot.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, 4 + boost * 6, 0, Math.PI * 2);
      ctx.fill();

      const ringR = 4 + t * 24;
      ctx.strokeStyle = `rgba(255,255,255,${(boost * 0.85).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function pointOnPolyline(points, t) {
    const idx = t * (points.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(points.length - 1, i0 + 1);
    const frac = idx - i0;
    const a = points[i0], b = points[i1];
    return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
  }

  function drawPulses(now) {
    for (const p of pulses) {
      if (now < p.startAt || !p.pos) continue;
      const glow = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, 5);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.5, "rgba(255,255,255,0.55)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Each dot rides one specific invisible strand per edge along its
  // path (chosen by color), so its motion still follows the tree's real
  // branch geometry even though that geometry is never drawn.
  function updatePulses(now) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (now < p.startAt) continue;
      const elapsed = now - p.startAt;
      const edgeIdx = Math.floor(elapsed / EDGE_TRAVEL_MS);
      if (edgeIdx >= p.path.length) {
        p.leaf.flareStart = now;
        pulses.splice(i, 1);
        continue;
      }
      const edge = p.path[edgeIdx];
      const strand = edge.strands[p.colorIdx % edge.strands.length];
      const tInEdge = (elapsed % EDGE_TRAVEL_MS) / EDGE_TRAVEL_MS;
      p.pos = pointOnPolyline(strand.points, tInEdge);
    }
  }

  // ---------------------------------------------------------------------
  // Scroll-triggered pulses: each spawn fires one spark per wire color,
  // each starting at a slightly different moment.
  // ---------------------------------------------------------------------
  function onScroll() {
    const now = performance.now();
    if (now - lastSpawnTime < SPAWN_THROTTLE_MS) return;
    lastSpawnTime = now;
    if (leaves.length === 0) return;
    for (let c = 0; c < WIRE_COLORS.length; c++) {
      if (pulses.length >= MAX_PULSES) break;
      const leaf = leaves[(Math.random() * leaves.length) | 0];
      const startAt = now + c * SPAWN_STAGGER_MS + Math.random() * SPAWN_STAGGER_MS * 0.6;
      pulses.push({ path: leaf.path, leaf, colorIdx: c, startAt, pos: null });
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
    updatePulses(now);
    drawCloud(now);
    drawPulses(now);
    drawLeaves(now);
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
