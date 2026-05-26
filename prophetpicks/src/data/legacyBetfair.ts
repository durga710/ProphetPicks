export type LegacyEvent = {
  id: string
  league: string
  group: string
  dateLabel: string
  time: string
  home: string
  away: string
  venue: string
}

export type LegacyMarket = {
  id: string
  label: string
  selections: Array<{
    id: string
    label: string
    odds: number
    side: 'Back' | 'Lay'
  }>
}

export type LegacySlipItem = {
  event: LegacyEvent
  market: LegacyMarket
  selection: LegacyMarket['selections'][number]
}

export type LegacyBet = {
  id: string
  match: string
  market: string
  type: string
  stake: string
  price: string
  profitLoss: string
  date: string
}

export type FinanceRow = {
  id: string
  date: string
  method: string
  amount: string
  status: string
}

export const legacyEvents: LegacyEvent[] = [
  {
    id: 'arsenal-barcelona',
    league: 'UEFA Champions League',
    group: 'Group A',
    dateLabel: 'Tuesday, February 16, 2016',
    time: '19:45',
    home: 'Arsenal',
    away: 'FC Barcelona',
    venue: 'Emirates Stadium',
  },
  {
    id: 'roma-real-madrid',
    league: 'UEFA Champions League',
    group: 'Group A',
    dateLabel: 'Tuesday, February 16, 2016',
    time: '19:45',
    home: 'Roma',
    away: 'Real Madrid',
    venue: 'Stadio Olimpico',
  },
  {
    id: 'juventus-bayern',
    league: 'UEFA Champions League',
    group: 'Group B',
    dateLabel: 'Wednesday, February 17, 2016',
    time: '19:45',
    home: 'Juventus',
    away: 'Bayern Munich',
    venue: 'Juventus Stadium',
  },
  {
    id: 'psg-chelsea',
    league: 'UEFA Champions League',
    group: 'Group C',
    dateLabel: 'Wednesday, February 17, 2016',
    time: '19:45',
    home: 'Paris Saint-Germain',
    away: 'Chelsea',
    venue: 'Parc des Princes',
  },
  {
    id: 'benfica-zenit',
    league: 'UEFA Champions League',
    group: 'Group D',
    dateLabel: 'Thursday, February 18, 2016',
    time: '18:00',
    home: 'Benfica',
    away: 'Zenit',
    venue: 'Estadio da Luz',
  },
]

export const legacyMarkets: LegacyMarket[] = [
  {
    id: 'match-odds',
    label: 'Match Odds',
    selections: [
      { id: 'home', label: 'Arsenal', odds: 4, side: 'Back' },
      { id: 'draw', label: 'Draw', odds: 3.6, side: 'Back' },
      { id: 'away', label: 'FC Barcelona', odds: 1.92, side: 'Back' },
    ],
  },
  {
    id: 'to-qualify',
    label: 'To Qualify',
    selections: [
      { id: 'home-qualify', label: 'Arsenal', odds: 4, side: 'Back' },
      { id: 'away-qualify', label: 'FC Barcelona', odds: 1.28, side: 'Back' },
    ],
  },
  {
    id: 'goals-25',
    label: 'More/Less than 2.5 Goals',
    selections: [
      { id: 'over-25', label: 'More than 2.5', odds: 1.74, side: 'Back' },
      { id: 'under-25', label: 'Less than 2.5', odds: 2.18, side: 'Back' },
    ],
  },
  {
    id: 'correct-score',
    label: 'Correct Score',
    selections: [
      { id: 'one-one', label: '1-1', odds: 7.8, side: 'Back' },
      { id: 'one-two', label: '1-2', odds: 8.5, side: 'Back' },
      { id: 'two-one', label: '2-1', odds: 12, side: 'Back' },
    ],
  },
]

export const legacyBets: LegacyBet[] = [
  {
    id: 'bet-1001',
    match: 'Arsenal VS FC Barcelona',
    market: 'To Qualify',
    type: 'Combined',
    stake: '$10.00',
    price: '4.00',
    profitLoss: '+$30.00',
    date: '2016-02-16 19:12',
  },
  {
    id: 'bet-1002',
    match: 'Roma VS Real Madrid',
    market: 'Match Odds',
    type: 'Simple',
    stake: '$25.00',
    price: '1.85',
    profitLoss: '+$21.25',
    date: '2016-02-16 19:24',
  },
  {
    id: 'bet-1003',
    match: 'Juventus VS Bayern Munich',
    market: 'More/Less than 2.5 Goals',
    type: 'Simple',
    stake: '$15.00',
    price: '2.18',
    profitLoss: '-$15.00',
    date: '2016-02-17 18:48',
  },
]

export const legacyDeposits: FinanceRow[] = [
  {
    id: 'dep-771',
    date: '2016-02-14',
    method: 'Account Credit',
    amount: '$20,000.00',
    status: 'Completed',
  },
  {
    id: 'dep-772',
    date: '2016-02-15',
    method: 'Manual Top Up',
    amount: '$500.00',
    status: 'Completed',
  },
]

export const legacyWithdrawals: FinanceRow[] = [
  {
    id: 'wd-331',
    date: '2016-02-18',
    method: 'Bank Transfer',
    amount: '$250.00',
    status: 'Pending review',
  },
  {
    id: 'wd-332',
    date: '2016-02-19',
    method: 'Account Credit',
    amount: '$125.00',
    status: 'Completed',
  },
]
