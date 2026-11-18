// Seeded random numbers (mulberry32). Same seed gives the same data on any machine.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let u = 0;
    while (u === 0) u = next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const lognormal = (median, sigma) => median * Math.exp(sigma * normal());
  const poisson = (lam) => {
    if (lam <= 0) return 0;
    if (lam < 30) {
      const L = Math.exp(-lam);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > L);
      return k - 1;
    }
    return Math.max(0, Math.round(lam + Math.sqrt(lam) * normal()));
  };
  const uniform = (lo, hi) => lo + (hi - lo) * next();
  return { next, normal, lognormal, poisson, uniform };
}
