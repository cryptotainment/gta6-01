// Solmar — Vice Coast: the entry point. Builds the game object, wires every
// module together, runs the fixed-timestep loop, the title / pause /
// game-over screens, the ?shot= staging for screenshots and the ?selftest=1
// playtest that drives the real loop through the core verbs. No Date.now() in
// gameplay: the clock is the accumulated game time, so a fixed seed replays
// the same world.

import { WORLD_W, WORLD_H } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { makeCar, collideCars, collideBuildings } from './vehicles.js';
import { spawnTraffic, spawnParked, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { makePlayer, updatePlayer, enterCar, exitCar, interact, nearestCar, nearestInteractable, shoot } from './player.js';
import { addWanted as policeAddWanted, setWanted as policeSetWanted, updatePolice, policeFire } from './police.js';
import { startMission, updateMissions, updateFares, collectPackage as missionsCollectPackage, startFare as missionsStartFare, missionMarker as missionsMarker } from './missions.js';
import { render, updateCamera } from './render.js';
import { drawHUD, drawTitle, drawPause, drawGameOver } from './hud.js';
import { makeAudio } from './audio.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { makeInput, bindInput, endTickInput } from './input.js';
import { stageShot } from './shots.js';

const SAMPLE = 1 / 60;

export function createGame(seed) {
  const rng = mulberry32(seed);
  const game = {
    seed,
    rng,
    time: 0,
    world: null,
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    police: [],
    player: null,
    wanted: 0,
    missions: { index: 1, active: null, done: [], card: null },
    camera: { x: 600, y: 600 },
    viewW: 1280,
    viewH: 800,
    input: null,
    audio: null,
    screen: 'title',
    banner: null,
    lastShotX: 0,
    lastShotY: 0,
    lastShotT: 0,
    shake: 0,
    sunset: false,
    noSightT: 0,
    decayT: 0,
    arrestT: 0,
    arrested: false,
    fireCd: 0,
    nextMissionT: 0,
    nextMissionIndex: 1,
    fare: null,
    _lastSavedMissions: 0,
  };
  game.world = buildWorld(seed);
  game.player = makePlayer(600, 600);
  game.input = makeInput();
  game.audio = makeAudio();

  // Wiring: the modules call these on the game object.
  game.addWanted = (n) => policeAddWanted(game, n);
  game.setWanted = (n) => policeSetWanted(game, n);
  game.setBanner = (text, sub, t) => { game.banner = { text, sub: sub || '', t: t || 2 }; };
  game.spawnCar = (type, x, y, angle, color) => {
    const car = makeCar(game.rng, type, x, y, angle, color);
    game.cars.push(car);
    return car;
  };
  game.collectPackage = () => missionsCollectPackage(game);
  game.startFare = (ped) => missionsStartFare(game, ped);
  game.missionMarker = () => missionsMarker(game);
  game.nearestCar = () => nearestCar(game);
  game.nearestInteractable = () => nearestInteractable(game);
  game.hasSave = () => hasSave();

  spawnTraffic(game, 14);
  spawnParked(game, 10);
  spawnPeds(game, 26);
  return game;
}

// One fixed tick of the whole game.
export function update(game, dt) {
  game.time += dt;
  if (game.banner) {
    game.banner.t -= dt;
    if (game.banner.t <= 0) game.banner = null;
  }
  if (game.lastShotT > 0) game.lastShotT -= dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 9);

  updatePlayer(game, dt);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  policeFire(game, dt);
  updateMissions(game, dt);
  updateFares(game, dt);
  updateBullets(game, dt);
  updateParticles(game, dt);
  collideCars(game);
  // The player's car and police cars collide with buildings.
  if (game.player.car) collideBuildings(game, game.player.car);
  for (const car of game.police) collideBuildings(game, car);
  updateCamera(game);
  game.audio.update(game, dt);

  // Autosave when a mission is completed.
  if (game.player.missionsDone > game._lastSavedMissions) {
    game._lastSavedMissions = game.player.missionsDone;
    saveGame(game);
  }

  // Death or arrest ends the run.
  if (game.screen === 'playing') {
    if (game.player.health <= 0) {
      game.screen = 'gameover';
      game.arrested = false;
      game.audio.sting();
    } else if (game.arrested) {
      game.screen = 'gameover';
      game.audio.sting();
    }
  }
}

function updateBullets(game, dt) {
  const p = game.player;
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && b.from === 'player') {
      // Hit a pedestrian: they flee.
      for (const ped of game.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.state = 'flee';
          ped.fleeT = 3;
          ped.angle = Math.atan2(ped.y - b.y, ped.x - b.x);
          spawnBurst(game, b.x, b.y, '#ffd94d');
          dead = true;
          break;
        }
      }
      // Hit a police car: slow it down.
      if (!dead) {
        for (const car of game.police) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
            car.speed *= 0.7;
            spawnBurst(game, b.x, b.y, '#ff9d2e');
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'police' && p.onFoot && p.invuln <= 0) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        p.health -= 8;
        p.invuln = 0.6;
        game.shake = Math.max(game.shake, 4);
        spawnBurst(game, b.x, b.y, '#e33f2f');
        dead = true;
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
}

function spawnBurst(game, x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    const a = game.rng() * Math.PI * 2;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * (40 + game.rng() * 90),
      vy: Math.sin(a) * (40 + game.rng() * 90),
      life: 0.4, max: 0.4, color,
    });
  }
}

function updateParticles(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }
}

// --- Screens and input -------------------------------------------------

function startNewGame(game, missionIndex = 1) {
  const oldAudio = game.audio;
  const fresh = createGame(game.seed);
  // Keep the audio context across restarts (don't leak oscillators).
  fresh.audio = oldAudio;
  Object.assign(game, fresh);
  bindInput(game.input, game.canvas);
  game.screen = 'playing';
  startMission(game, missionIndex);
}

function continueGame(game) {
  const data = loadGame();
  const next = data ? data.missionsDone + 1 : 1;
  startNewGame(game, next);
  if (data) applySave(game, data);
}

function handleKeys(game) {
  const input = game.input;
  const pressed = input.pressed;
  if (game.screen === 'title') {
    if (pressed.Enter) {
      game.audio.ensure();
      if (hasSave()) continueGame(game);
      else startNewGame(game);
    }
    return;
  }
  if (game.screen === 'gameover') {
    if (pressed.Enter) startNewGame(game);
    return;
  }
  if (pressed.Escape) {
    game.screen = game.screen === 'paused' ? 'playing' : 'paused';
    return;
  }
  if (game.screen === 'paused') {
    if (pressed.KeyR && game.missions.active) {
      const idx = game.missions.active.index;
      game.missions.active = null;
      game.screen = 'playing';
      startMission(game, idx);
    }
    if (pressed.KeyQ) game.screen = 'title';
    if (pressed.KeyM) game.audio.setMuted(!game.audio.muted);
    return;
  }
  // Playing.
  if (pressed.KeyM) game.audio.setMuted(!game.audio.muted);
  if (pressed.KeyE) interact(game);
}

// --- Selftest ----------------------------------------------------------
// Drives the real loop through the core verbs on a fresh seeded game and
// returns a deterministic report (no timings, no random values). Used by
// ?selftest=1 and by the headless screenshot runs.

export function runSelfTest() {
  const results = [];
  const check = (name, ok) => results.push(`${name}: ${ok ? 'PASS' : 'FAIL'}`);
  const game = createGame(1);
  game.screen = 'playing';
  game.viewW = 1280;
  game.viewH = 800;

  // 1. Enter a car. The car waits on the avenue facing south, so the drive
  // in step 2 runs along the road instead of into a building.
  const car = game.spawnCar('sedan', 600, 640, Math.PI / 2);
  const entered = enterCar(game, car);
  check('1 enter car', entered && !game.player.onFoot && game.player.car === car);

  // 2. Driving moves the car.
  const x0 = car.x;
  const y0 = car.y;
  game.input.up = true;
  for (let i = 0; i < 120; i += 1) update(game, SAMPLE);
  game.input.up = false;
  check('2 drive moves', Math.hypot(car.x - x0, car.y - y0) > 50);

  // 3. Exit the car.
  const exited = exitCar(game);
  check('3 exit car', exited && game.player.onFoot && !game.player.car);

  // 4. Stealing a car raises the wanted level.
  game.setWanted(0);
  const stealCar = game.spawnCar('sedan', game.player.x + 40, game.player.y, 0);
  enterCar(game, stealCar);
  check('4 wanted rises', game.wanted >= 1);
  game.setWanted(0);
  exitCar(game);

  // 5. Police spawn when wanted.
  game.setWanted(2);
  for (let i = 0; i < 60; i += 1) update(game, SAMPLE);
  check('5 police spawn', game.police.length > 0);
  game.setWanted(0);

  // 6. A mission step advances.
  startMission(game, 1);
  const pickup = game.missions.active.pickup;
  game.player.x = pickup.x;
  game.player.y = pickup.y;
  for (let i = 0; i < 10; i += 1) update(game, SAMPLE);
  const stageOk = game.missions.active && game.missions.active.stage === 'go';
  const target = game.missions.active ? game.missions.active.target : null;
  if (target) {
    game.player.x = target.x;
    game.player.y = target.y;
    for (let i = 0; i < 10; i += 1) update(game, SAMPLE);
  }
  check('6 mission step advances', stageOk && game.player.missionsDone === 1);

  // 7. Shooting fires a bullet.
  game.player.weapon = 'pistol';
  game.player.ammo = 10;
  const ammoBefore = game.player.ammo;
  game.player.onFoot = true;
  game.player.car = null;
  const shot = shoot(game);
  check('7 shoot bullet', shot && game.bullets.length > 0 && game.player.ammo === ammoBefore - 1);

  // 8. Save and load round-trip.
  game.player.cash = 777;
  saveGame(game);
  const loaded = loadGame();
  check('8 save loads', !!loaded && loaded.cash === 777);

  const passed = results.filter((r) => r.endsWith('PASS')).length;
  const lines = ['Solmar selftest (seed 1):', ...results, `${passed}/8 PASS`];
  return lines.join('\n');
}

// --- Boot ---------------------------------------------------------------

function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || '1') || 1;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Selftest mode: run it synchronously and print the report into the page.
  if (params.get('selftest') === '1') {
    const report = runSelfTest();
    document.title = report.split('\n').pop();
    const pre = document.createElement('pre');
    pre.id = 'selftest';
    pre.textContent = report;
    document.body.appendChild(pre);
    // eslint-disable-next-line no-console
    console.log(report);
    return;
  }

  const game = createGame(seed);
  game.canvas = canvas;
  bindInput(game.input, canvas);

  // Staged screenshot mode: build the scene, step it forward a fixed amount,
  // and render it. No title screen, no loop that advances the simulation —
  // the staged frame is re-painted every animation frame so a screenshot
  // taken at any moment catches the same deterministic frame.
  const shot = params.get('shot');
  if (shot) {
    game.screen = 'playing';
    game.viewW = canvas.width;
    game.viewH = canvas.height;
    stageShot(game, shot);
    for (let i = 0; i < 90; i += 1) update(game, SAMPLE);
    updateCamera(game);
    document.title = `shot:${shot}`;
    const paint = () => {
      game.viewW = canvas.width;
      game.viewH = canvas.height;
      render(game, ctx);
      drawHUD(game, ctx);
      requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    return;
  }

  // Normal play: fixed-timestep loop.
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.viewW = canvas.width;
    game.viewH = canvas.height;
    handleKeys(game);
    if (game.screen === 'playing') {
      acc += dt;
      while (acc >= SAMPLE) {
        update(game, SAMPLE);
        acc -= SAMPLE;
      }
    }
    updateCamera(game);
    render(game, ctx);
    if (game.screen === 'title') drawTitle(game, ctx);
    else if (game.screen === 'paused') drawPause(game, ctx);
    else if (game.screen === 'gameover') drawGameOver(game, ctx);
    else drawHUD(game, ctx);
    endTickInput(game.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
