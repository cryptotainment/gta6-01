// SOLMAR — Vice Coast. Everything the camera sees: the sea and sand, the five
// districts, the road grid, buildings with roofs and shadows, palms and lamps,
// cars, pedestrians, Riko, bullets and particles, and the sunset light of the
// marina finale. The HUD and menus live in hud.js.

import { WORLD, ROAD_W, ROADS_X, ROADS_Y, SEA_WEST, SEA_SOUTH, PALETTE, DISTRICTS } from './config.js';
import { districtAt } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, view, world, sunset) {
  // Land first: district ground colours, painted in district order.
  for (const d of DISTRICTS) {
    ctx.fillStyle = sunset && d.id === 'beach' ? '#f0c98a' : d.ground;
    ctx.fillRect(Math.max(view.x0, d.x0), Math.max(view.y0, d.y0), Math.min(view.x1, d.x1) - Math.max(view.x0, d.x0), Math.min(view.y1, d.y1) - Math.max(view.y0, d.y0));
  }
  // Beach sand along the west edge.
  ctx.fillStyle = sunset ? '#f0c98a' : PALETTE.sand;
  ctx.fillRect(Math.max(view.x0, SEA_WEST), view.y0, Math.min(view.x1, 800) - Math.max(view.x0, SEA_WEST), view.y1 - view.y0);
  // The sea, over the land: the west strip and the marina water in the south.
  ctx.fillStyle = sunset ? '#e07840' : PALETTE.sea;
  ctx.fillRect(view.x0, view.y0, Math.min(view.x1, SEA_WEST) - view.x0, view.y1 - view.y0);
  ctx.fillRect(view.x0, Math.max(view.y0, SEA_SOUTH), view.x1 - view.x0, view.y1 - Math.max(view.y0, SEA_SOUTH));
  ctx.fillStyle = sunset ? '#f2a35e' : PALETTE.seaDeep;
  ctx.fillRect(view.x0, Math.max(view.y0, SEA_SOUTH), view.x1 - view.x0, view.y1 - Math.max(view.y0, SEA_SOUTH));
  // Sea shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let y = 3520; y < WORLD.h; y += 46) {
    if (y < view.y0 || y > view.y1) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(view.x0, 0), y);
    ctx.lineTo(Math.min(view.x1, WORLD.w), y);
    ctx.stroke();
  }
}

function drawRoads(ctx, view) {
  // Sidewalks: a pale band wider than the asphalt.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 18, view.y0, ROAD_W + 36, view.y1 - view.y0);
  for (const ry of ROADS_Y) ctx.fillRect(view.x0, ry - ROAD_W / 2 - 18, view.x1 - view.x0, ROAD_W + 36);
  // Asphalt.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, view.y0, ROAD_W, view.y1 - view.y0);
  for (const ry of ROADS_Y) ctx.fillRect(view.x0, ry - ROAD_W / 2, view.x1 - view.x0, ROAD_W);
  // Centre dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(rx, view.y0);
    ctx.lineTo(rx, view.y1);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(view.x0, ry);
    ctx.lineTo(view.x1, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildings(ctx, view, world, sunset) {
  for (const b of world.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    // Shadow falls to the south-east; longer at sunset.
    const sh = sunset ? 26 : 10;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof detail.
    if (b.roof === 'pool') {
      ctx.fillStyle = '#5fb2d9';
      ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.3, b.w * 0.5, b.h * 0.4);
    } else if (b.roof === 'garden') {
      ctx.fillStyle = '#6f9e5a';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 10, b.y + 10, 18, 14);
      ctx.fillRect(b.x + b.w - 28, b.y + b.h - 24, 18, 14);
    }
    // Downtown towers get glass lines.
    if (b.district.id === 'downtown') {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      for (let x = b.x + 16; x < b.x + b.w - 8; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, b.y + 6);
        ctx.lineTo(x, b.y + b.h - 6);
        ctx.stroke();
      }
    }
  }
}

function drawProps(ctx, view, world) {
  for (const p of world.props) {
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
    if (p.kind === 'palm') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(p.x + 5, p.y + 6, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 8);
      ctx.lineTo(p.x, p.y - 8);
      ctx.stroke();
      ctx.fillStyle = '#3f8f4f';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * 10, p.y - 10 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(p.x - 2, p.y - 10, 4, 20);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 11, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'bench') {
      ctx.fillStyle = '#7a5c38';
      ctx.fillRect(p.x - 12, p.y - 4, 24, 8);
    } else if (p.kind === 'hydrant') {
      ctx.fillStyle = '#c94f42';
      ctx.fillRect(p.x - 4, p.y - 6, 8, 12);
    } else if (p.kind === 'dock') {
      // A wooden pier reaching south into the marina water.
      ctx.fillStyle = '#8a6a42';
      ctx.fillRect(p.x - 14, p.y - 20, 28, 130);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      for (let y = p.y - 10; y < p.y + 100; y += 18) {
        ctx.beginPath();
        ctx.moveTo(p.x - 14, y);
        ctx.lineTo(p.x + 14, y);
        ctx.stroke();
      }
    } else if (p.kind === 'boat') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#f4f1e6';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f6fd0';
      ctx.fillRect(-8, -14, 16, 12);
      ctx.restore();
    }
  }
}

function drawZones(ctx, view, world, game) {
  // TINT & PAINT garage: a marked bay with a sign.
  const g = world.garage;
  if (g.x > view.x0 - 200 && g.x < view.x1 + 200 && g.y > view.y0 - 200 && g.y < view.y1 + 200) {
    ctx.fillStyle = 'rgba(47,111,208,0.16)';
    ctx.fillRect(g.x - 90, g.y - 60, 180, 120);
    ctx.strokeStyle = '#2f6fd0';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(g.x - 90, g.y - 60, 180, 120);
    ctx.setLineDash([]);
    ctx.fillStyle = '#2f6fd0';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TINT & PAINT', g.x, g.y - 70);
  }
  // Shops: small signs over their doors.
  for (const shop of world.shops) {
    if (shop.x < view.x0 - 100 || shop.x > view.x1 + 100 || shop.y < view.y0 - 100 || shop.y > view.y1 + 100) continue;
    ctx.fillStyle = 'rgba(20,22,28,0.75)';
    roundRect(ctx, shop.x - 62, shop.y - 52, 124, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shop.label, shop.x, shop.y - 37);
  }
  // Stunt ramps.
  for (const ramp of world.ramps) {
    ctx.save();
    ctx.translate(ramp.x, ramp.y);
    ctx.rotate(ramp.angle);
    ctx.fillStyle = '#f2b705';
    ctx.beginPath();
    ctx.moveTo(-34, 18);
    ctx.lineTo(0, -18);
    ctx.lineTo(34, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#14161c';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JUMP', 0, 34);
    ctx.restore();
  }
  // Sun coins.
  for (const coin of world.coins) {
    if (coin.taken) continue;
    if (coin.x < view.x0 || coin.x > view.x1 || coin.y < view.y0 || coin.y > view.y1) continue;
    const pulse = 1 + Math.sin(game.time * 4 + coin.id) * 0.12;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 11 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87f0a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a87f0a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☀', coin.x, coin.y + 5);
  }
}

function drawCar(ctx, car, game, isPlayer) {
  const spec = { len: car.len, wid: car.wid };
  ctx.save();
  ctx.translate(car.x, car.y);
  // Airborne cars rise: the shadow stays on the ground, the body lifts.
  const lift = car.airborne > 0 ? (1 - car.airborne / 0.9) * 26 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(0, 4, spec.len / 2, spec.wid / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -lift);
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#14161c';
  const wl = spec.len / 2 - 8;
  const ww = spec.wid / 2 + 1;
  ctx.fillRect(-wl - 6, -ww - 2, 12, 5);
  ctx.fillRect(wl - 6, -ww - 2, 12, 5);
  ctx.fillRect(-wl - 6, ww - 3, 12, 5);
  ctx.fillRect(wl - 6, ww - 3, 12, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, -spec.len / 2 + 12, -spec.wid / 2 + 5, spec.len / 2 - 6, spec.wid - 10, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.75)';
  roundRect(ctx, spec.len / 2 - 16, -spec.wid / 2 + 4, 8, spec.wid - 8, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(spec.len / 2 - 2, -spec.wid / 2 + 3, 3, 5);
  ctx.fillRect(spec.len / 2 - 2, spec.wid / 2 - 8, 3, 5);
  if (car.type === 'police') {
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(-6, -spec.wid / 2 + 2, 12, spec.wid - 4);
    const flash = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f6fd0';
    ctx.beginPath();
    ctx.arc(-2, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#2f6fd0' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(6, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#14161c';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  // Damage smoke.
  if (car.hp < 45) {
    ctx.fillStyle = `rgba(120,120,120,${0.5 - car.hp / 120})`;
    ctx.beginPath();
    ctx.arc(-spec.len / 4, -spec.wid / 4, 8 + Math.sin(game.time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, -spec.len / 2 - 4, -spec.wid / 2 - 4, spec.len + 8, spec.wid + 8, 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawPed(ctx, ped, game) {
  ctx.save();
  ctx.translate(ped.x, ped.y + Math.sin(ped.bob) * 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerOnFoot(ctx, game) {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // Riko: yellow jacket, dark jeans, facing his aim.
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2f38';
  ctx.fillRect(6, -5, 10, 10);
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#14161c';
    ctx.fillRect(8, -2, 14, 4);
  }
  ctx.restore();
  if (game.muzzle > 0) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function render(game) {
  const ctx = game.ctx;
  const canvas = game.canvas;
  const cam = game.camera;
  const sunset = game.sunset;
  const view = {
    x0: cam.x - canvas.width / 2 - 40,
    y0: cam.y - canvas.height / 2 - 40,
    x1: cam.x + canvas.width / 2 + 40,
    y1: cam.y + canvas.height / 2 + 40,
  };
  ctx.save();
  // Camera: centre on the player, with shake while things explode.
  const shx = game.shake > 0 ? (game.rng() - 0.5) * game.shake * 22 : 0;
  const shy = game.shake > 0 ? (game.rng() - 0.5) * game.shake * 22 : 0;
  ctx.translate(canvas.width / 2 - cam.x + shx, canvas.height / 2 - cam.y + shy);
  drawGround(ctx, view, game.world, sunset);
  drawRoads(ctx, view);
  drawBuildings(ctx, view, game.world, sunset);
  drawProps(ctx, view, game.world);
  drawZones(ctx, view, game.world, game);
  // Mission marker: a pulsing beacon the player can see from anywhere nearby.
  const obj = game.currentObjective;
  if (obj && !obj.escape) {
    const pulse = 1 + Math.sin(game.time * 5) * 0.15;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // A guiding line from the player to the marker when it is far.
    const pd = Math.hypot(obj.x - game.player.x, obj.y - game.player.y);
    if (pd > 700) {
      ctx.strokeStyle = 'rgba(242,201,76,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(game.player.x, game.player.y);
      ctx.lineTo(obj.x, obj.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Taxi fare pedestrian, marked.
  if (game.taxi && game.taxi.state === 'waiting') {
    const t = game.taxi.ped;
    ctx.fillStyle = '#f2b705';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 22, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14161c';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', t.x, t.y - 18);
  }
  // Cars: parked first, then traffic, then police, then the player's.
  for (const car of game.parkedCars) if (car.hp > 0) drawCar(ctx, car, game, false);
  for (const car of game.traffic) if (car.hp > 0) drawCar(ctx, car, game, false);
  for (const car of game.policeCars) drawCar(ctx, car, game, false);
  if (game.player.ownedCar && game.player.ownedCar !== game.player.car) drawCar(ctx, game.player.ownedCar, game, false);
  if (game.player.car) drawCar(ctx, game.player.car, game, true);
  // Pedestrians, foot cops, Riko.
  for (const ped of game.peds) drawPed(ctx, ped, game);
  for (const cop of game.footCops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (game.player.onFoot) drawPlayerOnFoot(ctx, game);
  // Bullets and particles.
  for (const b of game.bullets) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Sunset wash over the whole frame.
  if (sunset) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(224,120,64,0.10)');
    grad.addColorStop(1, 'rgba(224,120,64,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
