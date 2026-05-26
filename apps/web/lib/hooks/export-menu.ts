'use client'

export type ExportFormat = 'markdown' | 'csv'

// Triggers a browser download of the menu export. The route handler already
// sets `content-disposition: attachment`, so a plain anchor click is enough —
// no fetch + Blob round-trip needed.
export const downloadMenuExport = ({
  workspaceId,
  format,
  weekStartDate,
  shopForIds,
}: {
  workspaceId: string
  format: ExportFormat
  weekStartDate?: string
  // Optional shop-for-subset selection. Same UUID list the in-app picker
  // sets on `?shop_for=` — passed through so the downloaded file honours
  // the user's current filter.
  shopForIds?: string[] | null
}): void => {
  const params = new URLSearchParams({ format })
  if (weekStartDate) params.set('week_start_date', weekStartDate)
  if (shopForIds && shopForIds.length > 0) {
    params.set('shop_for', shopForIds.join(','))
  }
  const url = `/api/workspaces/${workspaceId}/export?${params.toString()}`
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
