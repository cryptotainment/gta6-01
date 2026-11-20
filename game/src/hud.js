// HUD, minimap and menus: everything drawn on top of the world. Wanted
// stars, health, cash, the mission card, the message banner, the coins
// counter, the minimap (the whole city scaled down, with the player, police
// blips and the mission marker), and the title / pause / game-over screens.
// All canvas-drawn, system fonts only.

import { WORLD_W, WORLD_H, SEA_Y } from './config.js';
import { objectiveText, missionMarker } from './missions.js';
import { carKmh } from './vehicles.js';

const MINIMAP_W = 210;
const MINIMAP_H = 158;

export function drawHUD(game, ctx) {
  const vw = game.viewW;
  const vh = game.viewH;
  const p = game.player;

  // Top-left: wanted stars + health + cash.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // Stars.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < game.wanted ? '#ffd94d' : 'rgba(255,255,255,0.35)';
    drawStar(ctx, 26 + i * 26, 26, 11);
  }
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(16, 48, 150, 14);
  ctx.fillStyle = p.health > 30 ? '#4caf50' : '#e33f2f';
  ctx.fillRect(18, 50, 146 * Math.max(0, p.health / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 172, 49);
  // Cash.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${p.cash}`, 16, 70);
  // Speed (when driving).
  if (!p.onFoot && p.car) {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${carKmh(p.car)} km/h`, 16, 96);
  }
  // Mission card, top-right.
  const obj = objectiveText(game);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const cardW = Math.min(340, vw - 32);
  ctx.fillRect(vw - cardW - 16, 16, cardW, 54);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 13px sans-serif';
  const missionName = game.missions.active ? game.missions.active.def.name : (game.missions.index >= 7 ? 'Free roam' : 'Solmar');
  ctx.fillText(missionName, vw - cardW, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(obj, vw - cardW, 42);

  // Mission intro card (centre, fades).
  if (game.missions.card) {
    const card = game.missions.card;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(vw / 2 - 260, vh * 0.3, 520, 86);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.title, vw / 2, vh * 0.3 + 16);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    wrapText(ctx, card.text, vw / 2, vh * 0.3 + 44, 480, 18);
    ctx.textAlign = 'left';
  }

  // Message banner, centre.
  if (game.banner && game.banner.t > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(vw / 2 - 220, vh * 0.62, 440, 56);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.banner.text, vw / 2, vh * 0.62 + 10);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(game.banner.sub || '', vw / 2, vh * 0.62 + 32);
    ctx.textAlign = 'left';
  }

  // Bottom-right: sun coins.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(vw - 118, vh - 44, 102, 30);
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(vw - 100, vh - 29, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1e26';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('S', vw - 100, vh - 29);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${p.coins}/20`, vw - 82, vh - 36);

  // Interact hint (bottom-centre).
  const hint = interactHint(game);
  if (hint) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(hint).width + 28;
    ctx.fillRect(vw / 2 - w / 2, vh - 44, w, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hint, vw / 2, vh - 36);
    ctx.textAlign = 'left';
  }

  drawMinimap(game, ctx);
}

function interactHint(game) {
  const p = game.player;
  if (!p.onFoot) return null;
  const it = game.nearestInteractable ? game.nearestInteractable() : null;
  if (it) {
    if (it.kind === 'garage') return 'E — TINT & PAINT (repaint / buy a car)';
    if (it.kind === 'gunShop') return 'E — Gun Shop';
    if (it.kind === 'clinic') return 'E — Clinic (heal)';
    if (it.kind === 'package') return 'E — pick up the package';
    if (it.kind === 'taxi') return 'E — take the taxi fare';
  }
  if (game.nearestCar && game.nearestCar()) return 'E — get in the car';
  return null;
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawMinimap(game, ctx) {
  const vw = game.viewW;
  const vh = game.viewH;
  const mx = vw - MINIMAP_W - 16;
  const my = vh - MINIMAP_H - 16;
  const sx = MINIMAP_W / WORLD_W;
  const sy = MINIMAP_H / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(mx - 4, my - 4, MINIMAP_W + 8, MINIMAP_H + 8);
  // Sea.
  ctx.fillStyle = '#2e6f9e';
  ctx.fillRect(mx, my + SEA_Y * sy, MINIMAP_W, MINIMAP_H - SEA_Y * sy);
  // Land.
  ctx.fillStyle = '#5a6b52';
  ctx.fillRect(mx, my, MINIMAP_W, SEA_Y * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const ax of game.world.avenues) {
    ctx.beginPath();
    ctx.moveTo(mx + ax * sx, my);
    ctx.lineTo(mx + ax * sx, my + SEA_Y * sy);
    ctx.stroke();
  }
  for (const sy2 of game.world.streets) {
    ctx.beginPath();
    ctx.moveTo(mx, my + sy2 * sy);
    ctx.lineTo(mx + MINIMAP_W, my + sy2 * sy);
    ctx.stroke();
  }
  // Mission marker.
  const marker = missionMarker(game);
  if (marker) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1e26';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police blips.
  for (const car of game.police) {
    ctx.fillStyle = '#2f6fe8';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const p = game.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e33f2f';
  ctx.lineWidth = 2;
  ctx.stroke();
  // North.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', mx + 4, my + 12);
}

// Title screen: the game name, New Game / Continue, and the controls.
export function drawTitle(game, ctx) {
  const vw = game.viewW;
  const vh = game.viewH;
  // A warm dusk backdrop: the city from above, darkened.
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#f2c94c';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR', vw / 2, vh * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('— Vice Coast —', vw / 2, vh * 0.3 + 42);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfd8dc';
  ctx.fillText('A driver-for-hire. Six jobs. One city that never sleeps.', vw / 2, vh * 0.3 + 78);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffd94d';
  const hasSave = game.hasSave ? game.hasSave() : false;
  ctx.fillText(hasSave ? 'ENTER — Continue' : 'ENTER — New Game', vw / 2, vh * 0.52);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const lines = [
    'WASD — move / drive    Mouse — aim    Click — shoot',
    'E — get in / steal a car, use a shop    SPACE — handbrake',
    'ESC — pause    M — mute    Steal a car, lose the cops, repaint at TINT & PAINT.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh * 0.66 + i * 26));
  ctx.textAlign = 'left';
}

export function drawPause(game, ctx) {
  const vw = game.viewW;
  const vh = game.viewH;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', vw / 2, vh * 0.32);
  ctx.font = '16px sans-serif';
  const lines = [
    'ESC — resume',
    'R — restart the current mission',
    'M — mute / unmute',
    'Q — quit to the title screen',
    '',
    'WASD move/drive · E enter/steal · SPACE handbrake · Click shoot',
  ];
  lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh * 0.42 + i * 28));
  ctx.textAlign = 'left';
}

export function drawGameOver(game, ctx) {
  const vw = game.viewW;
  const vh = game.viewH;
  ctx.fillStyle = 'rgba(20,0,0,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ff6b5e';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(game.arrested ? 'BUSTED' : 'WASTED', vw / 2, vh * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(game.arrested ? 'The Solmar police took you in.' : 'Riko Vale did not make it.', vw / 2, vh * 0.38 + 34);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ENTER — try again', vw / 2, vh * 0.52);
  ctx.textAlign = 'left';
}
