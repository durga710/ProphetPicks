import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'

describe('ProphetPicks app', () => {
  it('renders the command center and saves a slip to the journal', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(
      screen.getByRole('heading', { name: /ProphetPicks Command Center/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Find the edge before the slip/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Add LeBron James over 25.5 points/i }),
    )

    expect(screen.getByText(/Selected Slip/i)).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('complementary', { name: /Selected Slip/i }),
      ).getByText(/LeBron James over 25.5 points/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Save to journal/i }))

    expect(screen.getByText(/Journaled Slips/i)).toBeInTheDocument()
    expect(screen.getByText(/Slip saved/i)).toBeInTheDocument()
  })

  it('filters the board to soccer markets from the soccer API layer', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      within(screen.getByRole('group', { name: /Sport filters/i })).getByRole(
        'button',
        { name: 'Soccer' },
      ),
    )

    expect(screen.getByText(/API-Football soccer/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Arsenal' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Add Arsenal to win/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /Add LeBron James over 25.5 points/i,
      }),
    ).not.toBeInTheDocument()
  })
})
