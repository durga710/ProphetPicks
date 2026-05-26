import { useMemo, useState } from 'react'
import {
  CalendarDays,
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
  legacyEvents,
  legacyMarkets,
  legacyWithdrawals,
  type FinanceRow,
  type LegacyEvent,
  type LegacyMarket,
  type LegacySlipItem,
} from '../data/legacyBetfair'

type Screen = 'events' | 'market' | 'bets' | 'finance'
type FinanceTab = 'deposits' | 'withdrawals'

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
  return tab === 'deposits' ? 'My Deposits' : 'My Withdrawals'
}

export function LegacyBetfairApp() {
  const [screen, setScreen] = useState<Screen>('events')
  const [catalogEvent, setCatalogEvent] = useState<LegacyEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<LegacyEvent>(legacyEvents[0])
  const [selectedMarket, setSelectedMarket] = useState<LegacyMarket>(
    legacyMarkets[0],
  )
  const [slipItems, setSlipItems] = useState<LegacySlipItem[]>([])
  const [isSlipOpen, setIsSlipOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [status, setStatus] = useState('')
  const [financeTab, setFinanceTab] = useState<FinanceTab>('deposits')

  const groupedEvents = useMemo(
    () =>
      legacyEvents.reduce<Record<string, LegacyEvent[]>>((groups, event) => {
        groups[event.dateLabel] = [...(groups[event.dateLabel] ?? []), event]
        return groups
      }, {}),
    [],
  )
  const groups = ['Group A', 'Group B', 'Group C', 'Group D', 'Group F', 'Group G', 'Group H']

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
        {screen === 'events' && (
          <EventsScreen
            groupedEvents={groupedEvents}
            groups={groups}
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

        {screen === 'bets' && <BetsScreen />}

        {screen === 'finance' && (
          <FinanceScreen
            activeTab={financeTab}
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

function EventsScreen({
  groupedEvents,
  groups,
  onOpenCatalog,
}: {
  groupedEvents: Record<string, LegacyEvent[]>
  groups: string[]
  onOpenCatalog: (event: LegacyEvent) => void
}) {
  return (
    <section className="legacy-stage legacy-events" aria-labelledby="events-title">
      <div className="legacy-title-row">
        <div>
          <p>Imported Betfair Market</p>
          <h1 id="events-title">UEFA Champions League</h1>
        </div>
        <div className="legacy-search" aria-label="Search games">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Search games" placeholder="Search" />
        </div>
      </div>

      <div className="legacy-group-strip" aria-label="Competition groups">
        {groups.map((group) => (
          <button key={group} type="button">
            {group}
          </button>
        ))}
        <button type="button">Group Bets</button>
      </div>

      {Object.entries(groupedEvents).map(([date, events]) => (
        <section className="legacy-date-card" key={date} aria-label={date}>
          <div className="legacy-date-heading">
            <CalendarDays size={16} aria-hidden="true" />
            {date}
          </div>
          <div className="legacy-event-list">
            {events.map((event) => (
              <button
                className="legacy-event-row"
                key={event.id}
                type="button"
                onClick={() => onOpenCatalog(event)}
              >
                <span>{event.group}</span>
                <strong>{eventName(event)}</strong>
                <small>
                  {event.time} - {event.venue}
                </small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </section>
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
  return (
    <section className="legacy-stage legacy-market" aria-labelledby="market-event">
      <div className="legacy-market-header">
        <div>
          <p>{event.league}</p>
          <h1 id="market-event">{eventName(event)}</h1>
          <span>
            {event.dateLabel} at {event.time}
          </span>
        </div>
        <button type="button" onClick={() => onOpenMarket(event, legacyMarkets[0])}>
          Refresh Markets
        </button>
      </div>

      <div className="legacy-market-grid">
        <aside className="legacy-catalog-panel" aria-label="Market Catalog">
          <h2>Market Catalog</h2>
          {legacyMarkets.map((catalogMarket) => (
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
                <strong>{selection.label}</strong>
                <b>{formatDecimal(selection.odds)}</b>
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function BetsScreen() {
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
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {legacyBets.map((bet) => (
              <tr key={bet.id}>
                <td>{bet.match}</td>
                <td>{bet.market}</td>
                <td>{bet.type}</td>
                <td>{bet.stake}</td>
                <td>{bet.price}</td>
                <td className={bet.profitLoss.startsWith('+') ? 'positive' : 'negative'}>
                  {bet.profitLoss}
                </td>
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
  onTabChange,
}: {
  activeTab: FinanceTab
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
        </div>
      </div>
      <div className="legacy-table-tools">
        <span>Show 10 entries</span>
        <div className="legacy-search compact">
          <Search size={15} aria-hidden="true" />
          <input aria-label={`Search ${financeRowsTitle(activeTab)}`} placeholder="Search" />
        </div>
      </div>
      <FinanceTable rows={rows} />
    </section>
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
          {legacyMarkets.map((market) => (
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
