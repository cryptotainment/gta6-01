// Solmar — Vice Coast: all tuning, districts, landmarks and mission data.
// One place for every number the rest of the game reads, so balancing the game
// never means hunting through the drawing or physics code.

export const WORLD_W = 4800;
export const WORLD_H = 3600;
export const SEA_Y = 3300; // everything below this line is water (the south coast)
export const ROAD_W = 90;

// Avenues run north-south, streets east-west. The grid is the city: every
// address in the game is an avenue/street crossing or a block between them.
export const AVENUES = [600, 1200, 1800, 2400, 3000, 3600, 4200];
export const STREETS = [450, 900, 1350, 1800, 2250, 2700, 3150];

// Five districts, each with its own ground and building palette. The regions
// tile the map: Old Town west, Downtown centre-north, Industrial east,
// Marina south-west on the water, Beach south-east on the sand.
export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1800, y1: 1800, ground: '#c98d5f', building: '#b0703f', roof: '#8f5a30' },
  { name: 'Downtown', x0: 1800, y0: 0, x1: 3600, y1: 1800, ground: '#9aa0a8', building: '#6f7a88', roof: '#525d6b' },
  { name: 'Industrial', x0: 3600, y0: 0, x1: 4800, y1: 1800, ground: '#a87f5a', building: '#7d6248', roof: '#5f4a36' },
  { name: 'Marina', x0: 0, y0: 1800, x1: 2400, y1: 3300, ground: '#7fa8b8', building: '#5d8296', roof: '#476374' },
  { name: 'Beach', x0: 2400, y0: 1800, x1: 4800, y1: 3300, ground: '#e0c98f', building: '#c2a86b', roof: '#a68d55' },
];

export const COLORS = {
  road: '#3d3d46',
  roadLine: '#d8d8c8',
  sidewalk: '#b9b9ae',
  sea: '#2e6f9e',
  seaDeep: '#245a82',
  sand: '#e0c98f',
  dock: '#8a6b45',
  boat: '#f2f2ea',
  tree: '#3f7a3a',
  treeDark: '#2f5c2c',
  lamp: '#e8e4d0',
  player: '#e33f2f',
  playerDark: '#a82a1e',
  ped: '#f0d0a0',
  coin: '#f2c94c',
  coinDark: '#c9a227',
  marker: '#ffd94d',
  package: '#ff9d2e',
};

export const CAR_TYPES = {
  sedan: { maxSpeed: 330, accel: 300, brake: 520, turn: 2.6, length: 44, width: 22, colors: ['#4a6fa5', '#7a4a8f', '#5a8f5a', '#a55a4a'] },
  sport: { maxSpeed: 470, accel: 420, brake: 620, turn: 3.1, length: 46, width: 21, colors: ['#f2c94c', '#e33f2f', '#2fb3a8'] },
  taxi: { maxSpeed: 350, accel: 320, brake: 540, turn: 2.7, length: 44, width: 22, colors: ['#f2c94c'] },
  police: { maxSpeed: 430, accel: 400, brake: 640, turn: 3.0, length: 46, width: 22, colors: ['#1c1e26'] },
  truck: { maxSpeed: 250, accel: 210, brake: 420, turn: 2.0, length: 58, width: 24, colors: ['#8a6b45', '#6b7a8f'] },
};

export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 240,
  radius: 13,
  health: 100,
  punchRange: 34,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 420,
  pistolPrice: 200,
  ammoPrice: 50,
  ammoPack: 30,
  healPrice: 30,
  repaintPrice: 50,
  ownedCarPrice: 500,
};

export const WANTED = {
  max: 5,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  speedPastPolice: 1,
  loseSightSeconds: 8,
  decaySeconds: 4,
  arrestHoldSeconds: 2,
};

// Named places the missions and the HUD point at. All on or beside a road.
export const LANDMARKS = {
  garage: { x: 900, y: 2700, name: 'TINT & PAINT' },
  gunShop: { x: 2100, y: 1200, name: 'Gun Shop' },
  clinic: { x: 2700, y: 2700, name: 'Clinic' },
  bank: { x: 2400, y: 900, name: 'Solmar Bank' },
  marina: { x: 800, y: 3350, name: 'Marina' },
  clientPickup: { x: 600, y: 600, name: 'Client' },
  fareDropoff: { x: 4200, y: 2700, name: 'Dropoff' },
  sportsCar: { x: 3600, y: 1350, name: 'Sports car' },
  informantA: { x: 600, y: 900, name: 'Package A' },
  informantB: { x: 1200, y: 1350, name: 'Package B' },
  informantC: { x: 900, y: 1800, name: 'Package C' },
  beachStart: { x: 4200, y: 3150, name: 'Beach start' },
  beachEnd: { x: 600, y: 3150, name: 'Beach end' },
  getawayStart: { x: 1800, y: 1350, name: 'Getaway start' },
};

export const MISSIONS = [
  {
    id: 1, name: 'First Fare', reward: 120,
    intro: 'A client needs a ride across town. Pick them up and drive them to the beach.',
    type: 'driveTo', target: 'fareDropoff', start: 'clientPickup',
  },
  {
    id: 2, name: 'Hot Wheels', reward: 250,
    intro: 'Steal the yellow sports car parked in the Industrial district and bring it to the garage.',
    type: 'deliverCar', target: 'garage', carAt: 'sportsCar',
  },
  {
    id: 3, name: 'Beach Run', reward: 300,
    intro: 'Timed delivery along the coast road. Get from the east end to the west end before the clock runs out.',
    type: 'timed', target: 'beachEnd', start: 'beachStart', timeLimit: 75,
  },
  {
    id: 4, name: 'The Informant', reward: 350,
    intro: 'On foot. Collect three packages around Old Town and stay out of the patrols.',
    type: 'collect', targets: ['informantA', 'informantB', 'informantC'],
  },
  {
    id: 5, name: 'Getaway', reward: 450,
    intro: 'Three stars on you. Lose the cops, then repaint the car at TINT & PAINT.',
    type: 'escape', target: 'garage', startWanted: 3,
  },
  {
    id: 6, name: 'The Solmar Job', reward: 1000,
    intro: 'Pick up the bank job at Solmar Bank, then deliver it to the marina. The whole city will be after you.',
    type: 'deliverCar', target: 'marina', start: 'bank', startWanted: 2,
  },
];

export const COIN_COUNT = 20;
export const COIN_VALUE = 25;
export const STUNT_VALUE = 20;
export const FARE_MIN = 30;
export const FARE_MAX = 80;

// Ramps for stunt jumps: a low wedge on a straight road.
export const RAMPS = [
  { x: 2400, y: 3150, angle: 0 },
  { x: 1200, y: 2250, angle: Math.PI / 2 },
  { x: 3600, y: 900, angle: Math.PI },
];
