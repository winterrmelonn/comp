// Start page background: a faint field of "comp." that darkens and scrambles around
// the pointer, with a ripple on click/tap. Static for people who prefer reduced motion.
(() => {
  const canvas = document.getElementById('ascii');
  const ctx = canvas.getContext('2d');
  const WORD = 'comp. ';
  const RAMP = '.:-=+*#%@';
  const INK = '17,17,17';
  const BASE_ALPHA = 0.08;
  const RADIUS = 150;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cw, ch, cols, rows, base;
  const pointer = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4 };
  const ripples = [];

  const charAt = (c, r) => WORD[(c + r * 3) % WORD.length];

  function resize() {
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '14px "Courier New", Courier, monospace';
    ctx.textBaseline = 'top';
    cw = ctx.measureText('m').width;
    ch = 18;
    cols = Math.ceil(innerWidth / cw);
    rows = Math.ceil(innerHeight / ch);

    // The resting field never changes, so draw it once and copy it each frame
    base = document.createElement('canvas');
    base.width = canvas.width;
    base.height = canvas.height;
    const b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.font = ctx.font;
    b.textBaseline = 'top';
    b.fillStyle = `rgba(${INK},${BASE_ALPHA})`;
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) line += charAt(c, r);
      b.fillText(line, 0, r * ch);
    }
    ctx.drawImage(base, 0, 0, innerWidth, innerHeight);
  }

  // Redraw one cell at strength k (0..1): darker, denser and jittery as k rises
  function cell(c, r, k) {
    const x = c * cw, y = r * ch;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, cw + 0.5, ch);
    const i = Math.min(RAMP.length - 1, Math.floor(k * RAMP.length + Math.random() * 2));
    ctx.fillStyle = `rgba(${INK},${BASE_ALPHA + k * 0.42})`;
    ctx.fillText(k < 0.12 ? charAt(c, r) : RAMP[i], x, y);
  }

  function frame(now) {
    pointer.sx += (pointer.x - pointer.sx) * 0.18;
    pointer.sy += (pointer.y - pointer.sy) * 0.18;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.drawImage(base, 0, 0, innerWidth, innerHeight);

    const strength = new Map(); // cell index -> strongest effect this frame
    const add = (c, r, k) => {
      const key = r * cols + c;
      if (k > (strength.get(key) || 0)) strength.set(key, k);
    };

    // Lens around the pointer
    const c0 = Math.max(0, Math.floor((pointer.sx - RADIUS) / cw)), c1 = Math.min(cols - 1, Math.ceil((pointer.sx + RADIUS) / cw));
    const r0 = Math.max(0, Math.floor((pointer.sy - RADIUS) / ch)), r1 = Math.min(rows - 1, Math.ceil((pointer.sy + RADIUS) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = 1 - Math.hypot(c * cw + cw / 2 - pointer.sx, r * ch + ch / 2 - pointer.sy) / RADIUS;
        if (k > 0) add(c, r, k * k);
      }
    }

    // Ripples: a ring that grows outward and fades
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const age = now - rp.t;
      const radius = age * 0.6, band = 36, fade = 1 - age / 1800;
      if (fade <= 0) { ripples.splice(i, 1); continue; }
      const rr0 = Math.max(0, Math.floor((rp.y - radius - band) / ch)), rr1 = Math.min(rows - 1, Math.ceil((rp.y + radius + band) / ch));
      const cc0 = Math.max(0, Math.floor((rp.x - radius - band) / cw)), cc1 = Math.min(cols - 1, Math.ceil((rp.x + radius + band) / cw));
      for (let r = rr0; r <= rr1; r++) {
        for (let c = cc0; c <= cc1; c++) {
          const off = Math.abs(Math.hypot(c * cw - rp.x, r * ch - rp.y) - radius);
          if (off < band) add(c, r, (1 - off / band) * fade * 0.8);
        }
      }
    }

    // A few idle flickers so the field never looks frozen
    for (let i = 0; i < 6; i++) add(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), 0.2 + Math.random() * 0.2);

    for (const [key, k] of strength) cell(key % cols, Math.floor(key / cols), k);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  if (reduced) return;

  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
  addEventListener('pointerdown', e => {
    pointer.x = pointer.sx = e.clientX;
    pointer.y = pointer.sy = e.clientY;
    ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  document.documentElement.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4; });
  requestAnimationFrame(frame);
})();
