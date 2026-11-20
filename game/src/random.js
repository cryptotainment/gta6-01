// Seeded RNG for Solmar. Every random choice in the world, traffic and
// missions goes through one of these, so the same seed replays the same city.
// mulberry32 is small, fast and deterministic across engines — the whole game
// is reproducible from a single integer.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Float in [a, b).
export function rngRange(rng, a, b) {
  return a + rng() * (b - a);
}

// Integer in [a, b] inclusive.
export function rngInt(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}

// One element of arr, uniformly.
export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// A stable 50/50.
export function rngBool(rng) {
  return rng() < 0.5;
}
