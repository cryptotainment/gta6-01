// Car physics for Solmar: one model for every car in the city — the player's
// car, traffic, police and the mission cars. Arcade handling: accelerate,
// brake, steer (stronger the faster you go, with a floor so a slow car can
// still turn at an intersection), and a soft collision that trades speed
// instead of dead-stopping both cars. A waypoint autopilot drives staged
// scenes (screenshots) and the occasional scripted car.

import { CAR_TYPES, WORLD_W, WORLD_H, SEA_Y } from './config.js';
import { rngPick } from './random.js';
import { isBlocked, nearestRoadPoint } from './world.js';

let carId = 0;

export function makeCar(rng, type, x, y, angle, color) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const c = {
    id: carId += 1,
    type,
    x, y, angle,
    speed: 0,
    color: color || (rng ? rngPick(rng, spec.colors) : spec.colors[0]),
    length: spec.length,
    width: spec.width,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    brake: spec.brake,
    turn: spec.turn,
    autopilot: null, // { waypoints: [{x,y}], i }
    siren: false,
    airborne: 0,
  };
  return c;
}

// Drive a car with throttle/brake/steer inputs in [-1, 1]. dt is seconds.
export function driveCar(car, throttle, steer, dt) {
  const spec = CAR_TYPES[car.type] || CAR_TYPES.sedan;
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  else if (throttle < 0) car.speed += car.brake * throttle * dt; // brake/reverse
  else {
    // Rolling drag.
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  const maxFwd = car.maxSpeed;
  const maxRev = -90;
  if (car.speed > maxFwd) car.speed = maxFwd;
  if (car.speed < maxRev) car.speed = maxRev;

  // Steering: full lock at speed, a 0.4 floor so a slow car still turns.
  const speedFactor = Math.min(1, Math.abs(car.speed) / 160);
  const turnRate = car.turn * (0.4 + 0.6 * speedFactor) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Keep cars inside the city and out of the sea and buildings.
  if (car.x < 30) { car.x = 30; car.speed *= 0.5; }
  if (car.x > WORLD_W - 30) { car.x = WORLD_W - 30; car.speed *= 0.5; }
  if (car.y < 30) { car.y = 30; car.speed *= 0.5; }
  if (car.y > SEA_Y - 30) { car.y = SEA_Y - 30; car.speed *= 0.5; }
}

// Soft collision between two cars: they trade a little speed instead of one
// of them stopping dead. Called for every close pair each tick.
export function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = (a.length + b.length) / 2 - 6;
      if (dist > 0 && dist < min) {
        // Push apart along the line between them.
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        // Trade speed: the faster one gives a little to the slower one.
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg + (a.speed - avg) * 0.4;
        b.speed = avg + (b.speed - avg) * 0.4;
      }
    }
  }
}

// A car touching a building loses speed and slides along it.
export function collideBuildings(game, car) {
  const half = car.length / 2;
  const corners = [
    { x: car.x + Math.cos(car.angle) * half, y: car.y + Math.sin(car.angle) * half },
    { x: car.x - Math.cos(car.angle) * half, y: car.y - Math.sin(car.angle) * half },
  ];
  for (const p of corners) {
    if (isBlocked(game.world, p.x, p.y, 4)) {
      car.speed *= 0.55;
      // Nudge back out along the car's travel direction.
      car.x -= Math.cos(car.angle) * 6;
      car.y -= Math.sin(car.angle) * 6;
    }
  }
}

// Waypoint autopilot: steer toward the current waypoint, slow for sharp
// turns, advance when within 130 px. Used by staged shots and scripted cars.
export function updateAutopilot(car, dt) {
  const ap = car.autopilot;
  if (!ap || ap.i >= ap.waypoints.length) {
    car.autopilot = null;
    return;
  }
  const wp = ap.waypoints[ap.i];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 130) {
    ap.i += 1;
    return;
  }
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Slow down for a sharp turn so the car makes the corner.
  const throttle = Math.abs(diff) > 0.9 ? 0.45 : 1;
  driveCar(car, throttle, steer, dt);
}

// Speed in km/h for the HUD (1 px/s ≈ 0.36 km/h at this scale).
export function carKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.36);
}
