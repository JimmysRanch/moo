import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useIsMobile } from '@/hooks/use-mobile'

type FinancialPoint = {
  month: string
  shortMonth: string
  revenue: number
  expenses: number
  profit: number
}

export function FinancialChart({ data = [] }: { data?: FinancialPoint[] }) {
  const isMobile = useIsMobile()

  return (
    <div className="w-full h-[200px] md:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={isMobile 
            ? { top: 10, right: 10, left: -20, bottom: 10 }
            : { top: 20, right: 30, left: 20, bottom: 20 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey={isMobile ? "shortMonth" : "month"}
            stroke="var(--muted-foreground)"
            tick={{ fill: 'var(--muted-foreground)', fontSize: isMobile ? 10 : 12 }}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 50 : 30}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fill: 'var(--muted-foreground)', fontSize: isMobile ? 10 : 12 }}
            width={isMobile ? 40 : 60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--popover-foreground)',
            }}
            formatter={(value: number) => `$${value.toFixed(2)}`}
          />
          {!isMobile && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
          )}
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-1)"
            strokeWidth={isMobile ? 2 : 3}
            dot={{ r: isMobile ? 3 : 4 }}
            name="REVENUE"
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="var(--chart-5)"
            strokeWidth={isMobile ? 2 : 3}
            dot={{ r: isMobile ? 3 : 4 }}
            name="EXPENSES"
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="var(--chart-2)"
            strokeWidth={isMobile ? 2 : 3}
            dot={{ r: isMobile ? 3 : 4 }}
            name="PROFIT"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
