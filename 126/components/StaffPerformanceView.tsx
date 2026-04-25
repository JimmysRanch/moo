import { useState, type CSSProperties } from "react"
import { motion } from "framer-motion"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PerformanceData } from "@/lib/performance-types"
import { useAppearance } from "@/hooks/useAppearance"

type CardDetail = {
  title: string
  description: string
  items?: string[]
}

type StaffPerformanceViewProps = {
  data: PerformanceData
  scopeLabel?: string
  headerBackground?: string
}

export function StaffPerformanceView({
  data,
  scopeLabel = "this groomer",
  headerBackground,
}: StaffPerformanceViewProps) {
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null)
  const { selectedTheme } = useAppearance()
  const isSteelNoirTheme = selectedTheme === 'steel-noir'
  const isBlueSteelTheme = selectedTheme === 'blue-steel'

  const { kpis, charts, earningsByBreed, topCombos, bottomCombos, matrixData } = data

  return (
    <>
      <style>{`
        .perf-wrap {
          padding: 0.75rem 0.75rem 0.5rem;
          height: calc(100vh - 9rem);
          max-height: calc(100vh - 9rem);
          overflow-x: visible;
          overflow-y: hidden;
          --perf-header-bg: #fde68a;
          --perf-accent: rgba(56, 189, 248, 0.3);
          --perf-accent-strong: rgba(56, 189, 248, 0.9);
          --perf-accent-soft: rgba(56, 189, 248, 0.35);
        }

        .perf-layout {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: 1fr 2fr 2fr 2fr;
          gap: 0.75rem;
          height: 100%;
        }

        .perf-card {
          height: 100%;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          box-shadow: 0 0 0 1px var(--perf-accent), 0 0 18px color-mix(in oklab, var(--perf-accent) 75%, transparent);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .perf-card-button {
          cursor: pointer;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .perf-card-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 0 1px var(--perf-accent), 0 0 24px color-mix(in oklab, var(--perf-accent) 85%, transparent);
        }

        .perf-slot-1 {
          grid-column: 1;
          grid-row: 1;
        }

        .perf-slot-2 {
          grid-column: 2;
          grid-row: 1;
        }

        .perf-slot-3 {
          grid-column: 3;
          grid-row: 1;
        }

        .perf-slot-4 {
          grid-column: 1;
          grid-row: 2;
        }

        .perf-slot-5 {
          grid-column: 2;
          grid-row: 2;
        }

        .perf-slot-6 {
          grid-column: 3;
          grid-row: 2;
        }

        .perf-slot-7 {
          grid-column: 1;
          grid-row: 3 / span 2;
        }

        .perf-slot-8 {
          grid-column: 2;
          grid-row: 3;
        }

        .perf-slot-9 {
          grid-column: 2;
          grid-row: 4;
        }

        .perf-slot-10 {
          grid-column: 3;
          grid-row: 3 / span 2;
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
          text-align: center;
          align-items: center;
        }

        .perf-kpi-top {
          display: flex;
          align-items: center;
          justify-content: center;
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
          text-align: center;
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
          padding: 0.35rem 0.6rem;
          border-radius: 0.6rem;
          background: var(--perf-header-bg);
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
          height: 6rem;
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
          background: linear-gradient(180deg, var(--perf-accent-strong), var(--perf-accent-soft));
          box-shadow: 0 0.5rem 1.25rem color-mix(in oklab, var(--perf-accent-soft) 90%, transparent);
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
          padding: 0.35rem;
          overflow-y: auto;
        }

        .perf-list {
          display: grid;
          gap: 0.35rem;
        }

        .perf-list-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.45rem;
          align-items: center;
          padding: 0.3rem 0.5rem;
          border-radius: 0.625rem;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          font-size: 0.8rem;
          line-height: 1.15;
        }

        .perf-list-row.rpm-breed {
          font-size: 0.9rem;
          line-height: 1.2;
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
          grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(0, 0.85fr));
          gap: 0.4rem;
          align-items: stretch;
        }

        .perf-matrix-head {
          color: hsl(var(--muted-foreground));
          font-size: 0.6875rem;
          letter-spacing: 0.0625rem;
          text-transform: uppercase;
          text-align: center;
        }

        .perf-matrix-head div:first-child {
          text-align: left;
        }

        .perf-matrix-breed,
        .perf-matrix-cell {
          padding: 0.35rem 0.5rem;
          border-radius: 0.625rem;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          min-height: 2.1rem;
        }

        .perf-matrix-breed {
          color: hsl(var(--foreground));
          text-align: left;
          font-weight: 600;
          font-size: 0.8rem;
        }

        .perf-matrix-cell {
          font-weight: 900;
          color: hsl(var(--foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
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
          }

          .perf-card {
            grid-column: auto;
            grid-row: auto;
            min-height: 12rem;
          }
        }
      `}</style>

      <div
        className="perf-wrap"
          style={
            ({
              ...(headerBackground ? { "--perf-header-bg": headerBackground } : {}),
              ...(isSteelNoirTheme
                ? {
                    "--perf-accent": "rgba(226, 171, 84, 0.4)",
                    "--perf-accent-strong": "rgba(226, 171, 84, 0.92)",
                    "--perf-accent-soft": "rgba(212, 150, 53, 0.36)",
                    "--perf-header-bg": headerBackground ?? "rgba(74, 80, 92, 0.9)",
                  }
                : {}),
              ...(isBlueSteelTheme
                ? {
                    "--perf-accent": "rgba(122, 173, 242, 0.45)",
                    "--perf-accent-strong": "rgba(122, 173, 242, 0.9)",
                    "--perf-accent-soft": "rgba(103, 157, 228, 0.38)",
                    "--perf-header-bg": headerBackground ?? "rgba(66, 78, 98, 0.9)",
                  }
                : {}),
            } as CSSProperties)
          }
      >
        <motion.div
          className="perf-layout"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className={`perf-kpi-card perf-card perf-card-button perf-slot-${i + 1} ${kpi.accent}`}
              onClick={() =>
                setSelectedCard({
                  title: kpi.label,
                  description: `Current ${scopeLabel} value: ${kpi.value}${kpi.unit ? ` ${kpi.unit}` : ""}.`,
                })
              }
            >
              <div className="perf-kpi-inner">
                <div className="perf-kpi-top">
                  {kpi.icon && <div className="perf-icon">{kpi.icon}</div>}
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
              className={`perf-chart-card perf-card perf-card-button perf-slot-${i + 4} ${chart.accent}`}
              onClick={() =>
                setSelectedCard({
                  title: chart.title,
                  description: `Monthly performance snapshot for ${scopeLabel}.`,
                  items: chart.labels.map((label, index) => {
                    const value = chart.values[index]
                    const formattedValue = chart.prefix
                      ? `${chart.prefix}${value.toFixed(2)}`
                      : `${value.toFixed(0)}${chart.suffix ?? ""}`
                    return `${label}: ${formattedValue}`
                  }),
                })
              }
            >
              <div className="perf-chart-inner">
                <div className="perf-header">
                  <div className="perf-dot" />
                  <div>{chart.title}</div>
                </div>
                <div className="perf-chart-slot">
                  {chart.labels.map((label, j) => {
                    const value = chart.values[j]
                    const min = Math.min(...chart.values)
                    const max = Math.max(...chart.values)
                    const range = Math.max(0.01, max - min)
                    const height = Math.max(0.15, (value - min) / range)
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
            className="perf-list-card perf-card perf-card-button perf-slot-7 blue"
            onClick={() =>
              setSelectedCard({
                title: "RPM by Breed",
                description: `Average RPM contribution by breed for ${scopeLabel}.`,
                items: earningsByBreed.map((item) => `${item.left}: ${item.right}`),
              })
            }
          >
            <div className="perf-list-inner">
              <div className="perf-header">
                <div className="perf-dot" />
                <div>RPM by Breed</div>
              </div>
              <div className="perf-list-slot">
                <div className="perf-list">
                  {earningsByBreed.map((item, i) => (
                    <div key={i} className="perf-list-row rpm-breed">
                      <div className="perf-list-left">{item.left}</div>
                      <div className="perf-list-right">{item.right}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className="perf-list-card perf-card perf-card-button perf-slot-8 amber"
            onClick={() =>
              setSelectedCard({
                title: "Top Performing Breed & Size",
                description: `Highest RPM combinations for ${scopeLabel}.`,
                items: topCombos.map((item) => `${item.left}: ${item.right}`),
              })
            }
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
            className="perf-list-card perf-card perf-card-button perf-slot-9 amber"
            onClick={() =>
              setSelectedCard({
                title: "Lowest Performing Breed & Size",
                description: `Lowest RPM combinations for ${scopeLabel}.`,
                items: bottomCombos.map((item) => `${item.left}: ${item.right}`),
              })
            }
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
            className="perf-list-card perf-card perf-card-button perf-slot-10 amber"
            onClick={() =>
              setSelectedCard({
                title: "RPM by Breed & Size",
                description: `RPM matrix across breeds and size categories for ${scopeLabel}.`,
                items: matrixData.rows.map((row) => `${row.name}: ${row.cells.map((cell) => cell ?? "—").join(" | ")}`),
              })
            }
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

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{selectedCard?.title}</DialogTitle>
            <DialogDescription>{selectedCard?.description}</DialogDescription>
          </DialogHeader>
          {selectedCard?.items && (
            <ul className="space-y-2 text-sm text-foreground">
              {selectedCard.items.map((item) => (
                <li key={item} className="rounded-md border border-border bg-background/50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
