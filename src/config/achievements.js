/**
 * achievements.js — All achievement badge definitions.
 *
 * badgeId must match the uint8 used in the smart contract.
 * condition is for display only — actual unlock logic is in the contract.
 */

export const ACHIEVEMENTS = [
  {
    id: 0,
    name: 'FIRST BLOOD',
    description: 'Submit your first score to Base',
    icon: '🚀',
    color: '#00f0ff',
    condition: 'Submit any score > 0',
  },
  {
    id: 1,
    name: 'SECTOR ACE',
    description: 'Defeat a boss and win a sector',
    icon: '⚔️',
    color: '#39ff14',
    condition: 'Win (boss defeated)',
  },
  {
    id: 2,
    name: 'HIGH ROLLER',
    description: 'Score 5,000 or more in a single run',
    icon: '💎',
    color: '#ff007f',
    condition: 'score >= 5000',
  },
  {
    id: 3,
    name: 'LEGENDARY PILOT',
    description: 'Score 15,000 or more in a single run',
    icon: '🌟',
    color: '#ffea00',
    condition: 'score >= 15000',
  },
  {
    id: 4,
    name: 'DAILY DEVOTEE',
    description: 'Check in 3 days in a row',
    icon: '📅',
    color: '#cc44ff',
    condition: 'checkInStreak >= 3',
  },
  {
    id: 5,
    name: 'GALAXY BRAIN',
    description: 'Reach Sector 9 in a single run',
    icon: '🧠',
    color: '#ff6600',
    condition: 'level >= 9',
  },
];

/** Look up an achievement by its contract badge ID */
export const getAchievement = (id) =>
  ACHIEVEMENTS.find((a) => a.id === id) ?? null;

/** Decode a bitmask into an array of earned achievement objects */
export const decodeAchievements = (bitmask) => {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if ((BigInt(bitmask) >> BigInt(a.id)) & 1n) {
      earned.push(a);
    }
  }
  return earned;
};

/** Check if a specific badge is earned from a bitmask */
export const hasAchievement = (bitmask, id) =>
  ((BigInt(bitmask) >> BigInt(id)) & 1n) === 1n;
