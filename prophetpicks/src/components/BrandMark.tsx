import { Crown } from 'lucide-react'

interface BrandMarkProps {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={compact ? 'brand-mark compact' : 'brand-mark'}>
      <div className="mask-badge" aria-hidden="true">
        <img src="/prophet-mask.webp" alt="" />
      </div>
      <div className="brand-copy">
        <span className="brand-name">ProphetPicks</span>
        {!compact && (
          <span className="brand-slogan">
            <Crown size={13} strokeWidth={2.4} aria-hidden="true" />
            Find the edge before the slip.
          </span>
        )}
      </div>
    </div>
  )
}
