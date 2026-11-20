// Drawing Solmar: the canvas render. Ground per district, the road grid with
// lane markings, buildings with roofs and shadows, the south coast (sea,
// sand, docks, boats), cars, pedestrians, the player, bullets, particles and
// the sunset wash for the marina finale. Everything is code-drawn vector
// shapes and gradients — no images, no network, no fonts beyond the system
// stack. The camera follows the player; the world is drawn in world
// coordinates and the HUD is drawn on top by hud.js.

import { WORLD_W, WORLD_H, SEA_Y, ROAD_W, DISTRICTS, COLORS } from './config.js';

export function render(game, ctx) {
  const cam = game.camera;
  const vw = game.viewW;
  const vh = game.viewH;
  ctx.save();
  // Screen shake: a small random offset while it lasts (seeded by the game
  // clock so a staged shot is stable).
  if (game.shake > 0) {
    const s = game.shake;
    ctx.translate((game.rng() - 0.5) * s * 2, (game.rng() - 0.5) * s * 2);
  }
  const viewX = cam.x - vw / 2;
  const viewY = cam.y - vh / 2;
  // Shift the world so the camera centre lands in the middle of the canvas.
  // Everything below is drawn in world coordinates; the HUD is drawn
  // separately in screen coordinates.
  ctx.translate(-viewX, -viewY);

  drawGround(game, ctx, viewX, viewY, vw, vh);
  drawRoads(game, ctx, viewX, viewY, vw, vh);
  drawDocks(game, ctx);
  drawBuildings(game, ctx, viewX, viewY, vw, vh);
  drawProps(game, ctx);
  drawCoins(game, ctx);
  drawRamps(game, ctx);
  drawLandmarks(game, ctx);
  drawCars(game, ctx);
  drawPeds(game, ctx);
  drawPlayer(game, ctx);
  drawBullets(game, ctx);
  drawParticles(game, ctx);
  drawMissionMarker(game, ctx);

  // Sunset wash for the marina finale: a warm gradient over everything.
  if (game.sunset) {
    const grad = ctx.createLinearGradient(0, viewY, 0, viewY + vh);
    grad.addColorStop(0, 'rgba(255, 140, 60, 0.10)');
    grad.addColorStop(0.6, 'rgba(255, 110, 60, 0.16)');
    grad.addColorStop(1, 'rgba(255, 80, 40, 0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(viewX, viewY, vw, vh);
    // Low sun on the water.
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(viewX + vw * 0.72, SEA_Y + 120, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 217, 77, 0.35)';
    ctx.beginPath();
    ctx.arc(viewX + vw * 0.72, SEA_Y + 120, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGround(game, ctx, viewX, viewY, vw, vh) {
  // District ground, drawn as big rectangles clipped to the view.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
  }
  // Sea along the whole south edge.
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(viewX, SEA_Y, vw, WORLD_H - SEA_Y);
  // Wave lines on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = SEA_Y + 40; y < WORLD_H; y += 70) {
    ctx.beginPath();
    for (let x = viewX - (viewX % 90); x < viewX + vw + 90; x += 90) {
      const wave = Math.sin((x + y * 3) * 0.02) * 6;
      if (x === viewX - (viewX % 90)) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  // Sand strip along the coast.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(viewX, SEA_Y - 46, vw, 46);
}

function drawRoads(game, ctx, viewX, viewY, vw, vh) {
  const world = game.world;
  ctx.fillStyle = COLORS.road;
  for (const ax of world.avenues) {
    ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, SEA_Y);
  }
  for (const sy of world.streets) {
    ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  }
  // Pavement edge: a lighter border on each road.
  ctx.fillStyle = COLORS.sidewalk;
  for (const ax of world.avenues) {
    ctx.fillRect(ax - ROAD_W / 2 - 8, 0, 8, SEA_Y);
    ctx.fillRect(ax + ROAD_W / 2, 0, 8, SEA_Y);
  }
  for (const sy of world.streets) {
    ctx.fillRect(0, sy - ROAD_W / 2 - 8, WORLD_W, 8);
    ctx.fillRect(0, sy + ROAD_W / 2, WORLD_W, 8);
  }
  // Dashed centre lines.
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const ax of world.avenues) {
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, SEA_Y);
    ctx.stroke();
  }
  for (const sy of world.streets) {
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(WORLD_W, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawDocks(game, ctx) {
  for (const dock of game.world.docks) {
    ctx.fillStyle = COLORS.dock;
    ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let y = dock.y + 18; y < dock.y + dock.h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(dock.x, y);
      ctx.lineTo(dock.x + dock.w, y);
      ctx.stroke();
    }
  }
  for (const boat of game.world.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = COLORS.boat;
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.len / 2, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e6f9e';
    ctx.fillRect(-boat.len / 4, -4, boat.len / 2, 8);
    ctx.restore();
  }
}

function drawBuildings(game, ctx, viewX, viewY, vw, vh) {
  for (const b of game.world.buildings) {
    if (b.x > viewX + vw || b.x + b.w < viewX || b.y > viewY + vh || b.y + b.h < viewY) continue;
    // Shadow offset by the building's height.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + b.height * 0.4, b.y + b.height * 0.4, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // A lighter roof edge.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Windows: a few lit dots on the roof face.
    ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 3 + b.x) % 5 === 0) {
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 30, 8, 6);
        }
      }
    }
  }
}

function drawProps(game, ctx) {
  for (const p of game.world.props) {
    if (p.kind === 'tree') {
      ctx.fillStyle = COLORS.treeDark;
      ctx.beginPath();
      ctx.arc(p.x + 3, p.y + 4, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.tree;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.fillStyle = COLORS.lamp;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCoins(game, ctx) {
  for (const coin of game.world.coins) {
    if (coin.taken) continue;
    ctx.fillStyle = COLORS.coinDark;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', coin.x, coin.y + 0.5);
  }
}

function drawRamps(game, ctx) {
  for (const ramp of game.world.ramps) {
    ctx.save();
    ctx.translate(ramp.x, ramp.y);
    ctx.rotate(ramp.angle);
    ctx.fillStyle = '#e8e4d0';
    ctx.beginPath();
    ctx.moveTo(-34, 16);
    ctx.lineTo(34, 16);
    ctx.lineTo(34, -10);
    ctx.lineTo(-34, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e33f2f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JUMP', 0, 2);
    ctx.restore();
  }
}

function drawLandmarks(game, ctx) {
  const marks = [
    { x: 900, y: 2700, label: 'TINT & PAINT', color: '#2fb3a8' },
    { x: 2100, y: 1200, label: 'GUN SHOP', color: '#e33f2f' },
    { x: 2700, y: 2700, label: 'CLINIC', color: '#4b8fe8' },
    { x: 2400, y: 900, label: 'BANK', color: '#f2c94c' },
  ];
  for (const m of marks) {
    ctx.fillStyle = m.color;
    ctx.fillRect(m.x - 34, m.y - 14, 68, 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.label, m.x, m.y + 0.5);
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 7);
  ctx.fill();
  // Roof + windshield.
  ctx.fillStyle = 'rgba(20, 24, 34, 0.85)';
  roundRect(ctx, -car.length / 4, -car.width / 2 + 4, car.length / 2.2, car.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 220, 255, 0.7)';
  ctx.fillRect(car.length / 4 - 2, -car.width / 2 + 5, 5, car.width - 10);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(car.length / 2 - 3, -car.width / 2 + 3, 3, 5);
  ctx.fillRect(car.length / 2 - 3, car.width / 2 - 8, 3, 5);
  // Police light bar.
  if (car.isPolice) {
    ctx.fillStyle = '#e33f2f';
    ctx.fillRect(-6, -car.width / 2 + 2, 6, 5);
    ctx.fillStyle = '#2f6fe8';
    ctx.fillRect(0, -car.width / 2 + 2, 6, 5);
  }
  // Taxi sign.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1c1e26';
    ctx.fillRect(-8, -5, 16, 10);
    ctx.fillStyle = '#f2c94c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 1);
  }
  ctx.restore();
}

function drawCars(game, ctx) {
  for (const car of game.cars) {
    // The player's car is drawn under the player marker; draw it here too
    // so it shows when the player is driving.
    drawCarShape(ctx, car);
  }
}

function drawPeds(game, ctx) {
  for (const ped of game.peds) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(ped.x + 2, ped.y + 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.police ? '#1c1e26' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0d0a0';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.police) {
      ctx.fillStyle = '#2f6fe8';
      ctx.fillRect(ped.x - 6, ped.y - 11, 12, 3);
    }
    if (ped.taxi) {
      ctx.fillStyle = '#f2c94c';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', ped.x, ped.y - 14);
    }
  }
}

function drawPlayer(game, ctx) {
  const p = game.player;
  if (!p.onFoot) {
    // Driving: a white ring around the player's car.
    if (p.car) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.car.x, p.car.y, p.car.length / 2 + 8, p.car.width / 2 + 10, p.car.angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 3, 13, 0, Math.PI * 2);
  ctx.fill();
  // Riko: red jacket, dark trousers, facing the aim direction.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.playerDark;
  ctx.fillRect(-4, -8, 8, 16);
  ctx.fillStyle = '#f0d0a0';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun in hand when armed.
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#1c1e26';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
  // Punch flash.
  if (p.punchCd > 0.12) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets(game, ctx) {
  for (const b of game.bullets) {
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(game, ctx) {
  for (const pt of game.particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(game, ctx) {
  const marker = game.missionMarker ? game.missionMarker() : null;
  if (!marker) return;
  // A pulsing diamond + a vertical beam so the target reads from far away.
  const pulse = 1 + Math.sin(game.time * 4) * 0.15;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COLORS.marker;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(12, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1c1e26';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 217, 77, 0.14)';
  ctx.fillRect(marker.x - 3, marker.y - 400, 6, 400);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Keep the camera centred on the player, clamped to the city.
export function updateCamera(game) {
  const p = game.player;
  const vw = game.viewW;
  const vh = game.viewH;
  game.camera.x = Math.max(vw / 2, Math.min(WORLD_W - vw / 2, p.x));
  game.camera.y = Math.max(vh / 2, Math.min(WORLD_H - vh / 2, p.y));
}
