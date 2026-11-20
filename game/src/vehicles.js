// SOLMAR — Vice Coast. Cars: one class for every vehicle in the city, with arcade
// driving physics — acceleration, steering that bites with speed, handbrake drift,
// building and car collisions, damage and smoke.

import { CAR_TYPES, WORLD } from './config.js';
import { collideBuildings, isInWater } from './world.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, owner) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId,
    type,
    owner, // 'player' | 'traffic' | 'parked' | 'police'
    x, y, angle,
    speed: 0,
    color: spec.colors[0], // caller repaints from the seeded stream
    len: spec.len,
    wid: spec.wid,
    hp: 100,
    airborne: 0,
    skid: 0,
    hitCd: 0, // seconds until the next collision can damage this car
  };
}

// Colour the car from a seeded pick: the caller sets `color` after making it.
export function paintCar(car, color) {
  car.color = color;
}

// One physics step for a driven car. input: {throttle (-1..1), steer (-1..1), brake}
// Returns true when the car hit a building or the water's edge.
export function driveCar(car, input, dt, world) {
  const spec = CAR_TYPES[car.type];
  const prevX = car.x;
  const prevY = car.y;
  if (input.brake) {
    car.speed *= Math.max(0, 1 - 3.2 * dt);
    car.skid = Math.min(1, car.skid + dt * 3);
  } else {
    car.skid = Math.max(0, car.skid - dt * 2);
  }
  car.speed += input.throttle * spec.accel * dt;
  // Rolling drag, and a hard cap on reverse.
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > spec.max) car.speed = spec.max;
  if (car.speed < -170) car.speed = -170;
  if (Math.abs(car.speed) < 4 && input.throttle === 0) car.speed = 0;
  const steerAmount = input.steer * spec.steer * Math.min(1, 0.4 + Math.abs(car.speed) / 240) * (car.speed >= 0 ? 1 : -1);
  car.angle += steerAmount * dt * (input.brake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // World bounds: the sea stops the car.
  let hit = false;
  if (car.x < 150) { car.x = 150; car.speed *= -0.3; hit = true; }
  if (car.x > WORLD.w - 30) { car.x = WORLD.w - 30; car.speed *= -0.3; hit = true; }
  if (car.y < 30) { car.y = 30; car.speed *= -0.3; hit = true; }
  if (car.y > WORLD.h - 30) { car.y = WORLD.h - 30; car.speed *= -0.3; hit = true; }
  if (isInWater(car.x, car.y)) {
    car.x = prevX;
    car.y = prevY;
    car.speed *= -0.25;
    hit = true;
  }
  const fixed = collideBuildings(car.x, car.y, car.len / 2 - 4, world);
  car.x = fixed.x;
  car.y = fixed.y;
  if (fixed.hit) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.45;
    if (impact > 220) car.hp -= (impact - 220) / 22;
    hit = true;
  }
  return hit;
}

// Waypoint autopilot: drives the player's car toward the next waypoint on
// game.autopilot {waypoints: [{x, y}], i}, holding a chase speed the police
// can keep up with. Used by the live loop and by the screenshot staging alike.
// When the last waypoint is reached the autopilot lets go.
export function autopilotDrive(game) {
  const ap = game.autopilot;
  if (!ap || !game.player.car) return;
  const car = game.player.car;
  const keys = game.input.keys;
  const target = ap.waypoints[ap.i];
  if (!target) { game.autopilot = null; return; }
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 130) {
    ap.i += 1;
    if (ap.i >= ap.waypoints.length) { game.autopilot = null; return; }
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  let da = wantAngle - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  keys.delete('KeyA');
  keys.delete('KeyD');
  if (da > 0.12) keys.add('KeyD');
  else if (da < -0.12) keys.add('KeyA');
  // Slow for a sharp turn or a close waypoint, so the car makes the corner
  // instead of blowing past it and circling back.
  if (Math.abs(da) > 0.7 || (dist < 220 && car.speed > 220)) keys.delete('KeyW');
  else if (car.speed > 400) keys.delete('KeyW');
  else keys.add('KeyW');
  keys.delete('KeyS');
}
// Circle collision between two cars: push them apart and trade a little speed.
// Damage is rate-limited (hitCd), so cars resting against each other do not
// grind each other down in a single second.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = (a.len + b.len) / 2 - 12;
  if (dist >= min || dist < 0.01) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const push = (min - dist) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  // A soft speed exchange: the faster car keeps most of its speed and shoves
  // the other one along, so a car never dead-stops against a stationary one.
  const aSpeed = a.speed;
  const bSpeed = b.speed;
  a.speed = aSpeed * 0.7 + bSpeed * 0.3;
  b.speed = bSpeed * 0.7 + aSpeed * 0.3;
  if (a.hitCd <= 0 && b.hitCd <= 0) {
    a.hp -= 2;
    b.hp -= 2;
    a.hitCd = 0.5;
    b.hitCd = 0.5;
  }
  return true;
}
