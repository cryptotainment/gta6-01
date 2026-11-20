// Riko Vale on foot: walk and run, aim with the mouse, punch or shoot,
// get in and out of cars (E to enter or steal), pick up sun coins and mission
// packages, and use the shops. Everything here reads the game object and the
// input state, and writes back to the player.

import { PLAYER, LANDMARKS, COIN_VALUE } from './config.js';
import { isBlocked } from './world.js';
import { driveCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    cash: 0,
    weapon: null, // 'pistol' once bought
    ammo: 0,
    armor: 0,
    missionsDone: 0,
    coins: 0,
    speed: 0,
    punchCd: 0,
    shootCd: 0,
    invuln: 0,
  };
}

// The nearest car within reach of the player (for E to enter/steal).
export function nearestCar(game, maxDist = 70) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car === game.player.car) continue;
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

// Get in a car. A parked or traffic car is a steal (wanted +1); the player's
// own car and the mission car are free. Returns true if it worked.
export function enterCar(game, car) {
  const p = game.player;
  if (!car || !p.onFoot) return false;
  const stolen = !car.owned && !car.missionCar;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  car.isParked = false;
  car.isTraffic = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (stolen) {
    game.addWanted(1);
    game.setBanner('Car stolen!', 'The cops are on to you.', 2.5);
  }
  return true;
}

export function exitCar(game) {
  const p = game.player;
  if (p.onFoot || !p.car) return false;
  const car = p.car;
  car.driver = null;
  // Step out beside the car, on the pavement side.
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 30, y: car.y + Math.sin(car.angle + Math.PI / 2) * 30 };
  p.x = side.x;
  p.y = side.y;
  p.angle = car.angle;
  p.onFoot = true;
  p.car = null;
  return true;
}

// Fire the pistol (or punch if unarmed). Creates a bullet the render draws
// and the police module resolves; returns true if a shot went off.
export function shoot(game) {
  const p = game.player;
  if (!p.onFoot || p.shootCd > 0) return false;
  if (p.weapon === 'pistol') {
    if (p.ammo <= 0) {
      game.setBanner('Out of ammo', 'Buy more at the Gun Shop.', 2);
      p.shootCd = 0.35;
      return false;
    }
    p.ammo -= 1;
    p.shootCd = 0.28;
    game.bullets.push({
      x: p.x + Math.cos(p.angle) * 20,
      y: p.y + Math.sin(p.angle) * 20,
      angle: p.angle, speed: 900, life: 0.6, from: 'player',
    });
    game.lastShotX = p.x;
    game.lastShotY = p.y;
    game.lastShotT = 1.2;
    game.audio.shot();
    game.shake = Math.max(game.shake, 3);
    game.addWanted(1);
    return true;
  }
  // Fists: a short punch that hurts the nearest ped or police car bumper.
  p.shootCd = 0.4;
  p.punchCd = 0.25;
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < PLAYER.punchRange + 12) {
      ped.state = 'flee';
      ped.fleeT = 3;
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
    }
  }
  return true;
}

// The nearest interactable: a shop, a mission package, a taxi ped, a coin
// is picked up by walking over it instead.
export function nearestInteractable(game) {
  const p = game.player;
  if (!p.onFoot) return null;
  const spots = [
    { kind: 'garage', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, name: LANDMARKS.garage.name },
    { kind: 'gunShop', x: LANDMARKS.gunShop.x, y: LANDMARKS.gunShop.y, name: LANDMARKS.gunShop.name },
    { kind: 'clinic', x: LANDMARKS.clinic.x, y: LANDMARKS.clinic.y, name: LANDMARKS.clinic.name },
  ];
  for (const s of spots) {
    if (Math.hypot(s.x - p.x, s.y - p.y) < 90) return s;
  }
  // Mission packages.
  if (game.missions.active && game.missions.active.type === 'collect') {
    for (const pk of game.missions.active.pointsLeft) {
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 60) return { kind: 'package', x: pk.x, y: pk.y, name: 'Package' };
    }
  }
  // A taxi ped waiting for a fare.
  for (const ped of game.peds) {
    if (ped.taxi && Math.hypot(ped.x - p.x, ped.y - p.y) < 70) {
      return { kind: 'taxi', x: ped.x, y: ped.y, name: 'Taxi fare', ped };
    }
  }
  return null;
}

// Use the nearest interactable (E). Driving: E gets out of the car.
export function interact(game) {
  const p = game.player;
  if (!p.onFoot) {
    exitCar(game);
    return 'exit';
  }
  const it = nearestInteractable(game);
  if (!it) {
    // No shop nearby: try to get in a car instead.
    const car = nearestCar(game);
    if (car) enterCar(game, car);
    return null;
  }
  if (it.kind === 'garage') {
    if (game.wanted > 0) {
      const cost = Math.min(PLAYER.repaintPrice, p.cash);
      p.cash -= cost;
      game.setWanted(0);
      game.setBanner('TINT & PAINT', `Fresh paint, clean slate. -$${cost}`, 2.5);
      game.audio.pickup();
      return 'repainted';
    }
    if (!p.ownedCar && p.cash >= PLAYER.ownedCarPrice) {
      p.cash -= PLAYER.ownedCarPrice;
      p.ownedCar = true;
      const spot = { x: LANDMARKS.garage.x + 60, y: LANDMARKS.garage.y + 40 };
      const car = game.spawnCar('sport', spot.x, spot.y, 0, '#f2c94c');
      car.owned = true;
      game.setBanner('Your car is ready', 'A sports car, parked at the garage.', 3);
      game.audio.pickup();
      return 'bought-car';
    }
    game.setBanner('TINT & PAINT', game.wanted > 0 ? 'Repaint clears your wanted level.' : 'No heat on you. A sports car costs $500.', 2.5);
    return 'garage';
  }
  if (it.kind === 'gunShop') {
    if (!p.weapon && p.cash >= PLAYER.pistolPrice) {
      p.cash -= PLAYER.pistolPrice;
      p.weapon = 'pistol';
      p.ammo = PLAYER.ammoPack;
      game.setBanner('Pistol bought', `${PLAYER.ammoPack} rounds included.`, 2.5);
      game.audio.pickup();
      return 'bought-gun';
    }
    if (p.weapon && p.cash >= PLAYER.ammoPrice) {
      p.cash -= PLAYER.ammoPrice;
      p.ammo += PLAYER.ammoPack;
      game.setBanner('Ammo bought', `+${PLAYER.ammoPack} rounds.`, 2);
      game.audio.pickup();
      return 'bought-ammo';
    }
    game.setBanner('Gun Shop', p.weapon ? `Ammo is $${PLAYER.ammoPrice}.` : `A pistol is $${PLAYER.pistolPrice}.`, 2.5);
    return 'gunshop';
  }
  if (it.kind === 'clinic') {
    if (p.health < PLAYER.health && p.cash >= PLAYER.healPrice) {
      p.cash -= PLAYER.healPrice;
      p.health = PLAYER.health;
      game.setBanner('Patched up', 'Full health.', 2);
      game.audio.pickup();
      return 'healed';
    }
    game.setBanner('Clinic', p.health >= PLAYER.health ? 'You are already healthy.' : `A full heal is $${PLAYER.healPrice}.`, 2.5);
    return 'clinic';
  }
  if (it.kind === 'package') {
    game.collectPackage();
    return 'package';
  }
  if (it.kind === 'taxi') {
    game.startFare(it.ped);
    return 'fare';
  }
  return null;
}

// Per-tick player update: on foot or driving, plus pickups and timers.
export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;

  if (!p.onFoot && p.car) {
    // Driving.
    const throttle = (input.up ? 1 : 0) + (input.down ? -1 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const car = p.car;
    // Handbrake: sharp slow + tighter turn.
    if (input.handbrake) {
      car.speed *= Math.max(0, 1 - 2.2 * dt);
    }
    driveCar(car, throttle, steer, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    // Ramps: a fast car over a ramp goes airborne and earns a stunt bonus.
    for (const ramp of game.world.ramps) {
      if (Math.abs(car.speed) > 260 && Math.hypot(car.x - ramp.x, car.y - ramp.y) < 40 && car.airborne <= 0) {
        car.airborne = 0.7;
        p.cash += 20;
        game.setBanner('STUNT!', '+$20', 1.5);
        game.audio.pickup();
      }
    }
    if (car.airborne > 0) car.airborne -= dt;
    return;
  }

  // On foot: WASD moves, mouse aims.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    // Buildings and the sea block movement (checked axis by axis so the
    // player slides along a wall instead of sticking to it).
    if (!isBlocked(game.world, nx, p.y, PLAYER.radius)) p.x = nx;
    if (!isBlocked(game.world, p.x, ny, PLAYER.radius)) p.y = ny;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // Aim at the mouse (screen → world).
  const wx = game.camera.x + input.mouseX - game.viewW / 2;
  const wy = game.camera.y + input.mouseY - game.viewH / 2;
  if (Math.hypot(wx - p.x, wy - p.y) > 8) {
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  if (input.shoot) shoot(game);

  // Sun coins: walk over one to collect it.
  for (const coin of game.world.coins) {
    if (!coin.taken && Math.hypot(coin.x - p.x, coin.y - p.y) < 30) {
      coin.taken = true;
      p.coins += 1;
      p.cash += COIN_VALUE;
      game.setBanner('Sun coin!', `+$${COIN_VALUE} (${p.coins}/20)`, 1.5);
      game.audio.pickup();
    }
  }
}
