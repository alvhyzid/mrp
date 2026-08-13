import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Carbon Design System: sudut tajam, tanpa shadow.
const badgeVariants = cva(
  "inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Soft/tint status variants — for scannable status columns (active/expired/
        // low-stock/etc) and system_alerts severity (info/warning/critical).
        success: "border-transparent bg-success-subtle text-success-subtle-foreground",
        warning: "border-transparent bg-warning-subtle text-warning-subtle-foreground",
        info: "border-transparent bg-info-subtle text-info-subtle-foreground",
        critical: "border-transparent bg-destructive-subtle text-destructive-subtle-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
