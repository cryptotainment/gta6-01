// Missions and side work: the six chained story missions from config.js,
// plus taxi fares for cash between missions. Each mission is a small state
// machine: an intro card, an objective marker on the map and minimap, and a
// success (cash + next mission) or fail (retry) state. Free-roam continues
// after the finale.

import { MISSIONS, LANDMARKS, FARE_MIN, FARE_MAX } from './config.js';
import { makeCar } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

export function startMission(game, index) {
  // index is 1-based (mission 1..6); 7 means the chain is done.
  const def = MISSIONS[index - 1];
  if (!def) {
    game.missions.active = null;
    game.missions.index = 7;
    game.missions.card = null;
    return null;
  }
  const active = {
    def,
    index,
    type: def.type,
    target: def.target ? { ...LANDMARKS[def.target] } : null,
    pointsLeft: def.targets ? def.targets.map((t) => ({ ...LANDMARKS[t] })) : [],
    collected: 0,
    timeLeft: def.timeLimit || 0,
    started: true,
    stage: 'go',
  };
  if (def.startWanted) game.setWanted(def.startWanted);
  if (def.type === 'deliverCar' && def.carAt) {
    // The mission car waits at its spot, marked.
    const spot = LANDMARKS[def.carAt];
    const car = makeCar(game.rng, 'sport', spot.x, spot.y, 0, '#f2c94c');
    car.missionCar = true;
    car.isParked = true;
    game.cars.push(car);
    active.missionCar = car;
  }
  if (def.type === 'driveTo' && def.start) {
    // The client waits at the pickup; the player must reach them first.
    active.pickup = { ...LANDMARKS[def.start] };
    active.stage = 'pickup';
  }
  if (def.type === 'timed' && def.start) {
    // The player starts at the start line.
    const s = LANDMARKS[def.start];
    const p = game.player;
    if (!p.onFoot && p.car) {
      p.car.x = s.x;
      p.car.y = s.y;
      p.car.angle = Math.PI;
      p.car.speed = 0;
      p.x = s.x;
      p.y = s.y;
    } else {
      p.x = s.x;
      p.y = s.y;
    }
  }
  game.missions.active = active;
  game.missions.index = index;
  game.missions.card = { title: `MISSION ${index} — ${def.name}`, text: def.intro, t: 6 };
  game.audio.sting();
  return active;
}

export function completeMission(game) {
  const active = game.missions.active;
  if (!active) return;
  const p = game.player;
  p.cash += active.def.reward;
  p.missionsDone += 1;
  game.missions.done.push(active.def.id);
  game.setBanner('MISSION COMPLETE', `${active.def.name} — +$${active.def.reward}`, 4);
  game.audio.sting();
  game.missions.active = null;
  game.missions.card = null;
  // Chain to the next mission after a breath.
  game.nextMissionT = 2.5;
  game.nextMissionIndex = active.index + 1;
}

export function failMission(game, reason) {
  const active = game.missions.active;
  if (!active) return;
  game.missions.card = { title: 'MISSION FAILED', text: `${reason} — try again from the pause menu or the next attempt.`, t: 5 };
  game.audio.sting();
  game.missions.active = null;
  // Restart the same mission after a breath.
  game.nextMissionT = 3;
  game.nextMissionIndex = active.index;
}

export function updateMissions(game, dt) {
  // Chain timing: start the next (or retried) mission when the timer ends.
  if (game.nextMissionT > 0) {
    game.nextMissionT -= dt;
    if (game.nextMissionT <= 0) {
      game.nextMissionT = 0;
      startMission(game, game.nextMissionIndex);
    }
  }
  if (game.missions.card) {
    game.missions.card.t -= dt;
    if (game.missions.card.t <= 0) game.missions.card = null;
  }
  const active = game.missions.active;
  if (!active) return;
  const p = game.player;

  if (active.type === 'driveTo') {
    if (active.stage === 'pickup') {
      if (Math.hypot(p.x - active.pickup.x, p.y - active.pickup.y) < 70) {
        active.stage = 'go';
        game.setBanner('Client aboard', 'Drive them to the beach dropoff.', 2.5);
      }
    } else if (Math.hypot(p.x - active.target.x, p.y - active.target.y) < 80) {
      completeMission(game);
    }
  } else if (active.type === 'deliverCar') {
    // Deliver the mission car (or any car you are driving) to the target.
    const atTarget = !p.onFoot && p.car && Math.hypot(p.car.x - active.target.x, p.car.y - active.target.y) < 90;
    const onFootAtTarget = p.onFoot && Math.hypot(p.x - active.target.x, p.y - active.target.y) < 90;
    if (atTarget || onFootAtTarget) {
      completeMission(game);
    }
  } else if (active.type === 'timed') {
    active.timeLeft -= dt;
    if (Math.hypot(p.x - active.target.x, p.y - active.target.y) < 90) {
      completeMission(game);
    } else if (active.timeLeft <= 0) {
      failMission(game, 'Out of time on the Beach Run.');
    }
  } else if (active.type === 'collect') {
    if (active.pointsLeft.length === 0) {
      completeMission(game);
    }
  } else if (active.type === 'escape') {
    // Lose the wanted level, then repaint at the garage.
    if (game.wanted === 0 && Math.hypot(p.x - active.target.x, p.y - active.target.y) < 110) {
      completeMission(game);
    } else if (game.wanted === 0) {
      game.setBanner('Clean — now repaint', 'Get to TINT & PAINT to finish the job.', 2);
    }
  }
}

// Collect one package (called from the player's interact). Advances the
// collect mission; when the last one is taken the mission completes.
export function collectPackage(game) {
  const active = game.missions.active;
  if (!active || active.type !== 'collect') return;
  const p = game.player;
  for (let i = 0; i < active.pointsLeft.length; i += 1) {
    const pk = active.pointsLeft[i];
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 60) {
      active.pointsLeft.splice(i, 1);
      active.collected += 1;
      p.cash += 25;
      game.setBanner('Package collected', `${active.collected}/3 — +$25`, 2);
      game.audio.pickup();
      if (active.pointsLeft.length === 0) completeMission(game);
      return;
    }
  }
}

// The marker the HUD and minimap point at right now (mission target, pickup,
// or a fare destination).
export function missionMarker(game) {
  const active = game.missions.active;
  if (!active) {
    if (game.fare) return { x: game.fare.dest.x, y: game.fare.dest.y, label: 'Fare' };
    return null;
  }
  if (active.type === 'driveTo' && active.stage === 'pickup') {
    return { x: active.pickup.x, y: active.pickup.y, label: 'Pickup' };
  }
  if (active.type === 'collect' && active.pointsLeft.length > 0) {
    const pk = active.pointsLeft[0];
    return { x: pk.x, y: pk.y, label: 'Package' };
  }
  if (active.target) return { x: active.target.x, y: active.target.y, label: active.def.name };
  return null;
}

// Taxi fares: pick up a waiting ped, drive them to a random dropoff, get paid.
export function startFare(game, ped) {
  if (game.fare) return;
  const dest = nearestRoadPoint(
    LANDMARKS.fareDropoff.x + (game.rng() - 0.5) * 600,
    LANDMARKS.fareDropoff.y + (game.rng() - 0.5) * 400,
  );
  const reward = Math.round(FARE_MIN + game.rng() * (FARE_MAX - FARE_MIN));
  game.fare = { ped, dest: { x: dest.x, y: dest.y }, reward, t: 120 };
  // The ped gets in the player's car (or waits if the player is on foot).
  ped.state = 'fare';
  game.setBanner('Taxi fare', `Take them to the marker — $${reward}.`, 2.5);
}

export function updateFares(game, dt) {
  if (!game.fare) return;
  const fare = game.fare;
  fare.t -= dt;
  const p = game.player;
  if (Math.hypot(p.x - fare.dest.x, p.y - fare.dest.y) < 80) {
    p.cash += fare.reward;
    game.setBanner('Fare complete', `+$${fare.reward}`, 2.5);
    game.audio.pickup();
    if (fare.ped) fare.ped.state = 'walk';
    game.fare = null;
    return;
  }
  if (fare.t <= 0) {
    game.setBanner('Fare lost', 'The passenger gave up waiting.', 2);
    if (fare.ped) fare.ped.state = 'walk';
    game.fare = null;
  }
}

// A short line describing the current objective, for the HUD card.
export function objectiveText(game) {
  const active = game.missions.active;
  if (game.fare) return `Taxi fare → $${game.fare.reward} (${Math.ceil(game.fare.t)}s)`;
  if (!active) {
    if (game.missions.index >= 7) return 'Free roam — Solmar is yours.';
    return 'No mission active.';
  }
  const d = active.def;
  if (active.type === 'driveTo' && active.stage === 'pickup') return `${d.name}: pick up the client`;
  if (active.type === 'driveTo') return `${d.name}: drive to the beach`;
  if (active.type === 'deliverCar') return `${d.name}: deliver to ${d.target}`;
  if (active.type === 'timed') return `${d.name}: ${Math.ceil(active.timeLeft)}s left`;
  if (active.type === 'collect') return `${d.name}: ${active.collected}/3 packages`;
  if (active.type === 'escape') return `${d.name}: lose the cops, repaint at TINT & PAINT`;
  return d.name;
}
