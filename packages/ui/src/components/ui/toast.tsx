import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react"
import * as React from "react"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Centered horizontally at the top of the fixed 360×600 popup window.
      // z-[200] sits above dialogs (z-50) and tooltips.
      "fixed top-3 left-1/2 z-200 flex w-84 -translate-x-1/2 flex-col gap-2",
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-2.5 overflow-hidden rounded-lg border px-3 py-2.5 pr-8 shadow-md",
    "transition-all",
    // Enter: slide down from above
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-top-3 data-[state=open]:fade-in-0 data-[state=open]:duration-200",
    // Exit: slide up and fade
    "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-3 data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        success: "border-success bg-success text-success-foreground",
        destructive: "border-destructive bg-destructive text-destructive-foreground",
        warning: "border-warning bg-warning text-warning-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const VARIANT_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden />,
  destructive: <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />,
  warning: <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />,
  default: <Info className="text-muted-foreground mt-px size-4 shrink-0" aria-hidden />,
}

const Toast = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, children, ...props }, ref) => {
  const icon = VARIANT_ICON[variant ?? "default"] ?? VARIANT_ICON["default"]
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {icon}
      {children}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-current/30 bg-transparent px-2 text-xs font-medium transition-colors hover:bg-current/15 focus:ring-1 focus:ring-current/50 focus:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute top-2.5 right-2 rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 focus:ring-1 focus:ring-current focus:outline-none",
      className,
    )}
    aria-label="Dismiss notification"
    toast-close=""
    {...props}
  >
    <X className="size-3.5" aria-hidden="true" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-[13px] leading-snug font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs opacity-85", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  Toast,
  ToastAction,
  type ToastActionElement,
  ToastClose,
  ToastDescription,
  type ToastProps,
  ToastProvider,
  ToastTitle,
  ToastViewport,
}
