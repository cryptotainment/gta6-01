// SOLMAR — Vice Coast. The HUD and the menus, drawn on the same canvas as the
// world: wanted stars, health, cash, the objective line, the minimap with its
// police blips and mission marker, prompts and banners, and the title, pause,
// game-over and mission-intro screens.

import { WORLD, PALETTE, FONT, COIN_COUNT, MISSIONS } from './config.js';

function drawStars(ctx, x, y, wanted, flash) {
  ctx.font = 'bold 26px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 5; i += 1) {
    const filled = i < wanted;
    ctx.fillStyle = filled ? (flash > 0 && Math.floor(flash * 6) % 2 === 0 ? '#ffffff' : '#f2c94c') : 'rgba(244,241,230,0.25)';
    ctx.fillText('★', x + i * 30, y);
  }
}

function drawMinimap(ctx, game) {
  const mw = 196;
  const mh = 148;
  const x0 = 16;
  const y0 = game.canvas.height - mh - 16;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(20,22,28,0.82)';
  ctx.fillRect(x0 - 6, y0 - 6, mw + 12, mh + 12);
  ctx.strokeStyle = 'rgba(244,241,230,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 6, y0 - 6, mw + 12, mh + 12);
  // Sea.
  ctx.fillStyle = '#2f7fa8';
  ctx.fillRect(x0, y0, 120 * sx, mh);
  ctx.fillRect(x0, y0 + 3440 * sy, mw, mh - 3440 * sy);
  // Ground.
  ctx.fillStyle = '#5d6b58';
  ctx.fillRect(x0, y0, mw, mh);
  // Roads.
  ctx.fillStyle = '#3a3f47';
  for (const rx of [400, 1200, 2000, 2800, 3600, 4400]) ctx.fillRect(x0 + rx * sx - 2, y0, 4, mh);
  for (const ry of [400, 1200, 2000, 2800]) ctx.fillRect(x0, y0 + ry * sy - 2, mw, 4);
  // Sun coins left.
  ctx.fillStyle = '#f2c94c';
  for (const coin of game.world.coins) {
    if (!coin.taken) ctx.fillRect(x0 + coin.x * sx - 1, y0 + coin.y * sy - 1, 2, 2);
  }
  // Mission marker.
  const obj = game.currentObjective;
  if (obj && !obj.escape) {
    const pulse = 4 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x0 + obj.x * sx, y0 + obj.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Taxi destination.
  if (game.taxi && game.taxi.state === 'riding') {
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(x0 + game.taxi.dest.x * sx - 3, y0 + game.taxi.dest.y * sy - 3, 6, 6);
  }
  // Police blips (red and blue, flashing).
  const flash = Math.floor(game.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff3b30' : '#2f6fd0';
  for (const car of game.policeCars) {
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of game.footCops) {
    ctx.beginPath();
    ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Riko: a white arrow, rotated to his heading.
  const px = x0 + game.player.x * sx;
  const py = y0 + game.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North.
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 11px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('N', x0 + mw - 10, y0 + 12);
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(20,22,28,0.8)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.max(0, Math.min(1, frac))), h - 4);
}

export function drawHUD(game) {
  const ctx = game.ctx;
  const canvas = game.canvas;
  const p = game.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Wanted stars + cash, top right.
  drawStars(ctx, canvas.width - 172, 40, game.wanted, game.wantedFlash);
  ctx.font = 'bold 22px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#58b368';
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), canvas.width - 16, 72);
  // Objective, top left: one panel for the label and the mission name.
  const obj = game.currentObjective;
  if (obj) {
    ctx.textAlign = 'left';
    const label = obj.label + (obj.timer !== undefined ? `  (${Math.ceil(obj.timer)}s)` : '');
    ctx.font = 'bold 15px ' + FONT;
    const labelW = ctx.measureText('◆ ' + label).width;
    const mission = game.missions.active;
    let subW = 0;
    if (mission) {
      ctx.font = '13px ' + FONT;
      subW = ctx.measureText(`${mission.def.name} — mission ${mission.def.id} of ${MISSIONS.length}`).width;
    }
    const w = Math.max(labelW, subW) + 24;
    ctx.fillStyle = 'rgba(20,22,28,0.72)';
    ctx.fillRect(16, 14, w, mission ? 54 : 30);
    ctx.fillStyle = '#f2c94c';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('◆ ' + label, 28, 34);
    if (mission) {
      ctx.font = '13px ' + FONT;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`${mission.def.name} — mission ${mission.def.id} of ${MISSIONS.length}`, 28, 56);
    }
  } else if (game.missions.index < MISSIONS.length) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = 'rgba(20,22,28,0.72)';
    ctx.fillRect(16, 14, 340, 30);
    ctx.fillStyle = '#f2c94c';
    ctx.fillText('◆ Follow the yellow M — next mission', 28, 34);
  }
  // Health + weapon, bottom right (kept clear of the window's bottom edge).
  const bx = canvas.width - 216;
  const by = canvas.height - 76;
  drawBar(ctx, bx, by, 200, 16, p.hp / 100, p.hp > 30 ? '#58b368' : '#e5534b');
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('HEALTH', bx, by - 6);
  if (!p.onFoot && p.car) {
    drawBar(ctx, bx, by - 34, 200, 12, p.car.hp / 100, '#4f7ec9');
    ctx.fillText('CAR', bx, by - 40);
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', canvas.width - 16, by - 44);
  }
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  const weapon = p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS';
  ctx.fillText(weapon, canvas.width - 16, by + 34);
  // Coins.
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px ' + FONT;
  ctx.fillStyle = '#f2c94c';
  ctx.fillText(`☀ ${p.coins}/${COIN_COUNT}`, canvas.width - 16, by + 56);
  drawMinimap(ctx, game);
  // Arrest progress: a closing ring around Riko's arrow.
  if (game.arrest > 0.2) {
    ctx.fillStyle = 'rgba(229,83,75,0.9)';
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('THE PD IS GRABBING YOU — DRIVE AWAY!', canvas.width / 2, 90);
  }
  // Prompts and hints, bottom centre.
  const prompt = currentPrompt(game);
  if (prompt) {
    ctx.font = 'bold 16px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(prompt).width + 28;
    ctx.fillStyle = 'rgba(20,22,28,0.78)';
    ctx.fillRect(canvas.width / 2 - w / 2, canvas.height - 92, w, 32);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(prompt, canvas.width / 2, canvas.height - 70);
  }
  if (game.hint && game.hint.t > 0) {
    ctx.font = '15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c94c';
    ctx.fillText(game.hint.text, canvas.width / 2, canvas.height - 120);
  }
  // Banner, centre.
  if (game.banner && game.banner.t > 0) {
    const alpha = Math.min(1, game.banner.t);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,22,28,0.85)';
    ctx.fillRect(canvas.width / 2 - 260, 120, 520, 64);
    ctx.fillStyle = '#f2c94c';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText(game.banner.text, canvas.width / 2, 148);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px ' + FONT;
    ctx.fillText(game.banner.sub, canvas.width / 2, 172);
    ctx.globalAlpha = 1;
  }
  // Low health vignette.
  if (p.hp < 30) {
    const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height / 3, canvas.width / 2, canvas.height / 2, canvas.height / 1.2);
    grad.addColorStop(0, 'rgba(229,83,75,0)');
    grad.addColorStop(1, `rgba(229,83,75,${0.35 + Math.sin(game.time * 5) * 0.1})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}

function currentPrompt(game) {
  const p = game.player;
  if (game.missionOffer) return 'Press E — start mission: ' + game.missionOffer.name;
  if (p.onFoot) {
    const shop = game.world.shops.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < s.r);
    if (shop) {
      if (shop.kind === 'guns') return p.weapon === 'pistol' ? 'Press E — buy ammo $50' : 'Press E — buy pistol $200';
      if (shop.kind === 'clinic') return 'Press E — medkit $60';
      if (shop.kind === 'carshop') return p.ownedCar ? 'Sports car is yours — parked at TINT & PAINT' : 'Press E — buy sports car $800';
    }
    return 'Press E near a car to drive it';
  }
  return 'E — step out    Space — handbrake';
}

function menuPanel(ctx, canvas, title, lines, footer) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,16,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 120);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px ' + FONT;
  let y = canvas.height / 2 - 70;
  for (const line of lines) {
    ctx.fillText(line, canvas.width / 2, y);
    y += 34;
  }
  if (footer) {
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(footer, canvas.width / 2, canvas.height - 48);
  }
  ctx.restore();
}

export function drawTitle(game) {
  const canvas = game.canvas;
  const ctx = game.ctx;
  menuPanel(ctx, canvas, 'SOLMAR', [
    'V I C E   C O A S T',
    '',
    game.hasSave ? 'ENTER — Continue your story' : 'ENTER — New Game',
    game.hasSave ? 'N — New Game (erases the save)' : '',
    'WASD move / drive   ·   Mouse aim   ·   Click punch or shoot',
    'E enter, steal or buy   ·   Space handbrake   ·   Esc pause   ·   M mute',
    '',
    'Six missions. Twenty sun coins. One city that never sleeps.',
  ], 'A fictional city. No affiliation with any real game or place.');
}

export function drawPause(game) {
  const canvas = game.canvas;
  const ctx = game.ctx;
  menuPanel(ctx, canvas, 'PAUSED', [
    'Esc — resume',
    'R — restart current mission',
    'M — ' + (game.audio.muted ? 'unmute sound' : 'mute sound'),
    'Q — quit to title',
  ], 'Progress saves after every mission.');
}

export function drawOver(game, kind) {
  const canvas = game.canvas;
  const ctx = game.ctx;
  if (kind === 'busted') {
    menuPanel(ctx, canvas, 'BUSTED', [
      'The Solmar PD got you.',
      `Fine: $${game.fine} — the case, if you had one, is gone.`,
      '',
      'ENTER — back on the street',
    ], 'Riko Vale does not stay down for long.');
  } else {
    menuPanel(ctx, canvas, 'WASTED', [
      'Riko is down.',
      `The clinic patched him up — $${game.fine}.`,
      '',
      'ENTER — back on the street',
    ], 'Solmar is still out there.');
  }
}

export function drawMissionCard(game) {
  const card = game.missions.card;
  if (!card) return;
  const ctx = game.ctx;
  const canvas = game.canvas;
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,16,0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c94c';
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillText(`MISSION ${card.mission.id} OF ${MISSIONS.length}`, canvas.width / 2, canvas.height / 2 - 110);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText(card.mission.name.toUpperCase(), canvas.width / 2, canvas.height / 2 - 58);
  ctx.font = '17px ' + FONT;
  const words = card.mission.intro.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).length > 64) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  let y = canvas.height / 2 - 8;
  for (const l of lines) {
    ctx.fillText(l, canvas.width / 2, y);
    y += 26;
  }
  ctx.fillStyle = '#58b368';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText(`Reward: $${card.mission.reward}`, canvas.width / 2, y + 18);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '15px ' + FONT;
  ctx.fillText('Press ENTER to start', canvas.width / 2, y + 56);
  ctx.restore();
}
