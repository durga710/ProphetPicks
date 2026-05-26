import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  LineChart,
  Menu,
  Search,
  ShieldCheck,
  TicketCheck,
  Trophy,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import {
  legacyBets,
  legacyDeposits,
  legacyLedger,
  legacyTeams,
  legacyWithdrawals,
  getEventsForSport,
  getMarketsForEvent,
  getResolvedPredictions,
  getSport,
  sports,
  type FinanceRow,
  type LedgerRow,
  type LegacyBet,
  type LegacyEvent,
  type LegacyMarket,
  type LegacySlipItem,
  type LegacyTeam,
  type ResolvedPrediction,
  type SportKey,
} from '../data/legacyBetfair'
import {
  decimalToAmericanOdds,
  formatAmericanOdds,
  formatProbability,
} from '../domain/odds'
import {
  buildOddsQuotes,
  formatMovement,
  getCategoryLabel,
  type OddsBoardCategory,
  type OddsQuote,
} from '../domain/oddsBoard'
import { loadOddsQuotes } from '../data/providers/oddsApi'

type Screen =
  | 'account'
  | 'events'
  | 'market'
  | 'bets'
  | 'finance'
  | 'teams'
  | 'today'
  | 'predictions'
  | 'odds'
type FinanceTab = 'deposits' | 'withdrawals' | 'ledger'
type BetTypeFilter = 'all' | 'simple' | 'combined'
type SlipMode = 'simple' | 'combined'
type LegalTopic = 'privacy' | 'cookies' | 'rules' | 'terms' | 'minors'
type PredictionFilter = 'all' | string

const legalTopics: Record<LegalTopic, { title: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    body: 'ProphetPicks is a personal simulator. It stores mock slips, filters, and bankroll activity locally in the current browser session for product testing.',
  },
  cookies: {
    title: 'Cookie Policy',
    body: 'This prototype does not use advertising cookies. Future integrations should only add cookies for sign-in, preferences, analytics, or API session safety.',
  },
  rules: {
    title: 'Rules and Regulations',
    body: 'All tickets shown here are mock bets. Odds, markets, account credits, and settlement rows are simulator data and do not represent live wagering.',
  },
  terms: {
    title: 'Terms and Conditions',
    body: 'Use ProphetPicks as a research and planning tool only. The app is built for personal testing, bet journaling, and parlay workflow design.',
  },
  minors: {
    title: 'Minor Protection',
    body: 'ProphetPicks is not intended for minors. Keep betting research tools private, educational, and compliant with local law.',
  },
}

function eventName(event: LegacyEvent): string {
  return `${event.home} VS ${event.away}`
}

function formatDecimal(odds: number): string {
  return Number.isInteger(odds) ? odds.toString() : odds.toFixed(2)
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function formatSignedCurrency(amount: number): string {
  const prefix = amount >= 0 ? '+' : '-'

  return `${prefix}$${Math.abs(amount).toFixed(2)}`
}

function parseStake(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''))

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.min(parsed, 100_000))
}

function combinedPrice(items: LegacySlipItem[]): number {
  return items.reduce((total, item) => total * item.selection.odds, 1)
}

function ticketRisk(items: LegacySlipItem[], mode: SlipMode, stake: number): number {
  return mode === 'simple' ? stake * items.length : stake
}

function ticketReturn(items: LegacySlipItem[], mode: SlipMode, stake: number): number {
  if (items.length === 0) {
    return 0
  }

  if (mode === 'simple') {
    return items.reduce((total, item) => total + item.selection.odds * stake, 0)
  }

  return combinedPrice(items) * stake
}

function ticketPriceLabel(items: LegacySlipItem[], mode: SlipMode): string {
  if (items.length === 0) {
    return '0.00'
  }

  if (mode === 'simple' && items.length > 1) {
    return 'Singles'
  }

  return formatDecimal(mode === 'combined' ? combinedPrice(items) : items[0].selection.odds)
}

function matchesSearch(searchText: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return searchText.toLowerCase().includes(normalizedQuery)
}

function financeRowsTitle(tab: FinanceTab): string {
  if (tab === 'ledger') {
    return 'Account Ledger'
  }

  return tab === 'deposits' ? 'My Deposits' : 'My Withdrawals'
}

export function LegacyBetfairApp() {
  const [activeSport, setActiveSport] = useState<SportKey>('soccer')
  const [screen, setScreen] = useState<Screen>('events')
  const [catalogEvent, setCatalogEvent] = useState<LegacyEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<LegacyEvent>(
    getEventsForSport('soccer')[0],
  )
  const [selectedMarket, setSelectedMarket] = useState<LegacyMarket>(
    getMarketsForEvent(getEventsForSport('soccer')[0])[0],
  )
  const [slipItems, setSlipItems] = useState<LegacySlipItem[]>([])
  const [isSlipOpen, setIsSlipOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [status, setStatus] = useState('')
  const [financeTab, setFinanceTab] = useState<FinanceTab>('deposits')
  const [mockBets, setMockBets] = useState<LegacyBet[]>([])
  const [mockLedgerRows, setMockLedgerRows] = useState<LedgerRow[]>([])
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [slipMode, setSlipMode] = useState<SlipMode>('combined')
  const [stakeInput, setStakeInput] = useState('10.00')
  const [legalTopic, setLegalTopic] = useState<LegalTopic | null>(null)

  const activeEvents = useMemo(() => getEventsForSport(activeSport), [activeSport])
  const activeSportDefinition = getSport(activeSport)
  const predictions = useMemo(() => getResolvedPredictions(), [])

  const groupedEvents = useMemo(
    () =>
      activeEvents.reduce<Record<string, LegacyEvent[]>>((groups, event) => {
        groups[event.dateLabel] = [...(groups[event.dateLabel] ?? []), event]
        return groups
      }, {}),
    [activeEvents],
  )

  function navigate(nextScreen: Screen): void {
    setScreen(nextScreen)
    setCatalogEvent(null)
    setIsAccountMenuOpen(false)
    setStatus('')
  }

  function changeSport(nextSport: SportKey): void {
    const nextEvents = getEventsForSport(nextSport)
    const nextEvent = nextEvents[0]

    setActiveSport(nextSport)
    setScreen('events')
    setCatalogEvent(null)
    setIsAccountMenuOpen(false)
    setStatus('')

    if (nextEvent) {
      setSelectedEvent(nextEvent)
      setSelectedMarket(getMarketsForEvent(nextEvent)[0])
    }
  }

  function openCatalog(event: LegacyEvent): void {
    setCatalogEvent(event)
    setStatus('')
  }

  function openMarket(event: LegacyEvent, market: LegacyMarket): void {
    setSelectedEvent(event)
    setSelectedMarket(market)
    setCatalogEvent(null)
    setScreen('market')
    setStatus('')
  }

  function addSelection(selection: LegacyMarket['selections'][number]): void {
    addSlipItem({
      event: selectedEvent,
      market: selectedMarket,
      selection,
    })
  }

  function addSlipItem(item: LegacySlipItem): void {
    setSlipItems((items) => [...items, item])
    setSelectedEvent(item.event)
    setSelectedMarket(item.market)
    setIsConfirmed(false)
    setIsSlipOpen(true)
    setStatus('')
  }

  function addPrediction(prediction: ResolvedPrediction): void {
    addSlipItem({
      event: prediction.event,
      market: prediction.market,
      selection: prediction.selection,
    })
  }

  function buildBestParlay(predictionItems: ResolvedPrediction[]): void {
    const parlayItems = predictionItems.slice(0, 3).map((prediction) => ({
      event: prediction.event,
      market: prediction.market,
      selection: prediction.selection,
    }))

    if (parlayItems.length === 0) {
      setStatus('No Prophet Picks match the current filters.')
      return
    }

    setSlipItems(parlayItems)
    setSlipMode('combined')
    setIsConfirmed(false)
    setIsSlipOpen(true)
    setStatus(`Best parlay loaded with ${parlayItems.length} Prophet Picks.`)
  }

  function refreshMarket(event: LegacyEvent): void {
    setSelectedEvent(event)
    setSelectedMarket(getMarketsForEvent(event)[0])
    setCatalogEvent(null)
    setStatus(`Markets refreshed for ${eventName(event)}.`)
  }

  function saveMockBet(): void {
    if (!isConfirmed || slipItems.length === 0) {
      return
    }

    const stake = parseStake(stakeInput)

    if (stake <= 0) {
      setStatus('Enter a stake greater than $0.00 before saving a mock bet.')
      return
    }

    const price = ticketPriceLabel(slipItems, slipMode)
    const risk = ticketRisk(slipItems, slipMode, stake)
    const returnValue = ticketReturn(slipItems, slipMode, stake)
    const primaryItem = slipItems[0]
    const createdId = `mock-${mockBets.length + 1}`
    const isMultiLeg = slipItems.length > 1
    const ticketType = slipMode === 'combined' ? 'Combined' : 'Simple'

    setMockBets((bets) => [
      {
        id: createdId,
        match: eventName(primaryItem.event),
        market:
          slipMode === 'combined' && isMultiLeg
            ? `${slipItems.length}-leg parlay`
            : slipMode === 'simple' && isMultiLeg
              ? `${slipItems.length} straight bets`
              : primaryItem.market.label,
        type: ticketType,
        stake: formatCurrency(risk),
        price,
        profitLoss: formatSignedCurrency(returnValue - risk),
        date: '2026-05-26 18:00',
        status: 'Pending Mock',
      },
      ...bets,
    ])
    setMockLedgerRows((rows) => [
      {
        id: `ledger-${createdId}`,
        date: '2026-05-26',
        description: 'Mock stake reserved',
        debit: formatCurrency(risk),
        credit: '-',
        balance: formatCurrency(20_030 - risk),
      },
      ...rows,
    ])
    setStatus(
      `Mock bet saved locally. Estimated return ${formatCurrency(returnValue)}. No live wager was placed.`,
    )
  }

  return (
    <div className="legacy-app">
      <header className="legacy-header">
        <div className="legacy-topbar">
          <button
            className="legacy-menu-button"
            type="button"
            aria-label="Open account menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => setIsAccountMenuOpen((open) => !open)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="legacy-brand" aria-label="ProphetPicks">
            <img src="/prophet-mask.webp" alt="" />
            <div>
              <span>PROPHET</span>
              <strong>PICKS</strong>
            </div>
          </div>
          <div className="legacy-account">
            <span>Hello, Jhon Alexander</span>
            <strong>Credits: $20000</strong>
            <button type="button" onClick={() => setIsSlipOpen(true)}>
              Betting Slip
            </button>
          </div>
        </div>

        <nav className="legacy-nav" aria-label="Imported betting navigation">
          <button
            className={screen === 'account' ? 'active' : ''}
            type="button"
            onClick={() => navigate('account')}
          >
            <UserRound size={16} aria-hidden="true" />
            My Account
          </button>
          <button
            className={screen === 'bets' ? 'active' : ''}
            type="button"
            onClick={() => navigate('bets')}
          >
            <ClipboardList size={16} aria-hidden="true" />
            My Bets
          </button>
          <button
            className={screen === 'events' ? 'active' : ''}
            type="button"
            onClick={() => navigate('events')}
          >
            <Trophy size={16} aria-hidden="true" />
            Competitions & Leagues
          </button>
          <button
            className={screen === 'teams' ? 'active' : ''}
            type="button"
            onClick={() => navigate('teams')}
          >
            <Trophy size={16} aria-hidden="true" />
            Teams
          </button>
          <button
            className={screen === 'predictions' ? 'active' : ''}
            type="button"
            onClick={() => navigate('predictions')}
          >
            <TicketCheck size={16} aria-hidden="true" />
            Prophet Picks
          </button>
          <button
            className={screen === 'odds' ? 'active' : ''}
            type="button"
            onClick={() => navigate('odds')}
          >
            <LineChart size={16} aria-hidden="true" />
            Odds Board
          </button>
          <button
            className={screen === 'today' ? 'active' : ''}
            type="button"
            onClick={() => navigate('today')}
          >
            <CalendarDays size={16} aria-hidden="true" />
            Today's Matches
          </button>
          <button
            className={screen === 'finance' ? 'active' : ''}
            type="button"
            onClick={() => {
              setFinanceTab('deposits')
              navigate('finance')
            }}
          >
            <WalletCards size={16} aria-hidden="true" />
            Financial
          </button>
        </nav>
      </header>

      <main className="legacy-main">
        {screen !== 'finance' &&
          screen !== 'bets' &&
          screen !== 'account' &&
          screen !== 'predictions' &&
          screen !== 'odds' && (
          <SportRail activeSport={activeSport} onChangeSport={changeSport} />
        )}

        {screen === 'account' && (
          <AccountScreen
            bets={[...mockBets, ...legacyBets]}
            ledgerRows={[...mockLedgerRows, ...legacyLedger]}
            onOpenLedger={() => {
              setFinanceTab('ledger')
              navigate('finance')
            }}
          />
        )}

        {(screen === 'events' || screen === 'today') && (
          <EventsScreen
            sport={activeSportDefinition}
            groupedEvents={groupedEvents}
            groups={activeSportDefinition.groups}
            title={screen === 'today' ? "Today's Matches" : activeSportDefinition.title}
            eyebrow={screen === 'today' ? 'Daily board' : 'Dense Sportsbook Board'}
            emptyMessage={
              screen === 'today'
                ? 'No matches match the current filters. Try another sport or clear search.'
                : 'No matches found for the current filters.'
            }
            onOpenCatalog={openCatalog}
          />
        )}

        {screen === 'market' && (
          <MarketScreen
            event={selectedEvent}
            market={selectedMarket}
            onOpenMarket={openMarket}
            onRefreshMarket={refreshMarket}
            onAddSelection={addSelection}
          />
        )}

        {screen === 'teams' && (
          <TeamsScreen teams={legacyTeams} />
        )}

        {screen === 'predictions' && (
          <PredictionScreen
            predictions={predictions}
            onAddPrediction={addPrediction}
            onBuildBestParlay={buildBestParlay}
          />
        )}

        {screen === 'odds' && (
          <OddsBoardScreen onAddSlipItem={addSlipItem} />
        )}

        {screen === 'bets' && <BetsScreen bets={[...mockBets, ...legacyBets]} />}

        {screen === 'finance' && (
          <FinanceScreen
            activeTab={financeTab}
            ledgerRows={[...mockLedgerRows, ...legacyLedger]}
            onAccountClick={() => navigate('account')}
            onTabChange={setFinanceTab}
          />
        )}
      </main>

      <footer className="legacy-footer">
        <div>
          {(Object.keys(legalTopics) as LegalTopic[]).map((topic) => (
            <a
              href={`#${topic}`}
              key={topic}
              onClick={(event) => {
                event.preventDefault()
                setLegalTopic(topic)
              }}
            >
              {legalTopics[topic].title}
            </a>
          ))}
        </div>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          Play responsibly. Mock betting only.
        </span>
      </footer>

      {catalogEvent && (
        <CatalogDialog
          event={catalogEvent}
          onClose={() => setCatalogEvent(null)}
          onOpenMarket={openMarket}
        />
      )}

      {isAccountMenuOpen && (
        <AccountMenuDialog
          onClose={() => setIsAccountMenuOpen(false)}
          onOpenBets={() => navigate('bets')}
          onOpenLedger={() => {
            setFinanceTab('ledger')
            navigate('finance')
          }}
          onOpenSlip={() => {
            setIsSlipOpen(true)
            setIsAccountMenuOpen(false)
          }}
        />
      )}

      {legalTopic && (
        <LegalDialog topic={legalTopic} onClose={() => setLegalTopic(null)} />
      )}

      {isSlipOpen && (
        <BettingSlipDialog
          items={slipItems}
          isConfirmed={isConfirmed}
          mode={slipMode}
          stakeInput={stakeInput}
          status={status}
          onConfirmChange={setIsConfirmed}
          onClose={() => setIsSlipOpen(false)}
          onModeChange={(mode) => {
            setSlipMode(mode)
            setIsConfirmed(false)
          }}
          onRemove={(index) =>
            setSlipItems((items) => items.filter((_, itemIndex) => itemIndex !== index))
          }
          onStakeChange={(stake) => {
            setStakeInput(stake)
            setIsConfirmed(false)
          }}
          onSave={saveMockBet}
        />
      )}

      {status && !isSlipOpen && (
        <div className="legacy-toast" role="status">
          <TicketCheck size={16} aria-hidden="true" />
          {status}
        </div>
      )}
    </div>
  )
}

function SportRail({
  activeSport,
  onChangeSport,
}: {
  activeSport: SportKey
  onChangeSport: (sport: SportKey) => void
}) {
  return (
    <nav className="legacy-sport-rail" aria-label="Sports">
      {sports.map((sport) => (
        <button
          className={sport.key === activeSport ? 'active' : ''}
          key={sport.key}
          type="button"
          aria-label={sport.label}
          onClick={() => onChangeSport(sport.key)}
        >
          {sport.label}
        </button>
      ))}
    </nav>
  )
}

function EventsScreen({
  sport,
  groupedEvents,
  groups,
  title,
  eyebrow,
  emptyMessage,
  onOpenCatalog,
}: {
  sport: ReturnType<typeof getSport>
  groupedEvents: Record<string, LegacyEvent[]>
  groups: string[]
  title: string
  eyebrow: string
  emptyMessage: string
  onOpenCatalog: (event: LegacyEvent) => void
}) {
  const [isLeagueOpen, setIsLeagueOpen] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const visibleEvents = useMemo(
    () =>
      Object.values(groupedEvents)
        .flat()
        .filter((event) => {
          const groupMatches = !activeGroup || event.group === activeGroup
          const eventText = [
            event.home,
            event.away,
            event.homeCode,
            event.awayCode,
            event.group,
            event.league,
            event.venue,
            event.dateLabel,
          ].join(' ')

          return groupMatches && matchesSearch(eventText, searchQuery)
        }),
    [activeGroup, groupedEvents, searchQuery],
  )
  const visibleGroupedEvents = useMemo(
    () =>
      visibleEvents.reduce<Record<string, LegacyEvent[]>>((eventGroups, event) => {
        eventGroups[event.dateLabel] = [...(eventGroups[event.dateLabel] ?? []), event]
        return eventGroups
      }, {}),
    [visibleEvents],
  )
  const eventCount = visibleEvents.length

  return (
    <section className="legacy-stage legacy-events" aria-labelledby="events-title">
      <div className="legacy-title-row">
        <div>
          <p>{eyebrow}</p>
          <h1 id="events-title">{title}</h1>
        </div>
        <div className="legacy-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search games"
            placeholder="Search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="legacy-board-toolbar">
        <button
          className="legacy-league-pulldown"
          type="button"
          aria-controls="league-event-list"
          aria-expanded={isLeagueOpen}
          onClick={() => setIsLeagueOpen((open) => !open)}
        >
          <span>{sport.family}</span>
          <strong>{sport.title}</strong>
          <small>{eventCount} events</small>
          <ChevronDown size={18} aria-hidden="true" />
        </button>

        <div className="legacy-group-strip compact" aria-label="Competition groups">
          {groups.map((group) => (
            <button
              className={
                activeGroup === group || (group === 'Bets' && activeGroup === null)
                  ? 'active'
                  : ''
              }
              key={group}
              type="button"
              onClick={() => setActiveGroup(group === 'Bets' ? null : group)}
            >
              {group}
            </button>
          ))}
          {!groups.includes('Bets') && (
            <button
              className={activeGroup === null ? 'active' : ''}
              type="button"
              onClick={() => setActiveGroup(null)}
            >
              Bets
            </button>
          )}
        </div>
      </div>

      {isLeagueOpen && (
        <div className="legacy-event-stack" id="league-event-list">
          <div className="legacy-board-head" aria-hidden="true">
            <span>Time</span>
            <span>Matchup</span>
            <span>Markets</span>
          </div>

          {visibleEvents.length === 0 && (
            <div className="legacy-empty">{emptyMessage}</div>
          )}

          {Object.entries(visibleGroupedEvents).map(([date, events]) => (
            <section className="legacy-date-card compact" key={date} aria-label={date}>
              <div className="legacy-date-heading">
                <CalendarDays size={15} aria-hidden="true" />
                {date}
              </div>
              <div className="legacy-event-list dense">
                {events.map((event) => (
                  <button
                    className="legacy-event-row dense"
                    key={event.id}
                    type="button"
                    aria-label={`Open ${eventName(event)} market`}
                    onClick={() => onOpenCatalog(event)}
                  >
                    <span className="legacy-time">{event.time}</span>
                    <span className="legacy-matchup-logos">
                      <TeamCrest
                        label={event.home}
                        code={event.homeCode}
                        primary={event.homePrimary}
                        secondary={event.homeSecondary}
                      />
                      <span className="legacy-versus">VS</span>
                      <TeamCrest
                        label={event.away}
                        code={event.awayCode}
                        primary={event.awayPrimary}
                        secondary={event.awaySecondary}
                      />
                    </span>
                    <span className="legacy-market-count">
                      {getMarketsForEvent(event).length} markets
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

function TeamCrest({
  label,
  code,
  primary,
  secondary,
}: {
  label: string
  code: string
  primary: string
  secondary: string
}) {
  return (
    <span className="legacy-team-crest-wrap">
      <span
        className="legacy-team-crest"
        role="img"
        aria-label={`${label} crest`}
        style={{
          '--team-primary': primary,
          '--team-secondary': secondary,
        } as CSSProperties}
      >
        <span>{code}</span>
      </span>
    </span>
  )
}

function MarketScreen({
  event,
  market,
  onOpenMarket,
  onRefreshMarket,
  onAddSelection,
}: {
  event: LegacyEvent
  market: LegacyMarket
  onOpenMarket: (event: LegacyEvent, market: LegacyMarket) => void
  onRefreshMarket: (event: LegacyEvent) => void
  onAddSelection: (selection: LegacyMarket['selections'][number]) => void
}) {
  const markets = getMarketsForEvent(event)

  return (
    <section className="legacy-stage legacy-market" aria-labelledby="market-event">
      <div className="legacy-market-header">
        <div>
          <p>{event.league}</p>
          <h1 id="market-event" aria-label={eventName(event)}>
            <span className="legacy-market-matchup">
              <TeamCrest
                label={event.home}
                code={event.homeCode}
                primary={event.homePrimary}
                secondary={event.homeSecondary}
              />
              <span className="legacy-versus">VS</span>
              <TeamCrest
                label={event.away}
                code={event.awayCode}
                primary={event.awayPrimary}
                secondary={event.awaySecondary}
              />
            </span>
          </h1>
          <span>
            {event.dateLabel} at {event.time}
          </span>
        </div>
        <button type="button" onClick={() => onRefreshMarket(event)}>
          Refresh Markets
        </button>
      </div>

      <div className="legacy-market-grid">
        <aside className="legacy-catalog-panel" aria-label="Market Catalog">
          <h2>Market Catalog</h2>
          {markets.map((catalogMarket) => (
            <button
              className={catalogMarket.id === market.id ? 'active' : ''}
              key={catalogMarket.id}
              type="button"
              onClick={() => onOpenMarket(event, catalogMarket)}
            >
              {catalogMarket.label}
            </button>
          ))}
        </aside>

        <article className="legacy-odds-panel">
          <div className="legacy-panel-title">
            <h2>{market.label}</h2>
            <span>Back prices</span>
          </div>
          <div className="legacy-odds-grid">
            {market.selections.map((selection) => {
              const american = formatAmericanOdds(
                decimalToAmericanOdds(selection.odds),
              )
              const implied = formatProbability(1 / selection.odds)

              return (
                <button
                  className="legacy-odd-tile"
                  key={selection.id}
                  type="button"
                  aria-label={`${selection.side} ${selection.label} at ${formatDecimal(selection.odds)}`}
                  onClick={() => onAddSelection(selection)}
                >
                  <span>{selection.side}</span>
                  <SelectionLabel event={event} label={selection.label} />
                  <b>{formatDecimal(selection.odds)}</b>
                  <span className="legacy-odd-tile-meta">
                    <em>{american}</em>
                    <em>{implied}</em>
                  </span>
                </button>
              )
            })}
          </div>
        </article>
      </div>
    </section>
  )
}

function SelectionLabel({ event, label }: { event: LegacyEvent; label: string }) {
  if (label === event.home) {
    return (
      <strong className="legacy-selection-logo">
        <TeamCrest
          label={event.home}
          code={event.homeCode}
          primary={event.homePrimary}
          secondary={event.homeSecondary}
        />
      </strong>
    )
  }

  if (label === event.away) {
    return (
      <strong className="legacy-selection-logo">
        <TeamCrest
          label={event.away}
          code={event.awayCode}
          primary={event.awayPrimary}
          secondary={event.awaySecondary}
        />
      </strong>
    )
  }

  return <strong>{label}</strong>
}

function AccountScreen({
  bets,
  ledgerRows,
  onOpenLedger,
}: {
  bets: LegacyBet[]
  ledgerRows: LedgerRow[]
  onOpenLedger: () => void
}) {
  const pendingBets = bets.filter((bet) => bet.status.includes('Pending')).length
  const lastBet = bets[0]

  return (
    <section className="legacy-stage" aria-labelledby="account-title">
      <div className="legacy-table-header">
        <div>
          <p>Personal command center</p>
          <h1 id="account-title">Account Overview</h1>
        </div>
        <button className="legacy-action-button" type="button" onClick={onOpenLedger}>
          View Ledger
        </button>
      </div>
      <div className="legacy-account-grid">
        <article>
          <span>Mock bankroll</span>
          <strong>$20,000.00</strong>
          <small>Personal simulator balance</small>
        </article>
        <article>
          <span>Open mock bets</span>
          <strong>{pendingBets}</strong>
          <small>Pending tickets tracked locally</small>
        </article>
        <article>
          <span>Last bet</span>
          <strong>{lastBet?.market ?? 'No bets yet'}</strong>
          <small>{lastBet?.match ?? 'Start with the board'}</small>
        </article>
        <article>
          <span>Ledger rows</span>
          <strong>{ledgerRows.length}</strong>
          <small>Credits, stakes, and settlements</small>
        </article>
      </div>
    </section>
  )
}

function PredictionScreen({
  predictions,
  onAddPrediction,
  onBuildBestParlay,
}: {
  predictions: ResolvedPrediction[]
  onAddPrediction: (prediction: ResolvedPrediction) => void
  onBuildBestParlay: (predictions: ResolvedPrediction[]) => void
}) {
  const [sportFilter, setSportFilter] = useState<PredictionFilter>('all')
  const [confidenceFilter, setConfidenceFilter] = useState<PredictionFilter>('all')
  const [riskFilter, setRiskFilter] = useState<PredictionFilter>('all')
  const sportOptions = Array.from(
    new Set(predictions.map((prediction) => prediction.event.sportLabel)),
  )
  const visiblePredictions = predictions.filter((prediction) => {
    const sportMatches =
      sportFilter === 'all' || prediction.event.sportLabel === sportFilter
    const confidenceMatches =
      confidenceFilter === 'all' || prediction.confidence === confidenceFilter
    const riskMatches = riskFilter === 'all' || prediction.risk === riskFilter

    return sportMatches && confidenceMatches && riskMatches
  })
  const averageEdge =
    predictions.length === 0
      ? 0
      : predictions.reduce((total, prediction) => total + prediction.edge, 0) /
        predictions.length

  return (
    <section className="legacy-stage legacy-predictions" aria-labelledby="predictions-title">
      <div className="legacy-table-header">
        <div>
          <p>Ranked Edge Board</p>
          <h1 id="predictions-title">Prophet Picks</h1>
        </div>
        <button
          className="legacy-action-button"
          type="button"
          onClick={() => onBuildBestParlay(visiblePredictions)}
        >
          Build Best Parlay
        </button>
      </div>

      <div className="legacy-prediction-stats">
        <article>
          <span>Tracked Picks</span>
          <strong>{predictions.length}</strong>
        </article>
        <article>
          <span>A Confidence</span>
          <strong>
            {predictions.filter((prediction) => prediction.confidence === 'A').length}
          </strong>
        </article>
        <article>
          <span>Avg Edge</span>
          <strong>+{averageEdge.toFixed(1)}%</strong>
        </article>
      </div>

      <div className="legacy-prediction-filters" aria-label="Prophet pick filters">
        <label>
          Sport
          <select
            value={sportFilter}
            onChange={(event) => setSportFilter(event.target.value)}
          >
            <option value="all">All Sports</option>
            {sportOptions.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>
        <label>
          Confidence
          <select
            value={confidenceFilter}
            onChange={(event) => setConfidenceFilter(event.target.value)}
          >
            <option value="all">All Grades</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label>
          Risk
          <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="all">All Risk</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
      </div>

      <div className="legacy-prediction-grid">
        {visiblePredictions.length === 0 && (
          <div className="legacy-empty">No Prophet Picks match those filters.</div>
        )}
        {visiblePredictions.map((prediction) => (
          <article className="legacy-prediction-card" key={prediction.id}>
            <div className="legacy-prediction-rank">#{prediction.rank}</div>
            <div>
              <span>{prediction.event.sportLabel}</span>
              <h2>{eventName(prediction.event)}</h2>
            </div>
            <div className="legacy-prediction-metrics">
              <strong>{prediction.confidence} Confidence</strong>
              <strong>+{prediction.edge.toFixed(1)}% edge</strong>
              <strong>{prediction.risk} Risk</strong>
            </div>
            <div className="legacy-prediction-selection">
              <span>{prediction.market.label}</span>
              <strong>{prediction.selection.label}</strong>
              <b>{formatDecimal(prediction.selection.odds)}</b>
            </div>
            <p>{prediction.reason}</p>
            <button
              type="button"
              onClick={() => onAddPrediction(prediction)}
              aria-label={`Add ${prediction.selection.label} ${prediction.market.label} pick`}
            >
              Add Pick
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function TeamsScreen({ teams }: { teams: LegacyTeam[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const visibleTeams = teams.filter((team) =>
    matchesSearch(
      [team.name, team.code, team.sportLabel, team.league].join(' '),
      searchQuery,
    ),
  )

  return (
    <section className="legacy-stage" aria-labelledby="teams-title">
      <div className="legacy-table-header">
        <div>
          <p>Catalog</p>
          <h1 id="teams-title">Team Directory</h1>
        </div>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input
            aria-label="Search teams"
            placeholder="Search teams"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="legacy-team-grid">
        {visibleTeams.length === 0 && (
          <div className="legacy-empty">No teams found for that search.</div>
        )}
        {visibleTeams.map((team) => (
          <article className="legacy-team-card" key={team.id}>
            <TeamCrest
              label={team.name}
              code={team.code}
              primary={team.primary}
              secondary={team.secondary}
            />
            <div>
              <strong>{team.name}</strong>
              <span>
                {team.sportLabel} - {team.league}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function BetsScreen({ bets }: { bets: LegacyBet[] }) {
  const [typeFilter, setTypeFilter] = useState<BetTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const visibleBets = bets.filter((bet) => {
    const typeMatches = typeFilter === 'all' || bet.type.toLowerCase() === typeFilter
    const betText = [
      bet.match,
      bet.market,
      bet.type,
      bet.stake,
      bet.price,
      bet.profitLoss,
      bet.status,
      bet.date,
    ].join(' ')

    return typeMatches && matchesSearch(betText, searchQuery)
  })

  return (
    <section className="legacy-stage" aria-labelledby="bets-title">
      <div className="legacy-table-header">
        <div>
          <p>Imported history</p>
          <h1 id="bets-title">My Bets</h1>
        </div>
        <label>
          Type
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as BetTypeFilter)}
          >
            <option value="all">All</option>
            <option value="simple">Simple</option>
            <option value="combined">Combined</option>
          </select>
        </label>
      </div>
      <div className="legacy-table-tools">
        <span>Showing {visibleBets.length} entries</span>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input
            aria-label="Search bets"
            placeholder="Search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="legacy-table-wrap">
        <table className="legacy-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Market</th>
              <th>Type</th>
              <th>Stake</th>
              <th>Price</th>
              <th>Profit/Loss</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {visibleBets.map((bet) => (
              <tr key={bet.id}>
                <td>{bet.match}</td>
                <td>{bet.market}</td>
                <td>{bet.type}</td>
                <td>{bet.stake}</td>
                <td>{bet.price}</td>
                <td className={bet.profitLoss.startsWith('+') ? 'positive' : 'negative'}>
                  {bet.profitLoss}
                </td>
                <td>{bet.status}</td>
                <td>{bet.date}</td>
              </tr>
            ))}
            {visibleBets.length === 0 && (
              <tr>
                <td colSpan={8}>No bets match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FinanceScreen({
  activeTab,
  ledgerRows,
  onAccountClick,
  onTabChange,
}: {
  activeTab: FinanceTab
  ledgerRows: LedgerRow[]
  onAccountClick: () => void
  onTabChange: (tab: FinanceTab) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const rows = activeTab === 'deposits' ? legacyDeposits : legacyWithdrawals
  const visibleRows = rows.filter((row) =>
    matchesSearch([row.date, row.method, row.amount, row.status].join(' '), searchQuery),
  )
  const visibleLedgerRows = ledgerRows.filter((row) =>
    matchesSearch(
      [row.date, row.description, row.debit, row.credit, row.balance].join(' '),
      searchQuery,
    ),
  )

  return (
    <section className="legacy-stage" aria-labelledby="finance-title">
      <div className="legacy-table-header">
        <div>
          <p>Financial</p>
          <h1 id="finance-title">{financeRowsTitle(activeTab)}</h1>
        </div>
        <div className="legacy-finance-tabs" aria-label="Financial sections">
          <button type="button" onClick={onAccountClick}>
            My Account
          </button>
          <button
            className={activeTab === 'deposits' ? 'active' : ''}
            type="button"
            onClick={() => onTabChange('deposits')}
          >
            Deposits
          </button>
          <button
            className={activeTab === 'withdrawals' ? 'active' : ''}
            type="button"
            onClick={() => onTabChange('withdrawals')}
          >
            Withdrawals
          </button>
          <button
            className={activeTab === 'ledger' ? 'active' : ''}
            type="button"
            onClick={() => onTabChange('ledger')}
          >
            Ledger
          </button>
        </div>
      </div>

      <div className="legacy-table-tools">
        <span>
          Showing {activeTab === 'ledger' ? visibleLedgerRows.length : visibleRows.length}{' '}
          entries
        </span>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input
            aria-label={`Search ${financeRowsTitle(activeTab)}`}
            placeholder="Search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      {activeTab === 'ledger' ? (
        <LedgerTable rows={visibleLedgerRows} />
      ) : (
        <FinanceTable rows={visibleRows} />
      )}
    </section>
  )
}

function AccountMenuDialog({
  onClose,
  onOpenBets,
  onOpenLedger,
  onOpenSlip,
}: {
  onClose: () => void
  onOpenBets: () => void
  onOpenLedger: () => void
  onOpenSlip: () => void
}) {
  return (
    <div className="legacy-modal-backdrop">
      <section
        className="legacy-dialog legacy-account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legacy-account-menu-title"
      >
        <button
          className="legacy-close"
          type="button"
          aria-label="Close account menu"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p>Profile</p>
        <h2 id="legacy-account-menu-title">Account Menu</h2>
        <div className="legacy-account-menu-summary">
          <span>Mock bankroll</span>
          <strong>$20,000.00</strong>
          <small>No real wager is placed from ProphetPicks.</small>
        </div>
        <div className="legacy-catalog-list">
          <button type="button" onClick={onOpenSlip}>
            Open Betting Slip
          </button>
          <button type="button" onClick={onOpenBets}>
            View Bet History
          </button>
          <button type="button" onClick={onOpenLedger}>
            View Account Ledger
          </button>
        </div>
      </section>
    </div>
  )
}

function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="legacy-table-wrap">
      <table className="legacy-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.description}</td>
              <td>{row.debit}</td>
              <td>{row.credit}</td>
              <td>{row.balance}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>No ledger rows match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FinanceTable({ rows }: { rows: FinanceRow[] }) {
  return (
    <div className="legacy-table-wrap">
      <table className="legacy-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.method}</td>
              <td>{row.amount}</td>
              <td>{row.status}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4}>No finance rows match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CatalogDialog({
  event,
  onClose,
  onOpenMarket,
}: {
  event: LegacyEvent
  onClose: () => void
  onOpenMarket: (event: LegacyEvent, market: LegacyMarket) => void
}) {
  const titleId = `catalog-${event.id}`
  const markets = getMarketsForEvent(event)

  return (
    <div className="legacy-modal-backdrop">
      <section
        className="legacy-dialog legacy-catalog-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          className="legacy-close"
          type="button"
          aria-label="Close market catalog"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p>Market Catalog</p>
        <h2 id={titleId}>{eventName(event)}</h2>
        <span>
          {event.league} - {event.time}
        </span>
        <div className="legacy-catalog-list">
          {markets.map((market) => (
            <button
              key={market.id}
              type="button"
              onClick={() => onOpenMarket(event, market)}
            >
              {market.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function LegalDialog({
  topic,
  onClose,
}: {
  topic: LegalTopic
  onClose: () => void
}) {
  const content = legalTopics[topic]

  return (
    <div className="legacy-modal-backdrop">
      <section
        className="legacy-dialog legacy-legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`legal-${topic}`}
      >
        <button
          className="legacy-close"
          type="button"
          aria-label={`Close ${content.title}`}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p>Policy</p>
        <h2 id={`legal-${topic}`}>{content.title}</h2>
        <div className="legacy-policy-copy">{content.body}</div>
      </section>
    </div>
  )
}

function BettingSlipDialog({
  items,
  isConfirmed,
  mode,
  stakeInput,
  status,
  onConfirmChange,
  onClose,
  onModeChange,
  onRemove,
  onStakeChange,
  onSave,
}: {
  items: LegacySlipItem[]
  isConfirmed: boolean
  mode: SlipMode
  stakeInput: string
  status: string
  onConfirmChange: (confirmed: boolean) => void
  onClose: () => void
  onModeChange: (mode: SlipMode) => void
  onRemove: (index: number) => void
  onStakeChange: (stake: string) => void
  onSave: () => void
}) {
  const stake = parseStake(stakeInput)
  const risk = ticketRisk(items, mode, stake)
  const returnValue = ticketReturn(items, mode, stake)
  const profit = returnValue - risk

  return (
    <div className="legacy-modal-backdrop">
      <section
        className="legacy-dialog legacy-slip-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legacy-slip-title"
      >
        <button
          className="legacy-close"
          type="button"
          aria-label="Close betting slip"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p>Bet Type</p>
        <h2 id="legacy-slip-title">Betting Slip</h2>
        <span className="legacy-slip-count">
          {items.length} {items.length === 1 ? 'selection' : 'selections'}
        </span>
        <div className="legacy-slip-toggle" aria-label="Bet type">
          <button
            className={mode === 'simple' ? 'active' : ''}
            type="button"
            aria-pressed={mode === 'simple'}
            onClick={() => onModeChange('simple')}
          >
            Simple
          </button>
          <button
            className={mode === 'combined' ? 'active' : ''}
            type="button"
            aria-pressed={mode === 'combined'}
            onClick={() => onModeChange('combined')}
          >
            Combined
          </button>
        </div>
        <div className="legacy-slip-items">
          {items.length === 0 && <div className="legacy-empty">No selections yet.</div>}
          {items.map((item, index) => (
            <div className="legacy-slip-item" key={`${item.event.id}-${item.market.id}-${index}`}>
              <div>
                <strong>{item.selection.label}</strong>
                <span>
                  {item.market.label} - {item.event.time}
                </span>
              </div>
              <b>{formatDecimal(item.selection.odds)}</b>
              <button
                type="button"
                aria-label={`Remove ${item.selection.label}`}
                onClick={() => onRemove(index)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <div className="legacy-slip-summary">
          <div>
            <span>Price</span>
            <strong>{ticketPriceLabel(items, mode)}</strong>
          </div>
          <label>
            Stake
            <input
              aria-label="Stake"
              inputMode="decimal"
              value={stakeInput}
              onChange={(event) => onStakeChange(event.target.value)}
            />
          </label>
          <div>
            <span>Potential Return</span>
            <strong>{formatCurrency(returnValue)}</strong>
          </div>
          <div>
            <span>Potential Profit</span>
            <strong>{formatSignedCurrency(profit)}</strong>
          </div>
        </div>
        <label className="legacy-confirm">
          <input
            checked={isConfirmed}
            type="checkbox"
            onChange={(event) => onConfirmChange(event.target.checked)}
          />
          Confirm mock bet
        </label>
        <button
          className="legacy-place-bet"
          type="button"
          disabled={!isConfirmed || items.length === 0}
          onClick={onSave}
        >
          <CircleDollarSign size={18} aria-hidden="true" />
          Place Mock Bet
        </button>
        {status && (
          <div className="legacy-inline-status" role="status">
            <TicketCheck size={16} aria-hidden="true" />
            {status}
          </div>
        )}
      </section>
    </div>
  )
}

type OddsBoardSportFilter = 'all' | SportKey
type OddsBoardCategoryFilter = 'all' | OddsBoardCategory

const ODDS_BOARD_CATEGORIES: OddsBoardCategory[] = [
  'moneyline',
  'spread',
  'total',
  'props',
  'futures',
  'other',
]

function OddsBoardScreen({
  onAddSlipItem,
}: {
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  const [sportFilter, setSportFilter] = useState<OddsBoardSportFilter>('all')
  const [categoryFilter, setCategoryFilter] =
    useState<OddsBoardCategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const baseQuotes = useMemo(() => buildOddsQuotes(), [])
  const [quotes, setQuotes] = useState<OddsQuote[]>(baseQuotes)
  const [providerStatus, setProviderStatus] = useState<string>(
    'Local demo quotes loaded',
  )

  useEffect(() => {
    let cancelled = false

    loadOddsQuotes()
      .then((result) => {
        if (cancelled) {
          return
        }

        if (result.quotes.length > 0) {
          setQuotes(result.quotes)
        }

        setProviderStatus(result.statusLabel)
      })
      .catch(() => {
        if (!cancelled) {
          setProviderStatus('Provider offline - showing local demo quotes')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const visibleQuotes = useMemo(
    () =>
      quotes.filter((quote) => {
        const sportMatches = sportFilter === 'all' || quote.sport === sportFilter
        const categoryMatches =
          categoryFilter === 'all' || quote.category === categoryFilter
        const searchText = [
          quote.matchup,
          quote.marketLabel,
          quote.selectionLabel,
          quote.sportLabel,
          quote.source,
        ].join(' ')

        return (
          sportMatches && categoryMatches && matchesSearch(searchText, searchQuery)
        )
      }),
    [categoryFilter, quotes, searchQuery, sportFilter],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, OddsQuote[]>()

    for (const quote of visibleQuotes) {
      const key = `${quote.eventId}::${quote.marketId}`
      const bucket = map.get(key) ?? []
      bucket.push(quote)
      map.set(key, bucket)
    }

    return Array.from(map.values())
  }, [visibleQuotes])

  return (
    <section className="legacy-stage legacy-odds-board" aria-labelledby="odds-board-title">
      <div className="legacy-title-row">
        <div>
          <p>Dense sportsbook quotes</p>
          <h1 id="odds-board-title">Odds Board</h1>
        </div>
        <div className="legacy-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search odds"
            placeholder="Search matchup, market, or source"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="legacy-odds-status">
        <span>{providerStatus}</span>
        <span>
          {visibleQuotes.length} of {quotes.length} odds shown
        </span>
      </div>

      <div className="legacy-prediction-filters" aria-label="Odds board filters">
        <label>
          Sport
          <select
            value={sportFilter}
            onChange={(event) =>
              setSportFilter(event.target.value as OddsBoardSportFilter)
            }
          >
            <option value="all">All Sports</option>
            {sports.map((sport) => (
              <option key={sport.key} value={sport.key}>
                {sport.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Market
          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as OddsBoardCategoryFilter)
            }
          >
            <option value="all">All Markets</option>
            {ODDS_BOARD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="legacy-odds-board-stack">
        {grouped.length === 0 && (
          <div className="legacy-empty">No odds match those filters.</div>
        )}
        {grouped.map((bucket) => {
          const head = bucket[0]
          const key = `${head.eventId}-${head.marketId}`

          return (
            <article className="legacy-odds-board-card" key={key}>
              <header>
                <p>
                  {head.sportLabel} - {head.league}
                </p>
                <h2>{head.matchup}</h2>
                <span>
                  {head.marketLabel} - {getCategoryLabel(head.category)} - {head.startLabel}
                </span>
              </header>
              <div className="legacy-odds-board-tile-grid">
                {bucket.map((quote) => (
                  <OddsBoardTile
                    key={quote.id}
                    quote={quote}
                    onAdd={() => onAddSlipItem(quote.slipItem)}
                  />
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function OddsBoardTile({
  quote,
  onAdd,
}: {
  quote: OddsQuote
  onAdd: () => void
}) {
  const updatedLabel = new Date(quote.updatedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <button
      className="legacy-odds-board-tile"
      type="button"
      aria-label={`Add ${quote.selectionLabel} at decimal ${formatDecimal(quote.decimalOdds)} to slip`}
      onClick={onAdd}
    >
      <strong>{quote.selectionLabel}</strong>
      <span className="legacy-odds-board-prices">
        <em>
          Dec <b>{formatDecimal(quote.decimalOdds)}</b>
        </em>
        <em>
          Am <b>{formatAmericanOdds(quote.americanOdds)}</b>
        </em>
        <em>
          Imp <b>{formatProbability(quote.impliedProbability)}</b>
        </em>
      </span>
      <span className="legacy-odds-board-meta">
        <em>Move {formatMovement(quote.movement)}</em>
        <em>{quote.source}</em>
        <em>Updated {updatedLabel}</em>
      </span>
    </button>
  )
}
