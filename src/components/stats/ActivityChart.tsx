import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { DayActivity } from '../../types/progress'
import './ActivityChart.css'

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']

interface Props {
  data: DayActivity[]
}

function formatLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return DAY_LABELS[d.getDay()]
}

export function ActivityChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.count), 1)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="activity-chart">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barSize={24}>
          <XAxis
            dataKey="date"
            tickFormatter={formatLabel}
            tick={{ fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-heading)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(139,92,246,0.1)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="activity-chart__tooltip">
                  <span>{payload[0].value} słów</span>
                </div>
              )
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={entry.count > 0 ? (entry.date === today ? 'var(--accent)' : 'var(--accent-dim)') : 'var(--bg-surface)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
