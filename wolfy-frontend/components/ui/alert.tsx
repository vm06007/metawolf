import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export const alertVariants = cva(
  "relative w-max rounded-full backdrop-blur-sm border px-4 py-1.5 lg:py-2 text-xs [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:fill-current [&>svg]:left-4  [&>svg]:w-3.5 [&>svg]:h-3.5 lg:[&>svg]:w-4 lg:[&>svg]:h-4 [&>svg]:top-[0.3rem] lg:[&>svg]:top-1.5 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        success: "bg-success/20 border-success text-success-foreground",
        destructive:
          "text-destructive-foreground bg-destructive/20 border-destructive",
      },
    },
    defaultVariants: {
      variant: "success",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
