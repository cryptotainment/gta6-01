// SOLMAR — Vice Coast. The game itself: state, the fixed-step loop, the screen
// machine (title / play / pause / game over), bullets, particles, the camera,
// and the wiring between every system.

import { STEP, WORLD, PLAYER, PRICES, LANDMARKS, COIN_COUNT } from './config.js';
import { createRandom, pick } from './random.js';
import { createWorld, collideBuildings } from './world.js';
import { createPlayer, updatePlayer } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { updatePolice, addWanted } from './police.js';
import { createMissionState, updateMissions, currentObjective, startMission } from './missions.js';
import { render } from './render.js';
import { drawHUD, drawTitle, drawPause, drawOver, drawMissionCard } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import { makeCar, paintCar, autopilotDrive } from './vehicles.js';

function queryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    seed: Number(params.get('seed')) || 1,
    shot: params.get('shot') || null,
    selftest: params.get('selftest') === '1',
  };
}

// A scripted playtest, run only on ?selftest=1: it drives the real loop through
// the core verbs (enter, drive, exit, wanted, police, mission, shoot, save)
// and reports PASS/FAIL lines into the status element for headless checking.
function runSelfTest(game) {
  const results = [];
  const check = (name, cond) => results.push((cond ? 'PASS ' : 'FAIL ') + name);
  game.screen = 'play';
  const p = game.player;
  const step = () => { update(game, STEP); game.input.endFrame(); };
  // 1. Enter a parked car with E.
  const parked = game.parkedCars[0];
  p.x = parked.x;
  p.y = parked.y + 10;
  game.input.pressedKeys.add('KeyE');
  step();
  check('enter car', p.car === parked && !p.onFoot);
  // 2. Drive forward for a second.
  game.input.keys.add('KeyW');
  const x0 = p.car.x;
  const y0 = p.car.y;
  for (let i = 0; i < 60; i += 1) step();
  check('drive moves', Math.hypot(p.car.x - x0, p.car.y - y0) > 50);
  game.input.keys.delete('KeyW');
  // 3. Step out with E.
  game.input.pressedKeys.add('KeyE');
  step();
  check('exit car', p.onFoot && p.car === null);
  // 4. Wanted rises and the PD sends a car. (Wait out the 1.2 s anti-spam
  // grace that the steal in step 1 set, then read the level.)
  for (let i = 0; i < 130; i += 1) step();
  const w0 = game.wanted;
  addWanted(game, 1, 'test');
  check('wanted rises', game.wanted === w0 + 1);
  for (let i = 0; i < 120; i += 1) step();
  check('police spawn', game.policeCars.length > 0);
  // 5. Mission 1 starts and its first step completes at the marker.
  startMission(game, 0);
  game.missions.card = null;
  p.x = 2000;
  p.y = 2000;
  for (let i = 0; i < 10; i += 1) step();
  check('mission step advances', !!game.missions.active && game.missions.active.step === 1);
  // 6. Shooting creates a bullet.
  p.weapon = 'pistol';
  p.ammo = 5;
  game.input.mouseDown = true;
  step();
  check('shoot bullet', game.bullets.length > 0);
  game.input.mouseDown = false;
  // 7. The save round-trips through localStorage.
  writeSave(game);
  check('save loads', loadSave() !== null);
  const status = document.getElementById('status');
  const allPass = results.every((r) => r.startsWith('PASS'));
  if (status) status.textContent = 'SELFTEST ' + results.join(' | ');
  document.title = 'SELFTEST ' + (allPass ? 'ALL PASS' : 'FAILURES');
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = {
    canvas,
    ctx,
    time: 0,
    screen: 'title',
    seed: 1,
    rng: createRandom(1),
    world: null,
    player: null,
    traffic: [],
    peds: [],
    parkedCars: [],
    policeCars: [],
    footCops: [],
    bullets: [],
    particles: [],
    missions: createMissionState(),
    taxi: null,
    taxiCooldown: 0,
    wanted: 0,
    wantedFlash: 0,
    wantedGrace: 0,
    coolTimer: 0,
    arrest: 0,
    camera: { x: WORLD.w / 2, y: WORLD.h / 2 },
    freeCamera: false,
    shake: 0,
    slowmo: 0,
    muzzle: 0,
    banner: null,
    hint: null,
    missionOffer: null,
    currentObjective: null,
    fine: 0,
    sunset: false,
    autopilot: null,
    hasSave: false,
    audio: createAudio(),
    input: null,
    save() { writeSave(game); },
    screenToWorld(mx, my) {
      return { x: game.camera.x - canvas.width / 2 + mx, y: game.camera.y - canvas.height / 2 + my };
    },
  };
  game.input = createInput(canvas);
  return game;
}

// (Re)build the whole city and every actor in it, from the seed.
export function resetWorld(game, seed, saveData) {
  game.seed = seed;
  game.rng = createRandom(seed);
  game.world = createWorld(seed);
  game.player = createPlayer();
  game.traffic = spawnTraffic(game.world, game.rng);
  game.peds = spawnPeds(game.world, game.rng);
  // Parked cars from the city plan, plus the yellow sports car for Hot Wheels.
  game.parkedCars = game.world.parked.map((spot) => {
    const car = makeCar(spot.type, spot.x, spot.y, spot.angle, 'parked');
    paintCar(car, pick(game.rng, ['#c94f42', '#4f7ec9', '#c9c9c9', '#5a6b52', '#f2b705', '#8a8f98']));
    return car;
  });
  const hotWheels = makeCar('sport', LANDMARKS.sportCar.x, LANDMARKS.sportCar.y, Math.PI / 2, 'parked');
  paintCar(hotWheels, '#f2c94c');
  game.parkedCars.push(hotWheels);
  game.policeCars = [];
  game.footCops = [];
  game.bullets = [];
  game.particles = [];
  game.missions = createMissionState();
  game.taxi = null;
  game.taxiCooldown = 4;
  game.wanted = 0;
  game.wantedFlash = 0;
  game.wantedGrace = 0;
  game.coolTimer = 0;
  game.arrest = 0;
  game.banner = null;
  game.hint = null;
  game.missionOffer = null;
  game.currentObjective = null;
  game.sunset = false;
  game.autopilot = null;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  if (saveData) {
    game.player.cash = saveData.cash ?? 100;
    game.player.missionsDone = saveData.missionsDone ?? 0;
    game.missions.index = saveData.missionIndex ?? 0;
    game.missions.done = MISSIONS_DONE(saveData);
    for (const id of saveData.coins ?? []) {
      const coin = game.world.coins.find((c) => c.id === id);
      if (coin) { coin.taken = true; game.player.coins += 1; }
    }
    if (saveData.weapon === 'pistol') { game.player.weapon = 'pistol'; game.player.ammo = saveData.ammo ?? 0; }
    if (saveData.ownedType) {
      const car = makeCar(saveData.ownedType, LANDMARKS.garage.x + 60, LANDMARKS.garage.y + 40, -Math.PI / 2, 'owned');
      paintCar(car, '#f2c94c');
      game.player.ownedCar = car;
    }
    game.audio.setMuted(!!saveData.muted);
  }
}

function MISSIONS_DONE(saveData) {
  const done = [];
  for (let i = 0; i < (saveData.missionIndex ?? 0); i += 1) done.push(i + 1);
  return done;
}

function updateBullets(game, dt) {
  const p = game.player;
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.dist += Math.hypot(b.vx, b.vy) * dt;
    if (b.dist > 560 || b.x < 0 || b.x > WORLD.w || b.y < 0 || b.y > WORLD.h) { b.dead = true; continue; }
    const fixed = collideBuildings(b.x, b.y, 2, game.world);
    if (fixed.hit) {
      b.dead = true;
      game.particles.push({ x: b.x, y: b.y, vx: 0, vy: -20, life: 0.3, max: 0.3, color: '#f2c94c', size: 4 });
      continue;
    }
    if (b.from === 'player') {
      for (const cop of game.footCops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) { cop.hp -= b.damage; b.dead = true; }
      }
      for (const car of [...game.policeCars, ...game.traffic]) {
        if (!b.dead && Math.hypot(car.x - b.x, car.y - b.y) < 30) { car.hp -= b.damage; b.dead = true; }
      }
      for (const ped of game.peds) {
        if (!b.dead && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          b.dead = true;
          ped.flee = 3;
          ped.fleeX = p.x;
          ped.fleeY = p.y;
          addWanted(game, 1, 'shot a pedestrian');
        }
      }
    } else {
      if (p.onFoot && Math.hypot(p.x - b.x, p.y - b.y) < 16) {
        b.dead = true;
        hurtPlayer(game, b.damage);
      }
      if (!p.onFoot && p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 30) {
        b.dead = true;
        p.car.hp -= b.damage;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
}

function hurtPlayer(game, damage) {
  const p = game.player;
  if (p.hurtCd > 0) return;
  p.hurtCd = 0.4;
  p.hp -= damage;
  game.shake = Math.max(game.shake, 0.2);
  if (p.hp <= 0) {
    p.hp = 0;
    game.fine = PRICES.deathFine;
    game.screen = 'over';
    game.audio.fail();
  }
}

function updateCamera(game, dt) {
  if (game.freeCamera) return;
  const p = game.player;
  const targetX = p.x;
  const targetY = p.y;
  game.camera.x += (targetX - game.camera.x) * Math.min(1, 5 * dt);
  game.camera.y += (targetY - game.camera.y) * Math.min(1, 5 * dt);
  const vw = game.canvas.width / 2;
  const vh = game.canvas.height / 2;
  game.camera.x = Math.max(vw, Math.min(WORLD.w - vw, game.camera.x));
  game.camera.y = Math.max(vh, Math.min(WORLD.h - vh, game.camera.y));
}

function updatePlay(game, dt) {
  const input = game.input;
  // The autopilot (screenshots) drives the car along its waypoints.
  if (game.autopilot && game.player.car) autopilotDrive(game);
  updatePlayer(game, dt);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  updateBullets(game, dt);
  // Particles.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  // Timers.
  game.time += dt;
  game.wantedFlash = Math.max(0, game.wantedFlash - dt);
  game.muzzle = Math.max(0, game.muzzle - dt);
  game.shake = Math.max(0, game.shake - dt * 1.6);
  game.slowmo = Math.max(0, game.slowmo - dt);
  if (game.banner) {
    game.banner.t -= dt;
    if (game.banner.t <= 0) game.banner = null;
  }
  if (game.hint) {
    game.hint.t -= dt;
    if (game.hint.t <= 0) game.hint = null;
  }
  game.currentObjective = currentObjective(game);
  updateCamera(game, dt);
  // Wrecked player car while driving is handled in player.js; death by bullets here.
  if (game.player.hp <= 0 && game.screen === 'play') {
    game.fine = PRICES.deathFine;
    game.screen = 'over';
  }
  // Audio follows the drive.
  const car = game.player.car;
  game.audio.update(car ? car.speed : 0, game.wanted, !game.player.onFoot);
  if (input.pressed('Escape')) game.screen = 'pause';
  if (input.pressed('KeyM')) game.audio.setMuted(!game.audio.muted);
}

function respawn(game, fine) {
  const p = game.player;
  p.cash = Math.max(0, p.cash - fine);
  p.hp = PLAYER.hp;
  p.onFoot = true;
  p.car = null;
  p.x = LANDMARKS.clinic.x;
  p.y = LANDMARKS.clinic.y + 60;
  game.wanted = 0;
  game.policeCars.length = 0;
  game.footCops.length = 0;
  game.arrest = 0;
  game.bullets.length = 0;
  game.missions.active = null;
  game.camera.x = p.x;
  game.camera.y = p.y;
  game.screen = 'play';
  game.save();
}

function update(game, dt) {
  const input = game.input;
  // First gesture wakes the audio.
  if (input.mouseClicked || input.pressedKeys.size > 0) {
    game.audio.ensure();
    game.audio.resume();
  }
  if (game.screen === 'title') {
    // The city lives behind the title: traffic rolls on.
    updateTraffic(game, dt);
    updatePeds(game, dt);
    game.time += dt;
    if (input.pressed('Enter')) {
      // The world already holds the save (boot loaded it); Enter just plays.
      game.screen = 'play';
      game.audio.sting();
    }
    if (input.pressed('KeyN')) {
      clearSave();
      resetWorld(game, game.seed, null);
      game.hasSave = false;
      game.screen = 'play';
      game.audio.sting();
    }
    return;
  }
  if (game.screen === 'pause') {
    if (input.pressed('Escape')) game.screen = 'play';
    if (input.pressed('KeyR') && game.missions.active) {
      const index = game.missions.active.def.id - 1;
      game.missions.active = null;
      startMission(game, index);
      game.screen = 'play';
    }
    if (input.pressed('KeyM')) game.audio.setMuted(!game.audio.muted);
    if (input.pressed('KeyQ')) {
      game.screen = 'title';
      resetWorld(game, game.seed, null);
    }
    return;
  }
  if (game.screen === 'over' || game.screen === 'busted') {
    if (input.pressed('Enter')) respawn(game, game.fine);
    return;
  }
  updatePlay(game, dt);
}

function draw(game) {
  const ctx = game.ctx;
  const canvas = game.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (game.screen === 'title') {
    render(game);
    drawTitle(game);
    return;
  }
  render(game);
  if (game.screen === 'play') {
    drawHUD(game);
    drawMissionCard(game);
  } else if (game.screen === 'pause') {
    drawHUD(game);
    drawPause(game);
  } else {
    drawHUD(game);
    drawOver(game, game.screen);
  }
}

function resize(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function boot() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  window.addEventListener('error', (event) => {
    const message = 'SOLMAR ERROR: ' + event.message;
    document.title = message;
    if (status) status.textContent = message;
  });
  resize(canvas);
  window.addEventListener('resize', () => resize(canvas));
  const params = queryParams();
  const game = createGame(canvas);
  game.hasSave = loadSave() !== null;
  resetWorld(game, params.seed, game.hasSave ? loadSave() : null);
  if (params.shot) {
    stageShot(params.shot, game);
  }
  if (params.selftest) {
    runSelfTest(game);
  }
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    const scale = game.slowmo > 0 ? 0.35 : 1;
    acc += dt * scale;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update(game, STEP);
      acc -= STEP;
      steps += 1;
    }
    draw(game);
    game.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.solmar = game;
}

boot();
