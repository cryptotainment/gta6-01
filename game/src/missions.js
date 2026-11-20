// SOLMAR — Vice Coast. The story: six chained missions with intro cards,
// objectives, rewards and fail states, plus the free-roam taxi fares that
// keep the city paying between missions.

import { MISSIONS, LANDMARKS, PRICES, TAXI_FARE_TIME } from './config.js';
import { addWanted } from './police.js';
import { pick, range } from './random.js';

export function createMissionState() {
  return {
    index: 0, // next mission to start (0-based into MISSIONS)
    active: null, // the running mission, or null
    card: null, // intro card being shown {mission, t}
    done: [], // completed mission ids
  };
}

// Where the next mission starts: its first step's marker.
export function nextMissionStart(game) {
  const m = MISSIONS[game.missions.index];
  if (!m) return null;
  const step = m.steps[0];
  return { x: step.x ?? LANDMARKS.taxiStand.x, y: step.y ?? LANDMARKS.taxiStand.y, mission: m };
}

export function startMission(game, index) {
  const def = MISSIONS[index];
  if (!def) return;
  game.missions.active = {
    def,
    step: 0,
    timer: def.steps[0].type === 'timed' ? def.steps[0].time : 0,
    collected: 0,
    pointsLeft: def.steps[0].points ? [...def.steps[0].points] : [],
  };
  game.missions.card = { mission: def, t: 0 };
  game.audio.sting();
  // Mission 5 starts hot: the getaway begins at three stars.
  if (def.id === 5) {
    game.wanted = 3;
    game.banner = { text: '3 STARS', sub: 'Lose them, then repaint the car', t: 2.4 };
  }
  // Mission 6 turns the heat up the moment the case is touched (step 2).
  if (def.id === 6) game.wanted = 0;
}

function completeStep(game) {
  const m = game.missions.active;
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    completeMission(game);
    return;
  }
  const step = m.def.steps[m.step];
  m.timer = step.type === 'timed' ? step.time : 0;
  m.pointsLeft = step.points ? [...step.points] : [];
  m.collected = 0;
  game.audio.objective();
  // Mission 6: grabbing the case brings four stars.
  if (m.def.id === 6 && m.step === 1) {
    game.wanted = 4;
    game.banner = { text: '4 STARS — THEY KNOW', sub: 'Run the case to the Marina Dock', t: 2.4 };
  }
}

function completeMission(game) {
  const m = game.missions.active;
  const p = game.player;
  p.cash += m.def.reward;
  p.missionsDone += 1;
  game.missions.done.push(m.def.id);
  game.missions.index += 1;
  game.missions.active = null;
  game.banner = { text: 'MISSION COMPLETE', sub: `${m.def.name} — +$${m.def.reward}`, t: 3 };
  game.audio.missionComplete();
  game.save();
}

// The mission's current objective marker (world position + label).
export function currentObjective(game) {
  const m = game.missions.active;
  if (!m) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.type === 'timed' || step.type === 'collect') {
    const next = m.pointsLeft[0];
    if (!next) return null;
    // Only timed steps carry a clock; collect steps show no timer.
    return { x: next.x, y: next.y, label: step.label, timer: step.type === 'timed' ? m.timer : undefined };
  }
  if (step.type === 'escape') return { x: game.player.x, y: game.player.y, label: step.label, escape: true };
  if (step.type === 'repaint') return { x: step.x, y: step.y, label: step.label };
  return { x: step.x, y: step.y, label: step.label };
}

export function updateMissions(game, dt) {
  const ms = game.missions;
  if (ms.card) {
    ms.card.t += dt;
    // The intro card holds until the player presses Enter (or 6 seconds pass).
    if (game.input.pressed('Enter') || ms.card.t > 6) ms.card = null;
    return; // the world waits while the card is up
  }
  const m = ms.active;
  if (!m) {
    // Free roam: standing on the next mission's start marker offers it.
    const start = nextMissionStart(game);
    if (start) {
      const d = Math.hypot(start.x - game.player.x, start.y - game.player.y);
      game.missionOffer = d < 80 ? start.mission : null;
      if (game.missionOffer && game.input.pressed('KeyE')) {
        startMission(game, ms.index);
      }
    }
    updateTaxi(game, dt);
    return;
  }
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = game.player;
  if (step.type === 'timed') {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(game, 'Out of time');
      return;
    }
    const next = m.pointsLeft[0];
    if (next && Math.hypot(next.x - p.x, next.y - p.y) < 80) {
      m.pointsLeft.shift();
      game.audio.objective();
      if (m.pointsLeft.length === 0) completeStep(game);
    }
    return;
  }
  if (step.type === 'collect') {
    const next = m.pointsLeft[0];
    if (next && Math.hypot(next.x - p.x, next.y - p.y) < 60) {
      m.pointsLeft.shift();
      m.collected += 1;
      game.audio.coin();
      game.banner = { text: `PACKAGE ${m.collected} OF ${step.points.length}`, sub: 'Keep moving — the patrols are out', t: 1.6 };
      if (m.pointsLeft.length === 0) completeStep(game);
    }
    return;
  }
  if (step.type === 'escape') {
    if (game.wanted === 0) completeStep(game);
    return;
  }
  if (step.type === 'repaint') {
    if (game.repainted) {
      game.repainted = false;
      completeStep(game);
    }
    return;
  }
  // goto: reach the marker.
  if (Math.hypot(step.x - p.x, step.y - p.y) < step.r) {
    // Mission 2's first step needs the sports car: Riko must be driving it.
    if (m.def.id === 2 && m.step === 0) {
      if (!p.car || p.car.type !== 'sport') {
        game.hint = { text: 'Get in the yellow sports car first (E)', t: 1.2 };
        return;
      }
    }
    // Mission 4 is on foot by design; the packages are collected walking.
    completeStep(game);
  }
}

function failMission(game, reason) {
  const m = game.missions.active;
  game.missions.active = null;
  game.banner = { text: 'MISSION FAILED', sub: `${m.def.name} — ${reason}`, t: 2.6 };
  game.audio.fail();
}

// Taxi fares: a waiting pedestrian with a fare, a destination, a clock.
export function updateTaxi(game, dt) {
  const p = game.player;
  if (!game.taxi) {
    game.taxiCooldown = Math.max(0, (game.taxiCooldown || 0) - dt);
    if (game.taxiCooldown <= 0 && p.car) {
      const ped = pick(game.rng, game.peds);
      if (ped) {
        game.taxi = {
          ped,
          dest: { x: pick(game.rng, [400, 1200, 2000, 2800, 3600]), y: pick(game.rng, [400, 1200, 2000, 2800]) },
          state: 'waiting',
          timer: TAXI_FARE_TIME,
          fare: Math.floor(range(game.rng, PRICES.taxiMin, PRICES.taxiMax)),
        };
      }
    }
    return;
  }
  const t = game.taxi;
  if (t.state === 'waiting') {
    if (p.car && Math.hypot(t.ped.x - p.x, t.ped.y - p.y) < 70) {
      t.state = 'riding';
      game.banner = { text: 'FARE PICKED UP', sub: `Drop them at the marker — $${t.fare}`, t: 2 };
      game.audio.objective();
    }
    return;
  }
  t.timer -= dt;
  if (t.timer <= 0) {
    game.taxi = null;
    game.taxiCooldown = 8;
    game.banner = { text: 'FARE LOST', sub: 'The passenger gave up waiting', t: 1.8 };
    return;
  }
  if (Math.hypot(t.dest.x - p.x, t.dest.y - p.y) < 80) {
    p.cash += t.fare;
    game.banner = { text: 'FARE COMPLETE', sub: `+$${t.fare} — thanks for riding Solmar Cabs`, t: 2 };
    game.audio.missionComplete();
    game.taxi = null;
    game.taxiCooldown = 6;
  }
}
