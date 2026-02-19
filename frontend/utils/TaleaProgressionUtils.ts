/**
 * TaleaProgressionUtils.ts
 * Shared utilities for level, ranks and progression labels.
 */

export const PROGRESSION_RANKS = [
    { minXP: 0, name: 'Anfänger' },
    { minXP: 20, name: 'Lehrling' },
    { minXP: 40, name: 'Geselle' },
    { minXP: 60, name: 'Meister' },
    { minXP: 80, name: 'Legende' },
    { minXP: 110, name: 'Legende+' },
    { minXP: 145, name: 'Veteran' },
    { minXP: 190, name: 'Ikone' },
];

export function getRankForValue(value: number): string {
    let currentRank = PROGRESSION_RANKS[0].name;
    for (const rank of PROGRESSION_RANKS) {
        if (value >= rank.minXP) {
            currentRank = rank.name;
        } else {
            break;
        }
    }
    return currentRank;
}

export function getNextRankProgress(value: number): { nextRankName: string | null; progress: number } {
    let currentIdx = 0;
    for (let i = 0; i < PROGRESSION_RANKS.length; i++) {
        if (value >= PROGRESSION_RANKS[i].minXP) {
            currentIdx = i;
        } else {
            break;
        }
    }

    const currentRank = PROGRESSION_RANKS[currentIdx];
    const nextRank = PROGRESSION_RANKS[currentIdx + 1];

    if (!nextRank) {
        return { nextRankName: null, progress: 100 };
    }

    const range = nextRank.minXP - currentRank.minXP;
    const currentInOffset = value - currentRank.minXP;
    const progress = Math.min(100, Math.max(0, (currentInOffset / range) * 100));

    return { nextRankName: nextRank.name, progress };
}
