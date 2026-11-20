// SOLMAR — Vice Coast. Riko Vale on foot: WASD movement, mouse aim, fists and the
// pistol, entering and stealing cars, picking up coins and packages, and the
// shops he can use when he is standing next to one.

import { PLAYER, PRICES, LANDMARKS } from './config.js';
import { collideBuildings, isInWater, circleHitsRect } from './world.js';
import { driveCar, makeCar, paintCar } from './vehicles.js';
import { addWanted } from './police.js';
import { scarePeds } from './traffic.js';

export function createPlayer() {
  return {
    x: LANDMARKS.spawn.x,
    y: LANDMARKS.spawn.y,
    angle: -Math.PI / 2,
    hp: PLAYER.hp,
    onFoot: true,
    car: null, // the car Riko is driving, or null
    ownedCar: null, // the car Riko owns (parked at the garage)
    weapon: 'fists', // 'fists' | 'pistol'
    ammo: 0,
    cash: 100,
    punchCd: 0,
    shootCd: 0,
    hurtCd: 0,
    coins: 0,
    missionsDone: 0,
  };
}

// The nearest car Riko can enter (traffic, parked, police, or his own), in range.
export function nearestEnterableCar(game, rangeDist) {
  const p = game.player;
  let best = null;
  let bestD = rangeDist;
  const cars = [...game.traffic, ...game.parkedCars, ...game.policeCars];
  if (p.ownedCar) cars.push(p.ownedCar);
  for (const car of cars) {
    if (car.hp <= 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function tryEnterCar(game) {
  const p = game.player;
  const car = nearestEnterableCar(game, 64);
  if (!car) return;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (car.owner === 'traffic' || car.owner === 'parked') {
    // Stealing a car is a crime the whole street sees.
    car.owner = 'player';
    addWanted(game, 1, 'stole a car');
    game.banner = { text: 'CAR STOLEN', sub: 'The owner called it in — lose the cops', t: 2.4 };
  } else if (car.owner === 'police') {
    car.owner = 'player';
    addWanted(game, 1, 'stole a police car');
    game.banner = { text: 'POLICE CAR STOLEN', sub: 'Every unit in Solmar is coming', t: 2.4 };
  }
  game.audio.carDoor();
}

function exitCar(game) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  // Step out to the driver's side.
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
  const fixed = collideBuildings(side.x, side.y, 14, game.world);
  p.x = fixed.x;
  p.y = fixed.y;
  p.angle = car.angle;
  p.onFoot = true;
  p.car = null;
  car.speed = 0;
  game.audio.carDoor();
}

function punch(game) {
  const p = game.player;
  if (p.punchCd > 0) return;
  p.punchCd = 0.45;
  game.audio.punch();
  const reach = PLAYER.punchRange;
  const hx = p.x + Math.cos(p.angle) * reach;
  const hy = p.y + Math.sin(p.angle) * reach;
  // Hit pedestrians (a crime), police on foot, or a car door.
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - hx, ped.y - hy) < 34) {
      ped.flee = 3;
      ped.fleeX = p.x;
      ped.fleeY = p.y;
      addWanted(game, 1, 'assaulted a pedestrian');
      game.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -40, life: 0.4, max: 0.4, color: '#f2c94c', size: 5 });
    }
  }
  for (const cop of game.footCops) {
    if (Math.hypot(cop.x - hx, cop.y - hy) < 34) {
      cop.hp -= PLAYER.punchDamage;
      game.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: -40, life: 0.4, max: 0.4, color: '#e5534b', size: 5 });
    }
  }
  for (const car of [...game.traffic, ...game.policeCars]) {
    if (Math.hypot(car.x - hx, car.y - hy) < 44) {
      car.hp -= 6;
      game.audio.thud();
    }
  }
}

function shoot(game) {
  const p = game.player;
  if (p.shootCd > 0 || p.ammo <= 0) return;
  p.shootCd = 0.28;
  p.ammo -= 1;
  const bx = p.x + Math.cos(p.angle) * 22;
  const by = p.y + Math.sin(p.angle) * 22;
  game.bullets.push({ x: bx, y: by, vx: Math.cos(p.angle) * PLAYER.bulletSpeed, vy: Math.sin(p.angle) * PLAYER.bulletSpeed, dist: 0, from: 'player', damage: PLAYER.pistolDamage });
  game.audio.gunshot();
  game.muzzle = 0.06;
  scarePeds(game, p.x, p.y, 320);
  // Firing where the police can see it is a crime.
  if (game.policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 520)) {
    addWanted(game, 1, 'fired a weapon');
  }
}

// The shop Riko is standing next to, if any.
export function nearbyShop(game) {
  const p = game.player;
  if (!p.onFoot) return null;
  for (const shop of game.world.shops) {
    if (Math.hypot(shop.x - p.x, shop.y - p.y) < shop.r) return shop;
  }
  return null;
}

function buyFromShop(game, shop) {
  const p = game.player;
  if (shop.kind === 'guns') {
    if (p.weapon !== 'pistol' && p.cash >= PRICES.pistol) {
      p.cash -= PRICES.pistol;
      p.weapon = 'pistol';
      p.ammo = PRICES.ammoRounds;
      game.banner = { text: 'PISTOL BOUGHT', sub: 'Click to shoot — the PD will notice', t: 2 };
      game.audio.buy();
    } else if (p.weapon === 'pistol' && p.cash >= PRICES.ammo) {
      p.cash -= PRICES.ammo;
      p.ammo += PRICES.ammoRounds;
      game.banner = { text: 'AMMO BOUGHT', sub: `+${PRICES.ammoRounds} rounds`, t: 1.6 };
      game.audio.buy();
    }
  } else if (shop.kind === 'clinic') {
    if (p.hp < PLAYER.hp && p.cash >= PRICES.medkit) {
      p.cash -= PRICES.medkit;
      p.hp = PLAYER.hp;
      game.banner = { text: 'PATCHED UP', sub: 'Health restored', t: 1.6 };
      game.audio.buy();
    }
  } else if (shop.kind === 'carshop') {
    if (!p.ownedCar && p.cash >= PRICES.sportscar) {
      p.cash -= PRICES.sportscar;
      const car = makeCar('sport', LANDMARKS.garage.x + 60, LANDMARKS.garage.y + 40, -Math.PI / 2, 'owned');
      paintCar(car, '#f2c94c');
      p.ownedCar = car;
      game.banner = { text: 'SPORTS CAR BOUGHT', sub: 'Parked at TINT & PAINT — press E near it to drive', t: 2.4 };
      game.audio.buy();
    }
  }
}

export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  if (p.onFoot) {
    // Aim at the mouse; WASD moves in screen space.
    const worldMouse = game.screenToWorld(input.mouseX, input.mouseY);
    p.angle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
    let mx = 0;
    let my = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      p.x += (mx / len) * PLAYER.walkSpeed * dt;
      p.y += (my / len) * PLAYER.walkSpeed * dt;
    }
    const fixed = collideBuildings(p.x, p.y, PLAYER.radius, game.world);
    p.x = fixed.x;
    p.y = fixed.y;
    if (isInWater(p.x, p.y)) {
      p.x = Math.max(150, p.x);
      p.y = Math.min(3560, p.y);
    }
    if (input.mouseDown) {
      if (p.weapon === 'pistol' && p.ammo > 0) shoot(game);
      else punch(game);
    }
    if (input.pressed('KeyE')) {
      const shop = nearbyShop(game);
      if (shop) buyFromShop(game, shop);
      else tryEnterCar(game);
    }
    // Sun coins, on foot or in a car, are collected by touch.
    for (const coin of game.world.coins) {
      if (!coin.taken && Math.hypot(coin.x - p.x, coin.y - p.y) < 30) {
        coin.taken = true;
        p.coins += 1;
        p.cash += PRICES.coin;
        game.audio.coin();
        game.particles.push({ x: coin.x, y: coin.y, vx: 0, vy: -60, life: 0.6, max: 0.6, color: '#f2c94c', size: 7 });
      }
    }
  } else {
    // Driving: W/S throttle, A/D steer, Space handbrake, E to step out.
    const car = p.car;
    const throttle = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 0.85 : 0);
    const steer = (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? -1 : 0) + (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
    const brake = input.keys.has('Space');
    const hit = driveCar(car, { throttle, steer, brake }, dt, game.world);
    if (hit && Math.abs(car.speed) > 200) game.audio.thud();
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (car.skid > 0.4 && Math.abs(car.speed) > 200) {
      game.particles.push({ x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24, vx: 0, vy: 0, life: 0.5, max: 0.5, color: '#c9c4b2', size: 6 });
    }
    if (input.pressed('KeyE')) exitCar(game);
    // Coins while driving.
    for (const coin of game.world.coins) {
      if (!coin.taken && Math.hypot(coin.x - car.x, coin.y - car.y) < 34) {
        coin.taken = true;
        p.coins += 1;
        p.cash += PRICES.coin;
        game.audio.coin();
      }
    }
    // Stunt ramps: speed over a ramp launches the car.
    for (const ramp of game.world.ramps) {
      if (car.airborne <= 0 && Math.abs(car.speed) > 300 && Math.hypot(ramp.x - car.x, ramp.y - car.y) < 46) {
        car.airborne = 0.9;
        p.cash += PRICES.stunt;
        game.slowmo = 0.9;
        game.banner = { text: 'STUNT JUMP!', sub: `+$${PRICES.stunt} — clean air`, t: 1.8 };
        game.audio.stunt();
      }
    }
    if (car.airborne > 0) car.airborne -= dt;
    // Hitting a pedestrian while driving is a crime.
    for (const ped of game.peds) {
      if (ped.hitCd > 0) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 34 && Math.abs(car.speed) > 60) {
        ped.hitCd = 2;
        ped.flee = 3;
        ped.fleeX = car.x;
        ped.fleeY = car.y;
        addWanted(game, 1, 'hit a pedestrian');
        game.audio.thud();
        game.shake = 0.25;
      }
    }
    // The player's car can be wrecked: bail out on foot.
    if (car.hp <= 0) {
      game.banner = { text: 'CAR WRECKED', sub: 'Riko bails out on foot', t: 2 };
      exitCar(game);
    }
  }
  for (const ped of game.peds) ped.hitCd = Math.max(0, (ped.hitCd || 0) - dt);
}
