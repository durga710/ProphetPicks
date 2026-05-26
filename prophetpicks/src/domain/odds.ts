export interface EdgeInput {
  fairProbability: number
  impliedProbability: number
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`)
  }
}

export function americanToDecimalOdds(americanOdds: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new Error('American odds must be a non-zero number')
  }

  if (americanOdds > 0) {
    return 1 + americanOdds / 100
  }

  return 1 + 100 / Math.abs(americanOdds)
}

export function decimalToAmericanOdds(decimalOdds: number): number {
  assertPositive(decimalOdds, 'Decimal odds')

  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100)
  }

  return Math.round(-100 / (decimalOdds - 1))
}

export function americanToImpliedProbability(americanOdds: number): number {
  return decimalToImpliedProbability(americanToDecimalOdds(americanOdds))
}

export function decimalToImpliedProbability(decimalOdds: number): number {
  assertPositive(decimalOdds, 'Decimal odds')
  return 1 / decimalOdds
}

export function calculateEdge({
  fairProbability,
  impliedProbability,
}: EdgeInput): number {
  return fairProbability - impliedProbability
}

export function multiplyDecimalOdds(decimalOdds: number[]): number {
  if (decimalOdds.length === 0) {
    return 0
  }

  return decimalOdds.reduce((product, odds) => {
    assertPositive(odds, 'Decimal odds')
    return product * odds
  }, 1)
}

export function parlayHitProbability(probabilities: number[]): number {
  if (probabilities.length === 0) {
    return 0
  }

  return probabilities.reduce((product, probability) => {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error('Probability must be between 0 and 1')
    }

    return product * probability
  }, 1)
}

export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`
}

export function formatEdge(edge: number): string {
  const sign = edge >= 0 ? '+' : ''
  return `${sign}${(edge * 100).toFixed(1)}%`
}

export function formatAmericanOdds(americanOdds: number): string {
  return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`
}
