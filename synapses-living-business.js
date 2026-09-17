(() => {
  "use strict";

  /*
    SilverXis Living Business Background
    Drop-in replacement for the existing synapses.js.
    Keeps the existing #synapse-canvas and requires no HTML changes.

    Narrative:
      HERO    = enterprise system coming online
      BUILD   = software architecture / data / APIs
      CONNECT = capability gaps being filled
      FIND    = market pathways / discovery / conversion
      SCALE   = all three systems operate as one
  */

  const canvas = document.getElementById("synapse-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const reduceMotion = !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const C = {
    blue: [92, 178, 250],
    cyan: [104, 224, 255],
    white: [230, 241, 255],
    amber: [255, 165, 80],
    navy: [3, 7, 16],
    panel: [10, 20, 36]
  };

  let dpr = 1, W = 0, H = 0, now = 0, last = performance.now();
  let scrollY = window.scrollY;
  let targetScrollY = scrollY;
  let pointer = { x: -9999, y: -9999, active: false };
  let sectionState = { name: "hero", progress: 0, global: 0 };
  let pulses = [];
  let sparks = [];
  let raf = 0;

  const sections = [
    { name: "hero", el: document.querySelector(".hero") },
    { name: "build", el: document.querySelector("#build") },
    { name: "connect", el: document.querySelector("#connect") },
    { name: "find", el: document.querySelector("#find") },
    { name: "scale", el: document.querySelector("#scale") },
    { name: "contact", el: document.querySelector("#contact") }
  ].filter(s => s.el);

  const systems = [];
  const routes = [];
  const marketRoutes = [];
  const capabilities = [];

  function rgba(c, a) {
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a=0, b=1) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t * t * (3 - 2 * t); }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.6 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildWorld();
  }

  function buildWorld() {
    systems.length = 0;
    routes.length = 0;
    marketRoutes.length = 0;
    capabilities.length = 0;

    // Mobile composition intentionally leaves the center-left readable.
    const compact = W < 700;
    const cx = compact ? W * 0.67 : W * 0.64;
    const cy = H * 0.48;
    const spreadX = compact ? W * 0.38 : Math.min(520, W * 0.38);
    const spreadY = H * 0.37;

    const defs = [
      [-.64,-.55, .18,.12,"APP"],
      [ .05,-.67, .22,.10,"API"],
      [ .60,-.48, .18,.14,"DATA"],
      [-.44,-.12, .22,.15,"SERVICES"],
      [ .15,-.12, .19,.13,"CLOUD"],
      [ .65, .02, .17,.12,"AI"],
      [-.55, .35, .18,.13,"OPS"],
      [ .00, .42, .22,.14,"PLATFORM"],
      [ .56, .50, .18,.12,"CRM"]
    ];

    defs.forEach((d,i) => {
      systems.push({
        x: cx + d[0]*spreadX, y: cy + d[1]*spreadY,
        w: Math.max(48, d[2]*spreadX), h: Math.max(34, d[3]*spreadY),
        label: d[4], phase: i*.73, id:i
      });
    });

    [[0,1],[1,2],[0,3],[3,4],[4,2],[3,6],[4,7],[7,8],[5,8],[2,5],[6,7],[1,4]]
      .forEach((r,i)=>routes.push({a:r[0],b:r[1],phase:i*.11}));

    for (let i=0;i<7;i++) {
      capabilities.push({
        angle: (Math.PI*2/7)*i + .2,
        radius: Math.min(W,H)*(.28 + (i%2)*.045),
        phase: i*.8
      });
    }

    for (let i=0;i<9;i++) {
      marketRoutes.push({
        side: i%2 ? 1 : -1,
        y: H*(.15 + (i/10)*.72),
        bend: (i%3-1)*W*.13,
        phase: i*.17,
        success: i===2 || i===5 || i===8
      });
    }
  }

  function getState() {
    const y = window.scrollY + H * .48;
    const docH = Math.max(1, document.documentElement.scrollHeight - H);
    let active = sections[0], p = 0;

    for (let i=0;i<sections.length;i++) {
      const s = sections[i];
      const top = s.el.offsetTop;
      const bottom = top + s.el.offsetHeight;
      if (y >= top && y < bottom) {
        active = s;
        p = clamp((y-top)/(bottom-top));
        break;
      }
      if (y >= bottom) active = s;
    }
    return { name: active.name, progress:p, global:clamp(window.scrollY/docH) };
  }

  function line(a,b,color=C.blue,alpha=.28,width=1) {
    ctx.strokeStyle = rgba(color,alpha);
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }

  function roundRect(x,y,w,h,r=7) {
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }

  function drawGrid(alpha=.06) {
    const step = W < 700 ? 34 : 48;
    const drift = (scrollY*.035)%step;
    ctx.lineWidth=.5;
    ctx.strokeStyle=rgba(C.blue,alpha);
    for(let x=-step+drift;x<W+step;x+=step){
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
    }
    for(let y=-step+drift*.55;y<H+step;y+=step){
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    }
  }

  function drawSystem(s, intensity=1, analyzed=false) {
    const breathe = reduceMotion ? 0 : Math.sin(now*.001+s.phase)*1.5;
    const x=s.x-s.w/2, y=s.y-s.h/2+breathe;
    const hover = pointer.active &&
      pointer.x>x-18 && pointer.x<x+s.w+18 &&
      pointer.y>y-18 && pointer.y<y+s.h+18;

    ctx.save();
    if (hover) {
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,90);
      g.addColorStop(0,rgba(C.cyan,.14)); g.addColorStop(1,rgba(C.cyan,0));
      ctx.fillStyle=g;ctx.fillRect(s.x-90,s.y-90,180,180);
    }

    ctx.fillStyle=rgba(C.panel,.28*intensity);
    ctx.strokeStyle=rgba(hover?C.cyan:C.blue,.38*intensity);
    ctx.lineWidth=hover?1.5:1;
    roundRect(x,y,s.w,s.h,6);ctx.fill();ctx.stroke();

    // plausible internal rack / application detail
    ctx.strokeStyle=rgba(C.white,.10*intensity);
    ctx.lineWidth=.7;
    for(let i=1;i<4;i++){
      ctx.beginPath();
      ctx.moveTo(x+s.w*.12,y+s.h*i/4);
      ctx.lineTo(x+s.w*.88,y+s.h*i/4);
      ctx.stroke();
    }

    const led = analyzed && (s.id===2 || s.id===4) ? C.amber : C.cyan;
    ctx.fillStyle=rgba(led,.72*intensity);
    ctx.beginPath();ctx.arc(x+s.w-7,y+7,1.7,0,Math.PI*2);ctx.fill();

    if (W>620 || hover) {
      ctx.font=`600 ${W<700?7:9}px 'IBM Plex Mono', monospace`;
      ctx.fillStyle=rgba(C.white,.36*intensity);
      ctx.fillText(s.label,x+7,y+12);
    }
    ctx.restore();
  }

  function routePoint(r,t) {
    const a=systems[r.a], b=systems[r.b];
    return {x:lerp(a.x,b.x,t), y:lerp(a.y,b.y,t)};
  }

  function drawArchitecture(mode) {
    const analysis = mode==="build" && sectionState.progress>.55;
    const intensity = mode==="hero" ? .48 : mode==="build" ? .9 : .62;

    routes.forEach((r,i)=>{
      const a=systems[r.a],b=systems[r.b];
      const active = mode!=="hero" || i<5;
      line(a,b,analysis && (i===4||i===7)?C.amber:C.blue,
        active?.18*intensity:.05, active?1:.6);

      if(active && !reduceMotion){
        const t=(now*.00010 + r.phase + sectionState.global*.9)%1;
        const p=routePoint(r,t);
        ctx.fillStyle=rgba(C.cyan,.72*intensity);
        ctx.beginPath();ctx.arc(p.x,p.y,1.7,0,Math.PI*2);ctx.fill();
      }
    });

    systems.forEach((s,i)=>{
      let visible=1;
      if(mode==="hero") visible = clamp((sectionState.progress*11-i)/2);
      drawSystem(s,visible*intensity,analysis);
    });

    if(analysis) drawScanner();
  }

  function drawScanner() {
    const y=(now*.055)%H;
    const g=ctx.createLinearGradient(0,y-35,0,y+35);
    g.addColorStop(0,rgba(C.cyan,0));
    g.addColorStop(.5,rgba(C.cyan,.14));
    g.addColorStop(1,rgba(C.cyan,0));
    ctx.fillStyle=g;ctx.fillRect(0,y-35,W,70);
    ctx.strokeStyle=rgba(C.cyan,.28);ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  }

  function drawCapabilities() {
    drawArchitecture("connect");
    const center=systems[7];
    capabilities.forEach((c,i)=>{
      const x=center.x+Math.cos(c.angle)*c.radius;
      const y=center.y+Math.sin(c.angle)*c.radius*.68;
      const fit = i===1 || i===4 || i===6;
      const pull=fit?ease(sectionState.progress):0;
      const tx=lerp(x,center.x+(i-3)*8,pull*.72);
      const ty=lerp(y,center.y+(i%2?18:-18),pull*.72);

      ctx.strokeStyle=rgba(fit?C.cyan:C.white,fit?.28:.08);
      ctx.lineWidth=fit?1:.6;
      ctx.setLineDash(fit?[4,7]:[2,8]);
      ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(center.x,center.y);ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle=rgba(fit?C.cyan:C.blue,fit?.65:.20);
      ctx.fillStyle=rgba(C.panel,.55);
      const size=fit?9:6;
      ctx.beginPath();
      ctx.rect(tx-size/2,ty-size/2,size,size);
      ctx.fill();ctx.stroke();

      if(fit && sectionState.progress>.45 && !reduceMotion){
        const t=(now*.00025+c.phase)%1;
        const px=lerp(tx,center.x,t),py=lerp(ty,center.y,t);
        ctx.fillStyle=rgba(C.cyan,.85);
        ctx.beginPath();ctx.arc(px,py,2,0,Math.PI*2);ctx.fill();
      }
    });
  }

  function bezierPoint(p0,p1,p2,t){
    const u=1-t;
    return {
      x:u*u*p0.x+2*u*t*p1.x+t*t*p2.x,
      y:u*u*p0.y+2*u*t*p1.y+t*t*p2.y
    };
  }

  function drawMarket() {
    // internal enterprise remains visible but quieter
    drawArchitecture("find");
    const source=systems[8];

    marketRoutes.forEach((r,i)=>{
      const end={x:r.side>0?W+35:-35,y:r.y};
      const ctrl={x:W*.5+r.bend,y:(source.y+end.y)*.5};
      const success=r.success;

      ctx.strokeStyle=rgba(success?C.cyan:C.blue,success?.27:.075);
      ctx.lineWidth=success?1.2:.7;
      ctx.beginPath();ctx.moveTo(source.x,source.y);
      ctx.quadraticCurveTo(ctrl.x,ctrl.y,end.x,end.y);ctx.stroke();

      if(!reduceMotion){
        const speed=success?.00016:.000085;
        const t=(now*speed+r.phase)%1;
        // unsuccessful attention dies before conversion
        const tt=success?t:t*.72;
        const p=bezierPoint(source,ctrl,end,tt);
        ctx.fillStyle=rgba(success?C.cyan:C.white,success?.85:.22*(1-t));
        ctx.beginPath();ctx.arc(p.x,p.y,success?2.2:1.3,0,Math.PI*2);ctx.fill();
      }
    });

    // conversion return path
    if(sectionState.progress>.55){
      const t=clamp((sectionState.progress-.55)/.35);
      ctx.strokeStyle=rgba(C.cyan,.18*t);ctx.lineWidth=1.3;
      ctx.beginPath();ctx.arc(source.x,source.y,28+22*t,0,Math.PI*2);ctx.stroke();
    }
  }

  function drawScale() {
    const p=ease(sectionState.progress);
    ctx.save();
    const scale=lerp(1,.72,p);
    ctx.translate(W/2,H/2);
    ctx.scale(scale,scale);
    ctx.translate(-W/2,-H/2);

    drawArchitecture("scale");

    // capability orbit
    const center=systems[7];
    capabilities.slice(0,5).forEach((c,i)=>{
      const x=center.x+Math.cos(c.angle)*c.radius*.65;
      const y=center.y+Math.sin(c.angle)*c.radius*.45;
      line({x,y},center,C.cyan,.13,1);
      ctx.fillStyle=rgba(C.cyan,.45);
      ctx.fillRect(x-3,y-3,6,6);
    });

    // market loops
    marketRoutes.filter(r=>r.success).forEach(r=>{
      const source=systems[8];
      const end={x:r.side>0?W+40:-40,y:r.y};
      const ctrl={x:W*.5+r.bend,y:(source.y+end.y)*.5};
      ctx.strokeStyle=rgba(C.cyan,.16);ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(source.x,source.y);
      ctx.quadraticCurveTo(ctrl.x,ctrl.y,end.x,end.y);ctx.stroke();
    });
    ctx.restore();

    // restrained growth indicator: throughput, not giant text
    const gx=W*.5, gy=H*.22;
    for(let i=0;i<4;i++){
      const rr=18+i*15+p*8;
      ctx.strokeStyle=rgba(C.cyan,.10*(1-i/5));
      ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(gx,gy,rr,0,Math.PI*2);ctx.stroke();
    }
  }

  function drawHero() {
    drawArchitecture("hero");
    // incomplete dependency traces around the edge of the system
    ctx.setLineDash([3,9]);
    ctx.strokeStyle=rgba(C.white,.07);
    ctx.lineWidth=.7;
    ctx.strokeRect(W*.08,H*.12,W*.84,H*.72);
    ctx.setLineDash([]);
  }

  function drawAmbient() {
    const count=W<700?12:20;
    const drift=reduceMotion?0:now*.004;
    for(let i=0;i<count;i++){
      const x=((i*137 + drift*(i%3+1))%(W+100))-50;
      const y=(i*83)%H;
      ctx.fillStyle=rgba(C.blue,.035+(i%4)*.008);
      ctx.fillRect(x,y,1,1);
    }
  }

  function drawVignette() {
    const g=ctx.createRadialGradient(W*.52,H*.45,Math.min(W,H)*.12,
      W*.52,H*.45,Math.max(W,H)*.78);
    g.addColorStop(0,"rgba(1,5,12,0)");
    g.addColorStop(1,"rgba(1,3,9,.68)");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

    // text-safe veil on mobile left/center
    if(W<700){
      const lg=ctx.createLinearGradient(0,0,W,0);
      lg.addColorStop(0,"rgba(2,5,12,.48)");
      lg.addColorStop(.62,"rgba(2,5,12,.13)");
      lg.addColorStop(1,"rgba(2,5,12,0)");
      ctx.fillStyle=lg;ctx.fillRect(0,0,W,H);
    }
  }

  function render(t) {
    now=t;
    const dt=Math.min(32,t-last); last=t;
    scrollY += (targetScrollY-scrollY)*(reduceMotion?1:.09);
    sectionState=getState();

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="rgba(2,5,12,.18)";
    ctx.fillRect(0,0,W,H);

    drawGrid(sectionState.name==="build"?.055:.035);
    drawAmbient();

    switch(sectionState.name){
      case "build": drawArchitecture("build"); break;
      case "connect": drawCapabilities(); break;
      case "find": drawMarket(); break;
      case "scale": drawScale(); break;
      case "contact": drawScale(); break;
      default: drawHero();
    }

    drawVignette();
    raf=requestAnimationFrame(render);
  }

  function interact(x,y){
    pointer={x,y,active:true};
    // send a short dependency pulse from the closest system
    let best=null,dist=85;
    systems.forEach(s=>{
      const d=Math.hypot(x-s.x,y-s.y);
      if(d<dist){dist=d;best=s;}
    });
    if(best){
      routes.filter(r=>r.a===best.id||r.b===best.id).forEach((r,i)=>{
        pulses.push({r,born:performance.now()+i*45});
      });
    }
  }

  window.addEventListener("scroll",()=>{targetScrollY=window.scrollY},{passive:true});
  window.addEventListener("resize",resize,{passive:true});
  window.addEventListener("pointermove",e=>{
    if(e.pointerType==="mouse") interact(e.clientX,e.clientY);
  },{passive:true});
  window.addEventListener("pointerleave",()=>pointer.active=false,{passive:true});
  window.addEventListener("touchstart",e=>{
    if(e.touches[0]) interact(e.touches[0].clientX,e.touches[0].clientY);
  },{passive:true});

  // Preserve compatibility with any existing calls.
  window.fireAllSynapses = () => {
    systems.forEach((s,i)=>setTimeout(()=>{
      pointer={x:s.x,y:s.y,active:true};
    },i*55));
    setTimeout(()=>pointer.active=false,900);
  };

  resize();
  targetScrollY=window.scrollY;
  scrollY=targetScrollY;
  raf=requestAnimationFrame(render);
})();
