// Save and continue: progress (missions done, cash, sun coins, owned car)
// lives in localStorage under one key. Nothing else is stored, and loading a
// save never touches the world seed — the city is always the same city.

const SAVE_KEY = 'solmar-save-v1';

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      version: 1,
      missionsDone: p.missionsDone,
      cash: p.cash,
      coins: p.coins,
      ownedCar: !!p.ownedCar,
      weapon: p.weapon,
      ammo: p.ammo,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function applySave(game, data) {
  if (!data) return;
  const p = game.player;
  p.missionsDone = data.missionsDone || 0;
  p.cash = data.cash || 0;
  p.coins = data.coins || 0;
  p.ownedCar = !!data.ownedCar;
  p.weapon = data.weapon || null;
  p.ammo = data.ammo || 0;
  game.missions.index = (data.missionsDone || 0) + 1;
  game.missions.done = [];
  for (let i = 1; i <= (data.missionsDone || 0); i += 1) game.missions.done.push(i);
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Storage may be unavailable (private mode); the game still runs.
  }
}
