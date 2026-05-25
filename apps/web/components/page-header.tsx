import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export const PageHeader = ({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
