import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/useToast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider swipeDirection="up">
      {toasts.map(({ id, title, description, variant, duration }) => (
        <Toast
          key={id}
          variant={variant}
          // duration is already resolved to a variant default by useToast/toast()
          duration={duration}
          onOpenChange={(open) => {
            if (!open) dismiss(id)
          }}
        >
          <div className="flex-1 space-y-0.5">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
