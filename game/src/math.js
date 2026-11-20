export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const headingTo = (a, b) => Math.atan2(b.x - a.x, a.z - b.z);
export const forward = a => ({ x: Math.sin(a), z: -Math.cos(a) });
export function seeded(seed = 29431) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function segmentBox(a, b, box, pad = 0) {
  let low = 0, high = 1;
  for (const key of ['x', 'z']) {
    const v = b[key] - a[key];
    const min = box[key] - box[key === 'x' ? 'w' : 'd'] / 2 - pad;
    const max = box[key] + box[key === 'x' ? 'w' : 'd'] / 2 + pad;
    if (Math.abs(v) < .00001) { if (a[key] < min || a[key] > max) return false; }
    else {
      let t1 = (min - a[key]) / v, t2 = (max - a[key]) / v;
      if (t1 > t2) [t1, t2] = [t2, t1];
      low = Math.max(low, t1); high = Math.min(high, t2);
      if (low > high) return false;
    }
  }
  return true;
}
export const ROADS_X = [-300, -200, -100, 0, 100, 200, 300];
export const ROADS_Z = [-300, -180, -60, 60, 180, 300];
export function nearest(value, array) { return array.reduce((a, b) => Math.abs(a - value) < Math.abs(b - value) ? a : b); }
export function roadAnchor(p) {
  const x = nearest(p.x, ROADS_X), z = nearest(p.z, ROADS_Z);
  return Math.abs(x - p.x) < Math.abs(z - p.z) ? { x, z: clamp(p.z, -300, 300) } : { x: clamp(p.x, -300, 300), z };
}
export function roadRoute(start, end) {
  const a = roadAnchor(start), b = roadAnchor(end);
  const ax = nearest(a.x, ROADS_X), az = nearest(a.z, ROADS_Z);
  const bx = nearest(b.x, ROADS_X), bz = nearest(b.z, ROADS_Z);
  if ((a.x === b.x && ROADS_X.includes(a.x)) || (a.z === b.z && ROADS_Z.includes(a.z))) return [a, b, { ...end }];
  const options = [];
  for (const sx of a.x === ax ? [ax] : ROADS_X.filter(x => Math.abs(x - a.x) <= 101)) {
    for (const sz of a.z === az ? [az] : ROADS_Z.filter(z => Math.abs(z - a.z) <= 121)) {
      const first = { x: sx, z: sz };
      for (const ex of b.x === bx ? [bx] : ROADS_X.filter(x => Math.abs(x - b.x) <= 101)) {
        for (const ez of b.z === bz ? [bz] : ROADS_Z.filter(z => Math.abs(z - b.z) <= 121)) {
          const last = { x: ex, z: ez };
          const path = [a, first, { x: ex, z: sz }, last, b, { ...end }];
          const length = path.reduce((n, p, i) => n + (i ? dist(p, path[i - 1]) : dist(start, p)), 0);
          options.push({ path, length });
        }
      }
    }
  }
  return options.sort((a, b) => a.length - b.length)[0].path.filter((p, i, all) => !i || dist(p, all[i - 1]) > 1);
}
export function district(p) {
  if (p.z > 213) return 'LOW WATER PORT';
  if (p.x > 235) return 'FERRY STRAND';
  if (p.x < -150) return 'OLD QUARTER';
  if (p.z < -190) return 'NORTH HEIGHTS';
  return 'CIVIC MILE';
}
export function street(p) {
  const a = roadAnchor(p);
  return ROADS_X.includes(a.x) ? ['Clay Street', 'Foundry Road', 'Calder Avenue', 'Civic Mile', 'Lantern Street', 'Dock Road', 'Ferry Boulevard'][ROADS_X.indexOf(a.x)] : ['North Loop', 'Radio Avenue', 'Market Cross', 'Canal Avenue', 'Salt Road', 'Low Water Quay'][ROADS_Z.indexOf(a.z)] || 'Coast Promenade';
}
