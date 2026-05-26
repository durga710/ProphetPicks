export type MarketType =
  | 'player_points'
  | 'player_rebounds'
  | 'player_assists'
  | 'player_threes'

export interface PropLeg {
  id: string
  sport: string
  league: string
  eventId: string
  matchup: string
  startsAt: string
  teamId: string
  opponentId: string
  playerId: string
  playerName: string
  marketId: string
  marketType: MarketType
  marketLabel: string
  selectionId: string
  selectionLabel: string
  line: string
  americanOdds: number
  decimalOdds: number
  fairProbability: number
  confidence: 'A' | 'B' | 'C'
  source: string
  oddsUpdatedAt: string
  modelVersion: string
  signals: string[]
  riskNotes: string[]
}
