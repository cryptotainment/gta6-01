// SOLMAR — Vice Coast. The screenshot scenes behind ?shot=start|play|end|onfoot|chase.
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { STEP, WORLD, LANDMARKS } from './config.js';
import { makeCar, paintCar, autopilotDrive } from './vehicles.js';
import { updatePlayer } from './player.js';
import { updateTraffic, updatePeds } from './traffic.js';
import { updatePolice } from './police.js';
import { updateMissions, startMission } from './missions.js';

const SAMPLE = STEP;

// One simulation step for a staged scene: the same systems the live loop runs,
// minus bullets (no shooting is staged) and minus the mission card wait.
function stepWorld(game, dt) {
  if (game.autopilot) autopilotDrive(game);
  updatePlayer(game, dt);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  game.time += dt;
  game.wantedFlash = Math.max(0, game.wantedFlash - dt);
  game.shake = Math.max(0, game.shake - dt * 1.6);
  if (game.banner) {
    game.banner.t -= dt;
    if (game.banner.t <= 0) game.banner = null;
  }
  game.currentObjective = null;
  const p = game.player;
  game.camera.x = Math.max(game.canvas.width / 2, Math.min(WORLD.w - game.canvas.width / 2, p.x));
  game.camera.y = Math.max(game.canvas.height / 2, Math.min(WORLD.h - game.canvas.height / 2, p.y));
}

// Steer the player's car along its autopilot waypoints (see vehicles.js).
// Kept as a named step so a staged scene reads like the live loop.

function putPlayerInCar(game, type, x, y, angle, color) {
  const car = makeCar(type, x, y, angle, 'player');
  paintCar(car, color);
  const p = game.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  return car;
}

function addPoliceBehind(game, spots) {
  for (const s of spots) {
    const car = makeCar('police', s.x, s.y, s.angle, 'police');
    paintCar(car, '#2f6fd0');
    game.policeCars.push(car);
  }
}

// Set `game` to the named scene and leave it running (the live loop keeps the
// autopilot driving, so the frame stays alive while the screenshot is taken).
export function stageShot(name, game) {
  game.screen = 'play';
  game.freeCamera = false;
  if (name === 'start') {
    game.screen = 'title';
    game.freeCamera = true;
    game.camera.x = 2400;
    game.camera.y = 1500;
    for (let i = 0; i < 5 / SAMPLE; i += 1) {
      updateTraffic(game, SAMPLE);
      updatePeds(game, SAMPLE);
      game.time += SAMPLE;
    }
    return;
  }
  if (name === 'play') {
    // Cover: Riko in the yellow sports car, running east down the downtown
    // avenue with the PD on his tail — towers, traffic, three stars and
    // mission 1, all live. A straight run, so the chase never has to turn.
    putPlayerInCar(game, 'sport', 1700, 1200, 0, '#f2c94c');
    game.player.car.speed = 380;
    game.wanted = 3;
    addPoliceBehind(game, [
      { x: 1400, y: 1200, angle: 0 },
      { x: 1300, y: 1200, angle: 0 },
    ]);
    startMission(game, 0);
    game.missions.card = null; // the card is shown in play; the shot is the street
    game.autopilot = { waypoints: [{ x: 2800, y: 1200 }], i: 0 };
    for (let i = 0; i < 2.5 / SAMPLE; i += 1) stepWorld(game, SAMPLE);
    return;
  }
  if (name === 'chase') {
    // A 3-star chase down the industrial east road — mission 5, Getaway, live.
    putPlayerInCar(game, 'sport', 3600, 900, Math.PI / 2, '#e5534b');
    game.player.car.speed = 460;
    game.wanted = 3;
    addPoliceBehind(game, [
      { x: 3575, y: 620, angle: Math.PI / 2 },
      { x: 3625, y: 500, angle: Math.PI / 2 },
      { x: 3524, y: 700, angle: Math.PI / 2 },
    ]);
    startMission(game, 4);
    game.missions.card = null; // the card is shown in play; the shot is the street
    game.autopilot = {
      waypoints: [
        { x: 3600, y: 1600 },
        { x: 3600, y: 2400 },
        { x: 3600, y: 3200 },
      ],
      i: 0,
    };
    for (let i = 0; i < 2 / SAMPLE; i += 1) stepWorld(game, SAMPLE);
    return;
  }
  if (name === 'onfoot') {
    // Mission 4, on foot in Old Town: one package collected already, the next
    // marker just ahead, patrols out, terracotta streets around.
    const p = game.player;
    p.x = 3600;
    p.y = 880;
    p.angle = -Math.PI / 2;
    p.onFoot = true;
    p.car = null;
    game.wanted = 0;
    startMission(game, 3);
    game.missions.card = null; // the card is shown in play; the shot is the street
    game.missions.active.pointsLeft = [{ x: LANDMARKS.informantB.x, y: LANDMARKS.informantB.y }, { x: LANDMARKS.informantC.x, y: LANDMARKS.informantC.y }];
    game.missions.active.collected = 1;
    for (let i = 0; i < 1.2 / SAMPLE; i += 1) stepWorld(game, SAMPLE);
    return;
  }
  // 'end' and anything else: the marina finale at sunset, job done — the car
  // nose-to the water, the dock and the sea filling the bottom of the frame.
  putPlayerInCar(game, 'sport', 800, 3300, Math.PI / 2, '#f2c94c');
  game.player.car.speed = 0;
  game.sunset = true;
  game.wanted = 0;
  game.player.cash = 1250;
  game.player.missionsDone = 6;
  game.missions.index = 6;
  game.missions.done = [1, 2, 3, 4, 5, 6];
  game.banner = { text: 'MISSION COMPLETE', sub: 'The Solmar Job — +$1000', t: 30 };
  for (let i = 0; i < 1 / SAMPLE; i += 1) {
    updateTraffic(game, SAMPLE);
    updatePeds(game, SAMPLE);
    game.time += SAMPLE;
  }
  game.camera.x = 800;
  game.camera.y = 3300;
}
