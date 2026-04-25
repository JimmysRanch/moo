import { CSSProperties } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"
import { getAppearanceColorScheme, useAppearance } from "@/hooks/useAppearance"

const Toaster = ({ ...props }: ToasterProps) => {
  const { selectedTheme } = useAppearance()

  return (
    <Sonner
      theme={getAppearanceColorScheme(selectedTheme)}
      className="toaster group"
      position="top-right"
      duration={8000}
      visibleToasts={3}
      expand={true}
      gap={8}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
