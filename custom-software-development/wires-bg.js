(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Custom Software Development background: an upside-down tree made of
  // thin twisted wire, hanging from a glowing cloud at the top of the
  // screen — a long twisted trunk that fans into a crown of major root
  // branches, each of which splits again and again into thinner, wavier
  // twigs, ending in loose wire tips with a small glowing box.
  //
  // Every strand is thin; a branch only reads as "thick" because several
  // thin blue/white/silverxis-blue wires are twisted together along it —
  // more of them near the trunk, fewer as it forks apart, down to one
  // single wavy wire per twig.
  //
  // Idle, the cloud breathes gently and the wires sit dim. Scrolling
  // fires an electrical pulse down a random root-to-box path; the pulse
  // travels branch by branch, leaving each branch it crosses brighter
  // for a moment before that residual glow fades, and the box at the
  // end of its path flares briefly when the pulse arrives.
  //
  // Under prefers-reduced-motion: no breathing, no pulses, one static
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
  const AFTERGLOW_MS = 550; // how long a crossed branch stays lit after the pulse leaves
  const FLARE_MS = 650; // box flare duration on arrival
  const MAX_PULSES = 14;
  const SPAWN_THROTTLE_MS = 90;
  const SPAWN_STAGGER_MS = 260; // "different times"
  const STRAND_CAP = 9; // max thin wires twisted together in any one cable

  // Thin blue, white, and SilverXis-blue — cycled across a bundle's strands.
  const WIRE_COLORS = [
    [140, 190, 255], // thin blue
    [235, 244, 255], // white
    [47, 134, 245]   // SilverXis blue
  ];

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let edges = [];
  let leaves = [];
  let wisps = [];
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
      glowUntil: 0,
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
      strands.push({ points, color: WIRE_COLORS[i % WIRE_COLORS.length], width: Math.max(0.55, 1.2 - depth * 0.06) });
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
    const rootX = W * 0.5, rootY = H * 0.085;
    const totalY = H * 0.8;
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

    // A handful of static decorative tendrils curling around the cloud,
    // purely atmospheric — not part of the branch/pulse system.
    wisps = [];
    for (let i = 0; i < 9; i++) {
      const ang = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
      const len = Math.min(W, H) * (0.18 + Math.random() * 0.16);
      const sx = rootX + Math.cos(ang) * len * 0.15;
      const sy = rootY + Math.sin(ang) * len * 0.1 - H * 0.02;
      wisps.push({
        p0: { x: rootX, y: rootY - H * 0.015 },
        c1: { x: sx, y: sy - len * 0.3 },
        c2: { x: sx + Math.cos(ang) * len * 0.6, y: sy + Math.sin(ang) * len * 0.4 },
        p1: { x: rootX + Math.cos(ang) * len, y: rootY + Math.sin(ang) * len * 0.55 }
      });
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildTree();
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------
  function strokePolyline(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  function strokeBezier(e) {
    ctx.beginPath();
    ctx.moveTo(e.p0.x, e.p0.y);
    ctx.bezierCurveTo(e.c1.x, e.c1.y, e.c2.x, e.c2.y, e.p1.x, e.p1.y);
    ctx.stroke();
  }

  function drawWisps() {
    ctx.strokeStyle = "rgba(150, 195, 255, 0.16)";
    ctx.lineWidth = 0.7;
    for (const w of wisps) strokeBezier(w);
  }

  function drawCloud(now) {
    const cx = W * 0.5, cy = H * 0.07;
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

  function drawEdges(now) {
    for (const e of edges) {
      const glowAlpha = e.glowUntil > now ? (e.glowUntil - now) / AFTERGLOW_MS : 0;

      for (const s of e.strands) {
        const [r, g, b] = s.color;
        ctx.strokeStyle = `rgba(${r},${g},${b},0.32)`;
        ctx.lineWidth = s.width;
        strokePolyline(s.points);

        if (glowAlpha > 0.02) {
          const gr = Math.min(255, r + 90), gg = Math.min(255, g + 90), gb = Math.min(255, b + 90);
          ctx.strokeStyle = `rgba(${gr},${gg},${gb},${(glowAlpha * 0.95).toFixed(3)})`;
          ctx.lineWidth = s.width + 1;
          strokePolyline(s.points);
        }
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLeaves(now) {
    for (const leaf of leaves) {
      const age = leaf.flareStart ? now - leaf.flareStart : Infinity;
      const flaring = age < FLARE_MS;
      const t = flaring ? age / FLARE_MS : 1;
      const boost = flaring ? 1 - t : 0;

      ctx.strokeStyle = `rgba(150, 205, 255, ${(0.3 + boost * 0.55).toFixed(3)})`;
      ctx.lineWidth = 0.9;
      roundRect(leaf.x - 5, leaf.y - 5, 10, 10, 2);
      ctx.stroke();

      const dot = ctx.createRadialGradient(leaf.x, leaf.y, 0, leaf.x, leaf.y, 4 + boost * 6);
      dot.addColorStop(0, `rgba(255,255,255,${(0.5 + boost * 0.5).toFixed(3)})`);
      dot.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(leaf.x, leaf.y, 4 + boost * 6, 0, Math.PI * 2);
      ctx.fill();

      if (flaring) {
        const ringR = 4 + t * 24;
        ctx.strokeStyle = `rgba(255,255,255,${((1 - t) * 0.85).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(leaf.x, leaf.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawPulses(now) {
    for (const p of pulses) {
      if (now < p.startAt || !p.pos) continue;
      const glow = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, 10);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.4, "rgba(150,205,255,0.65)");
      glow.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
      const tInEdge = (elapsed % EDGE_TRAVEL_MS) / EDGE_TRAVEL_MS;
      edge.glowUntil = now + AFTERGLOW_MS;
      p.pos = bezierPoint(edge, tInEdge);
    }
  }

  // ---------------------------------------------------------------------
  // Scroll-triggered pulses
  // ---------------------------------------------------------------------
  function onScroll() {
    const now = performance.now();
    if (now - lastSpawnTime < SPAWN_THROTTLE_MS) return;
    lastSpawnTime = now;
    if (pulses.length >= MAX_PULSES || leaves.length === 0) return;
    const leaf = leaves[(Math.random() * leaves.length) | 0];
    pulses.push({ path: leaf.path, leaf, startAt: now + Math.random() * SPAWN_STAGGER_MS, pos: null });
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
    drawWisps();
    drawEdges(now);
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
