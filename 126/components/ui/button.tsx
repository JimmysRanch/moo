import { ComponentProps, MouseEventHandler, useState } from "react"
import { SpinnerGap } from "@phosphor-icons/react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all active:translate-y-px active:shadow-none disabled:translate-y-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingText?: string
    disableWhileLoading?: boolean
    showSpinner?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText = "Processing...",
  disableWhileLoading = true,
  showSpinner = true,
  disabled,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const Comp = asChild ? Slot : "button"

  const isLoading = loading || internalLoading
  const isDisabled = disabled || (disableWhileLoading && isLoading)

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (isDisabled) {
      event.preventDefault()
      return
    }

    const result = onClick?.(event)

    if (
      !disableWhileLoading ||
      event.defaultPrevented ||
      !result ||
      typeof (result as Promise<unknown>).then !== "function"
    ) {
      return
    }

    setInternalLoading(true)
    void (result as Promise<unknown>).finally(() => setInternalLoading(false))
  }

  const isIconOnly = size === "icon"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      onClick={handleClick}
      {...props}
    >
      {isLoading && showSpinner ? (
        <>
          <SpinnerGap className="size-4 animate-spin" aria-hidden="true" />
          {!isIconOnly ? <span>{loadingText}</span> : null}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
