import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
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
  loadSavedSlips,
  saveBet,
  saveSlip,
} from '../data/providers/persistence'

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
  const [savedSlips, setSavedSlips] = useState<SavedSlipSummary[]>([])
  const [headerSearch, setHeaderSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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
          },
          ...current,
        ].slice(0, 8),
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
            className={screen === 'parlay-builder' ? 'active' : ''}
            type="button"
            onClick={() => navigate('parlay-builder')}
          >
            <TicketCheck size={16} aria-hidden="true" />
            Parlay Builder
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
              <FdFeaturedHero onAddSlipItem={addSlipItem} />
              <FdPromoStrip />
              <FdBoostedOddsRail onAddSlipItem={addSlipItem} />
              <FdTrendingRail onAddSlipItem={addSlipItem} />
              <FdPopularParlays
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

          {screen === 'teams' && <TeamsScreen teams={legacyTeams} />}

          {screen === 'predictions' && (
            <PredictionScreen
              predictions={predictions}
              onAddPrediction={addPrediction}
              onBuildBestParlay={buildBestParlay}
            />
          )}

          {screen === 'odds' && <OddsBoardScreen onAddSlipItem={addSlipItem} />}

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
}: {
  event: LegacyEvent
  market: LegacyMarket
  selection: LegacyMarket['selections'][number]
  onAdd: (item: LegacySlipItem) => void
}) {
  const american = formatAmericanOdds(decimalToAmericanOdds(selection.odds))

  return (
    <button
      className="fd-odd-btn"
      type="button"
      aria-label={`Board ${selection.label} ${market.label} at ${formatDecimal(selection.odds)}`}
      onClick={() => onAdd({ event, market, selection })}
    >
      <span className="fd-line">{shortenSelectionLabel(selection)}</span>
      <span className="fd-price">{american}</span>
    </button>
  )
}

function FdMarketColumn({
  label,
  event,
  market,
  onAdd,
}: {
  label: string
  event: LegacyEvent
  market: LegacyMarket | null
  onAdd: (item: LegacySlipItem) => void
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
                            />
                            {event.home}
                          </span>
                          <span className="fd-row-team">
                            <TeamCrest
                              label={event.away}
                              code={event.awayCode}
                              primary={event.awayPrimary}
                              secondary={event.awaySecondary}
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
                      />
                      <FdMarketColumn
                        label="Total"
                        event={event}
                        market={primary.total}
                        onAdd={onAddSlipItem}
                      />
                      <FdMarketColumn
                        label="Moneyline"
                        event={event}
                        market={primary.moneyline}
                        onAdd={onAddSlipItem}
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

function BetsScreen({
  bets,
  onCashOut,
}: {
  bets: LegacyBet[]
  onCashOut: (betId: string) => void
}) {
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
                  <td>{bet.status}</td>
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

// ----- Featured Pick of the Day -----
function FdFeaturedHero({
  onAddSlipItem,
}: {
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  const event = legacyEvents.find((candidate) => candidate.id === 'chiefs-bills')

  if (!event) {
    return null
  }

  const market = getMarketsForEvent(event).find((candidate) => candidate.id === 'player-props')
  const selection = market?.selections.find((option) => option.id === 'qb-passing')

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
        <h2>Mahomes goes over his passing yards line tonight</h2>
        <p>
          Buffalo has surrendered 250+ pass yards in nine of their last eleven games and now
          travels cross-country on a short week with both starting safeties banged up. Andy Reid
          is 14-2 at home off a bye in his career. Patrick is going to throw a lot tonight — it is
          the easiest spot to attack on the board.
        </p>
        <ul>
          <li>Bills allow 7.4 yards per attempt on the road (28th in the league).</li>
          <li>Mahomes averages 287 pass yards in home primetime games this year.</li>
          <li>Game total opened 47.5 and has ticked up to 49 — books expect points.</li>
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
    caption: '4+ leg SGPs on any NFL or NBA game.',
  },
  {
    id: 'no-sweat-nfl',
    tone: 'navy',
    eyebrow: 'Daily No-Sweat Bet',
    title: 'Up to $10 back on your first NFL bet',
    caption: 'Refunded as a Bonus Bet if your pick loses.',
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
    id: 'editor-pick',
    tone: 'green',
    eyebrow: "Editor's pick of the day",
    title: 'Mahomes O 1.5 passing TDs',
    caption: 'Bills D has allowed 2+ in 9 of their last 11.',
  },
]

function useRotatingPromos(slotCount = 3, intervalMs = 6000): PromoSlot[] {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setOffset((current) => (current + 1) % PROMO_SLOTS.length)
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs])

  return useMemo(
    () =>
      Array.from({ length: slotCount }).map(
        (_, index) => PROMO_SLOTS[(offset + index) % PROMO_SLOTS.length],
      ),
    [offset, slotCount],
  )
}

function FdPromoStrip() {
  const visible = useRotatingPromos()

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
  onAddSlipItem,
}: {
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
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

  return (
    <section className="fd-boosted-rail" aria-label="Boosted Odds">
      <header>
        <span>Boosted Odds</span>
        <small>Limited-time demo boosts</small>
      </header>
      <div className="fd-boosted-track">
        {BOOSTED_ODDS.map((boost) => (
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
  onAddSlipItem,
}: {
  onAddSlipItem: (item: LegacySlipItem) => void
}) {
  return (
    <section className="fd-trending-rail" aria-label="Trending bets">
      <header>
        <span>Trending bets right now</span>
        <small>What ProphetPicks players are tailing</small>
      </header>
      <div className="fd-trending-track">
        {TRENDING_BETS.map((bet) => {
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
    id: 'parlay-friday-mixer',
    name: 'Friday night mixer',
    tag: 'Hockey + tennis longshot',
    legs: [
      { eventId: 'leafs-bruins', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Leafs ML' },
      { eventId: 'rangers-avalanche', marketId: 'moneyline', selectionId: 'home-moneyline', line: 'Rangers ML' },
      { eventId: 'alcaraz-sinner', marketId: 'winner', selectionId: 'home-winner', line: 'Alcaraz' },
    ],
  },
]

function FdPopularParlays({
  onLoadParlay,
}: {
  onLoadParlay: (items: LegacySlipItem[]) => void
}) {
  function build(parlay: PopularParlay): void {
    const items = parlay.legs
      .map((leg) => resolveSlipItem(leg.eventId, leg.marketId, leg.selectionId))
      .filter((item): item is LegacySlipItem => item !== null)

    if (items.length > 0) {
      onLoadParlay(items)
    }
  }

  return (
    <section className="fd-popular-parlays" aria-label="Popular parlays">
      <header>
        <span>Popular parlays</span>
        <small>One-tap, pre-built tickets</small>
      </header>
      <div className="fd-parlay-grid">
        {POPULAR_PARLAYS.map((parlay) => {
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

  // Server reconciliation: prefer SSE (/api/live/stream), fall back to polling
  // /api/live every 30s when EventSource is unavailable or the stream errors.
  // Local 8s ticker keeps the rail visibly alive between server pushes.
  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let source: EventSource | null = null

    function applySnapshot(snapshot: {
      source: 'demo' | 'sportradar' | 'odds-api'
      games: LiveGame[]
    }): void {
      if (cancelled) {
        return
      }
      setGames(snapshot.games)
      setFeedSource(
        snapshot.source === 'demo'
          ? 'Server demo state'
          : `Live feed: ${snapshot.source}`,
      )
    }

    function startPolling(): void {
      function poll(): void {
        loadLiveState().then((snapshot) => {
          if (snapshot) {
            applySnapshot(snapshot)
          }
        })
      }
      poll()
      pollTimer = setInterval(poll, 30_000)
    }

    if (typeof EventSource === 'function') {
      try {
        source = new EventSource('/api/live/stream')

        // If no snapshot has arrived after 6s the upstream proxy is likely
        // buffering. Switch to polling so the rail stays current.
        const connectionTimeout = setTimeout(() => {
          source?.close()
          source = null
          if (!pollTimer) {
            startPolling()
          }
        }, 6000)

        source.addEventListener('snapshot', (event) => {
          clearTimeout(connectionTimeout)
          try {
            const data = JSON.parse((event as MessageEvent).data)
            applySnapshot(data)
          } catch {
            // Ignore malformed payloads.
          }
        })

        source.onerror = () => {
          clearTimeout(connectionTimeout)
          source?.close()
          source = null
          if (!pollTimer) {
            startPolling()
          }
        }
      } catch {
        startPolling()
      }
    } else {
      startPolling()
    }

    return () => {
      cancelled = true
      source?.close()
      if (pollTimer) {
        clearInterval(pollTimer)
      }
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
              <span>{`${game.homeCode} ${game.homeScore}`}</span>
              <span>{`${game.awayCode} ${game.awayScore}`}</span>
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

