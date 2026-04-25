import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type CurvedMonitorProps = {
  children: ReactNode
  intensity?: "subtle" | "medium" | "strong"
  className?: string
}

const CurvedMonitor = ({
  children,
  intensity = "subtle",
  className,
}: CurvedMonitorProps) => {
  return (
    <div className={cn("cm-frame", `cm-${intensity}`, className)}>
      <div className="cm-glass" aria-hidden="true" />
      <div className="cm-content">{children}</div>
    </div>
  )
}

export default CurvedMonitor
