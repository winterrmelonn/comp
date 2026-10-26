// Menu page: red spider lilies (Lycoris radiata) in React Three Fiber. On wide screens each menu link
// sits just off the bottom right of its own flower. Hovering (or focusing) a link blooms that flower: the petals open
// and the stamens reach out (morph targets), the red warms, and the link text grows, all driven by
// one eased value per flower so they stay in step. Shapes are seeded so they look the same every visit.
import { createElement as h, useLayoutEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { damp } from 'maath/easing';
import htm from 'htm';

const html = htm.bind(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tube = (pts, radius, segments = 20) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segments, radius, 5, false);
const morph = (a, b) => { a.morphAttributes.position = [b.getAttribute('position')]; return a; }; // a can morph into b's shape
const rng = seed => () => { // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A flat strip along a curve that is narrow at the base, widest in the middle and pointed at the tip,
// with rippled edges. `across` is the direction of its width.
function ribbon(pts, across, maxWidth, phase, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const p = curve.getPoint(s);
    const n = new THREE.Vector3().crossVectors(curve.getTangent(s), across).normalize();
    const half = (maxWidth / 2) * Math.pow(Math.sin(Math.PI * s), 0.6) * (1 - 0.35 * s);
    const wave = 0.018 * Math.sin(s * 15 + phase) * s;
    const a = p.clone().addScaledVector(across, half).addScaledVector(n, wave);
    const b = p.clone().addScaledVector(across, -half).addScaledVector(n, -wave);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, s, 1, s);
    if (i < segments) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const COLORS = {
  petal: new THREE.Color('#b3122b'), petalBloom: new THREE.Color('#d8283c'),
  stamen: new THREE.Color('#c92a3f'), stamenBloom: new THREE.Color('#e6485a'),
};
const MATERIALS = {
  stem: new THREE.MeshStandardMaterial({ color: '#2e3a22', roughness: 0.8 }),
  petal: new THREE.MeshStandardMaterial({ color: COLORS.petal, roughness: 0.45, side: THREE.DoubleSide, emissive: '#7a0a18', emissiveIntensity: 0 }),
  stamen: new THREE.MeshStandardMaterial({ color: COLORS.stamen, roughness: 0.5 }),
  anther: new THREE.MeshStandardMaterial({ color: '#5a2a14', roughness: 0.6 }),
};

// Build one lily (base at the origin, flower head at `top`) as one merged geometry per material.
// Petals, stamens and anthers carry a second "bloomed" shape as a morph target.
function buildLily(rand, height) {
  const parts = { stem: [], petal: [], stamen: [], anther: [] };
  const bend = (rand() - 0.5) * 0.6;
  const top = V(bend, height, (rand() - 0.5) * 0.3);
  parts.stem.push(tube([V(0, 0, 0), V(bend * 0.1, height * 0.4, 0), V(bend * 0.6, height * 0.85, top.z * 0.5), top], 0.032, 48));

  const florets = 6 + Math.floor(rand() * 2);
  for (let i = 0; i < florets; i++) {
    const a = (i / florets) * Math.PI * 2 + rand() * 0.5;
    const d = V(Math.cos(a), 0.3 + rand() * 0.35, Math.sin(a)).normalize(); // outward and a little up
    const base = top.clone().addScaledVector(d, 0.16);
    parts.stem.push(tube([top, top.clone().addScaledVector(d, 0.08).addScaledVector(UP, 0.02), base], 0.014, 6));

    const side = new THREE.Vector3().crossVectors(d, UP).normalize();
    const up2 = new THREE.Vector3().crossVectors(side, d).normalize();
    const around = b => side.clone().multiplyScalar(Math.cos(b)).addScaledVector(up2, Math.sin(b));

    for (let j = 0; j < 6; j++) { // petals: long and pointed, reaching out, with only the tips curling back
      const radial = around((j / 6) * Math.PI * 2 + rand() * 0.3);
      const across = new THREE.Vector3().crossVectors(d, radial).normalize();
      const L = 0.65 + rand() * 0.15, width = 0.13 + rand() * 0.04, phase = rand() * 6;
      const petal = open => { // open: splays wider, a bit longer, tips curl back further
        const v = d.clone().multiplyScalar(open ? 0.55 : 0.7).addScaledVector(radial, open ? 0.8 : 0.65).normalize();
        const len = L * (open ? 1.12 : 1);
        const at = (along, back, outward = 0) => base.clone().addScaledVector(v, len * along).addScaledVector(d, -back * len).addScaledVector(radial, outward * len);
        return ribbon([base, at(0.35, -0.06), at(0.7, -0.04, 0.05), at(0.95, open ? 0.16 : 0.1, open ? 0.16 : 0.12), at(1.0, open ? 0.42 : 0.3, open ? 0.22 : 0.15)],
          across, width * (open ? 1.1 : 1), phase);
      };
      parts.petal.push(morph(petal(false), petal(true)));
    }

    for (let j = 0; j < 6; j++) { // stamens: long and thin, reaching about 1.5x past the petals
      const dir = around((j / 6) * Math.PI * 2 + 0.5);
      const L = 0.95 + rand() * 0.25, rise = 0.35 + rand() * 0.1;
      const stamen = open => {
        const s = d.clone().addScaledVector(dir, open ? 0.42 : 0.3).normalize();
        const len = L * (open ? 1.08 : 1);
        const end = base.clone().addScaledVector(s, len).addScaledVector(UP, rise + (open ? 0.06 : 0));
        return { line: tube([base, base.clone().addScaledVector(s, len * 0.55).addScaledVector(UP, 0.05), end], 0.005, 16), end };
      };
      const shut = stamen(false), open = stamen(true);
      parts.stamen.push(morph(shut.line, open.line));
      const tip = e => new THREE.SphereGeometry(0.016, 6, 4).translate(e.x, e.y, e.z);
      parts.anther.push(morph(tip(shut.end), tip(open.end)));
    }
  }
  return { top, geos: Object.fromEntries(Object.entries(parts).map(([k, geos]) => [k, mergeGeometries(geos)])) };
}

// Menu links, and how far each one's flower is into its bloom (0 resting, 1 hovered)
const links = [...document.querySelectorAll('.nav a')];
const hover = links.map(() => 0);
links.forEach((a, i) => {
  const on = () => { hover[i] = 1; }, off = () => { hover[i] = 0; };
  a.addEventListener('pointerenter', on);
  a.addEventListener('pointerleave', off);
  a.addEventListener('focus', on);
  a.addEventListener('blur', off);
});

const swayed = new THREE.Vector3(), resting = new THREE.Vector3(); // scratch vectors for the per-frame link offset

// One lily whose flower head sits at (x, y, z). Lilies with a link `index` bloom on hover.
function Lily({ seed, x, y, z, index }) {
  const { top, geos } = useMemo(() => buildLily(rng(seed), y + 4), [seed, y]);
  const group = useRef();
  const meshes = useRef({});
  const anim = useRef({ p: 0 });
  const mats = useMemo(() => index == null ? MATERIALS
    : Object.fromEntries(Object.entries(MATERIALS).map(([k, m]) => [k, m.clone()])), [index]);

  useFrame(({ clock, camera, size }, delta) => {
    if (!still) { // a slow breeze, swaying from the base
      const t = clock.elapsedTime;
      group.current.rotation.z = Math.sin(t * 0.5 + seed) * 0.018;
      group.current.rotation.x = Math.sin(t * 0.37 + seed * 2) * 0.012;
    }
    if (index == null) return;
    damp(anim.current, 'p', hover[index], still ? 0 : 0.3, delta);
    const p = anim.current.p;
    for (const k of ['petal', 'stamen', 'anther']) meshes.current[k].morphTargetInfluences[0] = p;
    mats.petal.color.lerpColors(COLORS.petal, COLORS.petalBloom, p);
    mats.stamen.color.lerpColors(COLORS.stamen, COLORS.stamenBloom, p);
    mats.petal.emissiveIntensity = p * 0.35;
    const link = links[index].style;
    link.setProperty('--bloom', p.toFixed(3));

    // Let the link ride along as the flower head sways: on-screen offset from its resting spot
    group.current.updateMatrixWorld();
    const head = group.current.localToWorld(swayed.copy(top)).project(camera);
    const rest = resting.set(x, y, z).project(camera);
    link.setProperty('--sx', `${((head.x - rest.x) / 2) * size.width}px`);
    link.setProperty('--sy', `${((rest.y - head.y) / 2) * size.height}px`);
  });

  return html`
    <group ref=${group} position=${[x - top.x, -4, z - top.z]}>
      ${Object.entries(geos).map(([k, g]) => html`
        <mesh key=${k} geometry=${g} material=${mats[k]} ref=${m => { if (m) { m.updateMorphTargets(); meshes.current[k] = m; } }} />`)}
    </group>`;
}

// Wide screens: the spread-out garden, where three of the lilies carry the menu links (index) and
// bloom on hover. Narrow screens: links stay in a list on the left, with a few lilies on the right.
// x and z are world units, y is the flower head height (the view is about 6.3 tall, centred on 0).
const WIDE = [
  { seed: 11, x: -4.3, z: 0.5, y: -0.4 },
  { seed: 23, x: -3.0, z: -1.0, y: 0.6, index: 0, gap: 0.25, drop: 0.7 },
  { seed: 37, x: -1.7, z: 0.9, y: -1.0 },
  { seed: 41, x: -0.4, z: -0.6, y: 0.1 },
  { seed: 53, x: 0.9, z: 0.3, y: 0.9, index: 1, side: 'left' },
  { seed: 67, x: 2.1, z: -1.2, y: 0.4, index: 2 },
  { seed: 71, x: 3.2, z: 0.8, y: -0.7 },
  { seed: 83, x: 4.3, z: -0.3, y: 0.8 },
];
const NARROW = [ // fx: fraction of the page width
  { seed: 23, fx: 0.8, z: -0.5, y: 0.9 },
  { seed: 53, fx: 0.98, z: 0.3, y: -0.6 },
  { seed: 67, fx: 0.7, z: 0.6, y: -1.9 },
];
const STAMEN_REACH = 1.45; // how far stamens rise above the flower head, fully bloomed

function Garden() {
  const { size, viewport, camera } = useThree();
  const vp = viewport.getCurrentViewport(camera, [0, 0, 0]);
  const narrow = size.width < 720; // matches the breakpoint in style.css

  // Keep every flower below the top bar
  const barBottom = document.querySelector('.top').getBoundingClientRect().bottom;
  const maxY = (0.5 - barBottom / size.height) * vp.height - STAMEN_REACH;
  const lilies = (narrow ? NARROW.map(l => ({ ...l, x: (l.fx - 0.5) * vp.width })) : WIDE)
    .map(l => ({ ...l, y: Math.min(l.y, maxY) }));

  // Put each link just under its flower, beside the stem (on the right unless side: 'left'; gap and
  // drop are how far from the stem and below the head, in world units), and give it a round hover area over the flower
  useLayoutEffect(() => {
    if (narrow) return links.forEach(a => a.removeAttribute('style'));
    camera.updateMatrixWorld();
    for (const l of lilies.filter(l => l.index != null)) {
      const px = (x, y) => {
        const v = V(x, y, l.z).project(camera);
        return [(v.x + 1) / 2 * size.width, (1 - v.y) / 2 * size.height];
      };
      const a = links[l.index];
      const anchor = onLeft => px(l.x + (onLeft ? -1 : 1) * (l.gap ?? 0.12), l.y - (l.drop ?? 0.55));
      let left = l.side === 'left';
      let [ax, ay] = anchor(left);
      const overflows = left ? ax - a.offsetWidth < 16 : ax + a.offsetWidth > size.width - 16;
      if (overflows) [left, [ax, ay]] = [!left, anchor(!left)]; // no room on that side of the stem: use the other
      const [cx, cy] = px(l.x, l.y), [rx] = px(l.x + 0.7, l.y);
      a.dataset.side = left ? 'left' : 'right';
      a.style.left = left ? 'auto' : `${ax}px`; // the anchor is the text's left edge, or its right edge for side: 'left'
      a.style.right = left ? `${size.width - ax}px` : 'auto';
      a.style.top = `${ay}px`;
      a.style.setProperty('--cx', `${cx - ax}px`);
      a.style.setProperty('--cy', `${cy - ay}px`);
      a.style.setProperty('--r', `${rx - cx}px`);
    }
  }, [size.width, size.height]);

  return html`${lilies.map(l => html`<${Lily} key=${l.seed + (narrow ? 'n' : 'w')} ...${l} />`)}`;
}

createRoot(document.getElementById('lilies')).render(html`
  <${Canvas} camera=${{ position: [0, 0, 10], fov: 35 }} dpr=${[1, 2]} gl=${{ alpha: true, antialias: true }}>
    <ambientLight intensity=${0.7} />
    <directionalLight position=${[3, 5, 4]} intensity=${1.8} />
    <directionalLight position=${[-4, -2, 2]} intensity=${0.4} />
    <${Garden} />
  <//>`);
