import { expect, test } from '@playwright/test'

const sports = [
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
]

test.describe('ProphetPicks sportsbook', () => {
  test('loads the dense all-sports board and team directory', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: /UEFA Champions League/i }),
    ).toBeVisible()

    const sportRail = page.getByRole('navigation', { name: /Sports/i })
    for (const sport of sports) {
      await expect(
        sportRail.getByRole('button', { name: sport, exact: true }),
      ).toBeVisible()
    }

    const leaguePulldown = page.getByRole('button', {
      name: /Soccer UEFA Champions League 5 events/i,
    })
    await expect(leaguePulldown).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByLabel(/Arsenal crest/i)).toBeVisible()
    await expect(page.getByLabel(/FC Barcelona crest/i)).toBeVisible()

    await leaguePulldown.click()
    await expect(leaguePulldown).toHaveAttribute('aria-expanded', 'false')
    await expect(
      page.getByRole('button', { name: /Open Arsenal VS FC Barcelona market/i }),
    ).toBeHidden()

    await leaguePulldown.click()
    await expect(
      page.getByRole('button', { name: /Open Arsenal VS FC Barcelona market/i }),
    ).toBeVisible()

    await page.getByRole('button', { name: /Teams/i }).click()
    await expect(page.getByRole('heading', { name: /Team Directory/i })).toBeVisible()
    await expect(page.getByText(/Kansas City Chiefs/i)).toBeVisible()
    await expect(page.getByText(/Los Angeles Lakers/i)).toBeVisible()
    await expect(page.getByText(/New York Yankees/i)).toBeVisible()
    await expect(page.getByText(/Toronto Maple Leafs/i)).toBeVisible()
  })

  test('opens sport-specific NFL markets', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'NFL' }).click()

    await expect(page.getByRole('heading', { name: /^NFL$/i })).toBeVisible()
    await expect(page.getByLabel(/Kansas City Chiefs crest/i)).toBeVisible()
    await expect(page.getByLabel(/Buffalo Bills crest/i)).toBeVisible()

    await page
      .getByRole('button', {
        name: /Open Kansas City Chiefs VS Buffalo Bills market/i,
      })
      .click()

    const catalog = page.getByRole('dialog', {
      name: /Kansas City Chiefs VS Buffalo Bills/i,
    })
    await expect(catalog).toBeVisible()
    await expect(catalog.getByRole('button', { name: /Moneyline/i })).toBeVisible()
    await expect(catalog.getByRole('button', { name: /Spread/i })).toBeVisible()
    await expect(catalog.getByRole('button', { name: /Total/i })).toBeVisible()
    await expect(catalog.getByRole('button', { name: /Player Props/i })).toBeVisible()

    await catalog.getByRole('button', { name: /Spread/i }).click()
    await expect(page.getByRole('heading', { name: /Spread/i })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: /Back Kansas City Chiefs -2.5 at 1.91/i,
      }),
    ).toBeVisible()
  })

  test('places a mock bet and records it in history and ledger', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'NFL' }).click()
    await page
      .getByRole('button', {
        name: /Open Kansas City Chiefs VS Buffalo Bills market/i,
      })
      .click()

    const catalog = page.getByRole('dialog', {
      name: /Kansas City Chiefs VS Buffalo Bills/i,
    })
    await catalog.getByRole('button', { name: /Moneyline/i }).click()

    await page
      .getByRole('button', { name: /Back Kansas City Chiefs at 1.74/i })
      .click()

    const slip = page.getByRole('dialog', { name: /Betting Slip/i })
    await expect(slip).toBeVisible()
    await expect(slip.getByText(/Kansas City Chiefs/i)).toBeVisible()
    await expect(slip.getByLabel(/Stake/i)).toHaveValue('$10.00')

    await slip.getByLabel(/Confirm mock bet/i).check()
    await slip.getByRole('button', { name: /Place Mock Bet/i }).click()

    await expect(page.getByRole('status')).toContainText(/Mock bet saved locally/i)

    await slip.getByRole('button', { name: /Close betting slip/i }).click()
    await page.getByRole('button', { name: /My Bets/i }).click()

    await expect(page.getByRole('heading', { name: /My Bets/i })).toBeVisible()
    await expect(page.getByText(/Kansas City Chiefs VS Buffalo Bills/i)).toBeVisible()
    await expect(page.getByText(/Pending Mock/i)).toBeVisible()

    await page.getByRole('button', { name: /Financial/i }).click()
    await page.getByRole('button', { name: /Ledger/i }).click()

    await expect(page.getByRole('heading', { name: /Account Ledger/i })).toBeVisible()
    await expect(page.getByText(/Mock stake reserved/i)).toBeVisible()
  })
})
