/**
 * Insights Engine
 * Rule-based system for generating actionable insights from report data
 */

import {
  NormalizedAppointment,
  NormalizedTransaction,
  NormalizedInventoryItem,
  NormalizedMessage,
  Insight,
  ReportFilters,
} from '../types'
import {
  calculateNoShowRate,
  calculateContributionMarginPercent,
  calculateRebook7d,
  calculateNetSales,
} from './analyticsEngine'

interface InsightContext {
  appointments: NormalizedAppointment[]
  previousAppointments: NormalizedAppointment[]
  transactions: NormalizedTransaction[]
  previousTransactions: NormalizedTransaction[]
  inventoryItems: NormalizedInventoryItem[]
  messages: NormalizedMessage[]
  filters: ReportFilters
}

/**
 * Generate insights based on current data and filters
 * Returns 1-3 most relevant insights
 */
export function generateInsights(context: InsightContext): Insight[] {
  const insights: Insight[] = []
  
  // Check each insight rule
  const noShowInsight = checkNoShowSpike(context)
  if (noShowInsight) insights.push(noShowInsight)
  
  const marginInsight = checkMarginDrop(context)
  if (marginInsight) insights.push(marginInsight)
  
  const rebookInsight = checkRebookWeakness(context)
  if (rebookInsight) insights.push(rebookInsight)
  
  const staffInsight = checkStaffStandout(context)
  if (staffInsight) insights.push(staffInsight)
  
  const inventoryInsight = checkInventoryRisk(context)
  if (inventoryInsight) insights.push(inventoryInsight)
  
  const campaignInsight = checkCampaignROI(context)
  if (campaignInsight) insights.push(campaignInsight)
  
  // Sort by severity and return top 3
  const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 }
  return insights
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 3)
}

/**
 * No-show spike: delta > +15% and >= 5 appointments impacted
 */
function checkNoShowSpike(context: InsightContext): Insight | null {
  const currentRate = calculateNoShowRate(context.appointments)
  const previousRate = calculateNoShowRate(context.previousAppointments)
  
  const delta = currentRate - previousRate
  const noShowCount = context.appointments.filter(a => a.noShowFlag).length
  
  if (delta > 15 && noShowCount >= 5) {
    // Find impacted segments
    const staffNoShows = new Map<string, number>()
    context.appointments
      .filter(a => a.noShowFlag)
      .forEach(a => {
        staffNoShows.set(a.groomerName, (staffNoShows.get(a.groomerName) || 0) + 1)
      })
    
    const topStaff = Array.from(staffNoShows.entries())
      .sort((a, b) => b[1] - a[1])[0]
    
    return {
      id: `noshow-spike-${Date.now()}`,
      type: 'no-show-spike',
      category: 'noshow,cancel,recovery,reminder',
      title: 'No-Show Rate Spiked',
      description: `No-show rate increased by ${delta.toFixed(1)}% compared to the previous period. ${noShowCount} appointments were affected.`,
      metric: 'noShowRate',
      delta,
      impactedSegment: topStaff ? `Highest impact: ${topStaff[0]} (${topStaff[1]} no-shows)` : undefined,
      suggestedAction: 'Review reminder settings and consider requiring deposits for high-risk time slots.',
      severity: delta > 25 ? 'critical' : 'warning',
      drillKey: 'status:no-show',
    }
  }
  
  return null
}

/**
 * Margin drop: margin% down > 5 pts and $ impact > threshold
 */
function checkMarginDrop(context: InsightContext): Insight | null {
  const currentMargin = calculateContributionMarginPercent(context.appointments, context.transactions)
  const previousMargin = calculateContributionMarginPercent(context.previousAppointments, context.previousTransactions)
  
  const delta = currentMargin - previousMargin
  const currentNet = calculateNetSales(context.appointments)
  const marginImpact = Math.abs(delta / 100 * currentNet)
  
  if (delta < -5 && marginImpact > 10000) { // $100 threshold
    return {
      id: `margin-drop-${Date.now()}`,
      type: 'margin-drop',
      category: 'margin,cost,profit,sales,revenue',
      title: 'Margin Declined',
      description: `Contribution margin dropped ${Math.abs(delta).toFixed(1)} percentage points, representing approximately $${(marginImpact / 100).toFixed(0)} in reduced profitability.`,
      metric: 'contributionMarginPercent',
      delta,
      suggestedAction: 'Review discount usage and labor scheduling to identify cost savings opportunities.',
      severity: delta < -10 ? 'critical' : 'warning',
      drillKey: 'margin:low',
    }
  }
  
  return null
}

/**
 * Rebook weakness: rebook<=7d down > 10%
 */
function checkRebookWeakness(context: InsightContext): Insight | null {
  const currentRebook = calculateRebook7d(context.appointments)
  const previousRebook = calculateRebook7d(context.previousAppointments)
  
  const delta = currentRebook - previousRebook
  
  if (delta < -10) {
    return {
      id: `rebook-weakness-${Date.now()}`,
      type: 'rebook-weakness',
      category: 'retention,rebook,churn,lapsed',
      title: 'Rebooking Rate Dropped',
      description: `7-day rebooking rate decreased by ${Math.abs(delta).toFixed(1)}%. Fewer clients are scheduling their next appointment before leaving.`,
      metric: 'rebook7d',
      delta,
      suggestedAction: 'Train staff to prompt rebooking at checkout and consider implementing rebooking incentives.',
      severity: delta < -20 ? 'critical' : 'warning',
      drillKey: 'rebook:missed',
    }
  }
  
  return null
}

/**
 * Staff standout: margin/hour > 1.3x average
 */
function checkStaffStandout(context: InsightContext): Insight | null {
  // Group appointments by staff
  const staffMetrics = new Map<string, { revenue: number; hours: number }>()
  
  context.appointments
    .filter(a => a.status === 'picked_up')
    .forEach(a => {
      const existing = staffMetrics.get(a.groomerName) || { revenue: 0, hours: 0 }
      existing.revenue += a.netCents
      existing.hours += a.scheduledDurationMinutes / 60
      staffMetrics.set(a.groomerName, existing)
    })
  
  // Calculate revenue per hour for each staff
  const revenuePerHour = Array.from(staffMetrics.entries())
    .map(([name, metrics]) => ({
      name,
      revenuePerHour: metrics.hours > 0 ? metrics.revenue / metrics.hours : 0,
    }))
    .filter(s => s.revenuePerHour > 0)
  
  if (revenuePerHour.length < 2) return null
  
  const average = revenuePerHour.reduce((sum, s) => sum + s.revenuePerHour, 0) / revenuePerHour.length
  const standout = revenuePerHour.find(s => s.revenuePerHour > average * 1.3)
  
  if (standout) {
    const percentAbove = ((standout.revenuePerHour / average) - 1) * 100
    return {
      id: `staff-standout-${Date.now()}`,
      type: 'staff-standout',
      category: 'staff,performance,productivity,standout',
      title: 'Top Performer Identified',
      description: `${standout.name} is generating ${percentAbove.toFixed(0)}% more revenue per hour than average.`,
      metric: 'revenuePerHour',
      delta: percentAbove,
      impactedSegment: standout.name,
      suggestedAction: 'Consider analyzing their techniques for training opportunities with other staff.',
      severity: 'positive',
      drillKey: `staff:${standout.name}`,
    }
  }
  
  return null
}

/**
 * Inventory risk: days supply < 7
 */
function checkInventoryRisk(context: InsightContext): Insight | null {
  const lowSupplyItems = context.inventoryItems.filter(i => {
    if (i.quantityOnHand === 0) return true
    if (!i.usagePerAppointment || i.usagePerAppointment === 0) return false
    
    // Estimate appointments per day
    const apptPerDay = context.appointments.length / 30 // Rough estimate
    const dailyUsage = apptPerDay * (i.usagePerAppointment || 0)
    const daysSupply = dailyUsage > 0 ? i.quantityOnHand / dailyUsage : Infinity
    
    return daysSupply < 7 && i.category === 'supply'
  })
  
  if (lowSupplyItems.length > 0) {
    return {
      id: `inventory-risk-${Date.now()}`,
      type: 'inventory-risk',
      category: 'inventory,reorder,supply,stock',
      title: 'Low Inventory Alert',
      description: `${lowSupplyItems.length} supply item(s) have less than 7 days of stock remaining: ${lowSupplyItems.slice(0, 3).map(i => i.name).join(', ')}${lowSupplyItems.length > 3 ? '...' : ''}`,
      metric: 'daysOfSupply',
      delta: lowSupplyItems.length,
      suggestedAction: 'Review reorder points and place orders for critical supplies.',
      severity: lowSupplyItems.some(i => i.quantityOnHand === 0) ? 'critical' : 'warning',
      drillKey: 'inventory:low',
    }
  }
  
  return null
}

/**
 * Campaign ROI extreme: ROI < 0.5 or > 3.0
 */
function checkCampaignROI(context: InsightContext): Insight | null {
  if (context.messages.length === 0) return null
  
  // Group messages by campaign
  const campaignMetrics = new Map<string, { cost: number; revenue: number }>()
  
  context.messages.forEach(m => {
    if (!m.campaignId) return
    const existing = campaignMetrics.get(m.campaignId) || { cost: 0, revenue: 0 }
    existing.cost += m.costCents || 0
    if (m.showedUp && m.revenueCents) {
      existing.revenue += m.revenueCents
    }
    campaignMetrics.set(m.campaignId, existing)
  })
  
  // Find extreme ROI campaigns
  for (const [campaignId, metrics] of campaignMetrics.entries()) {
    if (metrics.cost === 0) continue
    const roi = (metrics.revenue - metrics.cost) / metrics.cost
    
    if (roi < 0.5) {
      return {
        id: `campaign-roi-low-${Date.now()}`,
        type: 'campaign-roi-extreme',
        category: 'marketing,campaign,roi,message,confirmation',
        title: 'Campaign Underperforming',
        description: `Campaign "${campaignId}" has an ROI of ${(roi * 100).toFixed(0)}%, significantly below expectations.`,
        metric: 'marketingROI',
        delta: roi * 100 - 100,
        impactedSegment: campaignId,
        suggestedAction: 'Review targeting and messaging for this campaign or consider pausing it.',
        severity: roi < 0 ? 'critical' : 'warning',
        drillKey: `campaign:${campaignId}`,
      }
    } else if (roi > 3.0) {
      return {
        id: `campaign-roi-high-${Date.now()}`,
        type: 'campaign-roi-extreme',
        category: 'marketing,campaign,roi,message,confirmation',
        title: 'Campaign Excelling',
        description: `Campaign "${campaignId}" is generating ${(roi * 100).toFixed(0)}% ROI, well above average.`,
        metric: 'marketingROI',
        delta: roi * 100 - 100,
        impactedSegment: campaignId,
        suggestedAction: 'Consider increasing budget or expanding this campaign to more segments.',
        severity: 'positive',
        drillKey: `campaign:${campaignId}`,
      }
    }
  }
  
  return null
}

/**
 * Get insights for a specific report type
 */
export function getReportInsights(
  reportType: string,
  context: InsightContext
): Insight[] {
  const allInsights = generateInsights(context)
  
  // Filter insights based on report type relevance
  const relevantTypes: Record<string, string[]> = {
    'owner-overview': ['no-show-spike', 'margin-drop', 'rebook-weakness', 'staff-standout'],
    'true-profit': ['margin-drop'],
    'sales-summary': ['margin-drop'],
    'no-shows-cancellations': ['no-show-spike'],
    'retention-rebooking': ['rebook-weakness'],
    'staff-performance': ['staff-standout'],
    'inventory-usage': ['inventory-risk'],
    'marketing-messaging': ['campaign-roi-extreme'],
  }
  
  const relevant = relevantTypes[reportType] || []
  if (relevant.length === 0) return allInsights
  
  return allInsights.filter(i => relevant.includes(i.type))
}
