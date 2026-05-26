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
})
