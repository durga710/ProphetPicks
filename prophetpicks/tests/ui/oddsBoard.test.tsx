import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'

async function openOddsBoard() {
  const user = userEvent.setup()

  render(<App />)
  await user.click(screen.getByRole('button', { name: /Odds Board/i }))

  return user
}

describe('ProphetPicks Odds Board', () => {
  it('renders an Odds Board nav entry that opens a dense odds board', async () => {
    await openOddsBoard()

    expect(
      screen.getByRole('heading', { name: /Odds Board/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Dense sportsbook quotes/i)).toBeInTheDocument()
  })

  it('shows decimal, American, implied probability, movement, source, and updated timestamp on each tile', async () => {
    await openOddsBoard()

    const sampleTile = screen.getAllByRole('button', {
      name: /^Add Arsenal at decimal 4 to slip/i,
    })[0]
    expect(sampleTile).toBeInTheDocument()

    const tileText = sampleTile.textContent ?? ''
    expect(tileText).toMatch(/Dec\s*4(\.|$|\D)/i)
    expect(tileText).toMatch(/Am\s*\+300/i)
    expect(tileText).toMatch(/Imp\s*25\.0%/i)
    expect(tileText).toMatch(/Move\s*[+-]\d+/i)
    expect(tileText).toMatch(/API-Football/i)
    expect(tileText).toMatch(/Updated/i)
  })

  it('filters odds tiles by sport', async () => {
    const user = await openOddsBoard()

    expect(
      screen.queryAllByRole('button', {
        name: /^Add Arsenal at decimal 4 to slip/i,
      }).length,
    ).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText(/Sport/i), 'NFL')

    expect(
      screen.queryAllByRole('button', {
        name: /^Add Arsenal at decimal 4 to slip/i,
      }).length,
    ).toBe(0)
    expect(
      screen.getAllByRole('button', {
        name: /^Add Kansas City Chiefs at decimal 1\.74 to slip/i,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('filters odds tiles by market category', async () => {
    const user = await openOddsBoard()

    await user.selectOptions(screen.getByLabelText(/Sport/i), 'NFL')
    await user.selectOptions(screen.getByLabelText(/Market/i), 'spread')

    expect(
      screen.getByRole('button', {
        name: /^Add Kansas City Chiefs -2\.5 at decimal 1\.91 to slip/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /^Add Kansas City Chiefs at decimal 1\.74 to slip/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('adds an odds tile to the betting slip on click', async () => {
    const user = await openOddsBoard()

    await user.selectOptions(screen.getByLabelText(/Sport/i), 'NFL')
    await user.click(
      screen.getByRole('button', {
        name: /^Add Kansas City Chiefs at decimal 1\.74 to slip/i,
      }),
    )

    const slip = screen.getByRole('dialog', { name: /Betting Slip/i })
    expect(within(slip).getByText(/Kansas City Chiefs/i)).toBeInTheDocument()
    expect(within(slip).getByText(/Moneyline/i)).toBeInTheDocument()
  })
})
