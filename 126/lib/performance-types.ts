export type KPI = {
  icon?: string
  value: string
  unit?: string
  label: string
  accent: "blue" | "amber" | "green"
}

export type BarData = {
  title: string
  accent: "blue" | "amber"
  labels: string[]
  values: number[]
  prefix?: string
  suffix?: string
}

export type ListItem = {
  left: string
  right: string
}

export type MatrixData = {
  cols: string[]
  rows: Array<{ name: string; cells: Array<string | null> }>
}

export type PerformanceData = {
  kpis: KPI[]
  charts: BarData[]
  earningsByBreed: ListItem[]
  topCombos: ListItem[]
  bottomCombos: ListItem[]
  matrixData: MatrixData
}

export const EMPTY_PERFORMANCE_DATA: PerformanceData = {
  kpis: [],
  charts: [],
  earningsByBreed: [],
  topCombos: [],
  bottomCombos: [],
  matrixData: {
    cols: [],
    rows: []
  }
}
