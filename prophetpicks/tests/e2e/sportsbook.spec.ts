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

    const sportRail = page.getByRole('navigation', { name: /League categories/i })
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
    await expect(slip.getByLabel(/Stake/i)).toHaveValue('10.00')

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

  test('keeps visible controls interactive across filters and account screens', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Group B', exact: true }).click()
    await expect(
      page.getByRole('button', {
        name: /Open Juventus VS Bayern Munich market/i,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: /Open Arsenal VS FC Barcelona market/i,
      }),
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'Bets', exact: true }).click()
    await page.getByLabel(/Search games/i).fill('Roma')
    await expect(
      page.getByRole('button', { name: /Open Roma VS Real Madrid market/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: /Open Juventus VS Bayern Munich market/i,
      }),
    ).toHaveCount(0)

    await page.getByRole('button', { name: /Open account menu/i }).click()
    const accountMenu = page.getByRole('dialog', { name: /Account Menu/i })
    await expect(accountMenu).toBeVisible()
    await expect(accountMenu.getByText(/Mock bankroll/i)).toBeVisible()
    await accountMenu.getByRole('button', { name: /Close account menu/i }).click()

    await page.getByRole('button', { name: /My Account/i }).click()
    await expect(page.getByRole('heading', { name: /Account Overview/i })).toBeVisible()

    await page.getByRole('button', { name: /Today's Matches/i }).click()
    await expect(page.getByRole('heading', { name: /Today's Matches/i })).toBeVisible()

    await page.getByRole('button', { name: /Teams/i }).click()
    await page.getByLabel(/Search teams/i).fill('Lakers')
    await expect(page.getByText(/Los Angeles Lakers/i)).toBeVisible()
    await expect(page.getByText(/Kansas City Chiefs/i)).toHaveCount(0)

    await page.getByRole('button', { name: /My Bets/i }).click()
    await page.getByLabel(/Type/i).selectOption('simple')
    await expect(page.getByText(/Roma VS Real Madrid/i)).toBeVisible()
    await expect(page.getByText(/Arsenal VS FC Barcelona/i)).toHaveCount(0)
    await page.getByLabel(/Search bets/i).fill('Bayern')
    await expect(page.getByText(/Juventus VS Bayern Munich/i)).toBeVisible()
    await expect(page.getByText(/Roma VS Real Madrid/i)).toHaveCount(0)

    await page.getByRole('button', { name: /Financial/i }).click()
    await page.getByRole('button', { name: /Ledger/i }).click()
    await page.getByLabel(/Search Account Ledger/i).fill('settlement')
    await expect(page.getByText(/Mock bet settlement/i)).toBeVisible()
    await expect(page.getByText(/Opening mock bankroll/i)).toHaveCount(0)
  })

  test('runs live slip controls, market refresh, and policy dialogs', async ({
    page,
  }) => {
    await page.goto('/')

    await page
      .getByRole('button', { name: /Open Arsenal VS FC Barcelona market/i })
      .click()
    await page
      .getByRole('dialog', { name: /Arsenal VS FC Barcelona/i })
      .getByRole('button', { name: /Match Odds/i })
      .click()

    await page.getByRole('button', { name: /Refresh Markets/i }).click()
    await expect(page.getByRole('status')).toContainText(/Markets refreshed/i)

    await page.getByRole('button', { name: /Back Arsenal at 4/i }).click()
    const slip = page.getByRole('dialog', { name: /Betting Slip/i })
    await expect(slip.getByRole('button', { name: /Combined/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await slip.getByRole('button', { name: /Simple/i }).click()
    await expect(slip.getByRole('button', { name: /Simple/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await slip.getByLabel(/Stake/i).fill('25')
    await expect(slip.getByText('$100.00')).toBeVisible()

    await slip.getByRole('button', { name: /Close betting slip/i }).click()
    await page.getByRole('link', { name: /Privacy Policy/i }).click()
    const policy = page.getByRole('dialog', { name: /Privacy Policy/i })
    await expect(policy).toBeVisible()
    await expect(policy.getByText(/personal simulator/i)).toBeVisible()
  })

  test('builds a Prophet Picks parlay from ranked predictions', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /Prophet Picks/i }).click()
    await expect(page.getByRole('heading', { name: /Prophet Picks/i })).toBeVisible()
    await expect(page.getByText(/Editor's picks/i)).toBeVisible()
    await expect(page.getByText(/Kansas City Chiefs VS Buffalo Bills/i)).toBeVisible()

    await page.getByLabel(/Sport/i).selectOption('NFL')
    await page.getByLabel(/Confidence/i).selectOption('A')
    await page.getByLabel(/Risk/i).selectOption('Low')
    await expect(page.getByText(/Kansas City Chiefs VS Buffalo Bills/i)).toBeVisible()
    await expect(page.getByText(/Arsenal VS FC Barcelona/i)).toHaveCount(0)

    await page
      .getByRole('button', { name: /Add Kansas City Chiefs Moneyline pick/i })
      .click()
    let slip = page.getByRole('dialog', { name: /Betting Slip/i })
    await expect(slip.getByText(/Kansas City Chiefs/i)).toBeVisible()
    await expect(slip.getByText(/Moneyline/i)).toBeVisible()
    await slip.getByRole('button', { name: /Close betting slip/i }).click()

    await page.getByLabel(/Sport/i).selectOption('all')
    await page.getByLabel(/Confidence/i).selectOption('all')
    await page.getByLabel(/Risk/i).selectOption('all')
    await page.getByRole('button', { name: /Build Best Parlay/i }).click()

    slip = page.getByRole('dialog', { name: /Betting Slip/i })
    await expect(slip.getByRole('button', { name: /Combined/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(slip.getByText(/3 selections/i)).toBeVisible()
    await expect(slip.getByText(/Kansas City Chiefs/i)).toBeVisible()
    await expect(slip.getByText(/Los Angeles Lakers/i)).toBeVisible()
    await expect(slip.getByText(/Arsenal/i)).toBeVisible()
  })
})
