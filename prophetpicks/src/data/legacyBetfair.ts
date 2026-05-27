export type SportKey =
  | 'nfl'
  | 'nba'
  | 'mlb'
  | 'nhl'
  | 'soccer'
  | 'ncaaf'
  | 'ncaab'
  | 'tennis'
  | 'golf'
  | 'ufc'
  | 'boxing'
  | 'f1'
  | 'cricket'
  | 'esports'

export type LegacyTeam = {
  id: string
  sport: SportKey
  sportLabel: string
  league: string
  name: string
  code: string
  primary: string
  secondary: string
  /**
   * Optional URL to a real team logo, e.g. `/team-logos/chiefs.png`.
   * Drop a licensed/public-domain image into `public/team-logos/` and wire it
   * up here. When absent, the UI renders the abstracted gradient + monogram
   * crest. Logos are NOT shipped in the repo for trademark reasons.
   */
  logoUrl?: string
}

export type SportDefinition = {
  key: SportKey
  label: string
  family: string
  title: string
  groups: string[]
}

export type LegacyEvent = {
  id: string
  sport: SportKey
  sportLabel: string
  league: string
  group: string
  dateLabel: string
  time: string
  home: string
  homeCode: string
  homePrimary: string
  homeSecondary: string
  homeLogoUrl?: string
  away: string
  awayCode: string
  awayPrimary: string
  awaySecondary: string
  awayLogoUrl?: string
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

export type LegacyPrediction = {
  id: string
  rank: number
  eventId: string
  marketId: string
  selectionId: string
  confidence: 'A' | 'B' | 'C'
  edge: number
  risk: 'Low' | 'Medium' | 'High'
  reason: string
}

export type ResolvedPrediction = LegacyPrediction & {
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
  status: string
}

export type FinanceRow = {
  id: string
  date: string
  method: string
  amount: string
  status: string
}

export type LedgerRow = {
  id: string
  date: string
  description: string
  debit: string
  credit: string
  balance: string
}

export const sports: SportDefinition[] = [
  {
    key: 'nfl',
    label: 'NFL',
    family: 'Football',
    title: 'NFL',
    groups: ['AFC', 'NFC', 'Primetime', 'Props', 'Futures', 'SGP'],
  },
  {
    key: 'nba',
    label: 'NBA',
    family: 'Basketball',
    title: 'NBA',
    groups: ['East', 'West', 'Props', 'Totals', 'Futures', 'SGP'],
  },
  {
    key: 'mlb',
    label: 'MLB',
    family: 'Baseball',
    title: 'MLB',
    groups: ['AL', 'NL', 'Run Line', 'Totals', 'Futures', 'Props'],
  },
  {
    key: 'nhl',
    label: 'NHL',
    family: 'Hockey',
    title: 'NHL',
    groups: ['East', 'West', 'Puck Line', 'Totals', 'Futures', 'Props'],
  },
  {
    key: 'soccer',
    label: 'Soccer',
    family: 'Soccer',
    title: 'UEFA Champions League',
    groups: ['Group A', 'Group B', 'Group C', 'Group D', 'Group F', 'Group G', 'Group H', 'Bets'],
  },
  {
    key: 'ncaaf',
    label: 'NCAAF',
    family: 'Football',
    title: 'College Football',
    groups: ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Playoff', 'Props'],
  },
  {
    key: 'ncaab',
    label: 'NCAAB',
    family: 'Basketball',
    title: 'College Basketball',
    groups: ['Top 25', 'ACC', 'Big 12', 'Big Ten', 'SEC', 'Props'],
  },
  {
    key: 'tennis',
    label: 'Tennis',
    family: 'Tennis',
    title: 'ATP/WTA',
    groups: ['ATP', 'WTA', 'Grand Slam', 'Sets', 'Games', 'Futures'],
  },
  {
    key: 'golf',
    label: 'Golf',
    family: 'Golf',
    title: 'PGA Tour',
    groups: ['Winner', 'Top 5', 'Top 10', 'Matchups', 'Round Props', 'Futures'],
  },
  {
    key: 'ufc',
    label: 'UFC',
    family: 'MMA',
    title: 'UFC',
    groups: ['Main Card', 'Prelims', 'Method', 'Rounds', 'Props', 'Futures'],
  },
  {
    key: 'boxing',
    label: 'Boxing',
    family: 'Combat',
    title: 'Boxing',
    groups: ['Main Event', 'Method', 'Rounds', 'Props', 'Futures'],
  },
  {
    key: 'f1',
    label: 'Formula 1',
    family: 'Racing',
    title: 'Formula 1',
    groups: ['Race Winner', 'Podium', 'Qualifying', 'Constructors', 'Futures'],
  },
  {
    key: 'cricket',
    label: 'Cricket',
    family: 'Cricket',
    title: 'International Cricket',
    groups: ['Match Winner', 'Runs', 'Wickets', 'Series', 'Futures'],
  },
  {
    key: 'esports',
    label: 'Esports',
    family: 'Esports',
    title: 'Esports',
    groups: ['LoL', 'CS2', 'Valorant', 'Dota 2', 'Maps', 'Futures'],
  },
]

export const legacyTeams: LegacyTeam[] = [
  team('chiefs', 'nfl', 'NFL', 'Kansas City Chiefs', 'KC', '#e31837', '#ffb81c'),
  team('bills', 'nfl', 'NFL', 'Buffalo Bills', 'BUF', '#00338d', '#c60c30'),
  team('niners', 'nfl', 'NFL', 'San Francisco 49ers', 'SF', '#aa0000', '#b3995d'),
  team('eagles', 'nfl', 'NFL', 'Philadelphia Eagles', 'PHI', '#004c54', '#a5acaf'),
  team('lakers', 'nba', 'NBA', 'Los Angeles Lakers', 'LAL', '#552583', '#fdb927'),
  team('celtics', 'nba', 'NBA', 'Boston Celtics', 'BOS', '#007a33', '#ba9653'),
  team('warriors', 'nba', 'NBA', 'Golden State Warriors', 'GSW', '#1d428a', '#ffc72c'),
  team('knicks', 'nba', 'NBA', 'New York Knicks', 'NYK', '#006bb6', '#f58426'),
  team('yankees', 'mlb', 'MLB', 'New York Yankees', 'NYY', '#132448', '#c4ced4'),
  team('dodgers', 'mlb', 'MLB', 'Los Angeles Dodgers', 'LAD', '#005a9c', '#ffffff'),
  team('braves', 'mlb', 'MLB', 'Atlanta Braves', 'ATL', '#13274f', '#ce1141'),
  team('cubs', 'mlb', 'MLB', 'Chicago Cubs', 'CHC', '#0e3386', '#cc3433'),
  team('leafs', 'nhl', 'NHL', 'Toronto Maple Leafs', 'TOR', '#00205b', '#ffffff'),
  team('bruins', 'nhl', 'NHL', 'Boston Bruins', 'BOS', '#000000', '#ffb81c'),
  team('rangers', 'nhl', 'NHL', 'New York Rangers', 'NYR', '#0038a8', '#ce1126'),
  team('avalanche', 'nhl', 'NHL', 'Colorado Avalanche', 'COL', '#6f263d', '#236192'),
  team('arsenal', 'soccer', 'UEFA Champions League', 'Arsenal', 'ARS', '#d71920', '#f7f7f7'),
  team('barcelona', 'soccer', 'UEFA Champions League', 'FC Barcelona', 'BAR', '#a50044', '#004d98'),
  team('roma', 'soccer', 'UEFA Champions League', 'Roma', 'ROM', '#8e1f2f', '#f0bc42'),
  team('real-madrid', 'soccer', 'UEFA Champions League', 'Real Madrid', 'RMA', '#f7f7f7', '#c7a13b'),
  team('juventus', 'soccer', 'UEFA Champions League', 'Juventus', 'JUV', '#111111', '#f5f5f5'),
  team('bayern', 'soccer', 'UEFA Champions League', 'Bayern Munich', 'BAY', '#dc052d', '#0066b2'),
  team('psg', 'soccer', 'UEFA Champions League', 'Paris Saint-Germain', 'PSG', '#004170', '#da291c'),
  team('chelsea', 'soccer', 'UEFA Champions League', 'Chelsea', 'CHE', '#034694', '#d1d3d4'),
  team('benfica', 'soccer', 'UEFA Champions League', 'Benfica', 'BEN', '#e32636', '#f1c232'),
  team('zenit', 'soccer', 'UEFA Champions League', 'Zenit', 'ZEN', '#0097d7', '#ffffff'),
  team('georgia', 'ncaaf', 'College Football', 'Georgia Bulldogs', 'UGA', '#ba0c2f', '#000000'),
  team('alabama', 'ncaaf', 'College Football', 'Alabama Crimson Tide', 'ALA', '#9e1b32', '#ffffff'),
  team('michigan', 'ncaaf', 'College Football', 'Michigan Wolverines', 'MICH', '#00274c', '#ffcb05'),
  team('ohio-state', 'ncaaf', 'College Football', 'Ohio State Buckeyes', 'OSU', '#bb0000', '#666666'),
  team('duke', 'ncaab', 'College Basketball', 'Duke Blue Devils', 'DUKE', '#003087', '#ffffff'),
  team('kansas', 'ncaab', 'College Basketball', 'Kansas Jayhawks', 'KU', '#0051ba', '#e8000d'),
  team('unc', 'ncaab', 'College Basketball', 'North Carolina Tar Heels', 'UNC', '#7bafd4', '#ffffff'),
  team('uconn', 'ncaab', 'College Basketball', 'UConn Huskies', 'CONN', '#000e2f', '#ffffff'),
  team('alcaraz', 'tennis', 'ATP/WTA', 'Carlos Alcaraz', 'CAR', '#c8102e', '#ffcd00'),
  team('sinner', 'tennis', 'ATP/WTA', 'Jannik Sinner', 'SIN', '#008c45', '#f4f5f0'),
  team('scheffler', 'golf', 'PGA Tour', 'Scottie Scheffler', 'SCH', '#1f7a4d', '#e7f0ff'),
  team('mcilroy', 'golf', 'PGA Tour', 'Rory McIlroy', 'RORY', '#005eb8', '#ffffff'),
  team('makhachev', 'ufc', 'UFC', 'Islam Makhachev', 'ISL', '#111111', '#d6b35a'),
  team('oliveira', 'ufc', 'UFC', 'Charles Oliveira', 'CHA', '#009739', '#fedd00'),
  team('crawford', 'boxing', 'Boxing', 'Terence Crawford', 'BUD', '#2b2d42', '#ef233c'),
  team('canelo', 'boxing', 'Boxing', 'Canelo Alvarez', 'CAN', '#006847', '#ce1126'),
  team('verstappen', 'f1', 'Formula 1', 'Max Verstappen', 'VER', '#1e41ff', '#ff1e00'),
  team('hamilton', 'f1', 'Formula 1', 'Lewis Hamilton', 'HAM', '#00d2be', '#111111'),
  team('india-cricket', 'cricket', 'International Cricket', 'India', 'IND', '#1c5aa6', '#ff9933'),
  team('australia-cricket', 'cricket', 'International Cricket', 'Australia', 'AUS', '#004b3a', '#ffcd00'),
  team('t1', 'esports', 'Esports', 'T1', 'T1', '#e4002b', '#111111'),
  team('geng', 'esports', 'Esports', 'Gen.G', 'GEN', '#aa8a00', '#111111'),
]

export const legacyEvents: LegacyEvent[] = [
  event('arsenal-barcelona', 'soccer', 'Group A', 'Tuesday, February 16, 2016', '19:45', 'arsenal', 'barcelona', 'Emirates Stadium'),
  event('roma-real-madrid', 'soccer', 'Group A', 'Tuesday, February 16, 2016', '19:45', 'roma', 'real-madrid', 'Stadio Olimpico'),
  event('juventus-bayern', 'soccer', 'Group B', 'Wednesday, February 17, 2016', '19:45', 'juventus', 'bayern', 'Juventus Stadium'),
  event('psg-chelsea', 'soccer', 'Group C', 'Wednesday, February 17, 2016', '19:45', 'psg', 'chelsea', 'Parc des Princes'),
  event('benfica-zenit', 'soccer', 'Group D', 'Thursday, February 18, 2016', '18:00', 'benfica', 'zenit', 'Estadio da Luz'),
  event('chiefs-bills', 'nfl', 'AFC', 'Sunday, September 7, 2026', '20:20', 'chiefs', 'bills', 'Arrowhead Stadium'),
  event('niners-eagles', 'nfl', 'NFC', 'Sunday, September 7, 2026', '16:25', 'niners', 'eagles', 'Levi Stadium'),
  event('lakers-celtics', 'nba', 'National TV', 'Tuesday, October 21, 2026', '22:00', 'lakers', 'celtics', 'Crypto.com Arena'),
  event('warriors-knicks', 'nba', 'Interconference', 'Wednesday, October 22, 2026', '19:30', 'warriors', 'knicks', 'Chase Center'),
  event('yankees-dodgers', 'mlb', 'Interleague', 'Friday, April 3, 2026', '19:05', 'yankees', 'dodgers', 'Yankee Stadium'),
  event('braves-cubs', 'mlb', 'National League', 'Saturday, April 4, 2026', '14:20', 'braves', 'cubs', 'Truist Park'),
  event('leafs-bruins', 'nhl', 'Atlantic', 'Thursday, October 8, 2026', '19:00', 'leafs', 'bruins', 'Scotiabank Arena'),
  event('rangers-avalanche', 'nhl', 'Cross Conference', 'Friday, October 9, 2026', '21:00', 'rangers', 'avalanche', 'Madison Square Garden'),
  event('georgia-alabama', 'ncaaf', 'SEC', 'Saturday, September 19, 2026', '19:30', 'georgia', 'alabama', 'Sanford Stadium'),
  event('michigan-ohio-state', 'ncaaf', 'Big Ten', 'Saturday, November 28, 2026', '12:00', 'michigan', 'ohio-state', 'Michigan Stadium'),
  event('duke-kansas', 'ncaab', 'Top 25', 'Tuesday, November 10, 2026', '21:30', 'duke', 'kansas', 'Madison Square Garden'),
  event('unc-uconn', 'ncaab', 'Top 25', 'Wednesday, November 11, 2026', '19:00', 'unc', 'uconn', 'Dean Smith Center'),
  event('alcaraz-sinner', 'tennis', 'ATP', 'Friday, June 5, 2026', '10:00', 'alcaraz', 'sinner', 'Court Philippe-Chatrier'),
  event('scheffler-mcilroy', 'golf', 'Matchups', 'Thursday, April 9, 2026', '09:20', 'scheffler', 'mcilroy', 'Augusta National'),
  event('makhachev-oliveira', 'ufc', 'Main Card', 'Saturday, August 15, 2026', '22:30', 'makhachev', 'oliveira', 'T-Mobile Arena'),
  event('crawford-canelo', 'boxing', 'Main Event', 'Saturday, September 12, 2026', '23:00', 'crawford', 'canelo', 'Allegiant Stadium'),
  event('verstappen-hamilton', 'f1', 'Race Winner', 'Sunday, July 5, 2026', '09:00', 'verstappen', 'hamilton', 'Silverstone Circuit'),
  event('india-australia', 'cricket', 'ODI', 'Sunday, March 15, 2026', '05:00', 'india-cricket', 'australia-cricket', 'Melbourne Cricket Ground'),
  event('t1-geng', 'esports', 'LoL', 'Saturday, May 30, 2026', '08:00', 't1', 'geng', 'LoL Park'),
]

export const legacyBets: LegacyBet[] = [
  bet('bet-1001', 'Arsenal VS FC Barcelona', 'To Qualify', 'Combined', '$10.00', '4.00', '+$30.00', '2016-02-16 19:12', 'Settled Mock'),
  bet('bet-1002', 'Roma VS Real Madrid', 'Match Odds', 'Simple', '$25.00', '1.85', '+$21.25', '2016-02-16 19:24', 'Settled Mock'),
  bet('bet-1003', 'Juventus VS Bayern Munich', 'More/Less than 2.5 Goals', 'Simple', '$15.00', '2.18', '-$15.00', '2016-02-17 18:48', 'Settled Mock'),
]

export const legacyDeposits: FinanceRow[] = [
  { id: 'dep-771', date: '2016-02-14', method: 'Account Credit', amount: '$20,000.00', status: 'Completed' },
  { id: 'dep-772', date: '2016-02-15', method: 'Manual Top Up', amount: '$500.00', status: 'Completed' },
]

export const legacyWithdrawals: FinanceRow[] = [
  { id: 'wd-331', date: '2016-02-18', method: 'Bank Transfer', amount: '$250.00', status: 'Pending review' },
  { id: 'wd-332', date: '2016-02-19', method: 'Account Credit', amount: '$125.00', status: 'Completed' },
]

export const legacyLedger: LedgerRow[] = [
  { id: 'ledger-1', date: '2016-02-14', description: 'Opening mock bankroll', debit: '-', credit: '$20,000.00', balance: '$20,000.00' },
  { id: 'ledger-2', date: '2016-02-16', description: 'Mock bet settlement', debit: '-', credit: '$30.00', balance: '$20,030.00' },
]

export const legacyPredictions: LegacyPrediction[] = [
  prediction(
    'pick-chiefs-moneyline',
    1,
    'chiefs-bills',
    'moneyline',
    'home-moneyline',
    'A',
    6.8,
    'Low',
    'Mahomes off the bye at Arrowhead in primetime is about as good a spot as you can buy. Buffalo travels cross-country on a short week and was already down two starting safeties last drill. Take the Chiefs to control this one start-to-finish.',
  ),
  prediction(
    'pick-lakers-moneyline',
    2,
    'lakers-celtics',
    'moneyline',
    'home-moneyline',
    'A',
    5.9,
    'Medium',
    'LeBron and AD are both fully healthy out of the break, and Boston is on the back end of a road back-to-back. Crypto.com gets loud after halftime and the Lakers shoot the lights out at home this year. Side with LA.',
  ),
  prediction(
    'pick-arsenal-moneyline',
    3,
    'arsenal-barcelona',
    'match-odds',
    'home',
    'A',
    4.7,
    'Medium',
    'Arsenal has not dropped a point at the Emirates in this competition all year, and Barcelona is leaning on a patchwork back four with two centerbacks suspended. Expect the Gunners to grab the early goal and squeeze the second half.',
  ),
  prediction(
    'pick-leafs-moneyline',
    4,
    'leafs-bruins',
    'moneyline',
    'home-moneyline',
    'B',
    3.9,
    'Medium',
    'Auston Matthews is on a five-game point streak and Boston is playing its third in four nights. Toronto wins the first-period shot share by a country mile when these two get together. Lean Leafs at home.',
  ),
  prediction(
    'pick-yankees-moneyline',
    5,
    'yankees-dodgers',
    'moneyline',
    'home-moneyline',
    'B',
    3.4,
    'High',
    'Cole takes the mound off a bullpen day and the Dodgers lineup has gone ice cold against righties this road trip. Wind is blowing in at the Stadium tonight too. It is the right side but not a hammer.',
  ),
  prediction(
    'pick-alcaraz-winner',
    6,
    'alcaraz-sinner',
    'winner',
    'home-winner',
    'C',
    2.8,
    'High',
    'Carlos has won four of their last five on clay and Sinner has been managing a wrist niggle since Madrid. Alcaraz served huge in his quarter. Risk is high because Jannik is still Jannik on this surface, but it is the right side.',
  ),
]

export function getSport(key: SportKey): SportDefinition {
  return sports.find((sport) => sport.key === key) ?? sports[0]
}

export function getEventsForSport(key: SportKey): LegacyEvent[] {
  return legacyEvents.filter((eventItem) => eventItem.sport === key)
}

export function getTeamsForSport(key: SportKey): LegacyTeam[] {
  return legacyTeams.filter((teamItem) => teamItem.sport === key)
}

export function getResolvedPredictions(): ResolvedPrediction[] {
  return legacyPredictions
    .map((predictionItem) => {
      const eventItem = legacyEvents.find((event) => event.id === predictionItem.eventId)

      if (!eventItem) {
        return null
      }

      const marketItem = getMarketsForEvent(eventItem).find(
        (marketOption) => marketOption.id === predictionItem.marketId,
      )
      const selectionItem = marketItem?.selections.find(
        (selectionOption) => selectionOption.id === predictionItem.selectionId,
      )

      if (!marketItem || !selectionItem) {
        return null
      }

      return {
        ...predictionItem,
        event: eventItem,
        market: marketItem,
        selection: selectionItem,
      }
    })
    .filter((predictionItem): predictionItem is ResolvedPrediction => Boolean(predictionItem))
    .sort((first, second) => first.rank - second.rank)
}

export function getMarketsForEvent(eventItem: LegacyEvent): LegacyMarket[] {
  if (eventItem.sport === 'soccer') {
    return [
      market('match-odds', 'Match Odds', [
        selection('home', eventItem.home, 4),
        selection('draw', 'Draw', 3.6),
        selection('away', eventItem.away, 1.92),
      ]),
      market('to-qualify', 'To Qualify', [
        selection('home-qualify', eventItem.home, 4),
        selection('away-qualify', eventItem.away, 1.28),
      ]),
      market('goals-25', 'More/Less than 2.5 Goals', [
        selection('over-25', 'More than 2.5', 1.74),
        selection('under-25', 'Less than 2.5', 2.18),
      ]),
      market('correct-score', 'Correct Score', [
        selection('one-one', '1-1', 7.8),
        selection('one-two', '1-2', 8.5),
        selection('two-one', '2-1', 12),
      ]),
    ]
  }

  if (eventItem.sport === 'nfl') {
    return [
      market('moneyline', 'Moneyline', [
        selection('home-moneyline', eventItem.home, 1.74),
        selection('away-moneyline', eventItem.away, 2.16),
      ]),
      market('spread', 'Spread', [
        selection('home-spread', `${eventItem.home} -2.5`, 1.91),
        selection('away-spread', `${eventItem.away} +2.5`, 1.91),
      ]),
      market('total', 'Total', [
        selection('over-total', 'Over 47.5', 1.89),
        selection('under-total', 'Under 47.5', 1.93),
      ]),
      market('player-props', 'Player Props', [
        selection('qb-passing', `${eventItem.homeCode} QB over 255.5 passing yards`, 1.87),
        selection('wr-receiving', `${eventItem.awayCode} WR over 64.5 receiving yards`, 1.95),
      ]),
    ]
  }

  if (['nba', 'ncaab'].includes(eventItem.sport)) {
    return [
      market('moneyline', 'Moneyline', [
        selection('home-moneyline', eventItem.home, 1.82),
        selection('away-moneyline', eventItem.away, 2.02),
      ]),
      market('spread', 'Spread', [
        selection('home-spread', `${eventItem.home} -4.5`, 1.9),
        selection('away-spread', `${eventItem.away} +4.5`, 1.92),
      ]),
      market('total', 'Total', [
        selection('over-total', 'Over 224.5', 1.91),
        selection('under-total', 'Under 224.5', 1.91),
      ]),
      market('player-props', 'Player Props', [
        selection('points-prop', 'Star player over 28.5 points', 1.86),
        selection('rebounds-prop', 'Center over 10.5 rebounds', 1.94),
      ]),
    ]
  }

  if (['mlb', 'nhl'].includes(eventItem.sport)) {
    return [
      market('moneyline', 'Moneyline', [
        selection('home-moneyline', eventItem.home, 1.8),
        selection('away-moneyline', eventItem.away, 2.05),
      ]),
      market(eventItem.sport === 'mlb' ? 'run-line' : 'puck-line', eventItem.sport === 'mlb' ? 'Run Line' : 'Puck Line', [
        selection('home-line', `${eventItem.home} -1.5`, 2.35),
        selection('away-line', `${eventItem.away} +1.5`, 1.62),
      ]),
      market('total', 'Total', [
        selection('over-total', eventItem.sport === 'mlb' ? 'Over 8.5' : 'Over 5.5', 1.9),
        selection('under-total', eventItem.sport === 'mlb' ? 'Under 8.5' : 'Under 5.5', 1.92),
      ]),
      market('props', 'Props', [
        selection('primary-prop', eventItem.sport === 'mlb' ? 'Home runs over 1.5' : 'Anytime goal scorer', 2.2),
        selection('secondary-prop', eventItem.sport === 'mlb' ? 'Pitcher strikeouts over 6.5' : 'Shots on goal over 3.5', 1.88),
      ]),
    ]
  }

  return [
    market('winner', 'Winner', [
      selection('home-winner', eventItem.home, 1.84),
      selection('away-winner', eventItem.away, 2.04),
    ]),
    market('handicap', 'Handicap', [
      selection('home-handicap', `${eventItem.homeCode} handicap`, 1.91),
      selection('away-handicap', `${eventItem.awayCode} handicap`, 1.91),
    ]),
    market('total', 'Total', [
      selection('over-total', 'Over market total', 1.9),
      selection('under-total', 'Under market total', 1.92),
    ]),
    market('futures', 'Futures', [
      selection('championship', `${eventItem.homeCode} outright`, 8.5),
      selection('podium', `${eventItem.awayCode} top finish`, 3.25),
    ]),
  ]
}

function team(
  id: string,
  sport: SportKey,
  league: string,
  name: string,
  code: string,
  primary: string,
  secondary: string,
): LegacyTeam {
  return {
    id,
    sport,
    sportLabel: getSport(sport).label,
    league,
    name,
    code,
    primary,
    secondary,
  }
}

function event(
  id: string,
  sport: SportKey,
  group: string,
  dateLabel: string,
  time: string,
  homeId: string,
  awayId: string,
  venue: string,
): LegacyEvent {
  const home = legacyTeams.find((teamItem) => teamItem.id === homeId)
  const away = legacyTeams.find((teamItem) => teamItem.id === awayId)
  if (!home || !away) {
    throw new Error(`Missing team for event ${id}`)
  }
  const sportDefinition = getSport(sport)

  return {
    id,
    sport,
    sportLabel: sportDefinition.label,
    league: sportDefinition.title,
    group,
    dateLabel,
    time,
    home: home.name,
    homeCode: home.code,
    homePrimary: home.primary,
    homeSecondary: home.secondary,
    homeLogoUrl: home.logoUrl,
    away: away.name,
    awayCode: away.code,
    awayPrimary: away.primary,
    awaySecondary: away.secondary,
    awayLogoUrl: away.logoUrl,
    venue,
  }
}

function market(id: string, label: string, selections: LegacyMarket['selections']): LegacyMarket {
  return { id, label, selections }
}

function selection(id: string, label: string, odds: number): LegacyMarket['selections'][number] {
  return { id, label, odds, side: 'Back' }
}

function prediction(
  id: string,
  rank: number,
  eventId: string,
  marketId: string,
  selectionId: string,
  confidence: LegacyPrediction['confidence'],
  edge: number,
  risk: LegacyPrediction['risk'],
  reason: string,
): LegacyPrediction {
  return {
    id,
    rank,
    eventId,
    marketId,
    selectionId,
    confidence,
    edge,
    risk,
    reason,
  }
}

function bet(
  id: string,
  match: string,
  marketItem: string,
  type: string,
  stake: string,
  price: string,
  profitLoss: string,
  date: string,
  status: string,
): LegacyBet {
  return { id, match, market: marketItem, type, stake, price, profitLoss, date, status }
}
