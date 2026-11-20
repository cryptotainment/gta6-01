// SOLMAR — Vice Coast. The wanted level and the Solmar PD: police cars that spawn
// at the road edge and chase, foot officers at higher levels, arrest when they
// catch Riko on foot, and the cool-down that lets a careful driver lose them —
// plus the TINT & PAINT garage that paints the heat away.

import { WANTED, PLAYER, ROADS_X, ROADS_Y } from './config.js';
import { makeCar, paintCar, driveCar } from './vehicles.js';
import { nearestRoad, isOnRoad } from './world.js';
import { pick } from './random.js';

// Raise the wanted level, never above the cap. A short grace stops one incident
// (one stolen car, one crash) from stacking the same crime twice.
export function addWanted(game, levels, reason) {
  const now = game.time;
  if (game.wantedGrace > now) return;
  game.wantedGrace = now + 1.2;
  const before = game.wanted;
  game.wanted = Math.min(WANTED.max, game.wanted + levels);
  if (game.wanted > before) {
    game.wantedFlash = 1.2;
    game.audio.sirenBurst();
    if (game.wanted >= 3 && before < 3) {
      game.banner = { text: `${game.wanted} STARS — PD ON THE WAY`, sub: reason, t: 2.2 };
    }
  }
}

function spawnPointNear(game, dist) {
  const p = game.player;
  const road = pick(game.rng, ROADS_X);
  const roadY = pick(game.rng, ROADS_Y);
  const vertical = game.rng() < 0.5;
  if (vertical) {
    const dir = p.y < roadY ? -1 : 1;
    return { x: road, y: p.y + dir * dist, vertical: true };
  }
  const dir = p.x < road ? -1 : 1;
  return { x: p.x + dir * dist, y: roadY, vertical: false };
}

function spawnPoliceCar(game) {
  const spot = spawnPointNear(game, 700);
  const car = makeCar('police', spot.x, spot.y, 0, 'police');
  paintCar(car, '#2f6fd0');
  car.vertical = spot.vertical;
  game.policeCars.push(car);
  game.audio.sirenBurst();
}

function spawnFootCop(game) {
  const p = game.player;
  const angle = game.rng() * Math.PI * 2;
  game.footCops.push({
    x: p.x + Math.cos(angle) * 420,
    y: p.y + Math.sin(angle) * 420,
    hp: 50,
    shootCd: 1 + game.rng(),
    grab: 0,
  });
}

export function updatePolice(game, dt) {
  const p = game.player;
  const want = game.wanted;
  // Keep the street presence matched to the wanted level.
  const wantCars = WANTED.carsPerLevel[want];
  while (game.policeCars.length < wantCars) spawnPoliceCar(game);
  while (game.policeCars.length > wantCars) game.policeCars.pop();
  const wantCops = want >= 2 ? Math.min(3, want - 1) : 0;
  while (game.footCops.length < wantCops) spawnFootCop(game);
  while (game.footCops.length > wantCops) game.footCops.pop();

  // Police cars: steer at the player, ram, and keep up at higher levels.
  for (const car of game.policeCars) {
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    // Do not pile onto one another: push the aim point away from nearby units.
    let aimX = p.x;
    let aimY = p.y;
    for (const other of game.policeCars) {
      if (other === car) continue;
      const ox = car.x - other.x;
      const oy = car.y - other.y;
      const od = Math.hypot(ox, oy);
      if (od > 0.01 && od < 110) {
        aimX += (ox / od) * (110 - od) * 0.9;
        aimY += (oy / od) * (110 - od) * 0.9;
      }
    }
    const dx = aimX - car.x;
    const dy = aimY - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let da = wantAngle - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, da * 1.6));
    const maxChase = 380 + want * 42;
    const throttle = dist > 90 ? 1 : 0.4;
    const hit = driveCar(car, { throttle, steer, brake: false }, dt, game.world);
    if (hit && Math.abs(car.speed) > 240) game.audio.thud();
    if (car.speed > maxChase) car.speed = maxChase;
    // Ramming the player's car damages it — one solid hit per car, then a pause,
    // so a surrounded car is threatened, not shredded in seconds.
    if (p.car && car.ramCd <= 0 && Math.abs(car.speed) > 200 && Math.hypot(car.x - p.car.x, car.y - p.car.y) < 56) {
      p.car.hp -= 5;
      car.ramCd = 1.2;
      game.shake = Math.max(game.shake, 0.12);
      game.audio.thud();
    }
    // A slow police car touching Riko on foot starts the arrest.
    if (p.onFoot && Math.hypot(car.x - p.x, car.y - p.y) < 48 && Math.abs(car.speed) < 90) {
      game.arrest += dt;
      if (game.arrest > WANTED.arrestTime) {
        game.screen = 'busted';
        game.audio.busted();
      }
    }
  }
  if (!p.onFoot || game.policeCars.every((c) => Math.hypot(c.x - p.x, c.y - p.y) > 48 || Math.abs(c.speed) >= 90)) {
    game.arrest = Math.max(0, game.arrest - dt * 2);
  }

  // Foot officers: run Riko down, grab him, and shoot from wanted 3 up.
  for (const cop of game.footCops) {
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.x += (dx / dist) * 190 * dt;
    cop.y += (dy / dist) * 190 * dt;
    if (dist < 42 && p.onFoot) {
      game.arrest += dt * 1.4;
      if (game.arrest > WANTED.arrestTime) {
        game.screen = 'busted';
        game.audio.busted();
      }
    }
    if (want >= 3 && dist < 460 && dist > 60) {
      cop.shootCd -= dt;
      if (cop.shootCd <= 0) {
        cop.shootCd = 1.4 + game.rng() * 0.8;
        const aim = Math.atan2(dy, dx) + (game.rng() - 0.5) * 0.22;
        game.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(aim) * 780, vy: Math.sin(aim) * 780, dist: 0, from: 'police', damage: 9 });
        game.audio.gunshot();
      }
    }
    if (cop.hp <= 0) {
      cop.dead = true;
      game.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: -30, life: 0.5, max: 0.5, color: '#2f6fd0', size: 6 });
    }
  }
  game.footCops = game.footCops.filter((c) => !c.dead);

  // Lose the cops: with no police in sight for a while, the level drops.
  if (want > 0) {
    const nearest = Math.min(
      ...game.policeCars.map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
      ...game.footCops.map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
      Infinity,
    );
    if (nearest > WANTED.sightRange) {
      game.coolTimer += dt;
      if (game.coolTimer >= WANTED.coolDown) {
        game.coolTimer = 0;
        game.wanted -= 1;
        game.banner = { text: 'HEAT DROPPING', sub: `Wanted level ${game.wanted}`, t: 1.6 };
      }
    } else {
      game.coolTimer = 0;
    }
  } else {
    game.coolTimer = 0;
  }

  // TINT & PAINT: drive the car into the garage and the heat is painted away.
  const g = game.world.garage;
  if (!p.onFoot && p.car && game.wanted > 0 && Math.hypot(g.x - p.car.x, g.y - p.car.y) < g.r) {
    if (p.cash >= 150) {
      p.cash -= 150;
      game.wanted = 0;
      game.policeCars.length = 0;
      game.footCops.length = 0;
      paintCar(p.car, pick(game.rng, ['#1f9d8a', '#e5534b', '#4f7ec9', '#c9c9c9', '#f2c94c']));
      game.banner = { text: 'REPAINTED', sub: 'New colour, clean slate — $150', t: 2.2 };
      game.audio.buy();
      game.repainted = true;
    }
  }
}
