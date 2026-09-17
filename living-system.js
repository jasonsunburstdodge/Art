(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // SilverXis "Living Digital Business" homepage background.
  //
  // One persistent Three.js scene, not four animations: a business system
  // laid out as three spatially distinct but connected clusters —
  // BUILD (technology/architecture), CONNECT (capability/people), FIND
  // (market/customers) — arranged around a shared origin. Scroll drives a
  // camera rail through the clusters in order, then pulls back in SCALE to
  // reveal all three at once, connected. Cyan/blue = healthy, active,
  // connected. Amber = a problem, bottleneck, or unresolved opportunity.
  // No literal icons, no text rendered into WebGL — HTML/CSS still owns
  // every word on the page; this only sets the scene behind it.
  //
  // Every value that drives the story (camera position, which nodes light
  // up, where signals travel) is a pure function of scroll progress via
  // GSAP ScrollTrigger's per-section `progress` (0 before a section, 1
  // after), so the whole thing is scrubbable and freezes the instant
  // scrolling stops — required for prefers-reduced-motion, and it just
  // happens to make the camera rail trivial to build: chaining
  // `pos.lerp(sectionTarget, sectionProgress)` down the section list
  // composes a smooth multi-stop path with no separate keyframe timeline.
  //
  // Every shape also drifts and turns gently on its own real-time clock
  // (computeLivePos/writeInstance), independent of scroll — that's what
  // makes the system feel alive rather than a fixed diagram. Edges are
  // stored as references to their endpoint nodes, not baked positions, so
  // a connection stays attached to both shapes as they float. While the
  // visitor is actively scrolling, occasional "sparks" fire between two
  // shapes that aren't already wired together — sometimes neighbors in
  // one cluster, sometimes a reach across to an adjacent one — briefly
  // flaring both ends. Both behaviors are disabled under
  // prefers-reduced-motion, same as the rest of the scene.
  // ---------------------------------------------------------------------

  const canvas = document.getElementById("synapse-canvas");
  if (!canvas) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fallbackToSynapses() {
    if (window.__livingSystemFailed) return;
    window.__livingSystemFailed = true;
    if (!window.SYNAPSE_THEME) {
      window.SYNAPSE_THEME = {
        primary: [92, 178, 250],
        accent: [255, 211, 42],
        accentRatio: 0.16,
        wordColor: [190, 255, 205],
        wordGlow: [80, 225, 130],
        words: [
          "Software", "Engineering", "Automation", "Full-Stack", "Scalable",
          "AI", "Intelligence", "Predictive", "Smart Systems", "Data-Driven",
          "Consulting", "Strategy", "Advisory", "Transformation", "Expertise",
          "Marketing", "Visibility", "Engagement", "Growth", "Conversion",
          "SEO", "Branding", "Integration", "Innovation"
        ]
      };
    }
    const s = document.createElement("script");
    s.src = "synapses.js";
    document.body.appendChild(s);
  }

  if (typeof THREE === "undefined" || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    fallbackToSynapses();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  } catch (err) {
    fallbackToSynapses();
    return;
  }
  if (!renderer.getContext()) { fallbackToSynapses(); return; }

  gsap.registerPlugin(ScrollTrigger);

  // ---------------------------------------------------------------------
  // Device tier: fewer nodes/edges and a lower pixel ratio on phones and
  // low-core devices, so this stays smooth on mid-range hardware.
  // ---------------------------------------------------------------------
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const lowTier = window.innerWidth < 768 || cores <= 4 || mem <= 4;
  const density = lowTier ? 0.55 : 1;
  const dpr = Math.min(window.devicePixelRatio || 1, lowTier ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  // ---------------------------------------------------------------------
  // Palette. Light has meaning: cyan/blue = healthy + active + connected;
  // amber = a problem, bottleneck, or unresolved opportunity; dim = latent
  // / not yet part of the story.
  // ---------------------------------------------------------------------
  const COLOR = {
    dim: new THREE.Color(0x2a3a5c),
    dimFaint: new THREE.Color(0x1b2740),
    cyan: new THREE.Color(0x5fcdfb),
    blue: new THREE.Color(0x2f86f5),
    amber: new THREE.Color(0xf0a83c),
    white: new THREE.Color(0xeaf1ff)
  };
  function stateColor(state) {
    if (state === "cyan") return COLOR.cyan;
    if (state === "amber") return COLOR.amber;
    if (state === "blue") return COLOR.blue;
    return COLOR.dim;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 8, 4000);

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------------------------------------------------------------------
  // Cluster layout. Three centers around a shared origin so SCALE can pull
  // the camera back and show real spatial relationships between them
  // rather than three isolated circles.
  // ---------------------------------------------------------------------
  const BUILD_CENTER = new THREE.Vector3(-230, 10, 40);
  const CONNECT_CENTER = new THREE.Vector3(230, -10, 40);
  const FIND_CENTER = new THREE.Vector3(0, 60, -320);
  const CENTROID = new THREE.Vector3().addVectors(BUILD_CENTER, CONNECT_CENTER).add(FIND_CENTER).divideScalar(3);

  // ---------------------------------------------------------------------
  // Instanced node pools. Boxes read as structured systems/modules
  // (services, project nodes, capability slots); spheres read as
  // stores/people/customers (databases, candidates, market points). Two
  // draw calls total for every node in the scene, on every device tier.
  // ---------------------------------------------------------------------
  const MAX_BOXES = 260;
  const MAX_SPHERES = 220;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeo = new THREE.SphereGeometry(0.5, 10, 8);
  const nodeMat = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: 1 });

  const boxMesh = new THREE.InstancedMesh(boxGeo, nodeMat.clone(), MAX_BOXES);
  const sphereMesh = new THREE.InstancedMesh(sphereGeo, nodeMat.clone(), MAX_SPHERES);
  boxMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BOXES * 3), 3);
  sphereMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPHERES * 3), 3);
  scene.add(boxMesh, sphereMesh);

  const boxes = []; // { pos, scale, state, opacity, floatPhase, floatSpeed, floatAmp, rot, flareStart, flareDur }
  const spheres = [];
  const dummy = new THREE.Object3D();

  // Frame-coherent clock: every position/rotation/flare computation this
  // frame reads the same timestamp, set once at the top of render().
  let frameNow = 0;

  function makeNode(pos, scale, state, opacity) {
    return {
      pos: pos.clone(), scale, state: state || "dim", opacity: opacity == null ? 1 : opacity,
      floatPhase: Math.random() * Math.PI * 2,
      floatSpeed: 0.5 + Math.random() * 0.7,
      floatAmp: 3 + Math.random() * 4,
      rot: { x: (Math.random() * 2 - 1), y: (Math.random() * 2 - 1), z: (Math.random() * 2 - 1) },
      flareStart: -Infinity, flareDur: 0
    };
  }
  function addBox(pos, scale, state, opacity) {
    boxes.push(makeNode(pos, scale, state, opacity));
    return boxes.length - 1;
  }
  function addSphere(pos, scale, state, opacity) {
    spheres.push(makeNode(pos, scale, state, opacity));
    return spheres.length - 1;
  }

  // A node's currently-rendered position: its anchor plus a gentle,
  // independent drift so the whole scene reads as floating rather than
  // static. Always a pure function of frameNow, so it's identical
  // wherever it's called this frame — edges stay attached to the shapes
  // they connect even though every shape drifts on its own.
  function computeLivePos(n) {
    if (reduceMotion) return n.pos;
    const fx = Math.sin(frameNow * 0.00035 * n.floatSpeed + n.floatPhase) * n.floatAmp;
    const fy = Math.cos(frameNow * 0.00028 * n.floatSpeed + n.floatPhase * 1.3) * n.floatAmp * 0.8;
    const fz = Math.sin(frameNow * 0.0003 * n.floatSpeed + n.floatPhase * 0.7) * n.floatAmp * 0.6;
    return new THREE.Vector3(n.pos.x + fx, n.pos.y + fy, n.pos.z + fz);
  }

  const FLARE_MS = 450;
  function flareNode(n) { n.flareStart = frameNow; n.flareDur = FLARE_MS; }
  function flareAmount(n) {
    if (n.flareDur <= 0) return 0;
    return clamp01(1 - (frameNow - n.flareStart) / n.flareDur);
  }

  function writeInstance(mesh, pool, i) {
    const n = pool[i];
    dummy.position.copy(computeLivePos(n));
    dummy.scale.setScalar(n.scale);
    if (reduceMotion) {
      dummy.rotation.set(0, 0, 0);
    } else {
      dummy.rotation.set(frameNow * 0.00022 * n.rot.x, frameNow * 0.00022 * n.rot.y, frameNow * 0.00022 * n.rot.z);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const flare = flareAmount(n);
    const opacity = Math.max(n.opacity, flare);
    const state = flare > 0.35 ? "cyan" : n.state;
    const c = COLOR.dimFaint.clone().lerp(stateColor(state), opacity);
    mesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }

  function flushInstances() {
    const bCount = Math.min(boxes.length, MAX_BOXES);
    for (let i = 0; i < bCount; i++) writeInstance(boxMesh, boxes, i);
    for (let i = bCount; i < MAX_BOXES; i++) {
      dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
      boxMesh.setMatrixAt(i, dummy.matrix);
    }
    boxMesh.instanceMatrix.needsUpdate = true;
    boxMesh.instanceColor.needsUpdate = true;
    boxMesh.count = bCount;

    const sCount = Math.min(spheres.length, MAX_SPHERES);
    for (let i = 0; i < sCount; i++) writeInstance(sphereMesh, spheres, i);
    for (let i = sCount; i < MAX_SPHERES; i++) {
      dummy.position.set(0, 0, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
      sphereMesh.setMatrixAt(i, dummy.matrix);
    }
    sphereMesh.instanceMatrix.needsUpdate = true;
    sphereMesh.instanceColor.needsUpdate = true;
    sphereMesh.count = sCount;
  }

  // ---------------------------------------------------------------------
  // Edges: one LineSegments buffer for everything. The first block is
  // static structural wiring (built once); a trailing block of reusable
  // "dynamic" slots is rewritten every frame for traveling signals and
  // connections that appear over the course of scrolling (candidate
  // docking, cross-cluster bridges, market signals). Unused dynamic slots
  // collapse to a zero-length segment, which costs nothing to draw.
  // ---------------------------------------------------------------------
  const MAX_STATIC_EDGES = 260;
  const NARRATIVE_DYNAMIC_SLOTS = 80;
  const SPARK_SLOTS = 16;
  const MAX_DYNAMIC_EDGES = NARRATIVE_DYNAMIC_SLOTS + SPARK_SLOTS;
  const TOTAL_EDGE_SLOTS = MAX_STATIC_EDGES + MAX_DYNAMIC_EDGES;
  const edgePositions = new Float32Array(TOTAL_EDGE_SLOTS * 2 * 3);
  const edgeColors = new Float32Array(TOTAL_EDGE_SLOTS * 2 * 3);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
  edgeGeo.setAttribute("color", new THREE.BufferAttribute(edgeColors, 3));
  const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeGeo.setDrawRange(0, 0);
  scene.add(edgeLines);

  // Edges reference their endpoint nodes by pool + index rather than a
  // baked position, so a static edge still tracks both of its shapes as
  // they independently float and rotate.
  const staticEdges = []; // { poolA, idxA, poolB, idxB, state, opacity }
  function addStaticEdge(poolA, idxA, poolB, idxB, state, opacity) {
    staticEdges.push({ poolA, idxA, poolB, idxB, state: state || "dim", opacity: opacity == null ? 0.5 : opacity });
  }

  function writeEdgeVertex(slot, which, pos, color) {
    const base = (slot * 2 + which) * 3;
    edgePositions[base] = pos.x; edgePositions[base + 1] = pos.y; edgePositions[base + 2] = pos.z;
    edgeColors[base] = color.r; edgeColors[base + 1] = color.g; edgeColors[base + 2] = color.b;
  }

  function flushStaticEdges() {
    const n = Math.min(staticEdges.length, MAX_STATIC_EDGES);
    for (let i = 0; i < n; i++) {
      const e = staticEdges[i];
      const pa = computeLivePos(e.poolA[e.idxA]);
      const pb = computeLivePos(e.poolB[e.idxB]);
      const c = COLOR.dimFaint.clone().lerp(stateColor(e.state), e.opacity);
      writeEdgeVertex(i, 0, pa, c);
      writeEdgeVertex(i, 1, pb, c);
    }
    staticEdgeCount = n;
  }

  let staticEdgeCount = 0;
  const ZERO = new THREE.Vector3();
  function clearDynamicSlot(slot) {
    writeEdgeVertex(slot, 0, ZERO, COLOR.dim);
    writeEdgeVertex(slot, 1, ZERO, COLOR.dim);
  }
  function writeDynamicEdge(index, a, b, color) {
    const slot = MAX_STATIC_EDGES + index;
    if (slot >= TOTAL_EDGE_SLOTS) return;
    writeEdgeVertex(slot, 0, a, color);
    writeEdgeVertex(slot, 1, b, color);
  }

  // ---------------------------------------------------------------------
  // Ambient dust: pure depth/atmosphere cue, one Points draw call.
  // ---------------------------------------------------------------------
  const DUST_COUNT = Math.round((lowTier ? 90 : 220));
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3] = (Math.random() * 2 - 1) * 900;
    dustPos[i * 3 + 1] = (Math.random() * 2 - 1) * 500;
    dustPos[i * 3 + 2] = (Math.random() * 2 - 1) * 900;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0x5578a8, size: 1.6, transparent: true, opacity: 0.35, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ---------------------------------------------------------------------
  // Cluster builders. Each returns a manifest of node indices/positions
  // so per-frame logic can look them up without re-deriving the layout.
  // ---------------------------------------------------------------------
  function jitter(v, amt) {
    return new THREE.Vector3(v.x + (Math.random() * 2 - 1) * amt, v.y + (Math.random() * 2 - 1) * amt, v.z + (Math.random() * 2 - 1) * amt);
  }

  let build, connect, find, hero;

  function buildBuildCluster() {
    const edgeStart = staticEdges.length;
    const cols = Math.max(3, Math.round(5 * density));
    const rows = Math.max(3, Math.round(4 * density));
    const layers = 3;
    const grid = [];
    const spacingX = 46, spacingY = 34, spacingZ = 55;
    for (let l = 0; l < layers; l++) {
      const layerNodes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pos = new THREE.Vector3(
            BUILD_CENTER.x + (c - (cols - 1) / 2) * spacingX,
            BUILD_CENTER.y + (r - (rows - 1) / 2) * spacingY,
            BUILD_CENTER.z + (l - (layers - 1) / 2) * spacingZ
          );
          const idx = addBox(jitter(pos, 4), 9 + Math.random() * 4, "dim", 0.12);
          layerNodes.push(idx);
        }
      }
      grid.push(layerNodes);
    }
    // Lattice wiring: within-layer neighbors, plus sparse cross-layer links.
    const edgeRefs = [];
    for (let l = 0; l < layers; l++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (c < cols - 1) edgeRefs.push([grid[l][i], grid[l][i + 1]]);
          if (r < rows - 1) edgeRefs.push([grid[l][i], grid[l][i + cols]]);
        }
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.55) {
          const i = r * cols + c;
          for (let l = 0; l < layers - 1; l++) edgeRefs.push([grid[l][i], grid[l + 1][i]]);
        }
      }
    }
    edgeRefs.forEach(([ai, bi]) => addStaticEdge(boxes, ai, boxes, bi, "dim", 0.4));

    // Two "database/cloud" spheres at the back layer.
    const dbIdx = [];
    for (let i = 0; i < 2; i++) {
      const pos = new THREE.Vector3(BUILD_CENTER.x + (i === 0 ? -60 : 60), BUILD_CENTER.y - 30, BUILD_CENTER.z + spacingZ * 1.3);
      const s = addSphere(pos, 16, "dim", 0.14);
      dbIdx.push(s);
      const nearest = grid[layers - 1][i === 0 ? 0 : cols - 1];
      addStaticEdge(spheres, s, boxes, nearest, "dim", 0.4);
    }

    const path = [];
    for (let l = layers - 1; l >= 0; l--) path.push(grid[l][Math.floor(rows / 2) * cols + Math.floor(cols / 2)]);
    const entry = grid[0][0];
    return { grid, edgeRefs, edgeStart, edgeCount: edgeRefs.length + dbIdx.length, dbIdx, path, entry, rows, cols, layers, spacingX, spacingY, spacingZ };
  }

  function buildConnectCluster() {
    const coreCount = Math.max(6, Math.round(9 * density));
    const core = [];
    for (let i = 0; i < coreCount; i++) {
      const a = (i / coreCount) * Math.PI * 2;
      const r = 55 + (i % 2) * 18;
      const pos = new THREE.Vector3(CONNECT_CENTER.x + Math.cos(a) * r, CONNECT_CENTER.y + Math.sin(a) * r * 0.6, CONNECT_CENTER.z + Math.sin(a * 1.7) * 30);
      core.push(addBox(pos, 10, "dim", 0.16));
    }
    for (let i = 0; i < coreCount; i++) addStaticEdge(boxes, core[i], boxes, core[(i + 1) % coreCount], "dim", 0.35);
    const centerIdx = addBox(CONNECT_CENTER.clone(), 13, "dim", 0.2);
    core.forEach((i) => addStaticEdge(boxes, centerIdx, boxes, i, "dim", 0.3));

    const slotCount = 4;
    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      const a = (i / slotCount) * Math.PI * 2 + 0.6;
      const pos = new THREE.Vector3(CONNECT_CENTER.x + Math.cos(a) * 30, CONNECT_CENTER.y + Math.sin(a) * 30, CONNECT_CENTER.z - 20);
      const boxIdx = addBox(pos, 9, "amber", 0.22);
      slots.push({ box: boxIdx, filled: false, docker: null });
      addStaticEdge(boxes, centerIdx, boxes, boxIdx, "amber", 0.3);
    }

    const candidateCount = Math.max(5, Math.round(7 * density));
    const candidates = [];
    for (let i = 0; i < candidateCount; i++) {
      const a = (i / candidateCount) * Math.PI * 2 + 1.1;
      const start = new THREE.Vector3(CONNECT_CENTER.x + Math.cos(a) * 150, CONNECT_CENTER.y + Math.sin(a) * 90, CONNECT_CENTER.z + Math.sin(a * 2) * 60);
      candidates.push({ sphere: addSphere(start, 6.5, "dim", 0.3), start, matches: i < slotCount, slot: i < slotCount ? slots[i] : null });
    }
    if (candidates.length > slotCount) {
      for (let i = slotCount; i < candidates.length; i++) candidates[i].slot = null;
    }

    return { core, centerIdx, slots, candidates };
  }

  function buildFindCluster() {
    const anchorIdx = addBox(FIND_CENTER.clone(), 14, "dim", 0.22);
    const marketCount = Math.max(20, Math.round(34 * density));
    const market = [];
    for (let i = 0; i < marketCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 150 + Math.random() * 190;
      const pos = new THREE.Vector3(
        FIND_CENTER.x + Math.sin(phi) * Math.cos(theta) * r,
        FIND_CENTER.y + Math.cos(phi) * r * 0.5,
        FIND_CENTER.z + Math.sin(phi) * Math.sin(theta) * r
      );
      market.push({ sphere: addSphere(pos, 4 + Math.random() * 2, "dim", 0.16), pos, reached: i % 6 === 0 });
    }
    return { anchorIdx, market };
  }

  function buildHeroField() {
    const count = Math.max(10, Math.round(16 * density));
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = new THREE.Vector3(
        lerp(-40, 0, t) + (Math.random() * 2 - 1) * 120,
        (Math.random() * 2 - 1) * 90,
        lerp(650, 140, t) + (Math.random() * 2 - 1) * 60
      );
      nodes.push(addBox(pos, 7 + Math.random() * 3, "dim", 0.14));
    }
    for (let i = 0; i < nodes.length - 1; i++) {
      if (Math.random() < 0.3) addStaticEdge(boxes, nodes[i], boxes, nodes[i + 1], "dim", 0.28);
    }
    return { nodes };
  }

  // Group ranges (recorded as contiguous slices of `boxes`/`spheres`, since
  // each cluster builder pushes its nodes in one run) let the spark system
  // pick a random node from a named group without re-deriving cluster
  // membership per node.
  let groupRanges = {};
  function snapshotRange() { return { boxStart: boxes.length, sphereStart: spheres.length }; }
  function closeRange(range) {
    range.boxEnd = boxes.length;
    range.sphereEnd = spheres.length;
    return range;
  }
  function randomNodeInGroup(name) {
    const r = groupRanges[name];
    if (!r) return null;
    const boxN = r.boxEnd - r.boxStart, sphereN = r.sphereEnd - r.sphereStart;
    if (boxN <= 0 && sphereN <= 0) return null;
    if (Math.random() * (boxN + sphereN) < boxN) return { pool: boxes, idx: r.boxStart + Math.floor(Math.random() * boxN) };
    return { pool: spheres, idx: r.sphereStart + Math.floor(Math.random() * sphereN) };
  }

  function rebuildWorld() {
    boxes.length = 0;
    spheres.length = 0;
    staticEdges.length = 0;
    groupRanges = {};
    let r = snapshotRange(); hero = buildHeroField(); groupRanges.hero = closeRange(r);
    r = snapshotRange(); build = buildBuildCluster(); groupRanges.build = closeRange(r);
    r = snapshotRange(); connect = buildConnectCluster(); groupRanges.connect = closeRange(r);
    r = snapshotRange(); find = buildFindCluster(); groupRanges.find = closeRange(r);
    flushInstances();
    flushStaticEdges();
  }

  // ---------------------------------------------------------------------
  // Camera rail. Each section owns one target camera state; chaining
  // lerps by each section's own ScrollTrigger progress composes the full
  // path (see file header for why this works).
  // ---------------------------------------------------------------------
  // Elevated well above every cluster's own node height (all clusters sit
  // near y=-30..30) so the straight-line blend between two waypoints arcs
  // over the geometry during a transition instead of clipping through it.
  const CAM = {
    hero: { pos: new THREE.Vector3(20, 160, 760), look: new THREE.Vector3(-40, 10, 300), fov: 50 },
    build: { pos: new THREE.Vector3(BUILD_CENTER.x + 40, BUILD_CENTER.y + 140, BUILD_CENTER.z + 170), look: BUILD_CENTER.clone(), fov: 54 },
    connect: { pos: new THREE.Vector3(CONNECT_CENTER.x - 30, CONNECT_CENTER.y + 140, CONNECT_CENTER.z + 150), look: CONNECT_CENTER.clone(), fov: 54 },
    find: { pos: new THREE.Vector3(FIND_CENTER.x + 10, FIND_CENTER.y + 160, FIND_CENTER.z + 260), look: FIND_CENTER.clone(), fov: 58 },
    scale: { pos: new THREE.Vector3(CENTROID.x, CENTROID.y + 430, CENTROID.z + 420), look: CENTROID.clone(), fov: 50 },
    contact: { pos: new THREE.Vector3(CENTROID.x, CENTROID.y + 520, CENTROID.z + 560), look: CENTROID.clone(), fov: 46 }
  };

  const progress = { build: 0, connect: 0, find: 0, scale: 0, contact: 0 };
  const analysis = { build: 0, connect: 0, find: 0 };

  function sectionTrigger(selector, key, target) {
    const el = document.querySelector(selector);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el, start: "top bottom", end: "bottom top", scrub: true,
      onUpdate: (self) => { target[key] = self.progress; }
    });
  }
  sectionTrigger("#build", "build", progress);
  sectionTrigger("#connect", "connect", progress);
  sectionTrigger("#find", "find", progress);
  sectionTrigger("#scale", "scale", progress);
  sectionTrigger("#contact", "contact", progress);

  function assessmentTrigger(sectionSelector, key) {
    const el = document.querySelector(sectionSelector + " .pillar-assessment");
    if (!el) return;
    ScrollTrigger.create({
      trigger: el, start: "top 85%", end: "bottom 35%", scrub: true,
      onUpdate: (self) => { analysis[key] = self.progress; }
    });
  }
  assessmentTrigger("#build", "build");
  assessmentTrigger("#connect", "connect");
  assessmentTrigger("#find", "find");

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let fov = CAM.hero.fov;

  function updateCamera() {
    camPos.copy(CAM.hero.pos);
    camLook.copy(CAM.hero.look);
    fov = CAM.hero.fov;
    ["build", "connect", "find", "scale", "contact"].forEach((key) => {
      const t = progress[key];
      camPos.lerp(CAM[key].pos, t);
      camLook.lerp(CAM[key].look, t);
      fov = lerp(fov, CAM[key].fov, t);
    });

    if (!reduceMotion) {
      const drift = performance.now() * 0.00012;
      camPos.x += Math.sin(drift) * 6 * (1 - progress.scale * 0.6);
      camPos.y += Math.cos(drift * 0.8) * 4 * (1 - progress.scale * 0.6);
    }

    camera.position.copy(camPos);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(camLook);
  }

  // ---------------------------------------------------------------------
  // Zone behavior driven directly by section progress.
  // ---------------------------------------------------------------------
  function updateBuild() {
    const t = progress.build;
    const litLayers = Math.floor(t * (build.layers + 1));
    build.grid.forEach((layerNodes, l) => {
      const on = l < litLayers;
      layerNodes.forEach((idx) => {
        boxes[idx].state = "cyan";
        boxes[idx].opacity = on ? lerp(0.12, 0.85, clamp01((t * (build.layers + 1)) - l)) : 0.12;
      });
    });
    build.dbIdx.forEach((idx) => { spheres[idx].opacity = lerp(0.14, 0.75, t); spheres[idx].state = "cyan"; });
    for (let i = 0; i < build.edgeCount; i++) {
      const e = staticEdges[build.edgeStart + i];
      if (!e) continue;
      e.opacity = lerp(0.35, 0.8, t);
      e.state = "cyan";
    }

    // The requirement: a single pulse traveling deeper into the
    // architecture as the visitor scrolls, then handed to the assessment
    // scan once the assessment card is in view.
    let di = 0;
    if (analysis.build > 0.02) {
      const a = analysis.build;
      const flagCount = Math.min(3, build.grid[1] ? build.grid[1].length : 0);
      for (let i = 0; i < flagCount; i++) {
        const idx = build.grid[1][i * 2 % build.grid[1].length];
        const resolved = a > 0.55 + i * 0.1;
        boxes[idx].state = resolved ? "cyan" : "amber";
        boxes[idx].opacity = Math.min(1, lerp(0.3, 0.95, a));
      }
    } else {
      const pathLen = build.path.length;
      const travel = t * pathLen;
      for (let i = 0; i < pathLen - 1; i++) {
        const segT = clamp01(travel - i);
        if (segT > 0 && segT < 1) {
          const a = computeLivePos(boxes[build.path[i]]), b = computeLivePos(boxes[build.path[i + 1]]);
          const p = a.clone().lerp(b, segT);
          writeDynamicEdge(di++, a, p, COLOR.white);
        }
      }
    }
    return di;
  }

  function updateConnect(diStart) {
    let di = diStart;
    const t = progress.connect;
    connect.core.forEach((idx) => { boxes[idx].state = "cyan"; boxes[idx].opacity = lerp(0.16, 0.7, t); });
    boxes[connect.centerIdx].opacity = lerp(0.2, 0.85, t);
    boxes[connect.centerIdx].state = "cyan";

    connect.candidates.forEach((cand, i) => {
      const localT = clamp01(t * 1.6 - i * 0.08);
      const sph = spheres[cand.sphere];
      if (cand.slot) {
        const target = computeLivePos(boxes[cand.slot.box]);
        sph.pos.copy(cand.start).lerp(target, easeOutCubic(localT));
        sph.opacity = lerp(0.3, 0.9, localT);
        sph.state = localT > 0.9 ? "cyan" : "blue";
        if (localT > 0.9) {
          boxes[cand.slot.box].state = "cyan";
          boxes[cand.slot.box].opacity = 0.85;
          const e = findConnectSlotEdge(cand.slot.box);
          if (e) { e.state = "cyan"; e.opacity = 0.8; }
        }
      } else {
        const veerT = clamp01(localT * 1.3);
        const veerOut = cand.start.clone().add(new THREE.Vector3(0, (veerT) * 40, 0));
        sph.pos.copy(cand.start).lerp(veerOut, veerT);
        sph.opacity = lerp(0.3, 0.15, veerT);
        sph.state = "amber";
      }
    });

    if (analysis.connect > 0.02) {
      const a = analysis.connect;
      connect.slots.forEach((slot, i) => {
        if (slot.filled) return;
        const resolved = a > 0.6;
        boxes[slot.box].state = resolved ? "cyan" : "amber";
        boxes[slot.box].opacity = Math.min(0.9, lerp(0.25, 0.8, a));
      });
    }
    return di;
  }

  const connectSlotEdgeCache = {};
  function findConnectSlotEdge(boxIdx) {
    if (boxIdx in connectSlotEdgeCache) return connectSlotEdgeCache[boxIdx];
    const found = staticEdges.find((e) =>
      (e.poolB === boxes && e.idxB === boxIdx) || (e.poolA === boxes && e.idxA === boxIdx)
    ) || null;
    connectSlotEdgeCache[boxIdx] = found;
    return found;
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - clamp01(t), 3); }

  function updateFind(diStart) {
    let di = diStart;
    const t = progress.find;
    boxes[find.anchorIdx].opacity = lerp(0.22, 0.8, t);
    boxes[find.anchorIdx].state = "cyan";

    find.market.forEach((m, i) => {
      const seed = (i * 37) % 100 / 100;
      const localT = clamp01(t * 1.8 - seed * 0.9);
      if (localT <= 0) return;
      const travel = m.reached ? Math.min(1, localT * 1.1) : Math.min(0.55, localT);
      const start = computeLivePos(boxes[find.anchorIdx]);
      const marketPos = computeLivePos(spheres[m.sphere]);
      const end = start.clone().lerp(marketPos, travel);
      const color = m.reached ? COLOR.cyan : COLOR.amber;
      if (localT < 1.05) writeDynamicEdge(di++, start, end, color);
      if (m.reached) {
        spheres[m.sphere].state = "cyan";
        spheres[m.sphere].opacity = Math.min(0.85, lerp(0.16, 0.85, localT));
        if (localT > 0.85 && localT < 1.02) {
          const backT = clamp01((localT - 0.85) / 0.2);
          const ret = marketPos.clone().lerp(start, backT);
          writeDynamicEdge(di++, marketPos, ret, COLOR.white);
        }
      } else {
        spheres[m.sphere].opacity = Math.min(0.35, lerp(0.16, 0.35, localT));
        spheres[m.sphere].state = "amber";
      }
    });

    if (analysis.find > 0.02) {
      const a = analysis.find;
      find.market.filter((m) => m.reached).slice(0, 3).forEach((m, i) => {
        spheres[m.sphere].state = a > 0.5 + i * 0.1 ? "cyan" : "amber";
        spheres[m.sphere].opacity = 0.85;
      });
    }
    return di;
  }

  function updateScale(diStart) {
    let di = diStart;
    const t = progress.scale;
    if (t > 0.01) {
      const bridges = [
        [BUILD_CENTER, CONNECT_CENTER], [CONNECT_CENTER, FIND_CENTER], [FIND_CENTER, BUILD_CENTER]
      ];
      bridges.forEach(([a, b], i) => {
        const segT = clamp01(t * 3 - i);
        if (segT <= 0) return;
        const end = a.clone().lerp(b, Math.min(1, segT * 1.3));
        writeDynamicEdge(di++, a, end, COLOR.cyan);
      });
      hero.nodes.forEach((idx) => { boxes[idx].opacity = lerp(0.14, 0.55, t); boxes[idx].state = "cyan"; });
    }
    return di;
  }

  function updateContact() {
    const t = progress.contact;
    const fade = 1 - t * 0.4;
    nodeMatOpacityFade = fade;
    edgeMat.opacity = 0.85 * fade;
    dustMat.opacity = 0.35 * fade;
  }
  let nodeMatOpacityFade = 1;

  // ---------------------------------------------------------------------
  // Interaction: tap a node to briefly reveal its dependencies. Restrained
  // — one raycast per tap, a short-lived highlight, nothing continuous.
  // ---------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let highlightPool = null;
  let highlightIdx = -1;
  let highlightUntil = 0;

  function onTap(clientX, clientY) {
    pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects([boxMesh, sphereMesh]);
    if (!hits.length) return;
    const hit = hits[0];
    const pool = hit.object === boxMesh ? boxes : spheres;
    const node = pool[hit.instanceId];
    if (!node) return;
    highlightPool = pool;
    highlightIdx = hit.instanceId;
    highlightUntil = frameNow + 650;
    flareNode(node);
  }
  window.addEventListener("pointerdown", (e) => onTap(e.clientX, e.clientY));
  window.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches[0]) onTap(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // ---------------------------------------------------------------------
  // Sparks: while the visitor is actively scrolling, fire an occasional
  // electrical connection between two shapes that aren't already wired
  // together — sometimes two neighbors in the same cluster, sometimes a
  // reach across to an adjacent one — so the scene reads as one system
  // finding more of its own connections rather than a fixed diagram.
  // Purely a byproduct of scroll activity: nothing fires while still.
  // ---------------------------------------------------------------------
  const GROUP_ORDER = ["hero", "build", "connect", "find"];
  const sparks = [];
  let lastSparkTime = -Infinity;

  function spawnSpark() {
    let a, b;
    if (Math.random() < 0.45) {
      const name = GROUP_ORDER[Math.floor(Math.random() * GROUP_ORDER.length)];
      a = randomNodeInGroup(name);
      b = randomNodeInGroup(name);
    } else {
      let gi = Math.floor(Math.random() * GROUP_ORDER.length);
      let gj = gi + (Math.random() < 0.7 ? 1 : 2);
      if (gj >= GROUP_ORDER.length) gj = gi - 1;
      if (gj < 0) gj = Math.min(GROUP_ORDER.length - 1, gi + 1);
      a = randomNodeInGroup(GROUP_ORDER[gi]);
      b = randomNodeInGroup(GROUP_ORDER[gj]);
    }
    if (!a || !b || (a.pool === b.pool && a.idx === b.idx)) return;
    sparks.push({ a, b, born: frameNow, duration: 380 + Math.random() * 260, startFlared: false, endFlared: false });
    if (sparks.length > SPARK_SLOTS) sparks.shift();
  }

  function maybeSpawnSpark(scrolling) {
    if (reduceMotion || !scrolling) return;
    if (frameNow - lastSparkTime < 240) return;
    if (Math.random() > 0.6) return;
    lastSparkTime = frameNow;
    spawnSpark();
  }

  function updateSparks() {
    for (let i = sparks.length - 1; i >= 0; i--) {
      if (frameNow - sparks[i].born > sparks[i].duration + 260) sparks.splice(i, 1);
    }
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const age = frameNow - s.born;
      const travel = clamp01(age / s.duration);
      const posA = computeLivePos(s.a.pool[s.a.idx]);
      const posB = computeLivePos(s.b.pool[s.b.idx]);
      if (!s.startFlared) { flareNode(s.a.pool[s.a.idx]); s.startFlared = true; }
      if (travel >= 1 && !s.endFlared) { flareNode(s.b.pool[s.b.idx]); s.endFlared = true; }
      const tip = posA.clone().lerp(posB, easeOutCubic(travel));
      const fadeOut = age > s.duration ? clamp01(1 - (age - s.duration) / 260) : 1;
      const alpha = Math.min(1, travel * 3) * fadeOut;
      const color = COLOR.dimFaint.clone().lerp(COLOR.white, alpha);
      writeDynamicEdge(NARRATIVE_DYNAMIC_SLOTS + i, posA, tip, color);
    }
    for (let i = sparks.length; i < SPARK_SLOTS; i++) clearDynamicSlot(MAX_STATIC_EDGES + NARRATIVE_DYNAMIC_SLOTS + i);
  }

  // ---------------------------------------------------------------------
  // Menu-open burst: brief brightness wash, kept for compatibility with
  // site-menu.js's existing window.fireAllSynapses() call.
  // ---------------------------------------------------------------------
  let burstUntil = 0;
  window.fireAllSynapses = function () {
    if (reduceMotion) return;
    burstUntil = performance.now() + 500;
  };

  // ---------------------------------------------------------------------
  // Resize / world (re)build
  // ---------------------------------------------------------------------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", () => { resize(); ScrollTrigger.refresh(); });

  resize();
  rebuildWorld();
  ScrollTrigger.refresh();

  // ---------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------
  let lastScrollY = null;
  function render() {
    frameNow = performance.now();
    updateCamera();

    const scrollY = window.scrollY;
    const scrolling = lastScrollY !== null && Math.abs(scrollY - lastScrollY) > 0.5;
    lastScrollY = scrollY;
    maybeSpawnSpark(scrolling);

    let di = 0;
    di = updateBuild();
    di = updateConnect(di);
    di = updateFind(di);
    di = updateScale(di);
    updateContact();
    for (let i = di; i < NARRATIVE_DYNAMIC_SLOTS; i++) clearDynamicSlot(MAX_STATIC_EDGES + i);
    updateSparks();

    const boost = frameNow < burstUntil ? 1.4 : 1;
    boxMesh.material.opacity = nodeMatOpacityFade * boost;
    sphereMesh.material.opacity = nodeMatOpacityFade * boost;

    flushInstances();
    flushStaticEdges();
    edgeGeo.setDrawRange(0, (staticEdgeCount + MAX_DYNAMIC_EDGES) * 2);
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.color.needsUpdate = true;

    if (!reduceMotion) {
      dust.rotation.y = frameNow * 0.000015;
    }

    if (highlightPool && frameNow < highlightUntil) {
      const a = 1 - (frameNow - (highlightUntil - 650)) / 650;
      for (const e of staticEdges) {
        const touches = (e.poolA === highlightPool && e.idxA === highlightIdx) ||
          (e.poolB === highlightPool && e.idxB === highlightIdx);
        if (touches) {
          e.opacity = Math.max(e.opacity, 0.9 * a);
          e.state = "cyan";
        }
      }
    }

    renderer.render(scene, camera);
  }

  function loop() {
    render();
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    // Strictly scroll-driven: render once per scroll/resize event, no
    // free-running rAF loop, so the scene never moves without input.
    render();
    window.addEventListener("scroll", () => requestAnimationFrame(render), { passive: true });
  } else {
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    fallbackToSynapses();
  });
})();
