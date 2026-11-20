// SOLMAR — Vice Coast. The city itself: a road grid, five districts by colour,
// buildings, palms, lamps, parked cars, shops, garages, ramps and the 20 hidden
// sun coins. Everything is placed from one seeded stream, so the same seed
// always builds the same city.

import { WORLD, ROAD_W, ROADS_X, ROADS_Y, SEA_WEST, SEA_SOUTH, DISTRICTS, LANDMARKS, COIN_COUNT } from './config.js';
import { createRandom, pick, range } from './random.js';

// The district whose ground colour paints a point; suburb is the fallback.
export function districtAt(x, y) {
  for (let i = 0; i < DISTRICTS.length - 1; i += 1) {
    const d = DISTRICTS[i];
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function isInWater(x, y) {
  return x < SEA_WEST || y > SEA_SOUTH;
}

// Is the point on a road (asphalt, not sidewalk)?
export function isOnRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// The nearest road centre line, for traffic lanes and sidewalk walking.
export function nearestRoad(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { axis: 'x', at: rx, d }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { axis: 'y', at: ry, d }; }
  }
  return best;
}

// Circle (x, y, r) against a building rectangle: true when they overlap.
export function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

// Push a circle out of every building it overlaps; returns true on any hit.
export function collideBuildings(x, y, r, world) {
  let hit = false;
  for (const b of world.buildings) {
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
    if (!circleHitsRect(x, y, r, b)) continue;
    hit = true;
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    let dx = x - cx;
    let dy = y - cy;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) { dx = x < b.x + b.w / 2 ? -1 : 1; dy = 0; }
    else { dx /= len; dy /= len; }
    const push = r - len + 0.5;
    x += dx * push;
    y += dy * push;
  }
  return { x, y, hit };
}

function buildBlocks(rng) {
  const buildings = [];
  const xs = [SEA_WEST + 40, ...ROADS_X, WORLD.w];
  const ys = [40, ...ROADS_Y, WORLD.h - 160];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + ROAD_W / 2 + 24;
      const x1 = xs[bx + 1] - ROAD_W / 2 - 24;
      const y0 = ys[by] + ROAD_W / 2 + 24;
      const y1 = ys[by + 1] - ROAD_W / 2 - 24;
      if (x1 - x0 < 130 || y1 - y0 < 130) continue;
      // One block in five is a plaza: open ground, no buildings.
      if (rng() < 0.18) continue;
      const count = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i += 1) {
        const w = Math.min(range(rng, 110, 240), x1 - x0 - 12);
        const h = Math.min(range(rng, 90, 210), y1 - y0 - 12);
        const cx = range(rng, x0 + w / 2, Math.max(x0 + w / 2 + 1, x1 - w / 2));
        const cy = range(rng, y0 + h / 2, Math.max(y0 + h / 2 + 1, y1 - h / 2));
        const b = { x: cx - w / 2, y: cy - h / 2, w, h, district: districtAt(cx, cy) };
        let overlaps = false;
        for (const o of buildings) {
          if (b.x < o.x + o.w + 26 && b.x + b.w + 26 > o.x && b.y < o.y + o.h + 26 && b.y + b.h + 26 > o.y) { overlaps = true; break; }
        }
        if (overlaps) continue;
        b.color = pick(rng, b.district.building);
        b.roof = rng() < 0.3 ? 'pool' : (rng() < 0.4 ? 'garden' : 'plain');
        buildings.push(b);
      }
    }
  }
  return buildings;
}

function buildProps(rng, buildings) {
  const props = [];
  // Palm trees down the beach road and the marina front.
  for (let y = 200; y < WORLD.h - 200; y += 170) {
    props.push({ kind: 'palm', x: 240 + range(rng, -14, 14), y });
  }
  for (let x = 400; x < WORLD.w - 200; x += 260) {
    if (rng() < 0.7) props.push({ kind: 'palm', x, y: 3300 + range(rng, -12, 12) });
  }
  // Street lamps along every road, both sides, skipping intersections.
  for (const rx of ROADS_X) {
    for (let y = 200; y < WORLD.h; y += 260) {
      if (ROADS_Y.some((ry) => Math.abs(y - ry) < 120)) continue;
      props.push({ kind: 'lamp', x: rx + ROAD_W / 2 + 14, y });
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = 200; x < WORLD.w; x += 260) {
      if (ROADS_X.some((rx) => Math.abs(x - rx) < 120)) continue;
      props.push({ kind: 'lamp', x, y: ry + ROAD_W / 2 + 14 });
    }
  }
  // Benches and hydrants, tucked into blocks but never inside a building.
  for (let i = 0; i < 60; i += 1) {
    const x = range(rng, 200, WORLD.w - 200);
    const y = range(rng, 200, WORLD.h - 300);
    if (isOnRoad(x, y) || isInWater(x, y)) continue;
    if (buildings.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) continue;
    props.push({ kind: rng() < 0.5 ? 'bench' : 'hydrant', x, y });
  }
  // Marina docks: wooden piers reaching into the water, with boats moored off.
  for (const dx of [400, 800, 1200, 2000, 2800]) {
    props.push({ kind: 'dock', x: dx, y: 3440 });
    if (rng() < 0.8) props.push({ kind: 'boat', x: dx + 70, y: 3500 + range(rng, -20, 20), angle: range(rng, -0.4, 0.4) });
  }
  return props;
}

function buildCoins(rng, buildings) {
  const coins = [];
  let guard = 0;
  while (coins.length < COIN_COUNT && guard < 400) {
    guard += 1;
    const rx = pick(rng, ROADS_X);
    const ry = pick(rng, ROADS_Y);
    const x = rx + range(rng, -260, 260);
    const y = ry + range(rng, -260, 260);
    if (isInWater(x, y) || isOnRoad(x, y)) continue;
    if (buildings.some((b) => x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30)) continue;
    if (coins.some((c) => Math.hypot(c.x - x, c.y - y) < 260)) continue;
    coins.push({ id: coins.length, x, y, taken: false });
  }
  return coins;
}

function buildParked(rng, buildings) {
  const parked = [];
  const types = ['sedan', 'sedan', 'sport', 'taxi', 'van'];
  let guard = 0;
  while (parked.length < 14 && guard < 300) {
    guard += 1;
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? ROADS_X : ROADS_Y);
    const along = range(rng, 300, vertical ? WORLD.h - 300 : WORLD.w - 300);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? road + side * (ROAD_W / 2 - 22) : along;
    const y = vertical ? along : road + side * (ROAD_W / 2 - 22);
    if (isInWater(x, y)) continue;
    if (buildings.some((b) => x > b.x - 40 && x < b.x + b.w + 40 && y > b.y - 40 && y < b.y + b.h + 40)) continue;
    if (parked.some((p) => Math.hypot(p.x - x, p.y - y) < 180)) continue;
    parked.push({ type: pick(rng, types), x, y, angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI) });
  }
  return parked;
}

export function createWorld(seed) {
  const rng = createRandom(seed);
  const buildings = buildBlocks(rng);
  const props = buildProps(rng, buildings);
  const coins = buildCoins(rng, buildings);
  const parked = buildParked(rng, buildings);
  return {
    seed,
    buildings,
    props,
    coins,
    parked,
    shops: [
      { kind: 'guns', x: LANDMARKS.gunShop.x, y: LANDMARKS.gunShop.y, r: 80, label: 'Ironworks Guns' },
      { kind: 'clinic', x: LANDMARKS.clinic.x, y: LANDMARKS.clinic.y, r: 80, label: 'St. Mara Clinic' },
      { kind: 'carshop', x: LANDMARKS.carShop.x, y: LANDMARKS.carShop.y, r: 90, label: 'Vice Motors' },
    ],
    garage: { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, r: 95, label: 'TINT & PAINT' },
    ramps: [
      { x: LANDMARKS.rampBeach.x, y: LANDMARKS.rampBeach.y, angle: 0 },
      { x: LANDMARKS.rampDowntown.x, y: LANDMARKS.rampDowntown.y, angle: Math.PI / 2 },
    ],
    taxiStand: { x: LANDMARKS.taxiStand.x, y: LANDMARKS.taxiStand.y },
    policeStation: { x: LANDMARKS.policeStation.x, y: LANDMARKS.policeStation.y },
  };
}
