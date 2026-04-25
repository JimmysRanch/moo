import { Skeleton } from "@/components/ui/skeleton"

interface PageLoadingStateProps {
  label: string
}

export function PageLoadingState({ label }: PageLoadingStateProps) {
  return (
    <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center">
        <div
          role="status"
          aria-live="polite"
          className="w-full rounded-lg border border-border bg-card p-6 text-center shadow-sm"
        >
          <Skeleton className="mx-auto mb-4 h-10 w-10 rounded-full" />
          <h1 className="text-lg font-semibold">{label}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please wait while we load the latest information.
          </p>
        </div>
      </div>
    </div>
  )
}
