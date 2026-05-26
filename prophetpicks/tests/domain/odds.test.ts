import { describe, expect, it } from 'vitest'
import {
  americanToDecimalOdds,
  americanToImpliedProbability,
  calculateEdge,
  decimalToAmericanOdds,
  decimalToImpliedProbability,
  multiplyDecimalOdds,
  parlayHitProbability,
} from '../../src/domain/odds'

describe('odds math', () => {
  it('converts American odds to implied probability', () => {
    expect(americanToImpliedProbability(-110)).toBeCloseTo(0.5238, 4)
    expect(americanToImpliedProbability(150)).toBeCloseTo(0.4, 4)
  })

  it('converts between American and decimal odds', () => {
    expect(americanToDecimalOdds(-110)).toBeCloseTo(1.9091, 4)
    expect(americanToDecimalOdds(150)).toBeCloseTo(2.5, 4)
    expect(decimalToAmericanOdds(1.91)).toBe(-110)
    expect(decimalToAmericanOdds(2.5)).toBe(150)
  })

  it('converts decimal odds to implied probability', () => {
    expect(decimalToImpliedProbability(2.5)).toBeCloseTo(0.4, 4)
    expect(decimalToImpliedProbability(1.91)).toBeCloseTo(0.5236, 4)
  })

  it('calculates edge from fair and implied probability', () => {
    expect(
      calculateEdge({ fairProbability: 0.58, impliedProbability: 0.52 }),
    ).toBeCloseTo(0.06, 4)
  })

  it('multiplies parlay odds and probabilities', () => {
    expect(multiplyDecimalOdds([1.91, 2.1, 1.8])).toBeCloseTo(7.2198, 4)
    expect(parlayHitProbability([0.58, 0.52, 0.6])).toBeCloseTo(0.181, 3)
  })
})
