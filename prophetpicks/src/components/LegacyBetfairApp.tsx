import { useMemo, useState, type CSSProperties } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
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
  getSport,
  sports,
  type FinanceRow,
  type LedgerRow,
  type LegacyBet,
  type LegacyEvent,
  type LegacyMarket,
  type LegacySlipItem,
  type LegacyTeam,
  type SportKey,
} from '../data/legacyBetfair'

type Screen = 'events' | 'market' | 'bets' | 'finance' | 'teams'
type FinanceTab = 'deposits' | 'withdrawals' | 'ledger'

function eventName(event: LegacyEvent): string {
  return `${event.home} VS ${event.away}`
}

function formatDecimal(odds: number): string {
  return Number.isInteger(odds) ? odds.toString() : odds.toFixed(2)
}

function combinedPrice(items: LegacySlipItem[]): number {
  return items.reduce((total, item) => total * item.selection.odds, 1)
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

  const activeEvents = useMemo(() => getEventsForSport(activeSport), [activeSport])
  const activeSportDefinition = getSport(activeSport)

  const groupedEvents = useMemo(
    () =>
      activeEvents.reduce<Record<string, LegacyEvent[]>>((groups, event) => {
        groups[event.dateLabel] = [...(groups[event.dateLabel] ?? []), event]
        return groups
      }, {}),
    [activeEvents],
  )

  function changeSport(nextSport: SportKey): void {
    const nextEvents = getEventsForSport(nextSport)
    const nextEvent = nextEvents[0]

    setActiveSport(nextSport)
    setScreen('events')
    setCatalogEvent(null)
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
    setSlipItems((items) => [
      ...items,
      {
        event: selectedEvent,
        market: selectedMarket,
        selection,
      },
    ])
    setIsConfirmed(false)
    setIsSlipOpen(true)
    setStatus('')
  }

  function saveMockBet(): void {
    if (!isConfirmed || slipItems.length === 0) {
      return
    }

    const price = combinedPrice(slipItems)
    const stake = 10
    const primaryItem = slipItems[0]
    const createdId = `mock-${mockBets.length + 1}`

    setMockBets((bets) => [
      {
        id: createdId,
        match: eventName(primaryItem.event),
        market:
          slipItems.length > 1
            ? `${slipItems.length}-leg parlay`
            : primaryItem.market.label,
        type: slipItems.length > 1 ? 'Combined' : 'Simple',
        stake: `$${stake.toFixed(2)}`,
        price: formatDecimal(price),
        profitLoss: `$${(price * stake - stake).toFixed(2)}`,
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
        debit: `$${stake.toFixed(2)}`,
        credit: '-',
        balance: '$20,020.00',
      },
      ...rows,
    ])
    setStatus('Mock bet saved locally. No live wager was placed.')
  }

  return (
    <div className="legacy-app">
      <header className="legacy-header">
        <div className="legacy-topbar">
          <button
            className="legacy-menu-button"
            type="button"
            aria-label="Open account menu"
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
            className={screen === 'events' ? 'active' : ''}
            type="button"
            onClick={() => setScreen('events')}
          >
            <UserRound size={16} aria-hidden="true" />
            My Account
          </button>
          <button
            className={screen === 'bets' ? 'active' : ''}
            type="button"
            onClick={() => setScreen('bets')}
          >
            <ClipboardList size={16} aria-hidden="true" />
            My Bets
          </button>
          <button type="button" onClick={() => setScreen('events')}>
            <Trophy size={16} aria-hidden="true" />
            Competitions & Leagues
          </button>
          <button
            className={screen === 'teams' ? 'active' : ''}
            type="button"
            onClick={() => setScreen('teams')}
          >
            <Trophy size={16} aria-hidden="true" />
            Teams
          </button>
          <button type="button" onClick={() => setScreen('events')}>
            <CalendarDays size={16} aria-hidden="true" />
            Today's Matches
          </button>
          <button
            className={screen === 'finance' ? 'active' : ''}
            type="button"
            onClick={() => {
              setFinanceTab('deposits')
              setScreen('finance')
            }}
          >
            <WalletCards size={16} aria-hidden="true" />
            Financial
          </button>
        </nav>
      </header>

      <main className="legacy-main">
        {screen !== 'finance' && screen !== 'bets' && (
          <SportRail activeSport={activeSport} onChangeSport={changeSport} />
        )}

        {screen === 'events' && (
          <EventsScreen
            sport={activeSportDefinition}
            groupedEvents={groupedEvents}
            groups={activeSportDefinition.groups}
            onOpenCatalog={openCatalog}
          />
        )}

        {screen === 'market' && (
          <MarketScreen
            event={selectedEvent}
            market={selectedMarket}
            onOpenMarket={openMarket}
            onAddSelection={addSelection}
          />
        )}

        {screen === 'teams' && (
          <TeamsScreen teams={legacyTeams} />
        )}

        {screen === 'bets' && <BetsScreen bets={[...mockBets, ...legacyBets]} />}

        {screen === 'finance' && (
          <FinanceScreen
            activeTab={financeTab}
            ledgerRows={[...mockLedgerRows, ...legacyLedger]}
            onTabChange={setFinanceTab}
          />
        )}
      </main>

      <footer className="legacy-footer">
        <div>
          <a href="#privacy">Privacy Policy</a>
          <a href="#cookies">Cookie Policy</a>
          <a href="#rules">Rules and Regulations</a>
          <a href="#terms">Terms and Conditions</a>
          <a href="#minors">Minor Protection</a>
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

      {isSlipOpen && (
        <BettingSlipDialog
          items={slipItems}
          isConfirmed={isConfirmed}
          status={status}
          onConfirmChange={setIsConfirmed}
          onClose={() => setIsSlipOpen(false)}
          onRemove={(index) =>
            setSlipItems((items) => items.filter((_, itemIndex) => itemIndex !== index))
          }
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
  onOpenCatalog,
}: {
  sport: ReturnType<typeof getSport>
  groupedEvents: Record<string, LegacyEvent[]>
  groups: string[]
  onOpenCatalog: (event: LegacyEvent) => void
}) {
  const [isLeagueOpen, setIsLeagueOpen] = useState(true)
  const eventCount = Object.values(groupedEvents).reduce(
    (count, events) => count + events.length,
    0,
  )

  return (
    <section className="legacy-stage legacy-events" aria-labelledby="events-title">
      <div className="legacy-title-row">
        <div>
          <p>Dense Sportsbook Board</p>
          <h1 id="events-title">{sport.title}</h1>
        </div>
        <div className="legacy-search" aria-label="Search games">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Search games" placeholder="Search" />
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
            <button key={group} type="button">
              {group}
            </button>
          ))}
          {!groups.includes('Bets') && <button type="button">Bets</button>}
        </div>
      </div>

      {isLeagueOpen && (
        <div className="legacy-event-stack" id="league-event-list">
          <div className="legacy-board-head" aria-hidden="true">
            <span>Time</span>
            <span>Matchup</span>
            <span>Markets</span>
          </div>

          {Object.entries(groupedEvents).map(([date, events]) => (
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
  onAddSelection,
}: {
  event: LegacyEvent
  market: LegacyMarket
  onOpenMarket: (event: LegacyEvent, market: LegacyMarket) => void
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
        <button type="button" onClick={() => onOpenMarket(event, markets[0])}>
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
            {market.selections.map((selection) => (
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
              </button>
            ))}
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

function TeamsScreen({ teams }: { teams: LegacyTeam[] }) {
  return (
    <section className="legacy-stage" aria-labelledby="teams-title">
      <div className="legacy-table-header">
        <div>
          <p>Catalog</p>
          <h1 id="teams-title">Team Directory</h1>
        </div>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input aria-label="Search teams" placeholder="Search teams" />
        </div>
      </div>
      <div className="legacy-team-grid">
        {teams.map((team) => (
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
  return (
    <section className="legacy-stage" aria-labelledby="bets-title">
      <div className="legacy-table-header">
        <div>
          <p>Imported history</p>
          <h1 id="bets-title">My Bets</h1>
        </div>
        <label>
          Type
          <select defaultValue="all">
            <option value="all">All</option>
            <option value="simple">Simple</option>
            <option value="combined">Combined</option>
          </select>
        </label>
      </div>
      <div className="legacy-table-tools">
        <span>Show 10 entries</span>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input aria-label="Search bets" placeholder="Search" />
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
            {bets.map((bet) => (
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
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FinanceScreen({
  activeTab,
  ledgerRows,
  onTabChange,
}: {
  activeTab: FinanceTab
  ledgerRows: LedgerRow[]
  onTabChange: (tab: FinanceTab) => void
}) {
  const rows = activeTab === 'deposits' ? legacyDeposits : legacyWithdrawals

  return (
    <section className="legacy-stage" aria-labelledby="finance-title">
      <div className="legacy-table-header">
        <div>
          <p>Financial</p>
          <h1 id="finance-title">{financeRowsTitle(activeTab)}</h1>
        </div>
        <div className="legacy-finance-tabs" aria-label="Financial sections">
          <button type="button">My Account</button>
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

      {activeTab === 'ledger' ? (
        <LedgerTable rows={ledgerRows} />
      ) : (
        <>
          <div className="legacy-table-tools">
            <span>Show 10 entries</span>
            <div className="legacy-search compact">
              <Search size={15} aria-hidden="true" />
              <input aria-label={`Search ${financeRowsTitle(activeTab)}`} placeholder="Search" />
            </div>
          </div>
          <FinanceTable rows={rows} />
        </>
      )}
    </section>
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

function BettingSlipDialog({
  items,
  isConfirmed,
  status,
  onConfirmChange,
  onClose,
  onRemove,
  onSave,
}: {
  items: LegacySlipItem[]
  isConfirmed: boolean
  status: string
  onConfirmChange: (confirmed: boolean) => void
  onClose: () => void
  onRemove: (index: number) => void
  onSave: () => void
}) {
  const price = combinedPrice(items)
  const stake = 10
  const potential = items.length > 0 ? price * stake : 0

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
        <div className="legacy-slip-toggle" aria-label="Bet type">
          <button type="button">Simple</button>
          <button className="active" type="button">
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
            <strong>{items.length > 0 ? formatDecimal(price) : '0.00'}</strong>
          </div>
          <label>
            Stake
            <input aria-label="Stake" readOnly value={`$${stake.toFixed(2)}`} />
          </label>
          <div>
            <span>Potential Profit</span>
            <strong>${potential.toFixed(2)}</strong>
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
