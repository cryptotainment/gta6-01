// SOLMAR — Vice Coast. Every tuning number, colour and story beat in one place.
// The world is a fixed 4800x3600 city; the renderer scales the camera to the window,
// so no rule below depends on the screen size.

export const STEP = 1 / 60; // fixed simulation step, seconds

export const WORLD = { w: 4800, h: 3600 };
export const ROAD_W = 110;
export const ROADS_X = [400, 1200, 2000, 2800, 3600, 4400];
export const ROADS_Y = [400, 1200, 2000, 2800];
export const SEA_WEST = 120; // x < 120 is the sea along the beach
export const SEA_SOUTH = 3440; // y > 3440 is the marina water

// Districts, by region. Each has a ground colour, a building palette and a name.
export const DISTRICTS = [
  { id: 'beach', name: 'Solmar Beach', x0: 0, y0: 0, x1: 800, y1: 3600, ground: '#e8d5a0', building: ['#f2e3bb', '#e6cf96', '#d9b878'] },
  { id: 'marina', name: 'Marina', x0: 0, y0: 3000, x1: 4800, y1: 3600, ground: '#b9d6e2', building: ['#dfeef5', '#c8dfe9', '#a9cfe0'] },
  { id: 'downtown', name: 'Downtown', x0: 1600, y0: 800, x1: 3200, y1: 2000, ground: '#9aa0a8', building: ['#7d8590', '#6b7280', '#8b939e', '#5f6b7a'] },
  { id: 'oldtown', name: 'Old Town', x0: 3200, y0: 0, x1: 4800, y1: 1600, ground: '#d9a06b', building: ['#c98a52', '#b97a45', '#dba878'] },
  { id: 'industrial', name: 'The Yards', x0: 3200, y0: 2000, x1: 4800, y1: 3600, ground: '#8a7a68', building: ['#7a6a58', '#6b5d4f', '#94806c'] },
  { id: 'suburb', name: 'Palm Heights', x0: 0, y0: 0, x1: 4800, y1: 3600, ground: '#a8b89a', building: ['#c9b18c', '#b5a37e', '#d4c4a0'] },
];

export const PALETTE = {
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#d8d3a8',
  sidewalk: '#b9b3a4',
  sea: '#2f7fa8',
  seaDeep: '#256b8f',
  sand: '#e8d5a0',
  grass: '#7d9b6a',
  player: '#f2c94c',
  police: '#2f6fd0',
  text: '#f4f1e6',
  muted: '#c9c4b2',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58b368',
  banner: '#14161c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-vice-coast.save.v1';

// Car types: top speed, acceleration, handling (steer rate), colour sets.
export const CAR_TYPES = {
  sedan: { max: 430, accel: 380, steer: 2.5, len: 52, wid: 26, colors: ['#c94f42', '#4f7ec9', '#c9c9c9', '#5a6b52'] },
  sport: { max: 580, accel: 520, steer: 3.1, len: 54, wid: 26, colors: ['#f2c94c', '#e5534b', '#1f9d8a'] },
  taxi: { max: 410, accel: 360, steer: 2.5, len: 52, wid: 26, colors: ['#f2b705'] },
  van: { max: 350, accel: 300, steer: 2.1, len: 62, wid: 28, colors: ['#8a8f98', '#b0b5bd'] },
  police: { max: 540, accel: 500, steer: 3.0, len: 54, wid: 26, colors: ['#2f6fd0'] },
};

export const PLAYER = {
  walkSpeed: 235,
  radius: 15,
  hp: 100,
  punchRange: 52,
  punchDamage: 25,
  pistolDamage: 34,
  bulletSpeed: 920,
  bulletRange: 520,
};

export const WANTED = {
  max: 5,
  // police cars on the street per level
  carsPerLevel: [0, 1, 2, 3, 4, 4],
  // seconds with no police in sight before the level drops by one
  coolDown: 7,
  sightRange: 620,
  // seconds a slow police car must stay touching an on-foot player to arrest
  arrestTime: 1.6,
};

export const PRICES = {
  pistol: 200,
  ammo: 50,
  ammoRounds: 24,
  medkit: 60,
  sportscar: 800,
  repaint: 150,
  taxiMin: 40,
  taxiMax: 120,
  coin: 25,
  stunt: 50,
  bustFine: 200,
  deathFine: 100,
};

// Fixed landmarks, by name. Missions, shops and garages all point here.
export const LANDMARKS = {
  taxiStand: { x: 2000, y: 2000, label: 'Taxi Stand' },
  beachHotel: { x: 560, y: 1800, label: 'Palmera Hotel' },
  sportCar: { x: 3600, y: 800, label: 'Sports Car' },
  garage: { x: 1200, y: 2800, label: 'TINT & PAINT' },
  bank: { x: 2400, y: 1200, label: 'Solmar Bank' },
  marinaDrop: { x: 800, y: 3200, label: 'Marina Dock' },
  gunShop: { x: 2800, y: 2000, label: 'Ironworks Guns' },
  clinic: { x: 2000, y: 1200, label: 'St. Mara Clinic' },
  carShop: { x: 3600, y: 2400, label: 'Vice Motors' },
  policeStation: { x: 2800, y: 400, label: 'Solmar PD' },
  rampBeach: { x: 400, y: 2800, label: 'Beach Ramp' },
  rampDowntown: { x: 2000, y: 400, label: 'Downtown Ramp' },
  informantA: { x: 2800, y: 400, label: 'Package 1' },
  informantB: { x: 3600, y: 800, label: 'Package 2' },
  informantC: { x: 3200, y: 1200, label: 'Package 3' },
  beachCp1: { x: 400, y: 800, label: 'Checkpoint 1' },
  beachCp2: { x: 400, y: 1800, label: 'Checkpoint 2' },
  beachCp3: { x: 400, y: 2800, label: 'Checkpoint 3' },
  spawn: { x: 2000, y: 2060, label: 'Riko Vale' },
};

// The six chained missions. Each step is one objective:
// goto (reach a marker), collect (reach each point in `points`), timed
// (reach every point before `time` runs out), escape (lose the wanted level),
// repaint (drive into the garage while wanted).
export const MISSIONS = [
  {
    id: 1, name: 'First Fare', reward: 150,
    intro: 'Riko Vale, driver for hire. A client waits at the taxi stand — get them to the Palmera Hotel on the beach, and mind the traffic.',
    steps: [
      { type: 'goto', x: 2000, y: 2000, r: 70, label: 'Pick up the client at the Taxi Stand' },
      { type: 'goto', x: 560, y: 1800, r: 80, label: 'Drive the client to the Palmera Hotel' },
    ],
  },
  {
    id: 2, name: 'Hot Wheels', reward: 300,
    intro: 'A collector in Old Town wants a yellow sports car — the one parked by the plaza. Take it. The owner will not be pleased.',
    steps: [
      { type: 'goto', x: 3600, y: 800, r: 80, label: 'Find the yellow sports car in Old Town' },
      { type: 'goto', x: 1200, y: 2800, r: 90, label: 'Deliver the car to TINT & PAINT' },
    ],
  },
  {
    id: 3, name: 'Beach Run', reward: 400,
    intro: 'A courier run down the coast road. Three checkpoints, seventy-five seconds, and the beach traffic is not slowing down for you.',
    steps: [
      { type: 'timed', time: 75, points: [{ x: 400, y: 800 }, { x: 400, y: 1800 }, { x: 400, y: 2800 }], label: 'Hit all 3 beach checkpoints in time' },
    ],
  },
  {
    id: 4, name: 'The Informant', reward: 350,
    intro: 'Three packages stashed around Old Town, and the PD is patrolling. On foot, quiet, and do not let them see you pick anything up.',
    steps: [
      { type: 'collect', points: [{ x: 2800, y: 400 }, { x: 3600, y: 800 }, { x: 3200, y: 1200 }], label: 'Collect the 3 packages on foot' },
    ],
  },
  {
    id: 5, name: 'Getaway', reward: 500,
    intro: 'The job went loud. Three stars and every unit in the city is coming. Lose them, then get the car repainted at TINT & PAINT.',
    steps: [
      { type: 'escape', label: 'Lose the police (wanted level to zero)' },
      { type: 'repaint', x: 1200, y: 2800, r: 90, label: 'Repaint the car at TINT & PAINT' },
    ],
  },
  {
    id: 6, name: 'The Solmar Job', reward: 1000,
    intro: 'The big one. Lift the case from Solmar Bank and run it to the marina dock. Four stars the moment you touch it. Make it count.',
    steps: [
      { type: 'goto', x: 2400, y: 1200, r: 80, label: 'Pick up the case at Solmar Bank' },
      { type: 'goto', x: 800, y: 3200, r: 90, label: 'Deliver the case to the Marina Dock' },
    ],
  },
];

export const COIN_COUNT = 20;
export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 34;
export const TAXI_FARE_TIME = 60;
