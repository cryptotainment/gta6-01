// Wanted level and police: crimes raise the stars, police cars and foot
// officers respond, chase and ram, and arrest on contact when the player is
// slow. Lose the heat by breaking line of sight and distance, or by
// repainting the car at TINT & PAINT. The wanted level is the game's pressure
// valve: it turns a quiet drive into a chase.

import { WANTED, LANDMARKS } from './config.js';
import { makeCar, collideBuildings } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

export function addWanted(game, n) {
  if (n <= 0) return;
  const before = game.wanted;
  game.wanted = Math.min(WANTED.max, game.wanted + n);
  if (game.wanted > before) {
    game.noSightT = 0;
    game.audio.siren();
  }
}

export function setWanted(game, n) {
  game.wanted = Math.max(0, Math.min(WANTED.max, n));
  if (n === 0) game.noSightT = 0;
}

// How many police cars the current wanted level fields.
export function policeTarget(game) {
  return game.wanted === 0 ? 0 : Math.min(game.wanted + 1, 6);
}

// Spawn a police car on a road near the player.
export function spawnPoliceCar(game) {
  const p = game.player;
  const spot = nearestRoadPoint(p.x + (game.rng() < 0.5 ? -1 : 1) * 500, p.y + (game.rng() < 0.5 ? -1 : 1) * 400);
  const car = makeCar(game.rng, 'police', spot.x, spot.y, 0, '#1c1e26');
  car.isPolice = true;
  car.siren = true;
  car.speed = 200;
  game.cars.push(car);
  game.police.push(car);
  return car;
}

export function updatePolice(game, dt) {
  const p = game.player;
  // Field the right number of police cars.
  const target = policeTarget(game);
  // Remove surplus police cars (they drive off).
  while (game.police.length > target) {
    const car = game.police.pop();
    car.isPolice = false;
    car.siren = false;
    car.isTraffic = true;
    car.autopilot = { waypoints: [{ x: 2400, y: 1600 }], i: 0 };
  }
  while (game.police.length < target) {
    spawnPoliceCar(game);
  }

  // Line of sight: a police car sees the player if it is close and no
  // building stands between them.
  let seen = false;
  for (const car of game.police) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 700 && hasLineOfSight(game, car.x, car.y, p.x, p.y)) seen = true;
    // Pursuit: steer at the player, faster than traffic, and ram.
    const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    const throttle = d > 60 ? 1 : 0.4;
    // Drive the police car directly (not via autopilot).
    drivePoliceCar(game, car, throttle, steer, dt);
    collideBuildings(game, car);
    // Ram: touching the player's car slows it and hurts the player a little.
    if (!p.onFoot && p.car) {
      if (Math.hypot(car.x - p.car.x, car.y - p.car.y) < 46) {
        p.car.speed *= 0.82;
        if (p.invuln <= 0) {
          p.health -= 2;
          p.invuln = 0.5;
          game.shake = Math.max(game.shake, 4);
        }
      }
    }
    // Arrest: a police car beside a slow player on foot, held for 2 seconds.
    if (p.onFoot && d < 52 && Math.abs(p.speed) < 30) {
      game.arrestT = (game.arrestT || 0) + dt;
      if (game.arrestT >= WANTED.arrestHoldSeconds) {
        game.arrested = true;
      }
    } else if (p.onFoot) {
      game.arrestT = 0;
    }
    // Arrest a stopped car: police beside it for 2 seconds.
    if (!p.onFoot && p.car && d < 52 && Math.abs(p.car.speed) < 25) {
      game.arrestT = (game.arrestT || 0) + dt;
      if (game.arrestT >= WANTED.arrestHoldSeconds) {
        game.arrested = true;
      }
    }
  }

  // Losing the cops: out of sight and far away for 8 seconds, then the
  // wanted level ticks down one star every 4 seconds.
  if (game.wanted > 0) {
    if (seen) {
      game.noSightT = 0;
    } else {
      game.noSightT = (game.noSightT || 0) + dt;
      if (game.noSightT >= WANTED.loseSightSeconds) {
        game.decayT = (game.decayT || 0) + dt;
        if (game.decayT >= WANTED.decaySeconds) {
          game.decayT = 0;
          game.wanted -= 1;
          game.setBanner('Heat dropping', `Wanted level ${game.wanted}.`, 1.5);
        }
      }
    }
  }
}

// Drive a police car with throttle/steer, reusing the car physics.
function drivePoliceCar(game, car, throttle, steer, dt) {
  // Inline the same physics as driveCar, but the police car is a little
  // grippier so it can keep up in a chase.
  const maxFwd = car.maxSpeed;
  if (throttle > 0) car.speed += car.accel * 1.15 * throttle * dt;
  else if (throttle < 0) car.speed += car.brake * throttle * dt;
  else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  if (car.speed > maxFwd) car.speed = maxFwd;
  if (car.speed < -90) car.speed = -90;
  const speedFactor = Math.min(1, Math.abs(car.speed) / 160);
  const turnRate = car.turn * (0.4 + 0.6 * speedFactor) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (car.x < 30) { car.x = 30; car.speed *= 0.5; }
  if (car.x > 4770) { car.x = 4770; car.speed *= 0.5; }
  if (car.y < 30) { car.y = 30; car.speed *= 0.5; }
  if (car.y > 3270) { car.y = 3270; car.speed *= 0.5; }
}

// Line of sight between two points: false if a building blocks the segment.
export function hasLineOfSight(game, x0, y0, x1, y1) {
  const steps = 24;
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    for (const b of game.world.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    }
  }
  return true;
}

// Police return fire at wanted 2+ when close to an on-foot player.
export function policeFire(game, dt) {
  if (game.wanted < 2) return;
  const p = game.player;
  if (!p.onFoot) return;
  game.fireCd = (game.fireCd || 0) - dt;
  if (game.fireCd > 0) return;
  for (const car of game.police) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 380 && hasLineOfSight(game, car.x, car.y, p.x, p.y)) {
      game.fireCd = 0.9;
      const spread = (game.rng() - 0.5) * 0.35;
      const angle = Math.atan2(p.y - car.y, p.x - car.x) + spread;
      game.bullets.push({
        x: car.x, y: car.y, angle, speed: 820, life: 0.7, from: 'police',
      });
      game.audio.shot();
      break;
    }
  }
}

// Is the player's car inside the TINT & PAINT garage zone?
export function inGarageZone(game) {
  const p = game.player;
  if (p.onFoot || !p.car) return false;
  return Math.hypot(p.car.x - LANDMARKS.garage.x, p.car.y - LANDMARKS.garage.y) < 110;
}
