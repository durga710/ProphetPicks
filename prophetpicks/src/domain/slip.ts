import { multiplyDecimalOdds, parlayHitProbability } from './odds'

export interface SlipLeg {
  id: string
  eventId: string
  marketId: string
  selectionId: string
  teamId?: string
  playerId?: string
  marketType: string
  oddsUpdatedAt: string
  startsAt: string
  americanOdds: number
  decimalOdds: number
  fairProbability: number
}

export interface SlipValidationOptions {
  now: string
  maxLegs: number
  staleAfterMinutes?: number
}

export interface SlipValidationResult {
  errors: string[]
  warnings: string[]
  combinedDecimalOdds: number
  estimatedHitProbability: number
}

const DEFAULT_STALE_AFTER_MINUTES = 15

function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Number.POSITIVE_INFINITY
  }

  return (end - start) / 60_000
}

function hasDuplicateLegs(legs: SlipLeg[]): boolean {
  const seen = new Set<string>()

  for (const leg of legs) {
    const key = `${leg.eventId}:${leg.marketId}:${leg.selectionId}`

    if (seen.has(key)) {
      return true
    }

    seen.add(key)
  }

  return false
}

function hasCorrelatedLegs(legs: SlipLeg[]): boolean {
  for (let index = 0; index < legs.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < legs.length; nextIndex += 1) {
      const current = legs[index]
      const next = legs[nextIndex]
      const sameEvent = current.eventId === next.eventId
      const samePlayer =
        Boolean(current.playerId) && current.playerId === next.playerId
      const sameTeam = Boolean(current.teamId) && current.teamId === next.teamId

      if (sameEvent && (samePlayer || sameTeam)) {
        return true
      }
    }
  }

  return false
}

export function validateSlip(
  legs: SlipLeg[],
  options: SlipValidationOptions,
): SlipValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const staleAfterMinutes =
    options.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES

  if (hasDuplicateLegs(legs)) {
    errors.push('Duplicate leg')
  }

  if (legs.length > options.maxLegs) {
    warnings.push('Too many legs')
  }

  if (
    legs.some(
      (leg) => minutesBetween(leg.oddsUpdatedAt, options.now) > staleAfterMinutes,
    )
  ) {
    warnings.push('Stale odds')
  }

  if (legs.some((leg) => new Date(options.now) >= new Date(leg.startsAt))) {
    errors.push('Expired event')
  }

  if (hasCorrelatedLegs(legs)) {
    warnings.push('Correlated legs')
  }

  return {
    errors,
    warnings,
    combinedDecimalOdds: multiplyDecimalOdds(legs.map((leg) => leg.decimalOdds)),
    estimatedHitProbability: parlayHitProbability(
      legs.map((leg) => leg.fairProbability),
    ),
  }
}
