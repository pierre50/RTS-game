type GameDifficultyId = 'easy' | 'medium' | 'hard'

export type GameDifficultyCombatBalance = {
  enemyAttackEnergyCostMultiplier: number
  playerDamageDealtMultiplier: number
  playerDamageReceivedMultiplier: number
}

const GAME_DIFFICULTY_COMBAT_BALANCE: Record<GameDifficultyId, GameDifficultyCombatBalance> = {
  easy: {
    enemyAttackEnergyCostMultiplier: 2,
    playerDamageDealtMultiplier: 2,
    playerDamageReceivedMultiplier: 0.5,
  },
  medium: {
    enemyAttackEnergyCostMultiplier: 1,
    playerDamageDealtMultiplier: 1,
    playerDamageReceivedMultiplier: 1,
  },
  hard: {
    enemyAttackEnergyCostMultiplier: 0.8,
    playerDamageDealtMultiplier: 0.75,
    playerDamageReceivedMultiplier: 1.35,
  },
}

export function getGameDifficultyCombatBalance(difficulty?: string | null): GameDifficultyCombatBalance {
  return GAME_DIFFICULTY_COMBAT_BALANCE[difficulty as GameDifficultyId] ?? GAME_DIFFICULTY_COMBAT_BALANCE.medium
}
