// The city of Solmar: a seeded road grid, district-coloured blocks, buildings,
// trees, lamps, the south coast (sea, sand, marina docks and boats), and the
// helpers the rest of the game uses to ask "is this a road?", "is this blocked?"
// and "which district am I in?". Everything here is pure data built once per seed.

import { WORLD_W, WORLD_H, SEA_Y, ROAD_W, AVENUES, STREETS, DISTRICTS, COLORS, RAMPS } from './config.js';
import { mulberry32, rngRange, rngInt, rngPick } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[0];
}

export function isRoad(x, y) {
  if (y >= SEA_Y) return false;
  for (const ax of AVENUES) {
    if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  }
  for (const sy of STREETS) {
    if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  }
  return false;
}

export function inSea(x, y) {
  return y >= SEA_Y;
}

// A point is blocked if it is inside a building (with a small margin) or in
// the sea. Roads, pavements, sand and docks are walkable/drivable.
export function isBlocked(world, x, y, margin = 0) {
  if (inSea(x, y)) return true;
  for (const b of world.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return true;
  }
  return false;
}

// Snap a point to the nearest road centre line (used for car spawns).
export function nearestRoadPoint(x, y) {
  let bestAx = AVENUES[0];
  for (const ax of AVENUES) {
    if (Math.abs(ax - x) < Math.abs(bestAx - x)) bestAx = ax;
  }
  let bestSy = STREETS[0];
  for (const sy of STREETS) {
    if (Math.abs(sy - y) < Math.abs(bestSy - y)) bestSy = sy;
  }
  // Prefer the closer axis.
  if (Math.abs(bestAx - x) <= Math.abs(bestSy - y)) return { x: bestAx, y };
  return { x, y: bestSy };
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const props = [];

  // Buildings fill the blocks between roads. Each block gets one or two
  // boxes, inset from the road edge, coloured by its district.
  const xs = [0, ...AVENUES, WORLD_W];
  const ys = [0, ...STREETS, SEA_Y];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + ROAD_W / 2 + 14;
      const x1 = xs[i + 1] - ROAD_W / 2 - 14;
      const y0 = ys[j] + ROAD_W / 2 + 14;
      const y1 = ys[j + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 70) continue;
      // The coast strip (last row before the sea) stays open: beach, no blocks.
      if (ys[j + 1] >= SEA_Y && j === ys.length - 2) continue;
      const district = districtAt(x0 + w / 2, y0 + h / 2);
      const count = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const bw = count === 1 ? w * rngRange(rng, 0.55, 0.85) : w * rngRange(rng, 0.35, 0.48);
        const bh = count === 1 ? h * rngRange(rng, 0.5, 0.8) : h * rngRange(rng, 0.4, 0.6);
        const bx = count === 1 ? x0 + (w - bw) / 2 : x0 + (k * (w / 2)) + (w / 2 - bw) / 2;
        const by = count === 1 ? y0 + (h - bh) / 2 : y0 + (h - bh) / 2;
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: district.building, roof: district.roof,
          height: rngInt(rng, 6, 26),
        });
      }
      // A tree or two per block, on the pavement edge.
      const trees = rngInt(rng, 0, 2);
      for (let t = 0; t < trees; t += 1) {
        props.push({
          kind: 'tree',
          x: rngRange(rng, x0, x1), y: rngRange(rng, y0, y1),
          r: rngRange(rng, 9, 15),
        });
      }
    }
  }

  // Lamps along the avenues, every other block.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (((ax + sy) / 450) % 2 === 0) {
        props.push({ kind: 'lamp', x: ax + ROAD_W / 2 + 8, y: sy + ROAD_W / 2 + 8, r: 4 });
      }
    }
  }

  // Marina: three wooden piers reaching into the sea, with boats moored.
  const docks = [];
  const boats = [];
  for (let i = 0; i < 3; i += 1) {
    const dx = 500 + i * 320;
    docks.push({ x: dx, y: SEA_Y, w: 26, h: 210 });
    boats.push({ x: dx + 60, y: SEA_Y + rngRange(rng, 60, 150), angle: Math.PI / 2 + rngRange(rng, -0.15, 0.15), len: 64 });
    boats.push({ x: dx - 60, y: SEA_Y + rngRange(rng, 90, 180), angle: Math.PI / 2 + rngRange(rng, -0.15, 0.15), len: 52 });
  }

  // Sun coins: 20 hidden spots on roads and pavements, never inside a building.
  const coins = [];
  let guard = 0;
  while (coins.length < 20 && guard < 400) {
    guard += 1;
    const x = rngRange(rng, 200, WORLD_W - 200);
    const y = rngRange(rng, 200, SEA_Y - 200);
    if (isBlocked({ buildings }, x, y, 26)) continue;
    if (coins.some((c) => Math.hypot(c.x - x, c.y - y) < 260)) continue;
    coins.push({ x, y, taken: false });
  }

  // Ramps for stunt jumps (from config).
  const ramps = RAMPS.map((r) => ({ ...r }));

  return {
    seed,
    buildings,
    props,
    docks,
    boats,
    coins,
    ramps,
    avenues: AVENUES,
    streets: STREETS,
  };
}

// A point on a road lane, offset to the right-hand side for its direction.
// Cars drive on the right: eastbound uses y + 22, westbound y - 22, and so on.
export function lanePoint(x, y, angle) {
  const off = 22;
  return { x: x + Math.cos(angle + Math.PI / 2) * off, y: y + Math.sin(angle + Math.PI / 2) * off };
}
