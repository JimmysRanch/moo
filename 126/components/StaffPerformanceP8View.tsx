import { useState } from "react"
import { motion } from "framer-motion"
import { PerformanceData } from "@/lib/performance-types"

type StaffPerformanceP8ViewProps = {
  data: PerformanceData
}

export function StaffPerformanceP8View({ data }: StaffPerformanceP8ViewProps) {
  const [activeCard, setActiveCard] = useState<
    | { type: "kpi"; index: number }
    | { type: "chart"; index: number }
    | { type: "earnings" | "top" | "bottom" | "matrix" }
    | null
  >(null)
  const closeActiveCard = () => setActiveCard(null)
  const kpis = data.kpis
  const charts = data.charts
  const earningsByBreed = data.earningsByBreed
  const topCombos = data.topCombos
  const bottomCombos = data.bottomCombos
  const matrixData = data.matrixData

  const renderModalContent = () => {
    if (!activeCard) return null

    if (activeCard.type === "kpi") {
      const kpi = kpis[activeCard.index]
      return (
        <>
          <div className="perf-kpi-inner">
            <div className="perf-kpi-top">
              <div className="perf-icon">{kpi.icon}</div>
              <div className="perf-value">
                {kpi.value}
                {kpi.unit && <span className="perf-unit">{kpi.unit}</span>}
              </div>
            </div>
            <div className="perf-label">{kpi.label}</div>
          </div>
          <div className="perf-card-detail">
            {kpi.label} trends and breakdowns appear here when expanded, including daily deltas and comparisons.
          </div>
        </>
      )
    }

    if (activeCard.type === "chart") {
      const chart = charts[activeCard.index]
      return (
        <div className="perf-chart-inner">
          <div className="perf-header">
            <div className="perf-dot" />
            <div>{chart.title}</div>
          </div>
          <div className="perf-chart-slot">
            {chart.labels.map((label, j) => {
              const value = chart.values[j]
              const max = Math.max(...chart.values)
              const height = Math.max(0.18, value / max)
              return (
                <div key={j} className="perf-chart-column">
                  <div className="perf-chart-value">
                    {chart.prefix ?? ""}{chart.prefix ? value.toFixed(2) : value.toFixed(0)}{chart.suffix ?? ""}
                  </div>
                  <div className="perf-chart-bar">
                    <div className="perf-chart-bar-fill" style={{ height: `${height * 100}%` }} />
                  </div>
                  <div className="perf-chart-label">{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (activeCard.type === "earnings") {
      return (
        <>
          <div className="perf-list-inner">
            <div className="perf-header">
              <div className="perf-dot" />
              <div>Earnings by Breed</div>
            </div>
            <div className="perf-list-slot">
              <div className="perf-list">
                {earningsByBreed.map((item, i) => (
                  <div key={i} className="perf-list-row">
                    <div className="perf-list-left">{item.left}</div>
                    <div className="perf-list-right">{item.right}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="perf-card-detail">
            View extended earnings data, seasonality, and price mix analysis when expanded.
          </div>
        </>
      )
    }

    if (activeCard.type === "top") {
      return (
        <>
          <div className="perf-list-inner">
            <div className="perf-header">
              <div className="perf-dot" />
              <div>Top Performing Breed & Size</div>
            </div>
            <div className="perf-list-slot">
              <div className="perf-list">
                {topCombos.map((item, i) => (
                  <div key={i} className="perf-list-row">
                    <div className="perf-list-left">{item.left}</div>
                    <div className="perf-list-right">{item.right}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="perf-card-detail">
            Expanded view highlights the top performers with service mix, repeat rate, and margin.
          </div>
        </>
      )
    }

    if (activeCard.type === "bottom") {
      return (
        <>
          <div className="perf-list-inner">
            <div className="perf-header">
              <div className="perf-dot" />
              <div>Lowest Performing Breed & Size</div>
            </div>
            <div className="perf-list-slot">
              <div className="perf-list">
                {bottomCombos.map((item, i) => (
                  <div key={i} className="perf-list-row">
                    <div className="perf-list-left">{item.left}</div>
                    <div className="perf-list-right">{item.right}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="perf-card-detail">
            Expanded details include appointment drivers, timing breakdowns, and improvement levers.
          </div>
        </>
      )
    }

    return (
      <>
        <div className="perf-list-inner">
          <div className="perf-header">
            <div className="perf-dot" />
            <div>RPM by Breed & Size</div>
          </div>
          <div className="perf-list-slot">
            <div className="perf-matrix">
              <div className="perf-matrix-head">
                <div>Breed</div>
                {matrixData.cols.map((col) => (
                  <div key={col}>{col}</div>
                ))}
              </div>
              {matrixData.rows.map((row) => (
                <div key={row.name} className="perf-matrix-row">
                  <div className="perf-matrix-breed">{row.name}</div>
                  {row.cells.map((cell, i) => (
                    <div key={i} className={`perf-matrix-cell ${cell ? "" : "muted"}`}>
                      {cell ?? "—"}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="perf-card-detail">
          Expanded matrix includes filters, percentile bands, and size mix comparisons.
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        .perf-wrap {
          padding: 0.75rem 0 0.5rem;
          height: calc(100vh - 9rem);
          max-height: calc(100vh - 9rem);
          overflow: hidden;
        }

        .perf-immersive-frame {
          height: 100%;
          perspective: 1600px;
          perspective-origin: 50% 50%;
          padding: 0.75rem 1.25rem;
        }

        .perf-layout {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: 1fr 2fr 2fr 2fr;
          gap: 0.75rem;
          height: 100%;
          transform-style: preserve-3d;
          transform: translateZ(0) rotateX(1deg) scale(0.965);
          transform-origin: center;
        }

        .perf-card {
          height: 100%;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 1.5rem;
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25), 0 0 18px rgba(56, 189, 248, 0.18);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          transform-style: preserve-3d;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .perf-card:hover {
          transform: translateZ(12px);
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.35),
            0 12px 30px rgba(56, 189, 248, 0.35);
        }

        .perf-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            radial-gradient(120% 90% at 50% 0%, rgba(255, 255, 255, 0.24), transparent 60%),
            radial-gradient(120% 90% at 50% 120%, rgba(15, 23, 42, 0.45), transparent 62%);
          opacity: 0.9;
          pointer-events: none;
          transform: translateZ(1px);
        }

        .perf-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(90deg, rgba(15, 23, 42, 0.18), transparent 35%, transparent 65%, rgba(15, 23, 42, 0.18)),
            radial-gradient(120% 80% at 50% 50%, rgba(59, 130, 246, 0.12), transparent 70%);
          opacity: 0.75;
          pointer-events: none;
          transform: translateZ(1px);
        }

        .perf-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 60;
        }

        .perf-modal-layer {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 80;
          pointer-events: none;
        }

        .perf-card-expanded {
          position: relative;
          width: min(80vw, 980px);
          height: min(80vh, 760px);
          transform: none;
          border: 1px solid rgba(148, 163, 184, 0.45);
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.55);
          overflow: auto;
          cursor: default;
          pointer-events: auto;
          background: hsl(var(--card) / 1);
          background-image: none;
          opacity: 1;
          isolation: isolate;
        }

        .perf-card-expanded::before,
        .perf-card-expanded::after {
          display: none;
        }

        .perf-modal-layer .perf-card-expanded::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: hsl(var(--card) / 1);
          opacity: 1;
          z-index: 0;
        }

        .perf-modal-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 2rem;
          height: 2rem;
          border-radius: 999px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--secondary));
          color: hsl(var(--foreground));
          display: grid;
          place-items: center;
          font-size: 1rem;
          z-index: 2;
        }

        .perf-modal-close:hover {
          background: hsl(var(--card));
        }

        .perf-card-expanded .perf-value {
          font-size: 2.75rem;
        }

        .perf-card-expanded .perf-unit {
          font-size: 1.25rem;
        }

        .perf-card-expanded .perf-label,
        .perf-card-expanded .perf-header {
          font-size: 0.9rem;
        }

        .perf-card-expanded .perf-list-row {
          padding: 0.75rem 1rem;
        }

        .perf-card-expanded .perf-chart-slot {
          padding: 0.75rem;
        }

        .perf-card-expanded.perf-chart-card {
          width: min(65vw, 720px);
          height: min(55vh, 520px);
        }

        .perf-card-detail {
          display: none;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid hsl(var(--border));
          color: hsl(var(--muted-foreground));
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .perf-card-expanded .perf-card-detail {
          display: block;
        }


        .perf-card > * {
          position: relative;
          z-index: 1;
        }

        .perf-slot-1 {
          grid-column: 1;
          grid-row: 1;
          transform: rotateY(6deg) translateZ(8px);
        }

        .perf-slot-2 {
          grid-column: 2;
          grid-row: 1;
          transform: translateZ(10px);
          height: calc(100% - 1rem);
        }

        .perf-slot-3 {
          grid-column: 3;
          grid-row: 1;
          transform: rotateY(-6deg) translateZ(8px);
        }

        .perf-slot-4 {
          grid-column: 1;
          grid-row: 2;
          transform: rotateY(6deg) translateZ(8px);
        }

        .perf-slot-5 {
          grid-column: 2;
          grid-row: 2;
          transform: translateZ(9px);
          height: calc(100% - 1rem);
        }

        .perf-slot-6 {
          grid-column: 3;
          grid-row: 2;
          transform: rotateY(-6deg) translateZ(8px);
        }

        .perf-slot-7 {
          grid-column: 1;
          grid-row: 3 / span 2;
          transform: rotateY(6deg) translateZ(6px);
        }

        .perf-slot-8 {
          grid-column: 2;
          grid-row: 3;
          transform: translateZ(7px);
          height: calc(100% - 0.35rem);
        }

        .perf-slot-9 {
          grid-column: 2;
          grid-row: 4;
          transform: translateZ(7px);
          height: calc(100% - 0.35rem);
        }

        .perf-slot-10 {
          grid-column: 3;
          grid-row: 3 / span 2;
          transform: rotateY(-6deg) translateZ(6px);
        }

        .perf-kpi-card {
          position: relative;
          overflow: hidden;
        }

        .perf-kpi-inner {
          position: relative;
          border-radius: 0.75rem;
          background: hsl(var(--card));
          border: none;
          box-shadow: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.375rem;
          height: 100%;
        }

        .perf-kpi-top {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .perf-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          display: grid;
          place-items: center;
          background: hsl(var(--secondary));
          border: none;
          box-shadow: none;
          color: hsl(var(--foreground));
        }

        .perf-value {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          font-weight: 800;
          letter-spacing: 0.019rem;
          font-size: 2rem;
          line-height: 1;
        }

        .perf-unit {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.019rem;
          opacity: 0.75;
        }

        .perf-label {
          font-size: 0.6875rem;
          letter-spacing: 0.04rem;
          text-transform: none;
          color: hsl(var(--muted-foreground));
        }

        .perf-chart-card {
          position: relative;
          overflow: visible;
        }

        .perf-chart-inner {
          position: relative;
          border-radius: 0.75rem;
          background: hsl(var(--card));
          border: none;
          box-shadow: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          height: 100%;
        }

        .perf-header {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.0125rem;
          color: hsl(var(--foreground));
          padding: 0;
        }

        .perf-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 0.1875rem;
          background: hsl(var(--primary));
          box-shadow: none;
        }

        .amber .perf-dot {
          background: hsl(var(--secondary));
          box-shadow: none;
        }

        .perf-chart-slot {
          flex: 1;
          border-radius: 0.75rem;
          background: hsl(var(--secondary));
          border: none;
          box-shadow: none;
          margin: 0;
          padding: 0.5rem;
          display: flex;
          align-items: flex-end;
          gap: 0.625rem;
          min-height: 0;
        }

        .perf-chart-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .perf-chart-value {
          font-size: 0.6875rem;
          text-align: center;
          color: hsl(var(--muted-foreground));
        }

        .perf-chart-bar {
          height: 5rem;
          border-radius: 0.625rem;
          border: none;
          background: hsl(var(--background));
          overflow: hidden;
          display: flex;
          align-items: flex-end;
        }

        .perf-chart-bar-fill {
          width: 100%;
          border-radius: 0.625rem 0.625rem 0 0;
          background: linear-gradient(180deg, rgba(56, 189, 248, 0.9), rgba(56, 189, 248, 0.35));
          box-shadow: 0 0.5rem 1.25rem rgba(56, 189, 248, 0.35);
          opacity: 1;
        }

        .perf-chart-label {
          font-size: 0.625rem;
          text-align: center;
          letter-spacing: 0.0625rem;
          color: hsl(var(--muted-foreground));
        }

        .perf-list-card {
          position: relative;
          overflow: hidden;
        }

        .perf-list-inner {
          position: relative;
          border-radius: 0.75rem;
          background: hsl(var(--card));
          border: none;
          box-shadow: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          height: 100%;
        }

        .perf-list-slot {
          flex: 1;
          border-radius: 0.75rem;
          background: hsl(var(--secondary));
          border: none;
          box-shadow: none;
          margin: 0;
          padding: 0.5rem;
          overflow-y: auto;
        }

        .perf-list {
          display: grid;
          gap: 0.625rem;
        }

        .perf-list-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.75rem;
          align-items: center;
          padding: 0.5rem 0.75rem;
          border-radius: 0.625rem;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
        }

        .perf-list-left {
          color: hsl(var(--foreground));
        }

        .perf-list-right {
          color: hsl(var(--foreground));
          font-weight: 900;
          letter-spacing: 0.0125rem;
        }

        .perf-section-title {
          margin: 0.5rem 0 0.25rem;
          font-size: 0.6875rem;
          letter-spacing: 0.0625rem;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
        }

        .perf-matrix {
          display: grid;
          gap: 0.625rem;
        }

        .perf-matrix-head,
        .perf-matrix-row {
          display: grid;
          grid-template-columns: 1.45fr repeat(4, 0.75fr);
          gap: 0.625rem;
          align-items: center;
        }

        .perf-matrix-head {
          color: hsl(var(--muted-foreground));
          font-size: 0.6875rem;
          letter-spacing: 0.0625rem;
          text-transform: uppercase;
        }

        .perf-matrix-breed,
        .perf-matrix-cell {
          padding: 0.5rem 0.75rem;
          border-radius: 0.625rem;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
        }

        .perf-matrix-breed {
          color: hsl(var(--foreground));
        }

        .perf-matrix-cell {
          text-align: center;
          font-weight: 900;
          color: hsl(var(--foreground));
        }

        .perf-matrix-cell.muted {
          color: hsl(var(--muted-foreground));
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .perf-wrap {
            height: auto;
          }

          .perf-layout {
            grid-template-columns: 1fr;
            grid-template-rows: none;
            height: auto;
            transform: none;
          }

          .perf-card {
            grid-column: auto;
            grid-row: auto;
            min-height: 12rem;
            transform: none;
          }

          .perf-card:hover {
            transform: none;
          }

          .perf-card-expanded {
            width: min(90vw, 720px);
            height: min(85vh, 720px);
          }

          .perf-card-expanded.perf-chart-card {
            width: min(85vw, 640px);
            height: min(70vh, 520px);
          }

        }
      `}</style>

      <div className="perf-wrap">
        {activeCard && <button className="perf-overlay" onClick={closeActiveCard} aria-label="Close details" />}
        {activeCard && (
          <div className="perf-modal-layer" role="dialog" aria-modal="true">
            <div
              className={`perf-card perf-card-expanded ${
                activeCard.type === "chart" ? "perf-chart-card" : "perf-list-card"
              }`}
            >
              <button className="perf-modal-close" onClick={closeActiveCard} aria-label="Close card">
                ✕
              </button>
              {renderModalContent()}
            </div>
          </div>
        )}
        <div className="perf-immersive-frame">
          <motion.div
            className="perf-layout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {kpis.map((kpi, i) => (
              <div
                key={i}
                className={`perf-kpi-card perf-card perf-slot-${i + 1} ${kpi.accent}`}
                onClick={() => setActiveCard({ type: "kpi", index: i })}
              >
                <div className="perf-kpi-inner">
                  <div className="perf-kpi-top">
                    <div className="perf-icon">{kpi.icon}</div>
                    <div className="perf-value">
                      {kpi.value}
                      {kpi.unit && <span className="perf-unit">{kpi.unit}</span>}
                    </div>
                  </div>
                  <div className="perf-label">{kpi.label}</div>
                </div>
              </div>
            ))}

            {charts.map((chart, i) => (
              <div
                key={i}
                className={`perf-chart-card perf-card perf-slot-${i + 4} ${chart.accent}`}
                onClick={() => setActiveCard({ type: "chart", index: i })}
              >
                <div className="perf-chart-inner">
                  <div className="perf-header">
                    <div className="perf-dot" />
                    <div>{chart.title}</div>
                  </div>
                  <div className="perf-chart-slot">
                    {chart.labels.map((label, j) => {
                      const value = chart.values[j]
                      const max = Math.max(...chart.values)
                      const height = Math.max(0.18, value / max)
                      return (
                        <div key={j} className="perf-chart-column">
                          <div className="perf-chart-value">
                            {chart.prefix ?? ""}{chart.prefix ? value.toFixed(2) : value.toFixed(0)}{chart.suffix ?? ""}
                          </div>
                          <div className="perf-chart-bar">
                            <div className="perf-chart-bar-fill" style={{ height: `${height * 100}%` }} />
                          </div>
                          <div className="perf-chart-label">{label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div
              className="perf-list-card perf-card perf-slot-7 blue"
              onClick={() => setActiveCard({ type: "earnings" })}
            >
              <div className="perf-list-inner">
                <div className="perf-header">
                  <div className="perf-dot" />
                  <div>Earnings by Breed</div>
                </div>
                <div className="perf-list-slot">
                  <div className="perf-list">
                    {earningsByBreed.map((item, i) => (
                      <div key={i} className="perf-list-row">
                        <div className="perf-list-left">{item.left}</div>
                        <div className="perf-list-right">{item.right}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="perf-list-card perf-card perf-slot-8 amber"
              onClick={() => setActiveCard({ type: "top" })}
            >
              <div className="perf-list-inner">
                <div className="perf-header">
                  <div className="perf-dot" />
                  <div>Top Performing Breed & Size</div>
                </div>
                <div className="perf-list-slot">
                  <div className="perf-list">
                    {topCombos.map((item, i) => (
                      <div key={i} className="perf-list-row">
                        <div className="perf-list-left">{item.left}</div>
                        <div className="perf-list-right">{item.right}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="perf-list-card perf-card perf-slot-9 amber"
              onClick={() => setActiveCard({ type: "bottom" })}
            >
              <div className="perf-list-inner">
                <div className="perf-header">
                  <div className="perf-dot" />
                  <div>Lowest Performing Breed & Size</div>
                </div>
                <div className="perf-list-slot">
                  <div className="perf-list">
                    {bottomCombos.map((item, i) => (
                      <div key={i} className="perf-list-row">
                        <div className="perf-list-left">{item.left}</div>
                        <div className="perf-list-right">{item.right}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="perf-list-card perf-card perf-slot-10 amber"
              onClick={() => setActiveCard({ type: "matrix" })}
            >
              <div className="perf-list-inner">
                <div className="perf-header">
                  <div className="perf-dot" />
                  <div>RPM by Breed & Size</div>
                </div>
                <div className="perf-list-slot">
                  <div className="perf-matrix">
                    <div className="perf-matrix-head">
                      <div>Breed</div>
                      {matrixData.cols.map((col) => (
                        <div key={col}>{col}</div>
                      ))}
                    </div>
                    {matrixData.rows.map((row) => (
                      <div key={row.name} className="perf-matrix-row">
                        <div className="perf-matrix-breed">{row.name}</div>
                        {row.cells.map((cell, i) => (
                          <div key={i} className={`perf-matrix-cell ${cell ? "" : "muted"}`}>
                            {cell ?? "—"}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
