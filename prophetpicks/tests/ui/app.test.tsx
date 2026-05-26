import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'

describe('ProphetPicks imported Betfair market experience', () => {
  it('renders the English Betfair-style market shell by default', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /UEFA Champions League/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/My Account/i)).toBeInTheDocument()
    expect(screen.getByText(/My Bets/i)).toBeInTheDocument()
    expect(screen.getByText(/Betting Slip/i)).toBeInTheDocument()
    expect(screen.getByText(/Play responsibly/i)).toBeInTheDocument()
  })

  it('uses dense logo-led event rows with a league pulldown', async () => {
    const user = userEvent.setup()

    render(<App />)

    const pulldown = screen.getByRole('button', {
      name: /UEFA Champions League.*5 events/i,
    })
    expect(pulldown).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/Arsenal crest/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/FC Barcelona crest/i)).toBeInTheDocument()
    expect(screen.getByText('ARS')).toBeInTheDocument()
    expect(screen.getByText('BAR')).toBeInTheDocument()
    expect(screen.queryByText(/^Arsenal VS FC Barcelona$/i)).not.toBeInTheDocument()

    await user.click(pulldown)

    expect(pulldown).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('button', { name: /Arsenal VS FC Barcelona/i }),
    ).not.toBeInTheDocument()

    await user.click(pulldown)

    expect(
      screen.getByRole('button', { name: /Arsenal VS FC Barcelona/i }),
    ).toBeInTheDocument()
  })

  it('opens an event catalog and adds an odd to the betting slip', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /Arsenal VS FC Barcelona/i }),
    )

    const catalog = screen.getByRole('dialog', {
      name: /Arsenal VS FC Barcelona/i,
    })
    expect(within(catalog).getByText(/Market Catalog/i)).toBeInTheDocument()

    await user.click(within(catalog).getByRole('button', { name: /To Qualify/i }))
    expect(screen.getByRole('heading', { name: /To Qualify/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Back Arsenal at 4/i }))

    const slip = screen.getByRole('dialog', { name: /Betting Slip/i })
    expect(within(slip).getByText(/Arsenal/i)).toBeInTheDocument()
    expect(within(slip).getByText(/Combined/i)).toBeInTheDocument()

    await user.click(within(slip).getByLabelText(/Confirm mock bet/i))
    await user.click(within(slip).getByRole('button', { name: /Place Mock Bet/i }))

    expect(screen.getByRole('status')).toHaveTextContent(
      /Mock bet saved locally/i,
    )
  })

  it('shows imported betting history and finance screens in English', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /My Bets/i }))
    expect(screen.getByRole('heading', { name: /My Bets/i })).toBeInTheDocument()
    expect(screen.getByText(/Profit\/Loss/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Financial/i }))
    expect(screen.getByRole('heading', { name: /My Deposits/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Withdrawals/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Withdrawals/i }))
    expect(screen.getByRole('heading', { name: /My Withdrawals/i })).toBeInTheDocument()
  })

  it('renders every major sport rail and a full team directory', async () => {
    const user = userEvent.setup()

    render(<App />)

    for (const sport of [
      'NFL',
      'NBA',
      'MLB',
      'NHL',
      'Soccer',
      'NCAAF',
      'NCAAB',
      'Tennis',
      'Golf',
      'UFC',
      'Boxing',
      'Formula 1',
      'Cricket',
      'Esports',
    ]) {
      expect(screen.getByRole('button', { name: sport })).toBeInTheDocument()
    }

    await user.click(screen.getByRole('button', { name: /Teams/i }))

    expect(screen.getByRole('heading', { name: /Team Directory/i })).toBeInTheDocument()
    expect(screen.getByText(/Kansas City Chiefs/i)).toBeInTheDocument()
    expect(screen.getByText(/Los Angeles Lakers/i)).toBeInTheDocument()
    expect(screen.getByText(/New York Yankees/i)).toBeInTheDocument()
    expect(screen.getByText(/Toronto Maple Leafs/i)).toBeInTheDocument()
  })

  it('switches sports and opens sport-specific betting structures', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'NFL' }))

    expect(screen.getByRole('heading', { name: /NFL/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Kansas City Chiefs crest/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Buffalo Bills crest/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Open Kansas City Chiefs VS Buffalo Bills market/i,
      }),
    )

    const catalog = screen.getByRole('dialog', {
      name: /Kansas City Chiefs VS Buffalo Bills/i,
    })
    expect(within(catalog).getByRole('button', { name: /Moneyline/i })).toBeInTheDocument()
    expect(within(catalog).getByRole('button', { name: /Spread/i })).toBeInTheDocument()
    expect(within(catalog).getByRole('button', { name: /Total/i })).toBeInTheDocument()
    expect(within(catalog).getByRole('button', { name: /Player Props/i })).toBeInTheDocument()

    await user.click(within(catalog).getByRole('button', { name: /Spread/i }))

    expect(screen.getByRole('heading', { name: /Spread/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Back Kansas City Chiefs -2.5 at 1.91/i }),
    ).toBeInTheDocument()
  })

  it('places an end-to-end mock parlay into history and ledger', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'NFL' }))
    await user.click(
      screen.getByRole('button', {
        name: /Open Kansas City Chiefs VS Buffalo Bills market/i,
      }),
    )

    const catalog = screen.getByRole('dialog', {
      name: /Kansas City Chiefs VS Buffalo Bills/i,
    })
    await user.click(within(catalog).getByRole('button', { name: /Moneyline/i }))
    await user.click(
      screen.getByRole('button', { name: /Back Kansas City Chiefs at 1.74/i }),
    )

    const slip = screen.getByRole('dialog', { name: /Betting Slip/i })
    await user.click(within(slip).getByLabelText(/Confirm mock bet/i))
    await user.click(within(slip).getByRole('button', { name: /Place Mock Bet/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/Mock bet saved locally/i)

    await user.click(within(slip).getByRole('button', { name: /Close betting slip/i }))
    await user.click(screen.getByRole('button', { name: /My Bets/i }))

    expect(screen.getByText(/Kansas City Chiefs/i)).toBeInTheDocument()
    expect(screen.getByText(/Pending Mock/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Financial/i }))
    await user.click(screen.getByRole('button', { name: /Ledger/i }))

    expect(screen.getByRole('heading', { name: /Account Ledger/i })).toBeInTheDocument()
    expect(screen.getByText(/Mock stake reserved/i)).toBeInTheDocument()
  })

  it('filters the event board by competition group and search text', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Group B' }))

    expect(
      screen.getByRole('button', { name: /Open Juventus VS Bayern Munich market/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Open Arsenal VS FC Barcelona market/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bets' }))
    await user.type(screen.getByLabelText(/Search games/i), 'Roma')

    expect(
      screen.getByRole('button', { name: /Open Roma VS Real Madrid market/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Open Juventus VS Bayern Munich market/i }),
    ).not.toBeInTheDocument()
  })

  it('opens the account menu and real account screens', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Open account menu/i }))

    expect(screen.getByRole('dialog', { name: /Account Menu/i })).toBeInTheDocument()
    expect(screen.getByText(/Mock bankroll/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /My Account/i }))
    expect(
      screen.getByRole('heading', { name: /Account Overview/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Today's Matches/i }))
    expect(
      screen.getByRole('heading', { name: /Today's Matches/i }),
    ).toBeInTheDocument()
  })

  it('filters team directory, bet history, and ledger tables', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Teams/i }))
    await user.type(screen.getByLabelText(/Search teams/i), 'Lakers')

    expect(screen.getByText(/Los Angeles Lakers/i)).toBeInTheDocument()
    expect(screen.queryByText(/Kansas City Chiefs/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /My Bets/i }))
    await user.selectOptions(screen.getByLabelText(/Type/i), 'simple')

    expect(screen.getByText(/Roma VS Real Madrid/i)).toBeInTheDocument()
    expect(screen.queryByText(/Arsenal VS FC Barcelona/i)).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Search bets/i))
    await user.type(screen.getByLabelText(/Search bets/i), 'Bayern')

    expect(screen.getByText(/Juventus VS Bayern Munich/i)).toBeInTheDocument()
    expect(screen.queryByText(/Roma VS Real Madrid/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Financial/i }))
    await user.click(screen.getByRole('button', { name: /Ledger/i }))
    await user.type(screen.getByLabelText(/Search Account Ledger/i), 'settlement')

    expect(screen.getByText(/Mock bet settlement/i)).toBeInTheDocument()
    expect(screen.queryByText(/Opening mock bankroll/i)).not.toBeInTheDocument()
  })

  it('lets the slip switch ticket type, edit stake, and saves the real stake', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'NFL' }))
    await user.click(
      screen.getByRole('button', {
        name: /Open Kansas City Chiefs VS Buffalo Bills market/i,
      }),
    )

    const catalog = screen.getByRole('dialog', {
      name: /Kansas City Chiefs VS Buffalo Bills/i,
    })
    await user.click(within(catalog).getByRole('button', { name: /Moneyline/i }))
    await user.click(
      screen.getByRole('button', { name: /Back Kansas City Chiefs at 1.74/i }),
    )

    const slip = screen.getByRole('dialog', { name: /Betting Slip/i })
    const simple = within(slip).getByRole('button', { name: /Simple/i })
    const combined = within(slip).getByRole('button', { name: /Combined/i })

    expect(combined).toHaveAttribute('aria-pressed', 'true')

    await user.click(simple)
    expect(simple).toHaveAttribute('aria-pressed', 'true')
    expect(combined).toHaveAttribute('aria-pressed', 'false')

    await user.clear(within(slip).getByLabelText(/Stake/i))
    await user.type(within(slip).getByLabelText(/Stake/i), '25')

    expect(within(slip).getByText('$43.50')).toBeInTheDocument()

    await user.click(within(slip).getByLabelText(/Confirm mock bet/i))
    await user.click(within(slip).getByRole('button', { name: /Place Mock Bet/i }))
    await user.click(within(slip).getByRole('button', { name: /Close betting slip/i }))
    await user.click(screen.getByRole('button', { name: /My Bets/i }))

    const savedBetRow = screen
      .getByText(/Kansas City Chiefs VS Buffalo Bills/i)
      .closest('tr')
    expect(savedBetRow).not.toBeNull()
    expect(within(savedBetRow as HTMLElement).getByText('$25.00')).toBeInTheDocument()
    expect(within(savedBetRow as HTMLElement).getByText('1.74')).toBeInTheDocument()
  })

  it('refreshes market data and opens footer policy dialogs', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /Open Arsenal VS FC Barcelona market/i }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: /Arsenal VS FC Barcelona/i }),
      ).getByRole('button', { name: /Match Odds/i }),
    )
    await user.click(screen.getByRole('button', { name: /Refresh Markets/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/Markets refreshed/i)

    await user.click(screen.getByRole('link', { name: /Privacy Policy/i }))

    expect(screen.getByRole('dialog', { name: /Privacy Policy/i })).toBeInTheDocument()
    expect(screen.getByText(/personal simulator/i)).toBeInTheDocument()
  })

  it('renders ranked Prophet Picks with filterable prediction metadata', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Prophet Picks/i }))

    expect(screen.getByRole('heading', { name: /Prophet Picks/i })).toBeInTheDocument()
    expect(screen.getByText(/Ranked Edge Board/i)).toBeInTheDocument()
    expect(screen.getByText(/Kansas City Chiefs VS Buffalo Bills/i)).toBeInTheDocument()
    expect(screen.getAllByText(/A Confidence/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/\+6.8% edge/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Low Risk/i).length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText(/Sport/i), 'NFL')
    await user.selectOptions(screen.getByLabelText(/Confidence/i), 'A')
    await user.selectOptions(screen.getByLabelText(/Risk/i), 'Low')

    expect(screen.getByText(/Kansas City Chiefs VS Buffalo Bills/i)).toBeInTheDocument()
    expect(screen.queryByText(/Arsenal VS FC Barcelona/i)).not.toBeInTheDocument()
  })

  it('adds predictor picks to the slip and builds the best parlay', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Prophet Picks/i }))
    await user.click(
      screen.getByRole('button', {
        name: /Add Kansas City Chiefs Moneyline pick/i,
      }),
    )

    let slip = screen.getByRole('dialog', { name: /Betting Slip/i })
    expect(within(slip).getByText(/Kansas City Chiefs/i)).toBeInTheDocument()
    expect(within(slip).getByText(/Moneyline/i)).toBeInTheDocument()

    await user.click(within(slip).getByRole('button', { name: /Close betting slip/i }))
    await user.click(screen.getByRole('button', { name: /Build Best Parlay/i }))

    slip = screen.getByRole('dialog', { name: /Betting Slip/i })
    expect(within(slip).getByRole('button', { name: /Combined/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(slip).getByText(/3 selections/i)).toBeInTheDocument()
    expect(within(slip).getByText(/Kansas City Chiefs/i)).toBeInTheDocument()
    expect(within(slip).getByText(/Los Angeles Lakers/i)).toBeInTheDocument()
    expect(within(slip).getByText(/Arsenal/i)).toBeInTheDocument()
  })
})
