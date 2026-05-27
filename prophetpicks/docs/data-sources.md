# ProphetPicks Data Sources

Curated catalog of free / freemium public APIs from
[`public-apis/public-apis`](https://github.com/public-apis/public-apis)
(the active fork of `toddmotto/public-apis`) that can power live
ProphetPicks data.

## Quick recommendation

| Surface to power | Recommended API | Why |
|------------------|-----------------|-----|
| Real team logos (badges) | **TheSportsDB** | Serves authentic team badge images via their own CDN under a free non-commercial license, CORS yes, public test key `3`. Wired through `/api/team-logo`. |
| NFL/NBA/MLB/NHL/Soccer odds | **The Odds API** | Already wired in `/api/odds`. Set `ODDS_API_KEY` to enable. |
| Live in-play scores | **TheSportsDB** (`livescore.php`) or **Football Standings** | TheSportsDB covers ~all major sports; Football Standings is ESPN-derived and no-auth. |
| Schedules / fixtures | **TheSportsDB** (`eventsnextleague.php`) | Free, multi-sport. |
| NBA stats deep-dive | **balldontlie** | No auth, CORS yes, batched player + game data. |
| Soccer scores | **OpenLigaDB** (Bundesliga) or **Football-Data** | Free, CORS yes (OpenLigaDB). |
| Highlight videos | **Scorebat** | No auth, CORS yes, returns embed codes. |
| AFL fixtures | **Squiggle** | Open data, no auth, CORS yes. |
| F1 historical | **Ergast F1** | Free, no auth. |
| Live UK bookmaker odds history | **Oddsmagnet** | No auth, CORS yes — useful for sharps-vs-public movement charts. |
| Real bookmaker odds (paid) | **Cloudbet** | Real-time odds API with bet-placement; needs an account. |
| Sports news | **GNews** or **TheNews** | Free apiKey tier, CORS yes. |

## Full Sports & Fitness list (from public-apis/public-apis)

| API | Description | Auth | HTTPS | CORS | Notes for ProphetPicks |
|---|---|---|---|---|---|
| [API-FOOTBALL](https://www.api-football.com/documentation-v3) | Football leagues & cups | apiKey | Yes | Yes | Already scaffolded in `src/data/providers/apiFootball.ts`. |
| [balldontlie](https://www.balldontlie.io) | NBA stats | No | Yes | Yes | Easy direct-browser fetch. |
| [Canadian Football League (CFL)](http://api.cfl.ca/) | CFL real-time stats | apiKey | Yes | No | Server-side proxy required. |
| [Cloudbet](https://www.cloudbet.com/api/) | **Real-time sports odds + bet placement** | apiKey | Yes | Yes | Most ambitious option — needs Cloudbet account. |
| [CollegeFootballData.com](https://collegefootballdata.com) | NCAAF stats | apiKey | Yes | Unknown | Strong CFB coverage. |
| [DiscGolf](https://discgolfapi.com/docs/) | Disc golf data | No | Yes | Yes | Off-genre. |
| [Ergast F1](http://ergast.com/mrd/) | F1 from 1950 | No | Yes | Unknown | Solid F1 archive. |
| [Football (Scorebat)](https://www.scorebat.com/video-api/) | Goal/highlight embeds | No | Yes | Yes | Could decorate event rows with highlights. |
| [Football Standings](https://github.com/azharimm/football-standings-api) | EPL, La Liga, Serie A standings (ESPN-derived) | No | Yes | Yes | Good for standings views. |
| [Football-Data](https://www.football-data.org) | Matches, players, teams, competitions | `X-Mashape-Key` | Yes | Unknown | Solid free tier. |
| [MLB Records and Stats](https://appac.github.io/mlb-data-api-docs/) | MLB current + historical | No | **No** | Unknown | Avoid — HTTPS:no breaks browser fetch. |
| [NBA Data](https://rapidapi.com/api-sports/api/api-nba/) | NBA stats, livescore, standings | apiKey | Yes | Unknown | RapidAPI gating. |
| [NBA Stats](https://any-api.com/nba_com/nba_com/docs/API_Description) | nba.com stats | No | Yes | Unknown | Unofficial, rate-limited heavily. |
| [NHL Records and Stats](https://gitlab.com/dword4/nhlapi) | NHL data | No | Yes | Unknown | Maintained docs, NHL official endpoints. |
| [Oddsmagnet](https://data.oddsmagnet.com) | UK bookmaker odds history | No | Yes | Yes | Great for line-movement charts. |
| [OpenLigaDB](https://www.openligadb.de) | German football leagues | No | Yes | Yes | Excellent crowd-sourced data, Bundesliga + 2. Bundesliga. |
| [Premier League Standings](https://rapidapi.com/heisenbug/api/premier-league-live-scores/) | EPL standings + stats | apiKey | Yes | Unknown | RapidAPI gating. |
| [RacingHub](https://racinghub.net/api/v1/docs#/) | F1 historical | No | Yes | Unknown | Alt to Ergast. |
| [Sport Data](https://sportdataapi.com) | Multi-sport global | apiKey | Yes | Unknown | Broad sport coverage. |
| [Sport List & Data (Decathlon)](https://developers.decathlon.com/products/sports) | Sport catalog | No | Yes | Yes | Reference data only. |
| [Sportmonks Cricket](https://docs.sportmonks.com/cricket/) | Cricket + fantasy | apiKey | Yes | Unknown | Strong cricket coverage. |
| [Sportmonks Football](https://docs.sportmonks.com/football/) | Football scores, schedules, news | apiKey | Yes | Unknown | Premium-quality football. |
| [Squiggle](https://api.squiggle.com.au) | AFL fixtures + predictions | No | Yes | Yes | Australian Rules Football. |
| [Strava](https://strava.github.io/api/) | Athlete activities | OAuth | Yes | Unknown | Off-genre. |
| [SuredBits](https://suredbits.com/api/) | Teams, players, scores | No | **No** | No | Avoid — HTTPS:no AND CORS:no. |
| [TheSportsDB](https://www.thesportsdb.com/api.php) | **Crowd-sourced sports data + ARTWORK** | apiKey (`3` for free public) | Yes | Yes | **Top recommendation for team logos + multi-sport schedules.** |
| [TourneyRadar](https://tourneyradar-api.vercel.app) | Chess tournaments | No | Yes | Unknown | Niche. |

## News (for editor headlines / sport-specific news rail)

| API | Auth | HTTPS | CORS | Notes |
|---|---|---|---|---|
| [GNews](https://gnews.io/) | apiKey | Yes | Yes | Best free tier with CORS. |
| [TheNews](https://www.thenewsapi.com/) | apiKey | Yes | Yes | Aggregated headlines + live news. |
| [Mediastack](https://mediastack.com) | apiKey | Yes | Unknown | Free + paid tiers. |
| [The Guardian](http://open-platform.theguardian.com/) | apiKey | Yes | Unknown | High-quality sports section. |

## Where each could plug in

- **TheSportsDB → `/api/team-logo`** (wired): swaps the abstract crest for a real team badge when available.
- **TheSportsDB → `/api/live`**: replace demo state with `livescore.php` for production-grade scores.
- **The Odds API → `/api/odds`** (already wired): set `ODDS_API_KEY`.
- **GNews → new `/api/news?sport=...`**: drives a "Today's stories" rail above the event board.
- **Scorebat → new `/api/highlights?eventId=...`**: drives a video clip in the StatPack drawer.
- **Squiggle / OpenLigaDB / balldontlie**: backfill richer schedules + standings for AFL, Bundesliga, NBA.

## Compliance reminders

- All keys are server-side only. Never prefix with `VITE_`.
- TheSportsDB's free tier is non-commercial. Their badges are
  league-licensed for that tier — fine for personal-use simulator,
  not for a production sportsbook.
- Cloudbet's bet-placement endpoints require real account auth and
  are explicitly out of scope for ProphetPicks (simulator only).
- Always rate-limit and cache upstream calls via the Vercel route's
  `Cache-Control: s-maxage=N, stale-while-revalidate=N`.
