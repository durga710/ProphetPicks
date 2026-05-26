import { describe, expect, it } from 'vitest'
import {
  buildApiFootballUrl,
  normalizeApiFootballFixture,
  normalizeApiFootballOddsToLegs,
} from '../../src/data/providers/apiFootball'

describe('API-Football provider adapter', () => {
  it('builds fixture request urls with stable query parameters', () => {
    const url = buildApiFootballUrl('/fixtures', {
      league: 39,
      season: 2025,
      date: '2026-03-07',
      timezone: 'America/New_York',
    })

    expect(url).toBe(
      'https://v3.football.api-sports.io/fixtures?league=39&season=2025&date=2026-03-07&timezone=America%2FNew_York',
    )
  })

  it('normalizes fixture payloads into ProphetPicks soccer fixtures', () => {
    const fixture = normalizeApiFootballFixture({
      fixture: {
        id: 112233,
        date: '2026-05-26T19:45:00+00:00',
        timestamp: 1782503100,
        status: {
          short: 'NS',
          long: 'Not Started',
        },
      },
      league: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        season: 2025,
        round: 'Regular Season - 38',
      },
      teams: {
        home: {
          id: 42,
          name: 'Arsenal',
        },
        away: {
          id: 40,
          name: 'Liverpool',
        },
      },
    })

    expect(fixture).toMatchObject({
      id: 'api-football:fixture:112233',
      sport: 'Soccer',
      league: 'Premier League',
      matchup: 'Arsenal vs Liverpool',
      startsAt: '2026-05-26T19:45:00.000Z',
      providerFixtureId: 112233,
      homeTeam: {
        id: 'api-football:team:42',
        name: 'Arsenal',
      },
      awayTeam: {
        id: 'api-football:team:40',
        name: 'Liverpool',
      },
      status: 'NS',
    })
  })

  it('normalizes odds into generic ProphetPicks legs without provider secrets', () => {
    const fixture = normalizeApiFootballFixture({
      fixture: {
        id: 112233,
        date: '2026-05-26T19:45:00+00:00',
        status: {
          short: 'NS',
          long: 'Not Started',
        },
      },
      league: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        season: 2025,
      },
      teams: {
        home: {
          id: 42,
          name: 'Arsenal',
        },
        away: {
          id: 40,
          name: 'Liverpool',
        },
      },
    })

    const legs = normalizeApiFootballOddsToLegs(
      {
        fixture: {
          id: 112233,
          date: '2026-05-26T19:45:00+00:00',
        },
        update: '2026-05-26T16:55:00+00:00',
        bookmakers: [
          {
            id: 1,
            name: 'Bet365',
            bets: [
              {
                id: 1,
                name: 'Match Winner',
                values: [
                  {
                    value: 'Home',
                    odd: '2.10',
                  },
                  {
                    value: 'Draw',
                    odd: '3.40',
                  },
                ],
              },
              {
                id: 5,
                name: 'Goals Over/Under',
                values: [
                  {
                    value: 'Over 2.5',
                    odd: '1.91',
                  },
                ],
              },
            ],
          },
        ],
      },
      fixture,
      {
        now: '2026-05-26T17:00:00Z',
        modelVersion: 'soccer-rules-v1',
        fairProbabilities: {
          'api-football:fixture:112233:match_result:home': 0.5,
          'api-football:fixture:112233:total_goals:over-2-5': 0.56,
        },
      },
    )

    expect(legs).toHaveLength(3)
    expect(legs[0]).toMatchObject({
      id: 'api-football:fixture:112233:match_result:home',
      sport: 'Soccer',
      league: 'Premier League',
      eventId: 'api-football:fixture:112233',
      matchup: 'Arsenal vs Liverpool',
      subjectName: 'Arsenal',
      marketType: 'match_result',
      marketLabel: 'Match Result',
      selectionLabel: 'Arsenal to win',
      line: 'Home',
      decimalOdds: 2.1,
      americanOdds: 110,
      fairProbability: 0.5,
      source: 'API-Football: Bet365',
      oddsUpdatedAt: '2026-05-26T16:55:00.000Z',
      modelVersion: 'soccer-rules-v1',
    })
    expect(legs[2]).toMatchObject({
      id: 'api-football:fixture:112233:total_goals:over-2-5',
      subjectName: 'Over 2.5 goals',
      marketType: 'total_goals',
      marketLabel: 'Total Goals',
      selectionLabel: 'Over 2.5 goals',
      line: 'Over 2.5',
      fairProbability: 0.56,
    })
  })
})
