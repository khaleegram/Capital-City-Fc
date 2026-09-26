import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-line/15 text-ivory/80",
        live: "border-live/40 bg-live/15 text-live",
        ivory: "border-line/15 bg-paper text-ivory",
        /*
         * Result badges. Tinted rather than filled, matching `live` above: a solid fill would
         * need a paired foreground colour that flips per theme, and a low-alpha tint carries
         * on ivory and on navy without one.
         */
        win: "border-win/40 bg-win/15 text-win",
        loss: "border-loss/40 bg-loss/15 text-loss",
        draw: "border-draw/40 bg-draw/15 text-draw",
        info: "border-info/40 bg-info/15 text-info",
        gold: "border-gold/40 bg-gold/15 text-gold",
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
