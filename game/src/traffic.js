// Traffic and pedestrians: the city alive around the player. Traffic cars
// follow the road grid (drive along an avenue or street, turn at
// intersections, slow for the car ahead). Pedestrians walk the pavements and
// run from gunfire and car horns. Both are cheap state machines driven by the
// seeded RNG, so the same seed replays the same rush hour.

import { AVENUES, STREETS, ROAD_W } from './config.js';
import { rngRange, rngInt, rngPick } from './random.js';
import { isRoad, nearestRoadPoint } from './world.js';
import { makeCar, driveCar, updateAutopilot } from './vehicles.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sport'];

export function spawnTraffic(game, count) {
  for (let i = 0; i < count; i += 1) {
    const onAvenue = game.rng() < 0.5;
    let x;
    let y;
    let angle;
    if (onAvenue) {
      x = rngPick(game.rng, AVENUES);
      y = rngRange(game.rng, 200, 3100);
      angle = game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = rngRange(game.rng, 200, 4600);
      y = rngPick(game.rng, STREETS);
      angle = game.rng() < 0.5 ? 0 : Math.PI;
    }
    const car = makeCar(game.rng, rngPick(game.rng, TRAFFIC_TYPES), x, y, angle);
    car.speed = rngRange(game.rng, 90, 190);
    car.autopilot = { waypoints: [randomRoadPoint(game)], i: 0 };
    car.isTraffic = true;
    game.cars.push(car);
  }
}

export function spawnParked(game, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(game);
    const car = makeCar(game.rng, rngPick(game.rng, ['sedan', 'sedan', 'sport', 'taxi']), p.x, p.y, p.angle);
    car.isParked = true;
    game.cars.push(car);
  }
}

function randomRoadPoint(game) {
  const onAvenue = game.rng() < 0.5;
  if (onAvenue) {
    return { x: rngPick(game.rng, AVENUES), y: rngRange(game.rng, 200, 3100), angle: game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  return { x: rngRange(game.rng, 200, 4600), y: rngPick(game.rng, STREETS), angle: game.rng() < 0.5 ? 0 : Math.PI };
}

// Traffic AI: follow the autopilot waypoints along the roads. At each
// waypoint pick a new one a few blocks away, so cars keep circulating.
export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (!car.isTraffic) continue;
    if (!car.autopilot || car.autopilot.i >= car.autopilot.waypoints.length) {
      car.autopilot = { waypoints: [randomRoadPoint(game)], i: 0 };
    }
    // Slow for the car ahead on the same road.
    let ahead = null;
    for (const other of game.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 110 && side < 40) {
        if (!ahead || along < ahead) ahead = along;
      }
    }
    if (ahead !== null) {
      // Ease off instead of rear-ending.
      car.speed = Math.max(0, car.speed - 260 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    } else {
      updateAutopilot(car, dt);
      // Traffic cruises below its top speed.
      if (car.speed > 200) car.speed = 200;
    }
  }
}

export function spawnPeds(game, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(game);
    // Step off the road onto the pavement.
    const px = p.x + (game.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14);
    const py = p.y + (game.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14);
    game.peds.push({
      x: px, y: py,
      angle: rngRange(game.rng, 0, Math.PI * 2),
      speed: rngRange(game.rng, 28, 52),
      state: 'walk',
      fleeT: 0,
      color: rngPick(game.rng, ['#e8b04b', '#4b8fe8', '#e84b7a', '#7ae84b', '#c9c9c9']),
      taxi: game.rng() < 0.18,
    });
  }
}

// Pedestrians walk the pavements, turn at random, and flee from gunfire or a
// car bearing down on them. A fleeing ped runs away from the threat.
export function updatePeds(game, dt) {
  for (const ped of game.peds) {
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
    }
    // Flee from a recent gunshot or a fast car close by.
    if (game.lastShotT > 0 && Math.hypot(ped.x - game.lastShotX, ped.y - game.lastShotY) < 320) {
      ped.state = 'flee';
      ped.fleeT = 2.5;
      ped.angle = Math.atan2(ped.y - game.lastShotY, ped.x - game.lastShotX);
    }
    const speed = ped.state === 'flee' ? 150 : ped.speed;
    let nx = ped.x + Math.cos(ped.angle) * speed * dt;
    let ny = ped.y + Math.sin(ped.angle) * speed * dt;
    // Stay out of buildings and the sea; turn instead of walking into them.
    if (!isRoad(nx, ny) && game.world && isBlockedAt(game, nx, ny)) {
      ped.angle += Math.PI / 2 + game.rng() * 0.6;
      nx = ped.x;
      ny = ped.y;
    }
    // Random gentle turns so they wander instead of marching straight.
    if (game.rng() < 0.008) ped.angle += (game.rng() - 0.5) * 1.6;
    ped.x = nx;
    ped.y = ny;
    // Keep them inside the city.
    if (ped.x < 40) ped.x = 40;
    if (ped.x > 4760) ped.x = 4760;
    if (ped.y < 40) ped.y = 40;
    if (ped.y > 3260) ped.y = 3260;
  }
}

function isBlockedAt(game, x, y) {
  for (const b of game.world.buildings) {
    if (x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8) return true;
  }
  return y >= 3300;
}

// Add a few police cars on foot patrol near the player (used by the police
// module when the wanted level rises). They are just peds with a uniform.
export function spawnFootPolice(game, x, y) {
  game.peds.push({
    x, y, angle: 0, speed: 60, state: 'walk', fleeT: 0,
    color: '#1c1e26', police: true, taxi: false,
  });
}
