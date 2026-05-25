'use client'

export type ExportFormat = 'markdown' | 'csv'

// Triggers a browser download of the menu export. The route handler already
// sets `content-disposition: attachment`, so a plain anchor click is enough —
// no fetch + Blob round-trip needed.
export const downloadMenuExport = ({
  workspaceId,
  format,
  weekStartDate,
}: {
  workspaceId: string
  format: ExportFormat
  weekStartDate?: string
}): void => {
  const params = new URLSearchParams({ format })
  if (weekStartDate) params.set('week_start_date', weekStartDate)
  const url = `/api/workspaces/${workspaceId}/export?${params.toString()}`
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
