// World layout, progression and creature statistics.

export const WORLD_W = 7200;
export const WORLD_H = 1800;

export const ZONES = [
  {
    id: 'garden', index: 0, x0: 0, x1: 1800, require: 0, palette: 'garden',
    name: 'The Garden', line: 'where everything begins, small and warm',
    spawns: { nectar: 26, aphid: 12, mite: 7, fly: 3, caterpillar: 2 },
    puddles: 9,
  },
  {
    id: 'meadow', index: 1, x0: 1800, x1: 3600, require: 1, palette: 'meadow',
    name: 'The Wild Meadow', line: 'golden, wind-combed, full of wings',
    spawns: { nectar: 22, aphid: 5, fly: 9, caterpillar: 7, moth: 4, spider: 2 },
    puddles: 9,
  },
  {
    id: 'edge', index: 2, x0: 3600, x1: 5400, require: 2, palette: 'edge',
    name: 'The Forest Edge', line: 'cool shade, wet moss, a hundred eyes',
    spawns: { nectar: 14, caterpillar: 3, moth: 4, spider: 5, wasp: 4, centipede: 3 },
    puddles: 8,
  },
  {
    id: 'deep', index: 3, x0: 5400, x1: 7200, require: 3, palette: 'deep',
    name: 'The Deep Wood', line: 'old roots, green light, something sleeping',
    spawns: { nectar: 10, moth: 3, spider: 4, wasp: 5, centipede: 5 },
    puddles: 7,
  },
];

export const STAGES = [
  {
    name: 'Larva', numeral: 'I', hp: 60, r: 9, speed: 136, bite: 7, cadence: 0.34,
    trait: 'Soft-bodied and overlooked. Everything is bigger than you.',
    hungerDrain: 0.62, thirstDrain: 0.7, dash: false,
  },
  {
    name: 'Nymph', numeral: 'II', hp: 94, r: 11, speed: 174, bite: 12, cadence: 0.32,
    trait: 'Six legs and sudden speed. The garden is a road now.',
    hungerDrain: 0.7, thirstDrain: 0.8, dash: true,
  },
  {
    name: 'Beetle', numeral: 'III', hp: 148, r: 14, speed: 198, bite: 22, cadence: 0.33,
    trait: 'A lacquered shell. Prey that used to be weather is now food.',
    hungerDrain: 0.8, thirstDrain: 0.9, dash: true,
  },
  {
    name: 'Stag Beetle', numeral: 'IV', hp: 208, r: 19, speed: 220, bite: 38, cadence: 0.34,
    trait: 'Antlered jaws. Even the spiders take a step back.',
    hungerDrain: 0.9, thirstDrain: 1.0, dash: true,
  },
  {
    name: 'Sovereign', numeral: 'V', hp: 292, r: 25, speed: 242, bite: 58, cadence: 0.35,
    trait: 'Winged, crowned, and very hard to kill. The wood notices.',
    hungerDrain: 1.0, thirstDrain: 1.08, dash: true,
  },
];

export const MOLT_COST = [30, 95, 215, 430];
export const FLOWER_RESPAWN = [13, 22];

export const TYPES = {
  aphid: {
    name: 'Aphid', tier: 0, r: 6, hp: 9, speed: 44, burst: 74, biomass: 4, hunger: 8, thirst: 2,
    threat: 0, aggro: 0, respawn: 9, wander: 50, color: '#b6c983',
  },
  mite: {
    name: 'Mite', tier: 0, r: 5, hp: 7, speed: 58, burst: 88, biomass: 3, hunger: 5, thirst: 1,
    threat: 0, aggro: 0, respawn: 8, wander: 70, color: '#b07a5f',
  },
  fly: {
    name: 'Fly', tier: 1, r: 7, hp: 16, speed: 92, burst: 198, biomass: 8, hunger: 9, thirst: 2,
    threat: 0, aggro: 0, respawn: 11, wander: 120, color: '#59605c',
  },
  caterpillar: {
    name: 'Caterpillar', tier: 1, r: 10, hp: 32, speed: 28, burst: 44, biomass: 12, hunger: 17, thirst: 3,
    threat: 0, aggro: 0, respawn: 14, wander: 25, color: '#a8b86a',
  },
  moth: {
    name: 'Moth', tier: 2, r: 10, hp: 36, speed: 96, burst: 216, biomass: 17, hunger: 12, thirst: 3,
    threat: 0, aggro: 0, respawn: 15, wander: 100, color: '#d6cfb1',
  },
  spider: {
    name: 'Wolf Spider', tier: 2, r: 13, hp: 62, speed: 112, burst: 150, biomass: 23, hunger: 12, thirst: 4,
    threat: 7, aggro: 285, respawn: 20, wander: 60, color: '#6b5847',
  },
  wasp: {
    name: 'Wasp', tier: 3, r: 12, hp: 88, speed: 156, burst: 232, biomass: 34, hunger: 11, thirst: 4,
    threat: 10, aggro: 340, respawn: 24, wander: 120, color: '#d2ab4e',
  },
  centipede: {
    name: 'Centipede', tier: 3, r: 17, hp: 105, speed: 110, burst: 152, biomass: 31, hunger: 15, thirst: 5,
    threat: 9, aggro: 260, respawn: 24, wander: 55, color: '#b06c4e',
  },
  mantis: {
    name: 'Mantis Queen', tier: 4, r: 30, hp: 430, speed: 148, burst: 560, biomass: 120, hunger: 25, thirst: 10,
    threat: 17, aggro: 640, respawn: 0, wander: 70, color: '#7d9b62', boss: true,
  },
};

export function pathY(x) {
  return 880
    + Math.sin(x * 0.00105) * 150
    + Math.sin(x * 0.00043 + 1.9) * 105
    + Math.sin(x * 0.0026 + 0.6) * 26;
}

export function zoneIndexAt(x) {
  for (let i = ZONES.length - 1; i >= 0; i--) {
    if (x >= ZONES[i].x0) return i;
  }
  return 0;
}

export function zoneAt(x) { return ZONES[zoneIndexAt(x)]; }

export const BARRIERS = ZONES.slice(0, 3).map((z, i) => ({
  x: z.x1,
  require: ZONES[i + 1].require,
  next: ZONES[i + 1],
}));

export function isOnPath(x, y, width = 260) {
  return Math.abs(y - pathY(x)) < width;
}
