import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { RecentActivity } from './dashboard/components/RecentActivity'
import { useDashboardData } from '@/pages/dashboard/hooks/useDashboardData'

export function RecentActivityPage() {
  const navigate = useNavigate()
  const { recentActivity } = useDashboardData()

  return (
    <div data-testid="page-recent-activity" className="min-h-full bg-background p-3 md:p-6">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Recent Activity</h1>
            <p className="text-sm text-muted-foreground">Full activity timeline</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <RecentActivity data={recentActivity} />
        </div>
      </div>
    </div>
  )
}
