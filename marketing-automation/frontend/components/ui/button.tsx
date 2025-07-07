import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap theme-radius-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "theme-primary hover:opacity-90 focus-visible:ring-[var(--color-primary)]",
        destructive:
          "bg-[var(--status-failed-bg)] text-[var(--status-failed-text)] hover:opacity-90 focus-visible:ring-[var(--status-failed-text)]",
        outline:
          "border theme-border bg-[var(--color-background)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-heading)]",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-text-body)] hover:opacity-80",
        ghost: "hover:bg-[var(--color-surface)] hover:text-[var(--color-text-heading)]",
        link: "text-[var(--color-primary)] underline-offset-4 hover:underline",
        success: "bg-[var(--status-active-bg)] text-[var(--status-active-text)] hover:opacity-90",
      },
      size: {
        default: "h-10 px-[var(--spacing-sm)] py-[var(--spacing-xs)]",
        sm: "h-9 theme-radius-md px-[calc(var(--spacing-xs)*1.5)]",
        lg: "h-11 theme-radius-md px-[calc(var(--spacing-sm)*2)]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }