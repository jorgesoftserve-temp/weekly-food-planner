// Thin wrappers around `sonner` so success/error feedback stays consistent
// across the app. Components call `notifySuccess` / `notifyError` instead of
// inlining `toast(...)` so a future swap (different toast library, different
// default duration, etc.) is a one-file change.

import { toast } from 'sonner'

export const notifySuccess = (message: string, description?: string): void => {
  toast.success(message, description ? { description } : undefined)
}

export const notifyError = (message: string, description?: string): void => {
  toast.error(message, description ? { description } : undefined)
}

export const notifyInfo = (message: string, description?: string): void => {
  toast(message, description ? { description } : undefined)
}
