// SOLMAR — Vice Coast. Traffic cars and pedestrians: cheap state machines on the
// road grid. Traffic follows lanes, brakes for the car ahead and turns at
// intersections; pedestrians walk the sidewalks and run from gunfire and horns.

import { ROADS_X, ROADS_Y, ROAD_W, WORLD, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { createRandom, pick, range } from './random.js';
import { makeCar, paintCar, driveCar, collideCars } from './vehicles.js';
import { isOnRoad, isInWater, collideBuildings, nearestRoad } from './world.js';

function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, ROADS_X), y: range(rng, 300, WORLD.h - 300), vertical: true };
  }
  return { x: range(rng, 300, WORLD.w - 300), y: pick(rng, ROADS_Y), vertical: false };
}

export function spawnTraffic(world, rng) {
  const cars = [];
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport'];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const p = randomRoadPoint(rng);
    const type = pick(rng, types);
    const dir = rng() < 0.5 ? 1 : -1;
    const car = makeCar(type, p.x, p.y, p.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), 'traffic');
    paintCar(car, pick(rng, ['#c94f42', '#4f7ec9', '#c9c9c9', '#5a6b52', '#f2b705', '#8a8f98']));
    car.cruise = range(rng, 130, 210);
    car.vertical = p.vertical;
    car.dir = dir;
    car.lane = (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 30);
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(world, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const p = randomRoadPoint(rng);
    const vertical = p.vertical;
    const side = rng() < 0.5 ? -1 : 1;
    peds.push({
      x: vertical ? p.x + side * (ROAD_W / 2 + 26) : p.x,
      y: vertical ? p.y : p.y + side * (ROAD_W / 2 + 26),
      angle: vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      speed: range(rng, 38, 68),
      vertical,
      flee: 0,
      fleeX: 0,
      fleeY: 0,
      color: pick(rng, ['#e8e0c8', '#7fb069', '#c96f4a', '#6a8caf', '#d9a0b8', '#8a6fbf']),
      bob: rng() * 6.28,
    });
  }
  return peds;
}

// A traffic car ahead of `car` on the same lane, within `range`.
function carAhead(car, cars, rangeDist) {
  let best = null;
  let bestD = rangeDist;
  for (const other of cars) {
    if (other === car || other.owner === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = car.vertical ? dy * car.dir : dx * car.dir;
    const across = car.vertical ? Math.abs(dx) : Math.abs(dy);
    if (along > 0 && along < bestD && across < 34) { bestD = along; best = other; }
  }
  return best;
}

export function updateTraffic(game, dt) {
  const { world, traffic, player } = game;
  for (const car of traffic) {
    if (car.hp <= 0) continue;
    // Lane target: the road centre plus the lane offset.
    const road = nearestRoad(car.x, car.y);
    let targetX = car.x;
    let targetY = car.y;
    if (car.vertical) {
      targetX = road.at + car.lane;
      targetY = car.y + car.dir * car.cruise * dt;
    } else {
      targetX = car.x + car.dir * car.cruise * dt;
      targetY = road.at + car.lane;
    }
    // Brake for the car ahead, and for the player's car blocking the lane.
    const ahead = carAhead(car, traffic, 110);
    const playerCar = player.car;
    let blocked = ahead !== null;
    if (playerCar && playerCar !== car) {
      const dx = playerCar.x - car.x;
      const dy = playerCar.y - car.y;
      const along = car.vertical ? dy * car.dir : dx * car.dir;
      const across = car.vertical ? Math.abs(dx) : Math.abs(dy);
      if (along > 0 && along < 90 && across < 36) blocked = true;
    }
    const speed = blocked ? 0 : car.cruise;
    const dx = targetX - car.x;
    const dy = targetY - car.y;
    const wantAngle = Math.atan2(dy, dx);
    let da = wantAngle - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    car.speed += (speed - car.speed) * Math.min(1, 2.2 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const onX = ROADS_X.some((rx) => Math.abs(car.x - rx) < 14);
    const onY = ROADS_Y.some((ry) => Math.abs(car.y - ry) < 14);
    if (onX && onY && game.rng() < 0.012) {
      car.vertical = !car.vertical;
      car.dir = game.rng() < 0.5 ? 1 : -1;
      car.lane = (game.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 30);
    }
    if (car.x < 140 || car.x > WORLD.w - 40 || car.y < 40 || car.y > WORLD.h - 40) {
      car.dir *= -1;
    }
  }
  // Car-car bumps (traffic vs traffic, police vs police, and the player's car).
  const all = traffic.filter((c) => c.hp > 0);
  all.push(...game.policeCars.filter((c) => c.hp > 0));
  if (player.car) all.push(player.car);
  for (const car of all) car.hitCd = Math.max(0, (car.hitCd || 0) - dt);
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      collideCars(all[i], all[j]);
    }
  }
  // Wrecked traffic cars get towed away and respawn at the edge.
  for (const car of traffic) {
    if (car.hp > 0) continue;
    const p = randomRoadPoint(game.rng);
    car.x = p.x;
    car.y = p.y;
    car.hp = 100;
    car.speed = 0;
    car.vertical = p.vertical;
    car.dir = game.rng() < 0.5 ? 1 : -1;
  }
}

export function updatePeds(game, dt) {
  const { peds } = game;
  for (const ped of peds) {
    ped.bob += dt * 7;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const len = Math.hypot(dx, dy) || 1;
      ped.x += (dx / len) * 150 * dt;
      ped.y += (dy / len) * 150 * dt;
      ped.angle = Math.atan2(dy, dx);
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // Turn at intersections, stay on the sidewalks.
      const onX = ROADS_X.some((rx) => Math.abs(ped.x - rx) < 20);
      const onY = ROADS_Y.some((ry) => Math.abs(ped.y - ry) < 20);
      if ((onX || onY) && game.rng() < 0.02) {
        ped.angle = pick(game.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      if (ped.x < 150 || ped.x > WORLD.w - 40 || ped.y < 40 || ped.y > WORLD.h - 40) {
        ped.angle += Math.PI;
      }
      const fixed = collideBuildings(ped.x, ped.y, 12, game.world);
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
    if (isInWater(ped.x, ped.y)) {
      ped.x = Math.max(160, ped.x);
      ped.y = Math.min(WORLD.h - 60, ped.y);
    }
  }
}

// Every pedestrian within `radius` of (x, y) runs away from it.
export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.flee = 2.2;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

export function driveCarForTraffic(car, dt, world) {
  return driveCar(car, { throttle: 0, steer: 0, brake: false }, dt, world);
}
