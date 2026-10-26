// Menu page: red spider lilies (Lycoris radiata) behind the links, in React Three Fiber.
// Each lily is a tall stem topped by a ring of florets; every floret has six wide, wavy petals
// that curl backward and six long stamens that arch out and up past them. Shapes are seeded so they stay put.
import { createElement as h, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import htm from 'htm';

const html = htm.bind(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const tube = (pts, radius, segments = 20) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segments, radius, 5, false);
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

const MATERIALS = {
  stem: new THREE.MeshStandardMaterial({ color: '#2e3a22', roughness: 0.8 }),
  petal: new THREE.MeshStandardMaterial({ color: '#b3122b', roughness: 0.45, side: THREE.DoubleSide }),
  stamen: new THREE.MeshStandardMaterial({ color: '#c92a3f', roughness: 0.5 }),
  anther: new THREE.MeshStandardMaterial({ color: '#5a2a14', roughness: 0.6 }),
};

// Build one lily (base at the origin) as one merged geometry per material
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
      const v = d.clone().multiplyScalar(0.7).addScaledVector(radial, 0.65).normalize();
      const across = new THREE.Vector3().crossVectors(d, radial).normalize();
      const L = 0.65 + rand() * 0.15;
      const at = (along, back, outward = 0) => base.clone().addScaledVector(v, L * along).addScaledVector(d, -back * L).addScaledVector(radial, outward * L);
      parts.petal.push(ribbon([base, at(0.35, -0.06), at(0.7, -0.04, 0.05), at(0.95, 0.1, 0.12), at(1.0, 0.3, 0.15)], across, 0.13 + rand() * 0.04, rand() * 6));
    }

    for (let j = 0; j < 6; j++) { // stamens: long and thin, reaching about 1.5x past the petals
      const s = d.clone().addScaledVector(around((j / 6) * Math.PI * 2 + 0.5), 0.3).normalize();
      const L = 0.95 + rand() * 0.25;
      const end = base.clone().addScaledVector(s, L).addScaledVector(UP, 0.35 + rand() * 0.1);
      parts.stamen.push(tube([base, base.clone().addScaledVector(s, L * 0.55).addScaledVector(UP, 0.05), end], 0.005, 16));
      parts.anther.push(new THREE.SphereGeometry(0.016, 6, 4).translate(end.x, end.y, end.z));
    }
  }
  return Object.fromEntries(Object.entries(parts).map(([k, geos]) => [k, mergeGeometries(geos)]));
}

function Lily({ seed, x, z, height }) {
  const ref = useRef();
  const geos = useMemo(() => buildLily(rng(seed), height), [seed, height]);
  useFrame(({ clock }) => { // a slow breeze, swaying from the base
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.5 + seed) * 0.018;
    ref.current.rotation.x = Math.sin(t * 0.37 + seed * 2) * 0.012;
  });
  return html`
    <group ref=${ref} position=${[x, -4, z]}>
      ${Object.entries(geos).map(([k, g]) => html`<mesh key=${k} geometry=${g} material=${MATERIALS[k]} />`)}
    </group>`;
}

// Spread across the page: x, depth, and stem height from below the bottom edge (visible height is about 6.3)
const LILIES = [
  { seed: 11, x: -4.3, z: 0.5, height: 3.6 },
  { seed: 23, x: -3.0, z: -1.0, height: 4.6 },
  { seed: 37, x: -1.7, z: 0.9, height: 3.0 },
  { seed: 41, x: -0.4, z: -0.6, height: 4.1 },
  { seed: 53, x: 0.9, z: 0.3, height: 4.9 },
  { seed: 67, x: 2.1, z: -1.2, height: 4.4 },
  { seed: 71, x: 3.2, z: 0.8, height: 3.3 },
  { seed: 83, x: 4.3, z: -0.3, height: 4.8 },
];

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
createRoot(document.getElementById('lilies')).render(html`
  <${Canvas} camera=${{ position: [0, 0, 10], fov: 35 }} dpr=${[1, 2]} gl=${{ alpha: true, antialias: true }} frameloop=${still ? 'demand' : 'always'}>
    <ambientLight intensity=${0.7} />
    <directionalLight position=${[3, 5, 4]} intensity=${1.8} />
    <directionalLight position=${[-4, -2, 2]} intensity=${0.4} />
    ${LILIES.map(l => html`<${Lily} key=${l.seed} ...${l} />`)}
  <//>`);
