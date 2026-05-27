import { expect, test } from '@playwright/test'

test.describe('ProphetPicks Odds Board', () => {
  test('opens the Odds Board with rich quote tiles', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /Odds Board/i }).click()

    await expect(page.getByRole('heading', { name: /Odds Board/i })).toBeVisible()
    await expect(page.getByText(/Sportsbook lines, all sports/i)).toBeVisible()

    const sampleTile = page
      .getByRole('button', { name: /^Add Arsenal at decimal 4 to slip/i })
      .first()
    await expect(sampleTile).toBeVisible()
    await expect(sampleTile).toContainText('Dec')
    await expect(sampleTile).toContainText('Am +300')
    await expect(sampleTile).toContainText('Imp 25.0%')
    await expect(sampleTile).toContainText(/Move [+-]\d+/)
    await expect(sampleTile).toContainText(/API-Football/)
    await expect(sampleTile).toContainText(/Updated/)
  })

  test('filters by sport and market, then places a mock bet from the Odds Board', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /Odds Board/i }).click()
    await page.getByLabel(/Sport/i).selectOption('nfl')
    await page.getByLabel(/Market/i).selectOption('moneyline')

    const chiefsTile = page
      .getByRole('button', {
        name: /^Add Kansas City Chiefs at decimal 1\.74 to slip/i,
      })
      .first()
    await expect(chiefsTile).toBeVisible()
    await chiefsTile.click()

    const slip = page.getByRole('dialog', { name: /Betting Slip/i })
    await expect(slip).toBeVisible()
    await expect(slip.getByText(/Kansas City Chiefs/i)).toBeVisible()
    await expect(slip.getByText(/Moneyline/i)).toBeVisible()

    await slip.getByLabel(/Confirm mock bet/i).check()
    await slip.getByRole('button', { name: /Place Mock Bet/i }).click()

    await expect(page.getByRole('status')).toContainText(/Mock bet saved locally/i)

    await slip.getByRole('button', { name: /Close betting slip/i }).click()
    await page.getByRole('button', { name: /My Bets/i }).click()

    await expect(page.getByText(/Kansas City Chiefs VS Buffalo Bills/i)).toBeVisible()
    await expect(page.getByText(/Pending Mock/i)).toBeVisible()
  })
})
