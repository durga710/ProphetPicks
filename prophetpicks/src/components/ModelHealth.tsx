import { BarChart3, ShieldCheck } from 'lucide-react'

const buckets = [
  { label: 'A confidence', hitRate: 62, calibration: 58 },
  { label: 'B confidence', hitRate: 54, calibration: 52 },
  { label: 'C confidence', hitRate: 49, calibration: 48 },
]

export function ModelHealth() {
  return (
    <section className="board-panel model-health" aria-labelledby="model-health">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Model</p>
          <h2 id="model-health">Model Health</h2>
        </div>
        <ShieldCheck size={21} aria-hidden="true" />
      </div>

      <div className="health-grid">
        <div className="health-stat">
          <span>Fixture legs</span>
          <strong>6</strong>
        </div>
        <div className="health-stat">
          <span>Positive edge</span>
          <strong>6/6</strong>
        </div>
        <div className="health-stat">
          <span>Markets paused</span>
          <strong>0</strong>
        </div>
      </div>

      <div className="calibration-list">
        {buckets.map((bucket) => (
          <div className="calibration-row" key={bucket.label}>
            <div>
              <strong>{bucket.label}</strong>
              <span>
                Hit {bucket.hitRate}% · model {bucket.calibration}%
              </span>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span style={{ width: `${bucket.hitRate}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="model-note">
        <BarChart3 size={17} aria-hidden="true" />
        rules-v1 · fixture data · calibration preview
      </div>
    </section>
  )
}
