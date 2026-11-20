// SOLMAR — Vice Coast. Saving: missions done, cash, sun coins, the car Riko
// owns, and the mute setting — in localStorage, so the start screen can offer
// Continue. Nothing leaves the browser.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const p = game.player;
    const data = {
      cash: p.cash,
      missionsDone: p.missionsDone,
      missionIndex: game.missions.index,
      coins: game.world.coins.filter((c) => c.taken).map((c) => c.id),
      ownedType: p.ownedCar ? p.ownedCar.type : null,
      weapon: p.weapon,
      ammo: p.ammo,
      muted: game.audio.muted,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // A browser that refuses storage just plays without saving.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}
