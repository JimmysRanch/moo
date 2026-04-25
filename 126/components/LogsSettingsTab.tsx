import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { CaretDown, CaretUp, ArrowClockwise } from "@phosphor-icons/react"
import { format, subDays } from "date-fns"

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppLog {
  id: number
  created_at: string
  level: 'error' | 'warning' | 'info'
  event_type: string
  message: string
  details: string | null
  route: string | null
  store_id: string | null
  store_name: string | null
  user_id: string | null
  user_name: string | null
  metadata: Record<string, unknown> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  error: "destructive",
  warning: "outline",
  info: "secondary",
}

const WINDOW_OPTIONS = [
  { label: "Last 24 hours", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: 0 },
]

const PAGE_SIZE = 50

// ── Component ─────────────────────────────────────────────────────────────────

export function LogsSettingsTab() {
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [storeFilter, setStoreFilter] = useState<string>("all")
  const [windowDays, setWindowDays] = useState<number>(7)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: logs, isLoading, isError, refetch, isFetching } = useQuery<AppLog[]>({
    queryKey: ["app_logs", levelFilter, typeFilter, storeFilter, windowDays],
    queryFn: async () => {
      let q = supabase
        .from("app_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE)

      if (levelFilter !== "all") q = q.eq("level", levelFilter)
      if (typeFilter !== "all") q = q.eq("event_type", typeFilter)
      if (storeFilter !== "all") q = q.eq("store_id", storeFilter)
      if (windowDays > 0) {
        const since = subDays(new Date(), windowDays).toISOString()
        q = q.gte("created_at", since)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AppLog[]
    },
    staleTime: 30_000,
    meta: {
      onError: () => { /* suppress global toast — handled inline */ },
    },
  })

  // Derive filter options from loaded data
  const eventTypes = Array.from(new Set((logs ?? []).map((l) => l.event_type))).sort()
  const stores = Array.from(
    new Map(
      (logs ?? [])
        .filter((l) => l.store_id)
        .map((l) => [l.store_id, l.store_name ?? l.store_id])
    ).entries()
  )

  const toggleExpanded = (id: number) =>
    setExpandedId((prev) => (prev === id ? null : id))

  // Reset stale filter selections when the available options shrink (e.g. after
  // narrowing the time window) so users are never left with a hidden filter that
  // produces zero results with no obvious way to clear it.
  useEffect(() => {
    if (!isLoading && !isError && typeFilter !== "all" && !eventTypes.includes(typeFilter)) {
      setTypeFilter("all")
    }
  }, [typeFilter, setTypeFilter, eventTypes, isLoading, isError])

  useEffect(() => {
    const availableIds = stores.map(([id]) => id)
    if (!isLoading && !isError && storeFilter !== "all" && !availableIds.includes(storeFilter)) {
      setStoreFilter("all")
    }
  }, [storeFilter, setStoreFilter, stores, isLoading, isError])

  return (
    <Card className="p-4 md:p-6 bg-card border-border">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Internal Logs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Errors, warnings, and degraded-mode events captured from the app.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <ArrowClockwise className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.days} value={String(o.days)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          {eventTypes.length > 0 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All event types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {eventTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {stores.length > 0 && (
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map(([id, name]) => (
                  <SelectItem key={id!} value={id!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Log list */}
        {isLoading && (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading logs…</p>
        )}

        {isError && (
          <p className="text-sm text-destructive py-8 text-center">
            Could not load logs. Check your network connection or ensure your account is in platform_admins.
          </p>
        )}

        {!isLoading && !isError && (logs ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No log entries found for the selected filters.</p>
        )}

        {!isLoading && !isError && (logs ?? []).length > 0 && (
          <div className="space-y-2">
            {(logs ?? []).map((log) => (
              <div
                key={log.id}
                className="border border-border rounded-md overflow-hidden"
              >
                {/* Summary row */}
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-secondary/30 transition-colors"
                  onClick={() => toggleExpanded(log.id)}
                >
                  <div className="flex-shrink-0 pt-0.5">
                    <Badge variant={LEVEL_COLORS[log.level] as "destructive" | "outline" | "secondary" | "default"}>
                      {log.level}
                    </Badge>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">
                        {log.event_type}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-0.5 truncate">{log.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {log.store_name && (
                        <span>Store: <span className="text-foreground font-medium">{log.store_name}</span></span>
                      )}
                      {log.user_name && (
                        <span>User: <span className="text-foreground font-medium">{log.user_name}</span></span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 pt-0.5 text-muted-foreground">
                    {expandedId === log.id ? <CaretUp className="h-4 w-4" /> : <CaretDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {expandedId === log.id && (
                  <div className="border-t border-border px-4 py-3 bg-secondary/10 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {log.route && (
                        <div>
                          <span className="text-muted-foreground">Route</span>
                          <p className="font-mono text-xs mt-0.5">{log.route}</p>
                        </div>
                      )}
                      {log.user_id && (
                        <div>
                          <span className="text-muted-foreground">User ID</span>
                          <p className="font-mono text-xs mt-0.5 break-all">{log.user_id}</p>
                        </div>
                      )}
                      {log.store_id && (
                        <div>
                          <span className="text-muted-foreground">Store ID</span>
                          <p className="font-mono text-xs mt-0.5 break-all">{log.store_id}</p>
                        </div>
                      )}
                    </div>

                    {log.details && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Raw details</p>
                        <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {log.details}
                        </pre>
                      </div>
                    )}

                    {log.metadata && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                        <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {(logs ?? []).length === PAGE_SIZE && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing most recent {PAGE_SIZE} entries. Use filters to narrow results.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
