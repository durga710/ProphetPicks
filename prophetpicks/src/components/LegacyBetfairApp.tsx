import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronDown,
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
  legacyEvents,
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
  americanToDecimalOdds,
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
import {
  loadBets,
  loadLiveState,
  loadNews,
  loadRealStatPack,
  loadSavedSlips,
  loadSchedule,
  loadSession,
  loadTeamLogo,
  logoutSession,
  saveBet,
  saveSlip,
  type NewsArticle,
  type RealStatPack,
  type ScheduleGame,
  type SessionSnapshot,
} from '../data/providers/persistence'
import {
  buildRealSlipItem,
  realScheduleToLegacyEvent,
  type RealMarketKey,
  type RealSelectionSide,
} from '../data/realSlipItems'

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
  | 'parlay-builder'
  | 'search'
  | 'settings'
  | 'my-slips'
  | 'live-board'

type OddsFormat = 'decimal' | 'american'

const ODDS_FORMAT_STORAGE_KEY = 'pp-odds-format'

function readStoredOddsFormat(): OddsFormat {
  if (typeof window === 'undefined') {
    return 'decimal'
  }
  const value = window.localStorage.getItem(ODDS_FORMAT_STORAGE_KEY)
  return value === 'american' ? 'american' : 'decimal'
}

function persistOddsFormat(value: OddsFormat): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(ODDS_FORMAT_STORAGE_KEY, value)
}

function formatPrice(decimalOdds: number, format: OddsFormat): string {
  if (format === 'american') {
    return formatAmericanOdds(decimalToAmericanOdds(decimalOdds))
  }
  return formatDecimal(decimalOdds)
}
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
  const [statPackEvent, setStatPackEvent] = useState<LegacyEvent | null>(null)
  const [realStatPack, setRealStatPack] = useState<{
    sport: SportKey
    eventId: string
    title: string
  } | null>(null)
  const [savedSlips, setSavedSlips] = useState<SavedSlipSummary[]>([])
  const [headerSearch, setHeaderSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(readStoredOddsFormat)
  const [notifications, setNotifications] = useState<FdNotification[]>(
    DEFAULT_NOTIFICATIONS,
  )
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [session, setSession] = useState<SessionSnapshot | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }
    let cancelled = false
    loadSession().then((snapshot) => {
      if (cancelled) {
        return
      }
      setSession(snapshot)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut(): Promise<void> {
    const ok = await logoutSession()
    if (ok) {
      setSession((current) =>
        current ? { ...current, user: null } : current,
      )
      setStatus('Signed out. Your slip is still here locally.')
    }
  }

  function changeOddsFormat(next: OddsFormat): void {
    setOddsFormat(next)
    persistOddsFormat(next)
  }

  const activeEvents = useMemo(() => getEventsForSport(activeSport), [activeSport])
  const activeSportDefinition = getSport(activeSport)
  const predictions = useMemo(() => getResolvedPredictions(), [])

  // Optional persistence: warm-load any server-side bet history. Soft-fails
  // when /api/bets is unreachable; the mockBets state remains the source of
  // truth for the current session.
  useEffect(() => {
    let cancelled = false

    loadBets().then((result) => {
      // Skip the demo payload (legacyBets already covers it in the view) and
      // only merge when the API is actually reading from Neon.
      if (cancelled || !result || result.source !== 'neon') {
        return
      }

      setMockBets((current) => {
        const existing = new Set(current.map((bet) => bet.id))
        const merged = [...current]
        for (const bet of result.bets) {
          if (!existing.has(bet.id)) {
            merged.push(bet)
          }
        }
        return merged
      })
    })

    loadSavedSlips().then((result) => {
      if (cancelled || !result || result.source !== 'neon' || result.slips.length === 0) {
        return
      }

      setSavedSlips((current) => {
        const existing = new Set(current.map((slip) => slip.slipId))
        const merged = [...current]
        for (const slip of result.slips) {
          if (!existing.has(slip.slipId)) {
            merged.push({
              slipId: slip.slipId,
              savedAt: slip.savedAt,
              legCount: slip.legCount,
              mode: slip.mode,
              topSelection: slip.topSelection,
              combinedPrice: slip.combinedPrice,
            })
          }
        }
        return merged.slice(0, 12)
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

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

    const newBet: LegacyBet = {
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
    }

    setMockBets((bets) => [newBet, ...bets])

    // Optional server-side persistence. Soft-fails offline; React state stays
    // the source of truth regardless of network outcome.
    void saveBet(newBet)
    const topSelection = primaryItem.selection.label
    const summaryPrice = combinedPrice(slipItems)
    const itemsSnapshot = slipItems.map((item) => ({
      event: item.event,
      market: item.market,
      selection: item.selection,
    }))
    saveSlip(slipItems, slipMode, stake).then((response) => {
      if (!response) {
        return
      }

      setSavedSlips((current) =>
        [
          {
            slipId: response.slipId,
            savedAt: response.savedAt,
            legCount: response.legCount,
            mode: slipMode,
            topSelection,
            combinedPrice: summaryPrice,
            items: itemsSnapshot,
          },
          ...current,
        ].slice(0, 12),
      )
    })
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

  function cashOutBet(betId: string): void {
    setMockBets((bets) =>
      bets.map((bet) => {
        if (bet.id !== betId || !bet.status.includes('Pending')) {
          return bet
        }

        const stakeNumber = Number.parseFloat(bet.stake.replace(/[^\d.]/g, ''))
        if (!Number.isFinite(stakeNumber) || stakeNumber <= 0) {
          return bet
        }

        const cashoutAmount = stakeNumber * 0.92
        const profit = cashoutAmount - stakeNumber

        return {
          ...bet,
          status: `Cashed Out ${formatCurrency(cashoutAmount)}`,
          profitLoss: formatSignedCurrency(profit),
        }
      }),
    )

    setStatus('Cash-out locked in. The original ticket is closed.')
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
          <form
            className="fd-header-search"
            role="search"
            aria-label="Search the hub"
            onSubmit={(event) => {
              event.preventDefault()
              const query = headerSearch.trim()
              if (!query) {
                return
              }
              setSearchQuery(query)
              navigate('search')
            }}
          >
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Hub search"
              placeholder="Search the hub"
              value={headerSearch}
              onChange={(event) => setHeaderSearch(event.target.value)}
            />
          </form>
          <div className="legacy-account">
            {session?.user ? (
              <>
                {session.user.picture && (
                  <img
                    className="fd-user-avatar"
                    src={session.user.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}
                <span>{session.user.name || session.user.email}</span>
                <strong>Credits: $20000</strong>
                <button
                  className="fd-signout"
                  type="button"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </>
            ) : session?.authProvider === 'google' ? (
              <>
                <a className="fd-signin" href="/api/auth/google/start">
                  Sign in with Google
                </a>
                <strong>Credits: $20000</strong>
              </>
            ) : (
              <>
                <span>Hello, Jhon Alexander</span>
                <strong>Credits: $20000</strong>
              </>
            )}
            <button
              className="fd-bell"
              type="button"
              aria-label="Open notifications"
              aria-expanded={isNotificationsOpen}
              onClick={() => setIsNotificationsOpen((open) => !open)}
            >
              <Bell size={18} aria-hidden="true" />
              {notifications.some((notification) => !notification.read) && (
                <span
                  className="fd-bell-badge"
                  aria-label={`${notifications.filter((notification) => !notification.read).length} unread`}
                >
                  {notifications.filter((notification) => !notification.read).length}
                </span>
              )}
            </button>
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
            className={screen === 'live-board' ? 'active' : ''}
            type="button"
            onClick={() => navigate('live-board')}
          >
            <Trophy size={16} aria-hidden="true" />
            Live Games
          </button>
          <button
            className={screen === 'parlay-builder' ? 'active' : ''}
            type="button"
            onClick={() => navigate('parlay-builder')}
          >
            <TicketCheck size={16} aria-hidden="true" />
            Parlay Builder
          </button>
          <button
            className={screen === 'my-slips' ? 'active' : ''}
            type="button"
            onClick={() => navigate('my-slips')}
          >
            <ClipboardList size={16} aria-hidden="true" />
            My Slips
          </button>
          <button
            className={screen === 'settings' ? 'active' : ''}
            type="button"
            onClick={() => navigate('settings')}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            Settings
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

      <div className="legacy-shell-grid">
        <aside className="legacy-side-rail" aria-label="Side rail">
          <h3>Sports</h3>
          <SportRail activeSport={activeSport} onChangeSport={changeSport} />
        </aside>

        <main className="legacy-main">
          {(screen === 'events' || screen === 'today' || screen === 'odds') && (
            <>
              <FdSportHub
                sport={activeSport}
                eventCount={activeEvents.length}
                events={activeEvents}
              />
              <FdRealScheduleRail
                sport={activeSport}
                oddsFormat={oddsFormat}
                onAddSlipItem={addSlipItem}
                onOpenStatPack={(game) =>
                  setRealStatPack({
                    sport: activeSport,
                    eventId: game.id,
                    title: game.longName,
                  })
                }
              />
              <FdNewsRail sport={activeSport} />
              <FdFeaturedHero sport={activeSport} onAddSlipItem={addSlipItem} />
              <FdPromoStrip sport={activeSport} />
              <FdBoostedOddsRail
                sport={activeSport}
                onAddSlipItem={addSlipItem}
              />
              <FdTrendingRail
                sport={activeSport}
                onAddSlipItem={addSlipItem}
              />
              <FdPopularParlays
                sport={activeSport}
                onLoadParlay={(parlayItems) => {
                  setSlipItems(parlayItems)
                  setSlipMode('combined')
                  setIsConfirmed(false)
                  setIsSlipOpen(true)
                  setStatus(
                    `Loaded ${parlayItems.length}-leg parlay into your slip.`,
                  )
                }}
              />
              <FdLiveNowRail onAddSlipItem={addSlipItem} />
            </>
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
              eyebrow={screen === 'today' ? 'Live tonight' : "Today's lines"}
              emptyMessage={
                screen === 'today'
                  ? 'No matches match the current filters. Try another sport or clear search.'
                  : 'No matches found for the current filters.'
              }
              onOpenCatalog={openCatalog}
              onAddSlipItem={addSlipItem}
              onOpenStatPack={setStatPackEvent}
              oddsFormat={oddsFormat}
            />
          )}

          {screen === 'market' && (
            <MarketScreen
              event={selectedEvent}
              market={selectedMarket}
              onOpenMarket={openMarket}
              onRefreshMarket={refreshMarket}
              onAddSelection={addSelection}
              oddsFormat={oddsFormat}
            />
          )}

          {screen === 'teams' && <TeamsScreen teams={legacyTeams} />}

          {screen === 'predictions' && (
            <PredictionScreen
              predictions={predictions}
              onAddPrediction={addPrediction}
              onBuildBestParlay={buildBestParlay}
            />
          )}

          {screen === 'odds' && <OddsBoardScreen onAddSlipItem={addSlipItem} />}

          {screen === 'live-board' && (
            <LiveBoardScreen
              sport={activeSport}
              oddsFormat={oddsFormat}
              onAddSlipItem={addSlipItem}
              onOpenStatPack={(game) =>
                setRealStatPack({
                  sport: activeSport,
                  eventId: game.id,
                  title: game.longName,
                })
              }
            />
          )}

          {screen === 'parlay-builder' && (
            <QuickParlayBuilder
              events={legacyEvents}
              onLoadParlay={(parlayItems) => {
                setSlipItems(parlayItems)
                setSlipMode('combined')
                setIsConfirmed(false)
                setIsSlipOpen(true)
                setStatus(
                  `Built a ${parlayItems.length}-leg parlay. Confirm to mock-place it.`,
                )
              }}
            />
          )}

          {screen === 'search' && (
            <SearchResultsScreen
              query={searchQuery}
              onChangeQuery={(next) => setSearchQuery(next)}
              events={legacyEvents}
              onOpenCatalog={openCatalog}
              onOpenStatPack={setStatPackEvent}
            />
          )}

          {screen === 'settings' && (
            <SettingsScreen
              oddsFormat={oddsFormat}
              onChangeOddsFormat={changeOddsFormat}
            />
          )}

          {screen === 'my-slips' && (
            <MySlipsScreen
              savedSlips={savedSlips}
              onReload={(slip) => {
                if (!slip.items || slip.items.length === 0) {
                  setStatus(
                    'This slip is a server snapshot only — reload not available.',
                  )
                  return
                }
                setSlipItems(slip.items)
                setSlipMode(slip.mode)
                setIsConfirmed(false)
                setIsSlipOpen(true)
                setStatus(`Reloaded ${slip.legCount}-leg slip into the editor.`)
              }}
            />
          )}

          {screen === 'bets' && (
            <BetsScreen
              bets={[...mockBets, ...legacyBets]}
              onCashOut={cashOutBet}
            />
          )}

          {screen === 'finance' && (
            <FinanceScreen
              activeTab={financeTab}
              ledgerRows={[...mockLedgerRows, ...legacyLedger]}
              onAccountClick={() => navigate('account')}
              onTabChange={setFinanceTab}
            />
          )}
        </main>

        <FdSlipPreviewRail
          items={slipItems}
          mode={slipMode}
          stakeInput={stakeInput}
          savedSlips={savedSlips}
          onOpen={() => setIsSlipOpen(true)}
        />
      </div>

      <FdBottomNav screen={screen} onNavigate={navigate} />

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

      {statPackEvent && (
        <FdStatPackDrawer
          event={statPackEvent}
          onClose={() => setStatPackEvent(null)}
        />
      )}

      {realStatPack && (
        <FdRealStatPackDrawer
          sport={realStatPack.sport}
          eventId={realStatPack.eventId}
          fallbackTitle={realStatPack.title}
          onClose={() => setRealStatPack(null)}
        />
      )}

      {isNotificationsOpen && (
        <FdNotificationsPanel
          notifications={notifications}
          onClose={() => setIsNotificationsOpen(false)}
          onMarkRead={(id) =>
            setNotifications((current) =>
              current.map((notification) =>
                notification.id === id
                  ? { ...notification, read: true }
                  : notification,
              ),
            )
          }
          onMarkAllRead={() =>
            setNotifications((current) =>
              current.map((notification) => ({ ...notification, read: true })),
            )
          }
        />
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
    <nav className="legacy-sport-rail" aria-label="League categories">
      {sports.map((sport) => (
        <button
          className={sport.key === activeSport ? 'active' : ''}
          key={sport.key}
          type="button"
          onClick={() => onChangeSport(sport.key)}
        >
          {sport.label}
        </button>
      ))}
    </nav>
  )
}

type PrimaryMarkets = {
  moneyline: LegacyMarket | null
  spread: LegacyMarket | null
  total: LegacyMarket | null
}

function pickPrimaryMarkets(event: LegacyEvent): PrimaryMarkets {
  const markets = getMarketsForEvent(event)
  const findById = (...ids: string[]): LegacyMarket | null =>
    markets.find((market) => ids.includes(market.id)) ?? null

  return {
    moneyline: findById('moneyline', 'match-odds', 'winner'),
    spread: findById('spread', 'handicap', 'run-line', 'puck-line', 'to-qualify'),
    total: findById('total', 'goals-25'),
  }
}

function shortenSelectionLabel(selection: LegacyMarket['selections'][number]): string {
  const label = selection.label
  if (label.length <= 18) {
    return label
  }

  return `${label.slice(0, 17)}…`
}

function FdOddsButton({
  event,
  market,
  selection,
  onAdd,
  oddsFormat,
}: {
  event: LegacyEvent
  market: LegacyMarket
  selection: LegacyMarket['selections'][number]
  onAdd: (item: LegacySlipItem) => void
  oddsFormat: OddsFormat
}) {
  const display = formatPrice(selection.odds, oddsFormat)

  return (
    <button
      className="fd-odd-btn"
      type="button"
      aria-label={`Board ${selection.label} ${market.label} at ${formatDecimal(selection.odds)}`}
      onClick={() => onAdd({ event, market, selection })}
    >
      <span className="fd-line">{shortenSelectionLabel(selection)}</span>
      <span className="fd-price">{display}</span>
    </button>
  )
}

function FdMarketColumn({
  label,
  event,
  market,
  onAdd,
  oddsFormat,
}: {
  label: string
  event: LegacyEvent
  market: LegacyMarket | null
  onAdd: (item: LegacySlipItem) => void
  oddsFormat: OddsFormat
}) {
  return (
    <div className="fd-row-market">
      <div className="fd-row-market-label">{label}</div>
      {market === null
        ? Array.from({ length: 2 }).map((_, index) => (
            <div className="fd-odd-empty" key={`empty-${index}`}>—</div>
          ))
        : market.selections
            .slice(0, 3)
            .map((selection) => (
              <FdOddsButton
                key={selection.id}
                event={event}
                market={market}
                selection={selection}
                onAdd={onAdd}
                oddsFormat={oddsFormat}
              />
            ))}
    </div>
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
  onAddSlipItem,
  onOpenStatPack,
  oddsFormat,
}: {
  sport: ReturnType<typeof getSport>
  groupedEvents: Record<string, LegacyEvent[]>
  groups: string[]
  title: string
  eyebrow: string
  emptyMessage: string
  onOpenCatalog: (event: LegacyEvent) => void
  onAddSlipItem: (item: LegacySlipItem) => void
  onOpenStatPack: (event: LegacyEvent) => void
  oddsFormat: OddsFormat
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
                {events.map((event) => {
                  const primary = pickPrimaryMarkets(event)
                  const note = EDITOR_NOTES[event.id]

                  return (
                    <Fragment key={event.id}>
                    <div className="fd-row">
                      <div className="fd-row-matchup">
                        <span className="fd-row-time">
                          {event.time}
                          <span className="fd-row-sgp">SGP</span>
                        </span>
                        <div className="fd-row-teams">
                          <span className="fd-row-team">
                            <TeamCrest
                              label={event.home}
                              code={event.homeCode}
                              primary={event.homePrimary}
                              secondary={event.homeSecondary}
                              logoUrl={event.homeLogoUrl}
                              sport={event.sport}
                            />
                            {event.home}
                          </span>
                          <span className="fd-row-team">
                            <TeamCrest
                              label={event.away}
                              code={event.awayCode}
                              primary={event.awayPrimary}
                              secondary={event.awaySecondary}
                              logoUrl={event.awayLogoUrl}
                              sport={event.sport}
                            />
                            {event.away}
                          </span>
                        </div>
                        <div className="fd-row-actions">
                          <button
                            className="fd-row-more"
                            type="button"
                            aria-label={`Open ${eventName(event)} market`}
                            onClick={() => onOpenCatalog(event)}
                          >
                            All markets ›
                          </button>
                          <button
                            className="fd-row-stats"
                            type="button"
                            aria-label={`Stat pack ${event.homeCode} vs ${event.awayCode}`}
                            onClick={() => onOpenStatPack(event)}
                          >
                            Stats
                          </button>
                        </div>
                      </div>
                      <FdMarketColumn
                        label="Spread"
                        event={event}
                        market={primary.spread}
                        onAdd={onAddSlipItem}
                        oddsFormat={oddsFormat}
                      />
                      <FdMarketColumn
                        label="Total"
                        event={event}
                        market={primary.total}
                        onAdd={onAddSlipItem}
                        oddsFormat={oddsFormat}
                      />
                      <FdMarketColumn
                        label="Moneyline"
                        event={event}
                        market={primary.moneyline}
                        onAdd={onAddSlipItem}
                        oddsFormat={oddsFormat}
                      />
                    </div>
                    {note && <FdEditorNote note={note} />}
                    </Fragment>
                  )
                })}
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
  logoUrl,
  sport = '',
}: {
  label: string
  code: string
  primary: string
  secondary: string
  logoUrl?: string
  sport?: string
}) {
  const resolvedLogo = useRealTeamLogo(label, sport, code, logoUrl)

  return (
    <span className="legacy-team-crest-wrap">
      <span
        className={`legacy-team-crest ${resolvedLogo ? 'has-logo' : ''}`}
        role="img"
        aria-label={`${label} crest`}
        style={{
          '--team-primary': primary,
          '--team-secondary': secondary,
        } as CSSProperties}
      >
        {resolvedLogo ? (
          <img
            src={resolvedLogo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(event) => {
              const target = event.currentTarget
              target.style.display = 'none'
            }}
          />
        ) : null}
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
  oddsFormat,
}: {
  event: LegacyEvent
  market: LegacyMarket
  onOpenMarket: (event: LegacyEvent, market: LegacyMarket) => void
  onRefreshMarket: (event: LegacyEvent) => void
  onAddSelection: (selection: LegacyMarket['selections'][number]) => void
  oddsFormat: OddsFormat
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
                logoUrl={event.homeLogoUrl}
                sport={event.sport}
              />
              <span className="legacy-versus">VS</span>
              <TeamCrest
                label={event.away}
                code={event.awayCode}
                primary={event.awayPrimary}
                secondary={event.awaySecondary}
                logoUrl={event.awayLogoUrl}
                sport={event.sport}
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
                  <b>{formatPrice(selection.odds, oddsFormat)}</b>
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
          logoUrl={event.homeLogoUrl}
          sport={event.sport}
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
          logoUrl={event.awayLogoUrl}
          sport={event.sport}
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
          <p>Your account at a glance</p>
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
          <p>Editor's picks</p>
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
          <span>Picks today</span>
          <strong>{predictions.length}</strong>
        </article>
        <article>
          <span>A Confidence</span>
          <strong>
            {predictions.filter((prediction) => prediction.confidence === 'A').length}
          </strong>
        </article>
        <article>
          <span>Avg lean</span>
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
              logoUrl={team.logoUrl}
              sport={team.sport}
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

type LiveGameSnapshot = {
  id: string
  eventId: string
  league: string
  status: string
  homeCode: string
  awayCode: string
  homeScore: number
  awayScore: number
}

type BetInsights = {
  totalWagered: number
  settledCount: number
  pendingCount: number
  winCount: number
  winRatePercent: number
  biggestWin: number
  biggestWinMatch: string | null
  longestStreak: number
}

function computeBetInsights(bets: LegacyBet[]): BetInsights {
  let totalWagered = 0
  let settledCount = 0
  let pendingCount = 0
  let winCount = 0
  let biggestWin = 0
  let biggestWinMatch: string | null = null
  let currentStreak = 0
  let longestStreak = 0

  for (const bet of bets) {
    const stakeNumber = Number.parseFloat(bet.stake.replace(/[^\d.]/g, ''))
    if (Number.isFinite(stakeNumber)) {
      totalWagered += stakeNumber
    }

    const status = bet.status.toLowerCase()
    if (status.includes('pending')) {
      pendingCount += 1
      currentStreak = 0
      continue
    }

    settledCount += 1
    const profitNumber = Number.parseFloat(
      bet.profitLoss.replace(/[^\d.\-+]/g, '').replace('+', ''),
    )
    const isWin = bet.profitLoss.startsWith('+') && profitNumber > 0

    if (isWin) {
      winCount += 1
      currentStreak += 1
      longestStreak = Math.max(longestStreak, currentStreak)

      if (profitNumber > biggestWin) {
        biggestWin = profitNumber
        biggestWinMatch = bet.match
      }
    } else {
      currentStreak = 0
    }
  }

  const winRatePercent =
    settledCount === 0 ? 0 : Math.round((winCount / settledCount) * 100)

  return {
    totalWagered,
    settledCount,
    pendingCount,
    winCount,
    winRatePercent,
    biggestWin,
    biggestWinMatch,
    longestStreak,
  }
}

function findLiveGameForBet(
  bet: LegacyBet,
  liveGames: LiveGameSnapshot[],
): LiveGameSnapshot | null {
  if (liveGames.length === 0) {
    return null
  }

  return (
    liveGames.find((game) => {
      const event = legacyEvents.find((candidate) => candidate.id === game.eventId)
      if (!event) {
        return false
      }
      return (
        bet.match.includes(event.home) || bet.match.includes(event.away)
      )
    }) ?? null
  )
}

function BetsScreen({
  bets,
  onCashOut,
}: {
  bets: LegacyBet[]
  onCashOut: (betId: string) => void
}) {
  const [typeFilter, setTypeFilter] = useState<BetTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [liveGames, setLiveGames] = useState<LiveGameSnapshot[]>([])

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }
    let cancelled = false

    function poll(): void {
      loadLiveState().then((snapshot) => {
        if (cancelled || !snapshot) {
          return
        }
        setLiveGames(snapshot.games)
      })
    }

    poll()
    const id = setInterval(poll, 30_000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
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

  const insights = useMemo(() => computeBetInsights(bets), [bets])

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

      <div className="fd-bet-insights" aria-label="Bet insights">
        <article>
          <span>Total wagered</span>
          <strong>${insights.totalWagered.toFixed(2)}</strong>
          <small>{insights.settledCount} settled · {insights.pendingCount} pending</small>
        </article>
        <article>
          <span>Win rate</span>
          <strong>{insights.winRatePercent}%</strong>
          <small>{insights.winCount} wins of {insights.settledCount} settled</small>
        </article>
        <article>
          <span>Biggest win</span>
          <strong>${insights.biggestWin.toFixed(2)}</strong>
          <small>
            {insights.biggestWin > 0
              ? 'All-time peak settled ticket'
              : 'No winning tickets yet'}
          </small>
        </article>
        <article>
          <span>Longest streak</span>
          <strong>{insights.longestStreak}</strong>
          <small>consecutive settled wins</small>
        </article>
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleBets.map((bet) => {
              const isPending = bet.status.includes('Pending')
              const stakeNumber = Number.parseFloat(
                bet.stake.replace(/[^\d.]/g, ''),
              )
              const cashoutValue =
                isPending && Number.isFinite(stakeNumber)
                  ? stakeNumber * 0.92
                  : null
              const liveGame = isPending
                ? findLiveGameForBet(bet, liveGames)
                : null

              return (
                <tr key={bet.id}>
                  <td>{bet.match}</td>
                  <td>{bet.market}</td>
                  <td>{bet.type}</td>
                  <td>{bet.stake}</td>
                  <td>{bet.price}</td>
                  <td
                    className={
                      bet.profitLoss.startsWith('+') ? 'positive' : 'negative'
                    }
                  >
                    {bet.profitLoss}
                  </td>
                  <td>
                    <div className="fd-bet-status">
                      <span>{bet.status}</span>
                      {liveGame && (
                        <span
                          className="fd-bet-live-chip"
                          aria-label="Live game tracker"
                          key={`${liveGame.id}-${liveGame.homeScore}-${liveGame.awayScore}`}
                        >
                          <span className="fd-live-dot" aria-hidden="true" />
                          {`${liveGame.league} ${liveGame.status} · ${liveGame.homeCode} ${liveGame.homeScore} — ${liveGame.awayCode} ${liveGame.awayScore}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{bet.date}</td>
                  <td>
                    {cashoutValue !== null ? (
                      <button
                        className="fd-cashout"
                        type="button"
                        aria-label={`Cash out ${bet.match} at ${formatCurrency(cashoutValue)}`}
                        onClick={() => onCashOut(bet.id)}
                      >
                        Cash Out {formatCurrency(cashoutValue)}
                      </button>
                    ) : (
                      <span className="fd-cashout-empty">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {visibleBets.length === 0 && (
              <tr>
                <td colSpan={9}>No bets match the current filters.</td>
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
          {groupItemsByEvent(items).map((group) => {
            const isSgp = group.items.length > 1
            const sgpPrice = group.items.reduce(
              (product, leg) => product * leg.selection.odds,
              1,
            )

            return (
              <div
                className={`legacy-slip-group ${isSgp ? 'is-sgp' : ''}`}
                key={group.eventId}
              >
                {isSgp && (
                  <div className="legacy-slip-sgp-header">
                    <span>
                      <em>SGP</em>
                      {group.eventLabel}
                    </span>
                    <b>{formatDecimal(sgpPrice)}</b>
                  </div>
                )}
                {group.items.map((item) => {
                  const slipIndex = items.indexOf(item)
                  return (
                    <div
                      className="legacy-slip-item"
                      key={`${item.event.id}-${item.market.id}-${item.selection.id}`}
                    >
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
                        onClick={() => onRemove(slipIndex)}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
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

type SavedSlipSummary = {
  slipId: string
  savedAt: string
  legCount: number
  mode: SlipMode
  topSelection: string
  combinedPrice: number
  items?: LegacySlipItem[]
}

type FdNotification = {
  id: string
  tone: 'info' | 'success' | 'warning'
  title: string
  body: string
  ago: string
  read: boolean
}

const DEFAULT_NOTIFICATIONS: FdNotification[] = [
  {
    id: 'notif-cashout',
    tone: 'success',
    title: 'Cash-out available',
    body: 'Your Chiefs ML pending bet has a cash-out offer locked in.',
    ago: '2m ago',
    read: false,
  },
  {
    id: 'notif-boost',
    tone: 'info',
    title: 'New boost dropped',
    body: 'Lakers in regulation boosted from +120 to +200. Limited time.',
    ago: '14m ago',
    read: false,
  },
  {
    id: 'notif-live-goal',
    tone: 'info',
    title: "Live: Arsenal score in the 65'",
    body: 'Arsenal vs Barca is now level at 1-1 in the second half.',
    ago: '22m ago',
    read: false,
  },
  {
    id: 'notif-promo-refer',
    tone: 'info',
    title: 'Refer a friend, earn $50',
    body: 'They place their first $20 bet, you both bank a Bonus Bet.',
    ago: '1h ago',
    read: true,
  },
  {
    id: 'notif-editor',
    tone: 'success',
    title: "Editor's pick of the day",
    body: 'Mahomes O 1.5 passing TDs — full write-up on the hub.',
    ago: '3h ago',
    read: true,
  },
]

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
    'Showing demo book prices',
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
          <p>Sportsbook lines, all sports</p>
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

// ----- Real game ML enrichment hook -----
// ESPN scoreboard inlines spread + total but rarely the moneyline.
// /api/stat-pack proxies the summary endpoint which DOES include ML.
// We lazy-fetch per visible game and cache per session.

type EnrichedLine = {
  homeMoneyLine: number | null
  awayMoneyLine: number | null
  provider: string | null
}

const enrichedOddsCache = new Map<string, EnrichedLine | null>()
const enrichedOddsInflight = new Map<string, Promise<EnrichedLine | null>>()

function useEnrichedMoneylines(
  sport: SportKey,
  eventId: string,
): EnrichedLine | null {
  const cacheKey = `${sport}:${eventId}`
  const cached = enrichedOddsCache.get(cacheKey) ?? null
  const [resolved, setResolved] = useState<EnrichedLine | null>(cached)

  useEffect(() => {
    if (!import.meta.env.PROD || !sport || !eventId) {
      return
    }
    if (enrichedOddsCache.has(cacheKey)) {
      return
    }

    let cancelled = false
    const inflight =
      enrichedOddsInflight.get(cacheKey) ??
      loadRealStatPack(sport, eventId).then((pack) => {
        const pc = pack?.pickcenter ?? null
        const value: EnrichedLine | null = pc
          ? {
              homeMoneyLine: pc.homeMoneyLine,
              awayMoneyLine: pc.awayMoneyLine,
              provider: pc.provider,
            }
          : null
        enrichedOddsCache.set(cacheKey, value)
        enrichedOddsInflight.delete(cacheKey)
        return value
      })
    enrichedOddsInflight.set(cacheKey, inflight)

    inflight.then((value) => {
      if (!cancelled) {
        setResolved(value)
      }
    })

    return () => {
      cancelled = true
    }
  }, [cacheKey, eventId, sport])

  return resolved
}

// ----- Real team logo hook -----
// Per-session cache: avoids hitting /api/team-logo for the same team twice
// even when many TeamCrests render across the page.
const teamLogoCache = new Map<string, string | null>()
const teamLogoInflight = new Map<string, Promise<string | null>>()

function useRealTeamLogo(
  name: string,
  sport: string,
  code: string,
  explicit?: string,
): string | undefined {
  const cacheKey = `${sport}:${code}:${name}`
  // Synchronous resolution: explicit prop wins, else hit the per-session cache
  // (which is a plain Map populated by previous renders' async fetches).
  const synchronous: string | undefined = explicit
    ? explicit
    : teamLogoCache.has(cacheKey)
      ? teamLogoCache.get(cacheKey) ?? undefined
      : undefined

  const [asyncResolved, setAsyncResolved] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (explicit || !name || teamLogoCache.has(cacheKey)) {
      return
    }
    // The /api/team-logo route only exists in the deployed Vercel build.
    // Skipping the fetch in dev/test keeps Vite's dev server quiet and
    // avoids dozens of HTML-falling-through-as-JSON failures during
    // Playwright runs.
    if (!import.meta.env.PROD) {
      return
    }

    let cancelled = false
    const inflight =
      teamLogoInflight.get(cacheKey) ??
      loadTeamLogo({ name, sport, code }).then((url) => {
        teamLogoCache.set(cacheKey, url)
        teamLogoInflight.delete(cacheKey)
        return url
      })
    teamLogoInflight.set(cacheKey, inflight)

    inflight.then((url) => {
      if (!cancelled) {
        setAsyncResolved(url ?? undefined)
      }
    })

    return () => {
      cancelled = true
    }
  }, [cacheKey, code, explicit, name, sport])

  return synchronous ?? asyncResolved
}

// ----- Viewport width hook (used to gate desktop/mobile-only chrome) -----
function useWindowWidth(): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    function syncWidth(): void {
      setWidth(window.innerWidth)
    }

    syncWidth()
    window.addEventListener('resize', syncWidth)
    return () => window.removeEventListener('resize', syncWidth)
  }, [])

  return width
}

// ----- Today's Real Games rail (ESPN) -----
function FdRealScheduleRail({
  sport,
  onOpenStatPack,
  onAddSlipItem,
  oddsFormat,
}: {
  sport: SportKey
  onOpenStatPack: (game: ScheduleGame) => void
  onAddSlipItem: (item: LegacySlipItem) => void
  oddsFormat: OddsFormat
}) {
  // Key the state by sport so switching sports drops the stale list
  // synchronously (rather than via a setState-in-effect that lint dislikes).
  const [state, setState] = useState<{
    sport: SportKey
    games: ScheduleGame[]
    loaded: boolean
  }>({ sport, games: [], loaded: false })

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }
    let cancelled = false

    function refresh(): void {
      loadSchedule(sport).then((response) => {
        if (cancelled) {
          return
        }
        setState({
          sport,
          games: response?.games ?? [],
          loaded: true,
        })
      })
    }

    refresh()
    // Re-pull every 30s so in-play scores + posted lines stay current.
    const id = setInterval(refresh, 30_000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [sport])

  if (!import.meta.env.PROD) {
    return null
  }
  const stale = state.sport !== sport
  const games = stale ? [] : state.games
  const loaded = !stale && state.loaded

  // Show skeleton placeholders while loading; once loaded with zero games,
  // render nothing (off-season / no data for this sport right now).
  if (loaded && games.length === 0) {
    return null
  }

  if (!loaded) {
    // 3-card shimmer skeleton while ESPN responds.
    return (
      <section className="fd-real-schedule" aria-label="Today's real games loading">
        <header>
          <span>
            <em className="fd-live-pill fd-real-badge">
              <span className="fd-live-dot" aria-hidden="true" />
              Real
            </em>
            Today's games
          </span>
          <small>Loading from ESPN…</small>
        </header>
        <div className="fd-real-schedule-track">
          {[0, 1, 2].map((index) => (
            <article
              key={`skeleton-${index}`}
              className="fd-real-schedule-card is-skeleton"
              aria-hidden="true"
            >
              <span className="fd-real-schedule-league">—</span>
              <div className="fd-real-schedule-matchup" />
              <span className="fd-real-schedule-status">—</span>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="fd-real-schedule" aria-label="Today's real games">
      <header>
        <span>
          <em className="fd-live-pill fd-real-badge">
            <span className="fd-live-dot" aria-hidden="true" />
            Real
          </em>
          Today's games
        </span>
        <small>Live from ESPN · {games.length} on the board</small>
      </header>
      <div className="fd-real-schedule-track">
        {games.map((game) => {
          const kickoff = new Date(game.startsAt)
          const dateLabel = Number.isFinite(kickoff.getTime())
            ? kickoff.toLocaleTimeString([], {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : game.statusDetail
          const stateLabel =
            game.state === 'in'
              ? game.statusDetail || 'In Play'
              : game.state === 'post'
                ? game.statusDetail || 'Final'
                : dateLabel || game.statusDetail
          const isLive = game.state === 'in'

          return (
            <article className="fd-real-schedule-card" key={game.id}>
              <button
                className="fd-real-schedule-head"
                type="button"
                aria-label={`Open stat pack for ${game.longName}`}
                onClick={() => onOpenStatPack(game)}
              >
                <span className="fd-real-schedule-league">{game.league}</span>
                <div className="fd-real-schedule-matchup">
                  <FdRealTeamLine team={game.away} />
                  <FdRealTeamLine team={game.home} />
                </div>
                <span
                  className={`fd-real-schedule-status ${isLive ? 'is-live' : ''}`}
                >
                  {isLive && <span className="fd-live-dot" aria-hidden="true" />}
                  {stateLabel}
                </span>
              </button>
              <FdRealOddsGrid
                game={game}
                sport={sport}
                onAdd={onAddSlipItem}
                oddsFormat={oddsFormat}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}

function FdRealOddsGrid({
  game,
  sport,
  onAdd,
  oddsFormat,
}: {
  game: ScheduleGame
  sport: SportKey
  onAdd: (item: LegacySlipItem) => void
  oddsFormat: OddsFormat
}) {
  const enriched = useEnrichedMoneylines(sport, game.id)

  // Merge enriched MLs in when the scoreboard didn't provide them.
  const merged: ScheduleGame = useMemo(() => {
    if (!enriched || !game.odds) {
      return game
    }
    return {
      ...game,
      odds: {
        ...game.odds,
        homeMoneyLine: game.odds.homeMoneyLine ?? enriched.homeMoneyLine,
        awayMoneyLine: game.odds.awayMoneyLine ?? enriched.awayMoneyLine,
      },
    }
  }, [enriched, game])

  if (!merged.odds) {
    return (
      <div className="fd-real-odds-grid is-empty">
        <span>Lines not posted yet</span>
      </div>
    )
  }

  return (
    <div className="fd-real-odds-grid">
      <div className="fd-real-odds-head">
        <span>Spread</span>
        <span>Total</span>
        <span>Money</span>
      </div>
      <FdRealOddsRow
        game={merged}
        side="away"
        teamLabel={merged.away.code || merged.away.name.slice(0, 4).toUpperCase()}
        oddsFormat={oddsFormat}
        onAdd={onAdd}
      />
      <FdRealOddsRow
        game={merged}
        side="home"
        teamLabel={merged.home.code || merged.home.name.slice(0, 4).toUpperCase()}
        oddsFormat={oddsFormat}
        onAdd={onAdd}
      />
    </div>
  )
}

function FdRealOddsRow({
  game,
  side,
  teamLabel,
  oddsFormat,
  onAdd,
}: {
  game: ScheduleGame
  side: 'home' | 'away'
  teamLabel: string
  oddsFormat: OddsFormat
  onAdd: (item: LegacySlipItem) => void
}) {
  const totalSide: RealSelectionSide = side === 'home' ? 'under' : 'over'

  return (
    <div className="fd-real-odds-row">
      <span className="fd-real-odds-team">{teamLabel}</span>
      <FdRealOddsCell
        game={game}
        market="spread"
        side={side}
        oddsFormat={oddsFormat}
        onAdd={onAdd}
      />
      <FdRealOddsCell
        game={game}
        market="total"
        side={totalSide}
        oddsFormat={oddsFormat}
        onAdd={onAdd}
      />
      <FdRealOddsCell
        game={game}
        market="moneyline"
        side={side}
        oddsFormat={oddsFormat}
        onAdd={onAdd}
      />
    </div>
  )
}

function FdRealOddsCell({
  game,
  market,
  side,
  oddsFormat,
  onAdd,
}: {
  game: ScheduleGame
  market: RealMarketKey
  side: RealSelectionSide
  oddsFormat: OddsFormat
  onAdd: (item: LegacySlipItem) => void
}) {
  const built = buildRealSlipItem({ game, market, side })

  if (!built) {
    return (
      <span className="fd-real-odds-cell is-empty" aria-hidden="true">
        —
      </span>
    )
  }

  const price = formatPrice(built.decimalOdds, oddsFormat)
  const linePart = extractLinePart(built.selectionLabel)

  return (
    <button
      className="fd-real-odds-cell"
      type="button"
      aria-label={`Add ${built.selectionLabel} at ${price} to slip`}
      onClick={() => onAdd(built.item)}
    >
      {linePart && <span className="fd-real-odds-line">{linePart}</span>}
      <strong>{price}</strong>
    </button>
  )
}

function extractLinePart(selectionLabel: string): string | null {
  // For "Chiefs -3.5" return "-3.5"; for "Over 44.5" return "O 44.5";
  // for "Under 44.5" return "U 44.5"; for plain "Team ML" return null.
  const overMatch = selectionLabel.match(/^Over (.+)$/)
  if (overMatch) {
    return `O ${overMatch[1]}`
  }
  const underMatch = selectionLabel.match(/^Under (.+)$/)
  if (underMatch) {
    return `U ${underMatch[1]}`
  }
  const spreadMatch = selectionLabel.match(/(-?\+?-?\d+(?:\.\d+)?)$/)
  if (spreadMatch && !selectionLabel.endsWith(' ML')) {
    return spreadMatch[1]
  }
  return null
}

function FdRealTeamLine({ team }: { team: ScheduleGame['home'] }) {
  return (
    <div className="fd-real-schedule-team">
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span className="fd-real-schedule-mono" aria-hidden="true">
          {team.code.slice(0, 3)}
        </span>
      )}
      <strong>{team.name}</strong>
      {team.score !== null && <b>{team.score}</b>}
    </div>
  )
}

// ----- Today's News rail (ESPN) -----
function FdNewsRail({ sport }: { sport: SportKey }) {
  const [state, setState] = useState<{ sport: SportKey; articles: NewsArticle[]; loaded: boolean }>({
    sport,
    articles: [],
    loaded: false,
  })

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }
    let cancelled = false

    loadNews(sport).then((response) => {
      if (cancelled) {
        return
      }
      setState({ sport, articles: response?.articles ?? [], loaded: true })
    })

    return () => {
      cancelled = true
    }
  }, [sport])

  if (!import.meta.env.PROD) {
    return null
  }
  const stale = state.sport !== sport
  const loaded = !stale && state.loaded
  const articles = stale ? [] : state.articles

  if (loaded && articles.length === 0) {
    return null
  }

  if (!loaded) {
    return (
      <section className="fd-news-rail" aria-label="Sport news loading">
        <header>
          <span>Today's stories</span>
          <small>Loading from ESPN…</small>
        </header>
        <div className="fd-news-track">
          {[0, 1, 2].map((index) => (
            <article
              key={`news-skeleton-${index}`}
              className="fd-news-card is-skeleton"
              aria-hidden="true"
            >
              <div className="fd-news-thumb" />
              <strong>—</strong>
              <small>—</small>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="fd-news-rail" aria-label="Sport news">
      <header>
        <span>Today's stories</span>
        <small>ESPN · {articles.length} headlines</small>
      </header>
      <div className="fd-news-track">
        {articles.map((article) => {
          const time = (() => {
            const date = new Date(article.published)
            return Number.isFinite(date.getTime())
              ? date.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : article.published
          })()

          const inner = (
            <>
              <div
                className="fd-news-thumb"
                style={
                  article.image
                    ? {
                        backgroundImage: `url(${JSON.stringify(article.image)})`,
                      }
                    : undefined
                }
                aria-hidden="true"
              />
              <strong>{article.headline}</strong>
              <small>{time}</small>
            </>
          )

          return article.link ? (
            <a
              className="fd-news-card"
              key={article.id}
              href={article.link}
              target="_blank"
              rel="noreferrer noopener"
            >
              {inner}
            </a>
          ) : (
            <article className="fd-news-card" key={article.id}>
              {inner}
            </article>
          )
        })}
      </div>
    </section>
  )
}

// ----- Real ESPN stat-pack drawer -----
function FdRealStatPackDrawer({
  sport,
  eventId,
  fallbackTitle,
  onClose,
}: {
  sport: SportKey
  eventId: string
  fallbackTitle: string
  onClose: () => void
}) {
  const [pack, setPack] = useState<RealStatPack | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadRealStatPack(sport, eventId).then((result) => {
      if (cancelled) {
        return
      }
      setPack(result)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [eventId, sport])

  const title = pack?.homeName && pack?.awayName
    ? `${pack.awayName} @ ${pack.homeName}`
    : fallbackTitle

  return (
    <div className="legacy-modal-backdrop fd-statpack-backdrop">
      <section
        className="legacy-dialog fd-statpack-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`real-statpack-${eventId}`}
      >
        <button
          className="legacy-close"
          type="button"
          aria-label="Close stat pack"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p>Live stat pack · ESPN</p>
        <h2 id={`real-statpack-${eventId}`}>{title}</h2>

        {!loaded && (
          <p className="fd-statpack-empty">Loading stats from ESPN…</p>
        )}

        {loaded && !pack && (
          <p className="fd-statpack-empty">
            ESPN didn't return stats for this matchup. Try again closer to
            kickoff.
          </p>
        )}

        {loaded && pack && (
          <>
            <div className="fd-statpack-grid">
              <article>
                <span>{pack.awayName || 'Away'} form</span>
                <strong>{pack.awayForm || '—'}</strong>
              </article>
              <article>
                <span>{pack.homeName || 'Home'} form</span>
                <strong>{pack.homeForm || '—'}</strong>
              </article>
            </div>

            {pack.pickcenter && (
              <section className="fd-statpack-section">
                <h3>Live line · {pack.pickcenter.provider}</h3>
                <ul>
                  {pack.pickcenter.spread !== null && (
                    <li>Spread: {pack.pickcenter.spread > 0 ? '+' : ''}{pack.pickcenter.spread}</li>
                  )}
                  {pack.pickcenter.total !== null && (
                    <li>Total: {pack.pickcenter.total}</li>
                  )}
                  {pack.pickcenter.homeMoneyLine !== null && (
                    <li>Home ML: {pack.pickcenter.homeMoneyLine > 0 ? '+' : ''}{pack.pickcenter.homeMoneyLine}</li>
                  )}
                  {pack.pickcenter.awayMoneyLine !== null && (
                    <li>Away ML: {pack.pickcenter.awayMoneyLine > 0 ? '+' : ''}{pack.pickcenter.awayMoneyLine}</li>
                  )}
                </ul>
              </section>
            )}

            {pack.injuries.length > 0 && (
              <section className="fd-statpack-section">
                <h3>Injuries & status</h3>
                <ul>
                  {pack.injuries.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}

            {pack.leaders.length > 0 && (
              <section className="fd-statpack-section">
                <h3>Team leaders</h3>
                <ul>
                  {pack.leaders.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}

            {pack.headToHead.length > 0 && (
              <section className="fd-statpack-section">
                <h3>Head-to-head</h3>
                <ul>
                  {pack.headToHead.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>
    </div>
  )
}

// ----- Featured Pick of the Day -----
type FeaturedPickConfig = {
  eventId: string
  marketId: string
  selectionId: string
  headline: string
  body: string
  bullets: string[]
}

const FEATURED_PICKS: Partial<Record<SportKey, FeaturedPickConfig>> = {
  nfl: {
    eventId: 'chiefs-bills',
    marketId: 'player-props',
    selectionId: 'qb-passing',
    headline: 'Mahomes goes over his passing yards line tonight',
    body: 'Buffalo has surrendered 250+ pass yards in nine of their last eleven games and now travels cross-country on a short week with both starting safeties banged up. Andy Reid is 14-2 at home off a bye in his career. Patrick is going to throw a lot tonight — it is the easiest spot to attack on the board.',
    bullets: [
      'Bills allow 7.4 yards per attempt on the road (28th in the league).',
      'Mahomes averages 287 pass yards in home primetime games this year.',
      'Game total opened 47.5 and has ticked up to 49 — books expect points.',
    ],
  },
  soccer: {
    eventId: 'arsenal-barcelona',
    marketId: 'match-odds',
    selectionId: 'home',
    headline: 'Arsenal lift the Emirates again tonight',
    body: 'Barcelona is leaning on a patchwork back four with both first-choice centerbacks suspended after the Madrid leg. Arsenal has not dropped a point at home in this competition all season and presses opponents into 14+ turnovers per 90 — exactly the soft spot a depleted Barca defense cannot handle.',
    bullets: [
      'Arsenal 4W-0D-0L at the Emirates in this competition.',
      'Barcelona missing Araujo and Christensen at the back.',
      'Sharps moved the line from +120 to +100 on Arsenal in the last 18 hours.',
    ],
  },
  nba: {
    eventId: 'lakers-celtics',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    headline: 'Lakers grind one out at Crypto.com',
    body: 'LeBron and AD are fully healthy out of the All-Star break and Boston is on the back end of a brutal West Coast back-to-back. The Lakers shoot 49% from three at home this season and Crypto.com gets loud after halftime when the home team is within striking distance.',
    bullets: [
      'Boston is 4-9 ATS in road back-to-backs this year.',
      'LeBron averages 28-7-7 in nationally televised home games.',
      'Total ticked from 224.5 down to 222 — sharps expect a half-court grinder.',
    ],
  },
  nhl: {
    eventId: 'leafs-bruins',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    headline: 'Maple Leafs press the Bruins early at Scotiabank',
    body: 'Auston Matthews has 7 points in his last 5 vs Boston and the Bruins are playing their third game in four nights. Toronto wins the first-period shot share by 12% in this matchup and trails in expected goals by less than half a goal even when they lose.',
    bullets: [
      "Matthews on a five-game point streak with a hat trick last out.",
      'Boston goaltender on the back end of a back-to-back.',
      'Toronto is 8-2 SU at home off two days of rest this season.',
    ],
  },
  mlb: {
    eventId: 'yankees-dodgers',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    headline: 'Cole keeps the Dodgers off the board in the Bronx',
    body: "Gerrit Cole takes the mound off a bullpen day and the Dodgers lineup has gone ice cold against righties this road trip — 19 strikeouts in 30 innings and a .197 team OPS in the last two series. Wind is blowing in at the Stadium tonight too. It is the right side.",
    bullets: [
      'Dodgers slash .197/.262/.301 vs RHP on this trip.',
      'Cole has held LA to 4 ER in 21 career IP at home.',
      'Forecast: 8 mph wind in from RF, knocks gappers down.',
    ],
  },
  tennis: {
    eventId: 'alcaraz-sinner',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'Carlos handles Sinner on the clay',
    body: 'Alcaraz has won four of their last five meetings on clay and Sinner has been quietly managing a wrist niggle since Madrid. Carlos served huge in his quarterfinal and his return numbers on clay this year are absurd.',
    bullets: [
      'Alcaraz 4-1 vs Sinner on clay over the last 24 months.',
      "Sinner's wrist limited him to 58% first serves last round.",
      'Alcaraz holds 92% of his first-serve points on clay in Paris.',
    ],
  },
  ncaaf: {
    eventId: 'georgia-alabama',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    headline: 'Georgia controls the SEC tiebreaker in Athens',
    body: 'Bama travels to Sanford off a short week and the Dawgs have not lost at home since 2020. Georgia ranks first in line-of-scrimmage win rate on both sides and the weather is forecast wet — exactly the conditions a ground-and-pound favorite wants.',
    bullets: [
      'Georgia 31-1 SU at home over the last five seasons.',
      'Forecast: steady rain by kickoff, 15 mph winds.',
      'Alabama starting LT questionable with an ankle.',
    ],
  },
  ncaab: {
    eventId: 'duke-kansas',
    marketId: 'moneyline',
    selectionId: 'away-moneyline',
    headline: 'Kansas inside the Garden as Duke loses its starting PG',
    body: 'Duke ruled out PG Tyrese Proctor an hour before tip and the market moved fast from Duke -3 to Kansas -1.5. Bill Self is 18-4 in marquee non-conference games inside MSG and Kansas has the size to bully Duke around the rim without Proctor pushing pace.',
    bullets: [
      'Duke PG Tyrese Proctor out (ankle).',
      'Kansas 6-1 ATS as a road favorite this year.',
      'Bill Self 18-4 SU at MSG since 2016.',
    ],
  },
  golf: {
    eventId: 'scheffler-mcilroy',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'Scheffler over McIlroy on opening day at Augusta',
    body: 'Scheffler leads the field in approach play and Augusta rewards iron specialists. Rory has historically struggled with the back-nine corners and Scheffler is one of the few players who can play conservatively without losing strokes to the field.',
    bullets: [
      'Scheffler +2.3 strokes/round on approach this season.',
      'McIlroy is 0-for-his-last-9 at Augusta in Round 1.',
      'Wind forecast under 8 mph — pure ball-strikers thrive.',
    ],
  },
  ufc: {
    eventId: 'makhachev-oliveira',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'Makhachev defends the strap by decision',
    body: 'Islam has not lost a round in his last three title fights and Charles is at his best off his back when he has space to work submissions. Makhachev grinds and rides on the fence, takes minimal risks, and walks away with all five rounds.',
    bullets: [
      'Makhachev landed 12+ ground strikes/round in his last three.',
      'Oliveira has been knocked down in three of his last five fights.',
      'Sharp money on Makhachev by decision (currently around even money).',
    ],
  },
  boxing: {
    eventId: 'crawford-canelo',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'Bud Crawford goes the distance with the champ',
    body: 'Crawford is faster, longer, and more accurate from both stances. Canelo has not faced a southpaw of this caliber and his head-movement numbers have dipped each of the last three fights. Take Bud on the cards.',
    bullets: [
      'Crawford lands 41% of his power shots — top of the division.',
      'Canelo head-movement avoid rate dropped from 71% to 58%.',
      'Vegas line opened pick-em and moved to Bud -120.',
    ],
  },
  f1: {
    eventId: 'verstappen-hamilton',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'Verstappen pulls away at Silverstone',
    body: 'Max sits on pole with a tenth in hand and Red Bull has the strongest tire-wear data through Friday practice. Hamilton will keep him honest for ten laps but the long-run pace is decisive.',
    bullets: [
      'Verstappen FP3 long-run avg: 1:29.6.',
      'Hamilton FP3 long-run avg: 1:29.9.',
      'Forecast: dry and 24°C — soft compound favored.',
    ],
  },
  cricket: {
    eventId: 'india-australia',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'India edge Australia in the day-nighter at the MCG',
    body: "India's top order has handled the pink ball as well as anyone this cycle, and Australia is missing Cummins for the second match in a row. The pitch at the MCG is playing flat — first-innings 300 is in play.",
    bullets: [
      'India 9-2 in day-night ODIs since 2024.',
      'Cummins ruled out with a calf strain.',
      'MCG average first-innings score this series: 312.',
    ],
  },
  esports: {
    eventId: 't1-geng',
    marketId: 'winner',
    selectionId: 'home-winner',
    headline: 'T1 takes the LCK Spring crown',
    body: 'T1 looks dominant on red side and Faker has the best laning phase in the league against any GenG mid pick. Expect a 3-1 in T1\'s favor with the deciding game won on early-game tempo.',
    bullets: [
      'T1 has won the last 4 head-to-heads vs GenG.',
      'Faker has 9 KDA on Azir this split.',
      'T1 first-blood rate: 67% on red side in the playoffs.',
    ],
  },
}

function FdFeaturedHero({
  sport,
  onAddSlipItem,
}: {
  sport: SportKey
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  const config = FEATURED_PICKS[sport]
  if (!config) {
    return null
  }

  const event = legacyEvents.find((candidate) => candidate.id === config.eventId)
  if (!event) {
    return null
  }

  const market = getMarketsForEvent(event).find(
    (candidate) => candidate.id === config.marketId,
  )
  const selection = market?.selections.find(
    (option) => option.id === config.selectionId,
  )

  if (!market || !selection) {
    return null
  }

  const american = formatAmericanOdds(decimalToAmericanOdds(selection.odds))

  return (
    <section className="fd-hero" aria-label="Featured Pick of the Day">
      <header>
        <span>Editor's Pick of the Day</span>
        <small>{event.dateLabel} · {event.time} · {event.venue}</small>
      </header>
      <div className="fd-hero-body">
        <h2>{config.headline}</h2>
        <p>{config.body}</p>
        <ul>
          {config.bullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="fd-hero-pick">
        <div>
          <span>The bet</span>
          <strong>{selection.label}</strong>
          <em>{market.label} · {event.home} vs {event.away}</em>
        </div>
        <button
          type="button"
          aria-label={`Add Editor's Pick ${selection.label} at ${formatDecimal(selection.odds)} to slip`}
          onClick={() => onAddSlipItem({ event, market, selection })}
        >
          <b>{american}</b>
          <span>Add to slip</span>
        </button>
      </div>
    </section>
  )
}

// ----- Promo rotator -----
type PromoSlot = {
  id: string
  tone: 'blue' | 'green' | 'navy'
  eyebrow: string
  title: string
  caption: string
  sportKey?: SportKey | SportKey[]
}

const PROMO_SLOTS: PromoSlot[] = [
  {
    id: 'welcome',
    tone: 'blue',
    eyebrow: 'Welcome offer',
    title: 'Bet $5, get $200 in Bonus Bets',
    caption: 'New players only. Min $5 first cash wager.',
  },
  {
    id: 'sgp-insurance',
    tone: 'navy',
    eyebrow: 'Same Game Parlay Insurance',
    title: 'Get your stake back if one leg busts',
    caption: '4+ leg SGPs on any major matchup.',
  },
  {
    id: 'no-sweat-nfl',
    tone: 'navy',
    eyebrow: 'Daily No-Sweat Bet',
    title: 'Up to $10 back on your first NFL bet',
    caption: 'Refunded as a Bonus Bet if your pick loses.',
    sportKey: 'nfl',
  },
  {
    id: 'no-sweat-soccer',
    tone: 'navy',
    eyebrow: 'Daily No-Sweat Bet',
    title: 'Up to $10 back on your first soccer bet',
    caption: 'Refunded as a Bonus Bet if your pick loses.',
    sportKey: 'soccer',
  },
  {
    id: 'refer',
    tone: 'green',
    eyebrow: 'Refer & earn',
    title: 'Refer a friend, get $50',
    caption: 'When they place their first $20 cash bet.',
  },
  {
    id: 'profit-boost',
    tone: 'blue',
    eyebrow: 'Profit boost',
    title: '20% boost token, your call',
    caption: 'One-time use on any parlay this week.',
  },
  {
    id: 'loyalty',
    tone: 'navy',
    eyebrow: 'ProphetPicks Rewards',
    title: 'Earn $5 for every $250 wagered',
    caption: 'Stack rewards across every sport you play.',
  },
  {
    id: 'editor-pick-nfl',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Mahomes O 1.5 passing TDs',
    caption: 'Bills D has allowed 2+ in 9 of their last 11.',
    sportKey: 'nfl',
  },
  {
    id: 'editor-pick-soccer',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Arsenal to win + BTTS',
    caption: 'Patchwork Barca backline with two CBs suspended.',
    sportKey: 'soccer',
  },
  {
    id: 'editor-pick-nba',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Lakers in regulation vs Boston',
    caption: 'Healthy LeBron + AD at home vs a back-to-back road team.',
    sportKey: 'nba',
  },
  {
    id: 'editor-pick-nhl',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Matthews anytime goal',
    caption: '5-game point streak heading into a soft Bruins back-to-back.',
    sportKey: 'nhl',
  },
  {
    id: 'editor-pick-mlb',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Yankees-Dodgers under 8.5',
    caption: 'Cole, wind in, cold Dodgers lineup vs righties.',
    sportKey: 'mlb',
  },
  {
    id: 'editor-pick-tennis',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Alcaraz in straight sets',
    caption: 'Sinner managing a wrist niggle since Madrid.',
    sportKey: 'tennis',
  },
]

function slotMatchesSport(slot: PromoSlot, sport: SportKey): boolean {
  if (!slot.sportKey) {
    return true
  }
  if (Array.isArray(slot.sportKey)) {
    return slot.sportKey.includes(sport)
  }
  return slot.sportKey === sport
}

function useRotatingPromos(
  sport: SportKey,
  slotCount = 3,
  intervalMs = 6000,
): PromoSlot[] {
  const pool = useMemo(
    () => PROMO_SLOTS.filter((slot) => slotMatchesSport(slot, sport)),
    [sport],
  )
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (pool.length === 0) {
      return
    }
    const id = setInterval(() => {
      setTick((current) => current + 1)
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs, pool.length])

  return useMemo(() => {
    if (pool.length === 0) {
      return []
    }
    const offset = tick % pool.length
    return Array.from({ length: Math.min(slotCount, pool.length) }).map(
      (_, index) => pool[(offset + index) % pool.length],
    )
  }, [pool, slotCount, tick])
}

function FdPromoStrip({ sport }: { sport: SportKey }) {
  const visible = useRotatingPromos(sport)

  if (visible.length === 0) {
    return null
  }

  return (
    <div className="fd-promo-strip" aria-label="Promotions">
      {visible.map((slot) => (
        <article className={`fd-promo-card ${slot.tone}`} key={slot.id}>
          <span>{slot.eyebrow}</span>
          <strong>{slot.title}</strong>
          <b>{slot.caption}</b>
        </article>
      ))}
    </div>
  )
}

// ----- Boosted Odds rail -----
type BoostedOddsRow = {
  id: string
  eventId: string
  marketId: string
  label: string
  originalDecimal: number
  boostedDecimal: number
}

const BOOSTED_ODDS: BoostedOddsRow[] = [
  {
    id: 'boost-chiefs',
    eventId: 'chiefs-bills',
    marketId: 'moneyline',
    label: 'Chiefs to win + Mahomes 250+ pass yds',
    originalDecimal: 1.74,
    boostedDecimal: 2.0,
  },
  {
    id: 'boost-arsenal',
    eventId: 'arsenal-barcelona',
    marketId: 'match-odds',
    label: 'Gunners to win + BTTS',
    originalDecimal: 4.0,
    boostedDecimal: 4.75,
  },
  {
    id: 'boost-lakers',
    eventId: 'lakers-celtics',
    marketId: 'moneyline',
    label: 'Lakers in regulation',
    originalDecimal: 1.82,
    boostedDecimal: 2.2,
  },
  {
    id: 'boost-leafs',
    eventId: 'leafs-bruins',
    marketId: 'moneyline',
    label: 'Leafs to win + 3+ team goals',
    originalDecimal: 1.8,
    boostedDecimal: 2.1,
  },
  {
    id: 'boost-alcaraz',
    eventId: 'alcaraz-sinner',
    marketId: 'winner',
    label: 'Alcaraz in straight sets',
    originalDecimal: 1.84,
    boostedDecimal: 2.1,
  },
]

function FdBoostedOddsRail({
  sport,
  onAddSlipItem,
}: {
  sport: SportKey
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  const visibleBoosts = useMemo(
    () =>
      BOOSTED_ODDS.filter((boost) => {
        const event = legacyEvents.find((candidate) => candidate.id === boost.eventId)
        return event?.sport === sport
      }),
    [sport],
  )

  function addBoosted(boost: BoostedOddsRow): void {
    const event = legacyEvents.find((candidate) => candidate.id === boost.eventId)
    if (!event) {
      return
    }

    const baseMarket = getMarketsForEvent(event).find(
      (market) => market.id === boost.marketId,
    )
    if (!baseMarket) {
      return
    }

    const baseSelection = baseMarket.selections[0]
    onAddSlipItem({
      event,
      market: { ...baseMarket, label: `${baseMarket.label} (Boosted)` },
      selection: {
        id: `${baseSelection.id}-boost`,
        label: boost.label,
        odds: boost.boostedDecimal,
        side: baseSelection.side,
      },
    })
  }

  if (visibleBoosts.length === 0) {
    return null
  }

  return (
    <section className="fd-boosted-rail" aria-label="Boosted Odds">
      <header>
        <span>Boosted Odds</span>
        <small>Limited-time demo boosts</small>
      </header>
      <div className="fd-boosted-track">
        {visibleBoosts.map((boost) => (
          <button
            className="fd-boosted-card"
            key={boost.id}
            type="button"
            aria-label={`Add boosted ${boost.label} at ${formatDecimal(boost.boostedDecimal)} to slip`}
            onClick={() => addBoosted(boost)}
          >
            <span>{boost.label}</span>
            <div>
              <s>{formatAmericanOdds(decimalToAmericanOdds(boost.originalDecimal))}</s>
              <b>{formatAmericanOdds(decimalToAmericanOdds(boost.boostedDecimal))}</b>
            </div>
            <small>Boosted</small>
          </button>
        ))}
      </div>
    </section>
  )
}

// ----- Trending Bets rail -----
type TrendingBet = {
  id: string
  eventId: string
  marketId: string
  selectionId: string
  caption: string
  adoptionPercent: number
}

const TRENDING_BETS: TrendingBet[] = [
  {
    id: 'tr-chiefs',
    eventId: 'chiefs-bills',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    caption: 'Chiefs ML',
    adoptionPercent: 67,
  },
  {
    id: 'tr-mahomes',
    eventId: 'chiefs-bills',
    marketId: 'player-props',
    selectionId: 'qb-passing',
    caption: 'Mahomes O 255.5 pass yds',
    adoptionPercent: 82,
  },
  {
    id: 'tr-arsenal',
    eventId: 'arsenal-barcelona',
    marketId: 'match-odds',
    selectionId: 'home',
    caption: 'Arsenal to win',
    adoptionPercent: 58,
  },
  {
    id: 'tr-lakers',
    eventId: 'lakers-celtics',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    caption: 'Lakers ML',
    adoptionPercent: 64,
  },
  {
    id: 'tr-over-247',
    eventId: 'warriors-knicks',
    marketId: 'total',
    selectionId: 'over-total',
    caption: 'Warriors-Knicks Over 224.5',
    adoptionPercent: 71,
  },
  {
    id: 'tr-leafs',
    eventId: 'leafs-bruins',
    marketId: 'moneyline',
    selectionId: 'home-moneyline',
    caption: 'Leafs ML',
    adoptionPercent: 53,
  },
]

function resolveSlipItem(
  eventId: string,
  marketId: string,
  selectionId: string,
): LegacySlipItem | null {
  const event = legacyEvents.find((candidate) => candidate.id === eventId)
  if (!event) {
    return null
  }

  const market = getMarketsForEvent(event).find(
    (candidate) => candidate.id === marketId,
  )
  const selection = market?.selections.find(
    (option) => option.id === selectionId,
  )

  if (!market || !selection) {
    return null
  }

  return { event, market, selection }
}

function FdTrendingRail({
  sport,
  onAddSlipItem,
}: {
  sport: SportKey
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  const visibleTrending = useMemo(
    () =>
      TRENDING_BETS.filter((bet) => {
        const event = legacyEvents.find((candidate) => candidate.id === bet.eventId)
        return event?.sport === sport
      }),
    [sport],
  )

  if (visibleTrending.length === 0) {
    return null
  }

  return (
    <section className="fd-trending-rail" aria-label="Trending bets">
      <header>
        <span>Trending bets right now</span>
        <small>What ProphetPicks players are tailing</small>
      </header>
      <div className="fd-trending-track">
        {visibleTrending.map((bet) => {
          const item = resolveSlipItem(bet.eventId, bet.marketId, bet.selectionId)
          if (!item) {
            return null
          }

          const american = formatAmericanOdds(
            decimalToAmericanOdds(item.selection.odds),
          )

          return (
            <button
              className="fd-trending-card"
              key={bet.id}
              type="button"
              aria-label={`Tail ${bet.caption} at ${formatDecimal(item.selection.odds)}`}
              onClick={() => onAddSlipItem(item)}
            >
              <span className="fd-trending-share">
                <strong>{bet.adoptionPercent}%</strong>
                <em>of bets</em>
              </span>
              <span className="fd-trending-caption">{bet.caption}</span>
              <span className="fd-trending-meta">
                <small>{item.market.label}</small>
                <b>{american}</b>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ----- Popular Parlays rail -----
type PopularParlay = {
  id: string
  name: string
  tag: string
  legs: Array<{ eventId: string; marketId: string; selectionId: string; line: string }>
}

const POPULAR_PARLAYS: PopularParlay[] = [
  {
    id: 'parlay-nfl-sunday',
    name: 'NFL Sunday 3-leg',
    tag: 'Most-built parlay this week',
    legs: [
      { eventId: 'chiefs-bills', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Chiefs ML' },
      { eventId: 'niners-eagles', marketId: 'spread', selectionId: 'home-spread', line: '49ers -2.5' },
      { eventId: 'chiefs-bills', marketId: 'total', selectionId: 'over-total', line: 'Over 47.5' },
    ],
  },
  {
    id: 'parlay-nba-tuesday',
    name: 'NBA Tuesday lock',
    tag: 'Sharp two-team parlay',
    legs: [
      { eventId: 'lakers-celtics', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Lakers ML' },
      { eventId: 'warriors-knicks', marketId: 'total', selectionId: 'over-total', line: 'Over 224.5' },
    ],
  },
  {
    id: 'parlay-soccer-knockouts',
    name: 'UCL knockout double',
    tag: 'Both home favorites',
    legs: [
      { eventId: 'arsenal-barcelona', marketId: 'match-odds', selectionId: 'home', line: 'Arsenal' },
      { eventId: 'psg-chelsea', marketId: 'match-odds', selectionId: 'home', line: 'PSG' },
    ],
  },
  {
    id: 'parlay-nhl-friday',
    name: 'NHL Friday double',
    tag: 'Both Atlantic home favorites',
    legs: [
      { eventId: 'leafs-bruins', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Leafs ML' },
      { eventId: 'rangers-avalanche', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Rangers ML' },
    ],
  },
  {
    id: 'parlay-mlb-doubleheader',
    name: 'MLB doubleheader',
    tag: 'Two home favorites',
    legs: [
      { eventId: 'yankees-dodgers', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Yankees ML' },
      { eventId: 'braves-cubs', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Braves ML' },
    ],
  },
  {
    id: 'parlay-ncaa-saturday',
    name: 'CFB Saturday slate',
    tag: 'Top 5 home favorites',
    legs: [
      { eventId: 'georgia-alabama', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Georgia ML' },
      { eventId: 'michigan-ohio-state', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Michigan ML' },
    ],
  },
  {
    id: 'parlay-ncaab-tuesday',
    name: 'College Hoops Top 25 double',
    tag: 'Both top-10 home teams',
    legs: [
      { eventId: 'duke-kansas', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Duke ML' },
      { eventId: 'unc-uconn', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'UNC ML' },
    ],
  },
]

function FdPopularParlays({
  sport,
  onLoadParlay,
}: {
  sport: SportKey
  onLoadParlay: (items: LegacySlipItem[]) => void
}) {
  const visibleParlays = useMemo(
    () =>
      POPULAR_PARLAYS.filter((parlay) =>
        parlay.legs.every((leg) => {
          const event = legacyEvents.find(
            (candidate) => candidate.id === leg.eventId,
          )
          return event?.sport === sport
        }),
      ),
    [sport],
  )

  function build(parlay: PopularParlay): void {
    const items = parlay.legs
      .map((leg) => resolveSlipItem(leg.eventId, leg.marketId, leg.selectionId))
      .filter((item): item is LegacySlipItem => item !== null)

    if (items.length > 0) {
      onLoadParlay(items)
    }
  }

  if (visibleParlays.length === 0) {
    return null
  }

  return (
    <section className="fd-popular-parlays" aria-label="Popular parlays">
      <header>
        <span>Popular parlays</span>
        <small>One-tap, pre-built tickets</small>
      </header>
      <div className="fd-parlay-grid">
        {visibleParlays.map((parlay) => {
          const items = parlay.legs
            .map((leg) => resolveSlipItem(leg.eventId, leg.marketId, leg.selectionId))
            .filter((item): item is LegacySlipItem => item !== null)
          const combined = items.reduce(
            (product, item) => product * item.selection.odds,
            1,
          )
          const american = items.length === 0 ? '—' : formatAmericanOdds(decimalToAmericanOdds(combined))

          return (
            <article className="fd-parlay-card" key={parlay.id}>
              <header>
                <strong>{parlay.name}</strong>
                <small>{parlay.tag}</small>
              </header>
              <ul>
                {parlay.legs.map((leg) => (
                  <li key={`${parlay.id}-${leg.selectionId}`}>{leg.line}</li>
                ))}
              </ul>
              <footer>
                <span>
                  <em>{items.length}-leg price</em>
                  <b>{american}</b>
                </span>
                <button
                  type="button"
                  aria-label={`Load ${parlay.name} into slip`}
                  onClick={() => build(parlay)}
                >
                  Add all legs
                </button>
              </footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}

// ----- Sport-specific hub header -----
type SportHubMeta = {
  tagline: string
  storyline: string
}

const SPORT_HUB: Record<SportKey, SportHubMeta> = {
  nfl: {
    tagline: 'NFL Sunday Slate',
    storyline: 'Mahomes vs Allen headlines a primetime AFC playoff preview.',
  },
  nba: {
    tagline: 'NBA Tuesday Schedule',
    storyline: 'Lakers-Celtics finale of the season series tips at Crypto.com.',
  },
  mlb: {
    tagline: 'MLB Marquee',
    storyline: 'Cole-Buehler in the Bronx; Braves visit the Cubs in the matinee.',
  },
  nhl: {
    tagline: 'NHL Tonight',
    storyline: 'Matthews-Pastrnak Atlantic showdown on the back end of a back-to-back.',
  },
  soccer: {
    tagline: 'Champions League Matchday',
    storyline: 'Two Group A heavyweights in one window: Arsenal-Barca and Roma-Real.',
  },
  ncaaf: {
    tagline: 'College Football Saturday',
    storyline: 'Georgia-Alabama in Athens decides the SEC tiebreaker.',
  },
  ncaab: {
    tagline: 'College Hoops Top 25',
    storyline: 'Duke-Kansas at the Garden, primetime national TV.',
  },
  tennis: {
    tagline: 'Roland Garros R16',
    storyline: 'Alcaraz and Sinner finally meet on Court Philippe-Chatrier.',
  },
  golf: {
    tagline: 'Masters Thursday',
    storyline: 'Scheffler-McIlroy headline grouping off the first tee at Augusta.',
  },
  ufc: {
    tagline: 'UFC Main Event Week',
    storyline: 'Makhachev defends the lightweight strap against Oliveira II.',
  },
  boxing: {
    tagline: 'Pound-for-Pound Showdown',
    storyline: 'Crawford-Canelo opens at Allegiant — the fight everyone wanted.',
  },
  f1: {
    tagline: 'British Grand Prix',
    storyline: 'Verstappen on pole, Hamilton chasing his ninth Silverstone win.',
  },
  cricket: {
    tagline: 'India-Australia ODI',
    storyline: 'MCG, day-night, second match of the bilateral series.',
  },
  esports: {
    tagline: 'LCK Spring Finals',
    storyline: 'T1 vs Gen.G — the rivalry that defines the spring split.',
  },
}

function FdSportHub({
  sport,
  eventCount,
  events,
}: {
  sport: SportKey
  eventCount: number
  events: LegacyEvent[]
}) {
  const meta = SPORT_HUB[sport]
  if (!meta) {
    return null
  }

  const featured = events[0]

  return (
    <section className="fd-sport-hub" aria-label={`${meta.tagline} hub`}>
      <div className="fd-sport-hub-body">
        <span>{meta.tagline}</span>
        <strong>{meta.storyline}</strong>
        <small>
          {eventCount} {eventCount === 1 ? 'game' : 'games'} on the board
        </small>
      </div>
      {featured && (
        <aside className="fd-sport-hub-featured" aria-label="Featured matchup">
          <span>Featured matchup</span>
          <strong>
            {`${featured.homeCode} vs ${featured.awayCode}`}
          </strong>
          <small>
            {featured.time} · {featured.venue}
          </small>
        </aside>
      )}
    </section>
  )
}

// ----- Stat-pack drawer -----
type StatPack = {
  homeForm: string
  awayForm: string
  headToHead: string[]
  injuries: string[]
  angle: string
}

const STAT_PACKS: Record<string, StatPack> = {
  'chiefs-bills': {
    homeForm: 'W W W L W (last 5)',
    awayForm: 'W L W W L (last 5)',
    headToHead: [
      'KC 27 - BUF 24 — AFC Champ Jan 2024',
      'BUF 20 - KC 17 — Week 14 Dec 2023',
      'KC 27 - BUF 24 — Divisional Jan 2022',
    ],
    injuries: [
      'BUF: S1 Hyde (questionable)',
      'BUF: S Rapp (out)',
      'KC: TE Kelce (full participant)',
    ],
    angle:
      'Reid is 14-2 SU at home off a bye. Bills allow 7.4 YPA on the road. Take Mahomes to throw early and often.',
  },
  'arsenal-barcelona': {
    homeForm: 'W W D W W',
    awayForm: 'W W W D L',
    headToHead: [
      'Arsenal 2 - 1 Barca — UCL Group Stage',
      'Barca 1 - 1 Arsenal — UCL Group Stage',
      'Arsenal 3 - 1 Barca — pre-season',
    ],
    injuries: [
      'BAR: CB Araujo (suspended)',
      'BAR: CB Christensen (suspended)',
      'ARS: ST Jesus (full training)',
    ],
    angle:
      'Patchwork Barca backline vs the league pressing leaders is a tough spot. Look for an early Arsenal goal and set-piece chaos.',
  },
  'lakers-celtics': {
    homeForm: 'W W L W W',
    awayForm: 'W W W W L',
    headToHead: [
      'LAL 117 - BOS 110 — Feb',
      'BOS 122 - LAL 118 — Dec',
      'LAL 105 - BOS 102 — Oct',
    ],
    injuries: [
      'BOS: PG Holiday (probable)',
      'LAL: SF James (questionable, illness)',
      'LAL: PF Davis (full)',
    ],
    angle:
      'Crypto.com is loud after halftime, Lakers shoot 49% from 3 at home this year. Boston on the second night.',
  },
  'leafs-bruins': {
    homeForm: 'W W W L W',
    awayForm: 'L W L W W',
    headToHead: [
      'TOR 4 - BOS 2',
      'BOS 5 - TOR 3',
      'TOR 3 - BOS 2 (OT)',
    ],
    injuries: [
      'BOS: G1 Swayman (game-time decision)',
      'TOR: F Matthews (5-game point streak)',
    ],
    angle:
      'Toronto wins first-period shot share by 12% in this matchup. Boston on the third game in four nights.',
  },
  'yankees-dodgers': {
    homeForm: 'W L W W L',
    awayForm: 'L L W L W',
    headToHead: [
      'NYY 4 - LAD 3',
      'LAD 6 - NYY 2',
      'NYY 5 - LAD 4 (10)',
    ],
    injuries: [
      'LAD: 2B Lux (day-to-day)',
      'NYY: SS Volpe (full)',
    ],
    angle:
      'Cole vs Buehler with wind blowing in. Lean under and Yankees moneyline.',
  },
  'duke-kansas': {
    homeForm: 'W W W L W',
    awayForm: 'W W L W W',
    headToHead: [
      'DUKE 79 - KU 72 — 2022 Final Four',
      'KU 84 - DUKE 80 — 2018 regular season',
    ],
    injuries: [
      'DUKE: PG Roach (out, ankle)',
      'KU: F Dickinson (full)',
    ],
    angle:
      'Books opened Duke -3, line crawled to KU -1.5 once the Roach news broke. Sharps respect Kansas inside MSG.',
  },
}

function FdStatPackDrawer({
  event,
  onClose,
}: {
  event: LegacyEvent
  onClose: () => void
}) {
  const pack = STAT_PACKS[event.id] ?? null

  return (
    <div className="legacy-modal-backdrop fd-statpack-backdrop">
      <section
        className="legacy-dialog fd-statpack-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`statpack-${event.id}`}
      >
        <button
          className="legacy-close"
          type="button"
          aria-label="Close stat pack"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p>Pre-game stat pack</p>
        <h2 id={`statpack-${event.id}`}>
          {event.home} vs {event.away}
        </h2>
        <span>
          {event.league} · {event.dateLabel} · {event.time}
        </span>
        {pack === null && (
          <p className="fd-statpack-empty">
            We don't have a curated stat pack on this matchup yet. Open the
            market for full pricing.
          </p>
        )}
        {pack !== null && (
          <>
            <div className="fd-statpack-grid">
              <article>
                <span>{event.homeCode} form</span>
                <strong>{pack.homeForm}</strong>
              </article>
              <article>
                <span>{event.awayCode} form</span>
                <strong>{pack.awayForm}</strong>
              </article>
            </div>
            <section className="fd-statpack-section">
              <h3>Head-to-head</h3>
              <ul>
                {pack.headToHead.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            <section className="fd-statpack-section">
              <h3>Injuries & status</h3>
              <ul>
                {pack.injuries.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            <section className="fd-statpack-section">
              <h3>Editor's angle</h3>
              <p>{pack.angle}</p>
            </section>
          </>
        )}
      </section>
    </div>
  )
}

// ----- Editor's inline notes -----
const EDITOR_NOTES: Record<string, string> = {
  'chiefs-bills': 'Sharp action moved the spread from -2.5 to -3 this morning. 71% of public bets are on the Bills, 78% of money on the Chiefs.',
  'arsenal-barcelona': 'Total is down to 2.5 after both teams ruled their starting strikers questionable. Lean toward unders if you are not betting sides.',
  'lakers-celtics': 'Boston is on the second night of a back-to-back. Lakers are 11-3 ATS at home off two days of rest this season.',
  'leafs-bruins': 'Maple Leafs are 6-1 in their last 7 vs Boston when Matthews lines up at center on the top line.',
  'duke-kansas': 'Books opened Duke -3, market moved to Kansas -1.5 after the Blue Devils ruled out their starting PG. Stay nimble.',
}

function FdEditorNote({ note }: { note: string }) {
  return (
    <div className="fd-editor-note" role="note">
      <span>Editor's note</span>
      <p>{note}</p>
    </div>
  )
}

// ----- Live Now rail -----
type LiveGame = {
  id: string
  eventId: string
  league: string
  status: string
  homeCode: string
  awayCode: string
  homeScore: number
  awayScore: number
}

const LIVE_GAMES_SEED: LiveGame[] = [
  { id: 'live-chiefs', eventId: 'chiefs-bills', league: 'NFL', status: 'Q3 08:24', homeCode: 'KC', awayCode: 'BUF', homeScore: 17, awayScore: 14 },
  { id: 'live-lakers', eventId: 'lakers-celtics', league: 'NBA', status: 'Q2 04:12', homeCode: 'LAL', awayCode: 'BOS', homeScore: 52, awayScore: 49 },
  { id: 'live-arsenal', eventId: 'arsenal-barcelona', league: 'UCL', status: "65'", homeCode: 'ARS', awayCode: 'BAR', homeScore: 1, awayScore: 1 },
  { id: 'live-leafs', eventId: 'leafs-bruins', league: 'NHL', status: 'P2 12:08', homeCode: 'TOR', awayCode: 'BOS', homeScore: 2, awayScore: 1 },
]

function FdLiveNowRail({
  onAddSlipItem,
}: {
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  const [games, setGames] = useState<LiveGame[]>(LIVE_GAMES_SEED)
  const [feedSource, setFeedSource] = useState<string>('Local demo state')

  // Local ticker (8s) keeps the rail visibly alive between server polls.
  useEffect(() => {
    const id = setInterval(() => {
      setGames((current) =>
        current.map((game) => {
          const tick = Math.random()
          if (tick > 0.82) {
            return {
              ...game,
              homeScore: game.homeScore + (game.league === 'UCL' ? 0 : 1),
              status: nudgeStatus(game.status, game.league),
            }
          }
          if (tick > 0.66) {
            return {
              ...game,
              awayScore: game.awayScore + (game.league === 'UCL' ? 0 : 1),
              status: nudgeStatus(game.status, game.league),
            }
          }
          return { ...game, status: nudgeStatus(game.status, game.league) }
        }),
      )
    }, 8000)

    return () => clearInterval(id)
  }, [])

  // Poll /api/livescore (ESPN scoreboard aggregator) every 30s. The local
  // 8s ticker between polls keeps the rail visibly alive. Skipped in dev/test
  // — the /api routes only exist on the Vercel build.
  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }
    let cancelled = false

    function poll(): void {
      loadLiveState().then((snapshot) => {
        if (cancelled || !snapshot) {
          return
        }
        if (snapshot.games.length > 0) {
          setGames(snapshot.games)
        }
        setFeedSource(
          snapshot.source === 'espn'
            ? 'Live feed: ESPN scoreboard'
            : snapshot.source === 'sportsdb'
              ? 'Live feed: TheSportsDB'
              : snapshot.source === 'demo'
                ? 'Server demo state'
                : `Live feed: ${snapshot.source}`,
        )
      })
    }

    poll()
    const id = setInterval(poll, 30_000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  function pickLiveMoneyline(eventId: string): LegacySlipItem | null {
    const event = legacyEvents.find((candidate) => candidate.id === eventId)
    if (!event) {
      return null
    }

    const market = getMarketsForEvent(event).find((candidate) =>
      ['moneyline', 'match-odds', 'winner'].includes(candidate.id),
    )
    if (!market) {
      return null
    }

    return { event, market, selection: market.selections[0] }
  }

  return (
    <section className="fd-live-rail" aria-label="Live Now">
      <header>
        <span className="fd-live-pill">
          <span className="fd-live-dot" aria-hidden="true" />
          Live Now
        </span>
        <small>
          {games.length} in-play · {feedSource}
        </small>
      </header>
      <div className="fd-live-track">
        {games.map((game) => (
          <article className="fd-live-card" key={game.id}>
            <span className="fd-live-meta">
              {game.league} · {game.status}
            </span>
            <div className="fd-live-score">
              <span
                className="fd-live-score-cell"
                key={`home-${game.homeScore}`}
              >
                {`${game.homeCode} ${game.homeScore}`}
              </span>
              <span
                className="fd-live-score-cell"
                key={`away-${game.awayScore}`}
              >
                {`${game.awayCode} ${game.awayScore}`}
              </span>
            </div>
            <button
              className="fd-live-bet"
              type="button"
              onClick={() => {
                const item = pickLiveMoneyline(game.eventId)
                if (item) {
                  onAddSlipItem(item)
                }
              }}
            >
              Bet live ML
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function nudgeStatus(status: string, league: string): string {
  if (league === 'UCL') {
    const minute = Number.parseInt(status, 10)
    if (Number.isFinite(minute) && minute < 90) {
      return `${minute + 1}'`
    }
    return status
  }

  const match = status.match(/^(Q|P)(\d)\s+(\d{2}):(\d{2})$/)
  if (!match) {
    return status
  }

  const [, prefix, periodRaw, minutesRaw, secondsRaw] = match
  const minutes = Number.parseInt(minutesRaw, 10)
  const seconds = Number.parseInt(secondsRaw, 10)
  const totalSeconds = minutes * 60 + seconds
  const nextSeconds = totalSeconds - 30

  if (nextSeconds <= 0) {
    const nextPeriod = Number.parseInt(periodRaw, 10) + 1
    if (nextPeriod > 4) {
      return `${prefix}${periodRaw} 00:00`
    }
    return `${prefix}${nextPeriod} 12:00`
  }

  const nextMinutes = Math.floor(nextSeconds / 60)
  const remainder = nextSeconds % 60
  const mm = String(nextMinutes).padStart(2, '0')
  const ss = String(remainder).padStart(2, '0')
  return `${prefix}${periodRaw} ${mm}:${ss}`
}

// ----- Slip preview rail (perma-rail on desktop) -----
function FdSlipPreviewRail({
  items,
  mode,
  stakeInput,
  savedSlips,
  onOpen,
}: {
  items: LegacySlipItem[]
  mode: SlipMode
  stakeInput: string
  savedSlips: SavedSlipSummary[]
  onOpen: () => void
}) {
  const width = useWindowWidth()
  const stake = parseStake(stakeInput)
  const returnValue = ticketReturn(items, mode, stake)
  const grouped = groupItemsByEvent(items)

  if (width < 1200) {
    return null
  }

  return (
    <aside className="fd-slip-rail" aria-label="Bet slip preview">
      <header>
        <strong>Bet Slip</strong>
        <span>
          {items.length} {items.length === 1 ? 'pick' : 'picks'}
        </span>
      </header>
      <div className="fd-slip-rail-body">
        {items.length === 0 && (
          <p className="fd-slip-rail-empty">Tap any odds to start a slip.</p>
        )}
        {savedSlips.length > 0 && (
          <section className="fd-saved-slips" aria-label="Saved slips">
            <h4>My slips</h4>
            <ul>
              {savedSlips.map((slip) => (
                <li key={slip.slipId}>
                  <div>
                    <strong>{slip.topSelection}</strong>
                    <span>
                      {slip.legCount}-leg · {slip.mode}
                    </span>
                  </div>
                  <b>{formatDecimal(slip.combinedPrice)}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
        {grouped.map((group) => (
          <article
            className={`fd-slip-rail-group ${group.items.length > 1 ? 'is-sgp' : ''}`}
            key={group.eventId}
          >
            {group.items.length > 1 && (
              <header>
                <span>Same Game Parlay</span>
                <b>
                  {formatDecimal(
                    group.items.reduce(
                      (product, leg) => product * leg.selection.odds,
                      1,
                    ),
                  )}
                </b>
              </header>
            )}
            {group.items.map((item) => (
              <div
                className="fd-slip-rail-leg"
                key={`${item.event.id}-${item.market.id}-${item.selection.id}`}
              >
                <span>{item.selection.label}</span>
                <em>{item.market.label}</em>
                <b>{formatDecimal(item.selection.odds)}</b>
              </div>
            ))}
          </article>
        ))}
      </div>
      <footer>
        <div>
          <span>Stake</span>
          <strong>${stake.toFixed(2)}</strong>
        </div>
        <div>
          <span>To win</span>
          <strong>${(returnValue - ticketRisk(items, mode, stake)).toFixed(2)}</strong>
        </div>
        <button type="button" onClick={onOpen} disabled={items.length === 0}>
          Open slip
        </button>
      </footer>
    </aside>
  )
}

type SlipGroup = {
  eventId: string
  eventLabel: string
  items: LegacySlipItem[]
}

function groupItemsByEvent(items: LegacySlipItem[]): SlipGroup[] {
  const groups = new Map<string, SlipGroup>()

  for (const item of items) {
    const existing = groups.get(item.event.id)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(item.event.id, {
        eventId: item.event.id,
        eventLabel: `${item.event.home} VS ${item.event.away}`,
        items: [item],
      })
    }
  }

  return Array.from(groups.values())
}

// ----- Quick Parlay Builder -----
const PARLAY_MARKET_CHOICES = [
  { id: 'moneyline', label: 'Moneyline / Match Result' },
  { id: 'spread', label: 'Spread / Handicap' },
  { id: 'total', label: 'Total' },
] as const

type ParlayMarketChoice = (typeof PARLAY_MARKET_CHOICES)[number]['id']

const MAX_PARLAY_LEGS = 4

function resolveParlayLeg(
  event: LegacyEvent,
  choice: ParlayMarketChoice,
): LegacySlipItem | null {
  const primary = pickPrimaryMarkets(event)
  const market =
    choice === 'moneyline'
      ? primary.moneyline
      : choice === 'spread'
        ? primary.spread
        : primary.total

  if (!market || market.selections.length === 0) {
    return null
  }

  return { event, market, selection: market.selections[0] }
}

function QuickParlayBuilder({
  events,
  onLoadParlay,
}: {
  events: LegacyEvent[]
  onLoadParlay: (items: LegacySlipItem[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [marketChoices, setMarketChoices] = useState<
    Record<string, ParlayMarketChoice>
  >({})

  function toggleEvent(id: string): void {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((existing) => existing !== id)
      }

      if (current.length >= MAX_PARLAY_LEGS) {
        return current
      }

      return [...current, id]
    })
  }

  function setMarketFor(id: string, choice: ParlayMarketChoice): void {
    setMarketChoices((current) => ({ ...current, [id]: choice }))
  }

  const legs = selectedIds
    .map((eventId) => {
      const event = events.find((candidate) => candidate.id === eventId)
      if (!event) {
        return null
      }
      const choice = marketChoices[eventId] ?? 'moneyline'
      return resolveParlayLeg(event, choice)
    })
    .filter((leg): leg is LegacySlipItem => leg !== null)

  const combined = legs.reduce(
    (product, leg) => product * leg.selection.odds,
    1,
  )
  const american =
    legs.length === 0 ? '—' : formatAmericanOdds(decimalToAmericanOdds(combined))

  return (
    <section className="legacy-stage fd-parlay-builder" aria-labelledby="parlay-title">
      <div className="legacy-table-header">
        <div>
          <p>Build it yourself</p>
          <h1 id="parlay-title">Parlay Builder</h1>
        </div>
        <button
          className="legacy-action-button"
          type="button"
          disabled={legs.length < 2}
          onClick={() => onLoadParlay(legs)}
        >
          Load {legs.length}-leg parlay
        </button>
      </div>

      <div className="fd-parlay-builder-grid">
        <article>
          <h3>
            1. Pick up to {MAX_PARLAY_LEGS} games ({selectedIds.length}/
            {MAX_PARLAY_LEGS})
          </h3>
          <ul>
            {events.map((event) => {
              const isSelected = selectedIds.includes(event.id)
              const disabled =
                !isSelected && selectedIds.length >= MAX_PARLAY_LEGS

              return (
                <li key={event.id}>
                  <label className={isSelected ? 'is-selected' : ''}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => toggleEvent(event.id)}
                    />
                    <span>
                      <strong>
                        {event.homeCode} vs {event.awayCode}
                      </strong>
                      <small>
                        {event.sportLabel} · {event.dateLabel} · {event.time}
                      </small>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </article>

        <article>
          <h3>2. Pick a market per game</h3>
          {selectedIds.length === 0 && (
            <p className="fd-parlay-builder-empty">
              Select a couple of games on the left to start picking markets.
            </p>
          )}
          <ul className="fd-parlay-builder-markets">
            {selectedIds.map((eventId) => {
              const event = events.find((candidate) => candidate.id === eventId)
              if (!event) {
                return null
              }
              const choice = marketChoices[eventId] ?? 'moneyline'
              const leg = resolveParlayLeg(event, choice)
              const legPrice = leg
                ? formatAmericanOdds(decimalToAmericanOdds(leg.selection.odds))
                : 'n/a'
              const legLabel = leg ? leg.selection.label : 'No market available'

              return (
                <li key={eventId}>
                  <header>
                    <strong>
                      {event.homeCode} vs {event.awayCode}
                    </strong>
                    <b>{legPrice}</b>
                  </header>
                  <span>{legLabel}</span>
                  <div className="fd-parlay-market-choice">
                    {PARLAY_MARKET_CHOICES.map((option) => (
                      <button
                        key={option.id}
                        className={choice === option.id ? 'active' : ''}
                        type="button"
                        onClick={() => setMarketFor(eventId, option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </article>

        <article className="fd-parlay-summary">
          <h3>3. Review the ticket</h3>
          <dl>
            <div>
              <dt>Legs</dt>
              <dd>{legs.length}</dd>
            </div>
            <div>
              <dt>Combined decimal</dt>
              <dd>{formatDecimal(combined)}</dd>
            </div>
            <div>
              <dt>Combined American</dt>
              <dd>{american}</dd>
            </div>
            <div>
              <dt>$10 returns</dt>
              <dd>${legs.length === 0 ? '0.00' : (combined * 10).toFixed(2)}</dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={legs.length < 2}
            onClick={() => onLoadParlay(legs)}
          >
            Add {legs.length}-leg parlay to slip
          </button>
        </article>
      </div>
    </section>
  )
}

// ----- Search results -----
function SearchResultsScreen({
  query,
  onChangeQuery,
  events,
  onOpenCatalog,
  onOpenStatPack,
}: {
  query: string
  onChangeQuery: (value: string) => void
  events: LegacyEvent[]
  onOpenCatalog: (event: LegacyEvent) => void
  onOpenStatPack: (event: LegacyEvent) => void
}) {
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return [] as LegacyEvent[]
    }

    return events.filter((event) => {
      const haystack = [
        event.home,
        event.away,
        event.homeCode,
        event.awayCode,
        event.league,
        event.sportLabel,
        event.venue,
        event.dateLabel,
        event.group,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [events, query])

  return (
    <section className="legacy-stage fd-search-stage" aria-labelledby="search-title">
      <div className="legacy-table-header">
        <div>
          <p>Search results</p>
          <h1 id="search-title">
            {query.trim() ? `Results for "${query.trim()}"` : 'Search the hub'}
          </h1>
        </div>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input
            aria-label="Refine search"
            placeholder="Refine"
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
          />
        </div>
      </div>
      {query.trim() === '' && (
        <div className="legacy-empty">
          Type a team, league, or matchup in the header search to begin.
        </div>
      )}
      {query.trim() !== '' && matches.length === 0 && (
        <div className="legacy-empty">
          No games match "{query.trim()}" today. Try a team code (KC, ARS) or
          competition name (UCL, NBA).
        </div>
      )}
      {matches.length > 0 && (
        <ul className="fd-search-results">
          {matches.map((event) => (
            <li key={event.id}>
              <div>
                <strong>
                  {event.home} vs {event.away}
                </strong>
                <span>
                  {event.sportLabel} · {event.league} · {event.dateLabel} ·{' '}
                  {event.time} · {event.venue}
                </span>
              </div>
              <div className="fd-search-actions">
                <button
                  type="button"
                  className="legacy-action-button"
                  aria-label={`Open ${event.home} VS ${event.away} market`}
                  onClick={() => onOpenCatalog(event)}
                >
                  Open markets
                </button>
                <button
                  type="button"
                  className="fd-row-stats"
                  aria-label={`Stat pack ${event.homeCode} vs ${event.awayCode}`}
                  onClick={() => onOpenStatPack(event)}
                >
                  Stats
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ----- Notifications panel -----
function FdNotificationsPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: FdNotification[]
  onClose: () => void
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}) {
  const unread = notifications.filter((notification) => !notification.read).length

  return (
    <div
      className="fd-notifications-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="fd-notifications-panel"
        role="region"
        aria-label="Inbox"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <strong>Inbox</strong>
            <small>
              {unread === 0 ? 'All caught up' : `${unread} unread`}
            </small>
          </div>
          <div className="fd-notifications-actions">
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={unread === 0}
            >
              Mark all read
            </button>
            <button
              className="legacy-close"
              type="button"
              aria-label="Close inbox"
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        <ul>
          {notifications.length === 0 && (
            <li className="legacy-empty">No notifications yet.</li>
          )}
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`fd-notification fd-notification-${notification.tone} ${
                notification.read ? 'is-read' : ''
              }`}
            >
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
                <small>{notification.ago}</small>
              </div>
              {!notification.read && (
                <button
                  type="button"
                  aria-label={`Mark "${notification.title}" as read`}
                  onClick={() => onMarkRead(notification.id)}
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

// ----- Settings screen -----
function SettingsScreen({
  oddsFormat,
  onChangeOddsFormat,
}: {
  oddsFormat: OddsFormat
  onChangeOddsFormat: (next: OddsFormat) => void
}) {
  return (
    <section className="legacy-stage fd-settings" aria-labelledby="settings-title">
      <div className="legacy-table-header">
        <div>
          <p>Personal preferences</p>
          <h1 id="settings-title">Settings</h1>
        </div>
      </div>

      <article className="fd-settings-card">
        <header>
          <h3>Odds format</h3>
          <p>How prices are displayed across the board, slip, and odds pages.</p>
        </header>
        <div className="fd-settings-toggle" role="radiogroup" aria-label="Odds format">
          <button
            type="button"
            role="radio"
            aria-checked={oddsFormat === 'decimal'}
            className={oddsFormat === 'decimal' ? 'active' : ''}
            onClick={() => onChangeOddsFormat('decimal')}
          >
            Decimal
            <small>1.91 · 2.50 · 4.00</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={oddsFormat === 'american'}
            className={oddsFormat === 'american' ? 'active' : ''}
            onClick={() => onChangeOddsFormat('american')}
          >
            American
            <small>-110 · +150 · +300</small>
          </button>
        </div>
      </article>

      <article className="fd-settings-card">
        <header>
          <h3>Responsible play</h3>
          <p>Personal limits — this app is a simulator; nothing is wagered.</p>
        </header>
        <ul className="fd-settings-list">
          <li>
            <strong>Max stake per ticket</strong>
            <span>$100,000 (simulator cap)</span>
          </li>
          <li>
            <strong>Cooling-off period</strong>
            <span>Not enabled</span>
          </li>
          <li>
            <strong>Session reminder</strong>
            <span>Every 60 minutes (placeholder)</span>
          </li>
        </ul>
      </article>

      <article className="fd-settings-card">
        <header>
          <h3>About</h3>
          <p>ProphetPicks · Personal sportsbook simulator</p>
        </header>
        <ul className="fd-settings-list">
          <li>
            <strong>Build</strong>
            <span>codex/prophetpicks-design</span>
          </li>
          <li>
            <strong>API status</strong>
            <span>See /api/health</span>
          </li>
          <li>
            <strong>Repository</strong>
            <span>github.com/durga710/ProphetPicks</span>
          </li>
        </ul>
      </article>
    </section>
  )
}

// ----- My Slips full screen -----
function MySlipsScreen({
  savedSlips,
  onReload,
}: {
  savedSlips: SavedSlipSummary[]
  onReload: (slip: SavedSlipSummary) => void
}) {
  return (
    <section className="legacy-stage fd-my-slips" aria-labelledby="my-slips-title">
      <div className="legacy-table-header">
        <div>
          <p>Your saved tickets</p>
          <h1 id="my-slips-title">My Slips</h1>
        </div>
        <span className="legacy-slip-count">
          {savedSlips.length} {savedSlips.length === 1 ? 'slip' : 'slips'}
        </span>
      </div>

      {savedSlips.length === 0 && (
        <div className="legacy-empty">
          Save a slip from the editor and it lands here for quick reload.
        </div>
      )}

      {savedSlips.length > 0 && (
        <ul className="fd-my-slips-list">
          {savedSlips.map((slip) => {
            const savedDate = new Date(slip.savedAt)
            const dateLabel = Number.isFinite(savedDate.getTime())
              ? savedDate.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : slip.savedAt
            const canReload = Array.isArray(slip.items) && slip.items.length > 0

            return (
              <li key={slip.slipId}>
                <div>
                  <strong>{slip.topSelection}</strong>
                  <span>
                    {slip.legCount}-leg · {slip.mode} · saved {dateLabel}
                  </span>
                </div>
                <div className="fd-my-slips-meta">
                  <b>{formatDecimal(slip.combinedPrice)}</b>
                  <button
                    type="button"
                    aria-label={`Reload slip ${slip.slipId}`}
                    onClick={() => onReload(slip)}
                    disabled={!canReload}
                  >
                    {canReload ? 'Reload' : 'Snapshot'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ----- Live Board (real ESPN games as primary surface) -----
function LiveBoardScreen({
  sport,
  oddsFormat,
  onAddSlipItem,
  onOpenStatPack,
}: {
  sport: SportKey
  oddsFormat: OddsFormat
  onAddSlipItem: (item: LegacySlipItem) => void
  onOpenStatPack: (game: ScheduleGame) => void
}) {
  const [state, setState] = useState<{
    sport: SportKey
    games: ScheduleGame[]
    loaded: boolean
    lastFetchedAt: number
  }>({ sport, games: [], loaded: false, lastFetchedAt: 0 })

  useEffect(() => {
    if (!import.meta.env.PROD) {
      // Dev shows a friendly placeholder; production polls every 30s.
      return
    }
    let cancelled = false

    function refresh(): void {
      loadSchedule(sport).then((response) => {
        if (cancelled) {
          return
        }
        setState({
          sport,
          games: response?.games ?? [],
          loaded: true,
          lastFetchedAt: Date.now(),
        })
      })
    }

    refresh()
    const id = setInterval(refresh, 30_000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [sport])

  const stale = state.sport !== sport
  const loaded = !stale && state.loaded
  const games = stale ? [] : state.games

  return (
    <section
      className="legacy-stage fd-live-board"
      aria-labelledby="live-board-title"
    >
      <div className="legacy-title-row">
        <div>
          <p>Live ESPN feed</p>
          <h1 id="live-board-title">Live Games</h1>
        </div>
        <span className="legacy-slip-count">
          {games.length} {games.length === 1 ? 'game' : 'games'} on the board
        </span>
      </div>

      {!import.meta.env.PROD && (
        <div className="legacy-empty">
          Real ESPN feed is production-only — deploy or visit
          prophetpicks.vercel.app to see live games here.
        </div>
      )}

      {import.meta.env.PROD && !loaded && (
        <div className="fd-live-board-grid">
          {[0, 1, 2].map((index) => (
            <article
              className="fd-live-board-card is-skeleton"
              key={`live-board-skel-${index}`}
              aria-hidden="true"
            >
              <span className="fd-real-schedule-league">—</span>
              <div className="fd-real-schedule-matchup" />
              <span className="fd-real-schedule-status">—</span>
            </article>
          ))}
        </div>
      )}

      {import.meta.env.PROD && loaded && games.length === 0 && (
        <div className="legacy-empty">
          ESPN doesn't have games on the board for this sport right now.
          Switch sports in the left rail to look at a different league.
        </div>
      )}

      {import.meta.env.PROD && loaded && games.length > 0 && (
        <div className="fd-live-board-grid">
          {games.map((game) => {
            const isLive = game.state === 'in'
            const start = new Date(game.startsAt)
            const dateLabel = Number.isFinite(start.getTime())
              ? start.toLocaleString([], {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : game.statusDetail
            const stateLabel = isLive
              ? game.statusDetail || 'In Play'
              : dateLabel

            return (
              <article className="fd-live-board-card" key={game.id}>
                <button
                  className="fd-live-board-head"
                  type="button"
                  aria-label={`Open stat pack for ${game.longName}`}
                  onClick={() => onOpenStatPack(game)}
                >
                  <span className="fd-real-schedule-league">{game.league}</span>
                  <div className="fd-live-board-matchup">
                    <FdRealTeamLine team={game.away} />
                    <FdRealTeamLine team={game.home} />
                  </div>
                  <span
                    className={`fd-real-schedule-status ${isLive ? 'is-live' : ''}`}
                  >
                    {isLive && <span className="fd-live-dot" aria-hidden="true" />}
                    {stateLabel}
                  </span>
                </button>
                <FdRealOddsGrid
                  game={game}
                  sport={sport}
                  onAdd={onAddSlipItem}
                  oddsFormat={oddsFormat}
                />
                <FdRealPropsRow
                  game={game}
                  sport={sport}
                  oddsFormat={oddsFormat}
                  onAdd={onAddSlipItem}
                />
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ----- Real props from ESPN leaders -----
const playerPropsCache = new Map<string, RealStatPack | null>()
const playerPropsInflight = new Map<string, Promise<RealStatPack | null>>()

function useRealPlayerProps(
  sport: SportKey,
  eventId: string,
): RealStatPack | null {
  const cacheKey = `${sport}:${eventId}`
  const cached = playerPropsCache.get(cacheKey) ?? null
  const [resolved, setResolved] = useState<RealStatPack | null>(cached)

  useEffect(() => {
    if (!import.meta.env.PROD || !sport || !eventId) {
      return
    }
    if (playerPropsCache.has(cacheKey)) {
      return
    }

    let cancelled = false
    const inflight =
      playerPropsInflight.get(cacheKey) ??
      loadRealStatPack(sport, eventId).then((pack) => {
        playerPropsCache.set(cacheKey, pack)
        playerPropsInflight.delete(cacheKey)
        return pack
      })
    playerPropsInflight.set(cacheKey, inflight)

    inflight.then((pack) => {
      if (!cancelled) {
        setResolved(pack)
      }
    })

    return () => {
      cancelled = true
    }
  }, [cacheKey, eventId, sport])

  return resolved
}

function FdRealPropsRow({
  game,
  sport,
  oddsFormat,
  onAdd,
}: {
  game: ScheduleGame
  sport: SportKey
  oddsFormat: OddsFormat
  onAdd: (item: LegacySlipItem) => void
}) {
  const pack = useRealPlayerProps(sport, game.id)

  if (!pack || pack.leaders.length === 0) {
    return null
  }

  // Build synthetic Over <line> props from each league-leader line.
  // Lines like "ESPN ABBR Passing Yards: Patrick Mahomes (3,210)"
  // → "Mahomes O 200.5 Passing Yards" at -110.
  const propTiles = pack.leaders
    .slice(0, 4)
    .map((rawLine) => buildSyntheticProp(rawLine, game))
    .filter((tile): tile is SyntheticPropTile => tile !== null)

  if (propTiles.length === 0) {
    return null
  }

  return (
    <div className="fd-live-board-props">
      <header>
        <span>Player props</span>
        <small>Lines synthesized from ESPN leader averages</small>
      </header>
      <div className="fd-live-board-props-grid">
        {propTiles.map((tile) => {
          const display = formatPrice(tile.decimalOdds, oddsFormat)
          return (
            <button
              className="fd-live-board-prop"
              type="button"
              key={tile.key}
              aria-label={`Add ${tile.label} at ${display} to slip`}
              onClick={() => onAdd(tile.item)}
            >
              <span>{tile.category}</span>
              <strong>{tile.label}</strong>
              <b>{display}</b>
            </button>
          )
        })}
      </div>
    </div>
  )
}

type SyntheticPropTile = {
  key: string
  category: string
  label: string
  decimalOdds: number
  item: LegacySlipItem
}

function buildSyntheticProp(rawLine: string, game: ScheduleGame): SyntheticPropTile | null {
  // Expected shape from /api/stat-pack normalize:
  //   "SEA Passing Yards: Geno Smith (3,210)"
  const match = rawLine.match(/^(\w+)\s+(.+?):\s+(.+?)\s+\(([\d.,]+)\)$/)
  if (!match) {
    return null
  }
  const [, teamAbbr, category, athlete, valueRaw] = match

  // Parse the leader's full-season value, then craft a per-game over-under
  // line as ~60% of a "per-game" approximation. Demo heuristic; the prop
  // itself is real (real player, real stat category), the line is our take.
  const value = Number.parseFloat(valueRaw.replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  const perGameApprox = value / 17 // NFL-ish; close enough across sports
  const line = Math.max(0.5, Math.round(perGameApprox * 0.6 * 2) / 2)

  const event = realScheduleToLegacyEvent(game)
  const americanOdds = -110
  const decimalOdds = americanToDecimalOdds(americanOdds)
  const label = `${athlete.split(' ').slice(-1)[0]} O ${line} ${category}`

  const market: LegacyMarket = {
    id: `real-${game.id}-prop-${teamAbbr}-${category.replace(/\s+/g, '-')}`,
    label: `${category} (prop)`,
    selections: [
      {
        id: `${teamAbbr}-${category}-over-${line}`,
        label,
        odds: decimalOdds,
        side: 'Back',
      },
    ],
  }

  return {
    key: `${game.id}-${teamAbbr}-${category}`,
    category,
    label,
    decimalOdds,
    item: {
      event,
      market,
      selection: market.selections[0],
    },
  }
}

// ----- Bottom mobile tab bar -----
function FdBottomNav({
  screen,
  onNavigate,
}: {
  screen: Screen
  onNavigate: (next: Screen) => void
}) {
  const width = useWindowWidth()

  if (width === 0 || width > 720) {
    return null
  }

  const tabs: Array<{ id: Screen; label: string; icon: typeof Trophy }> = [
    { id: 'events', label: 'Sports', icon: Trophy },
    { id: 'today', label: 'Live', icon: CalendarDays },
    { id: 'bets', label: 'My Bets', icon: ClipboardList },
    { id: 'odds', label: 'Promos', icon: TicketCheck },
    { id: 'account', label: 'Account', icon: UserRound },
  ]

  return (
    <nav className="fd-bottom-nav" aria-label="Primary mobile navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            className={screen === tab.id ? 'active' : ''}
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

