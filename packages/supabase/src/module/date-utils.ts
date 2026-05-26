// Timezone-naive YYYY-MM-DD helpers shared by the menus + grocery modules.
// Kept in its own leaf file (no imports from other module/* files) so the
// two callers can share logic without forming an import cycle through the
// React Query layer.

export const todayYmd = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "Has the menu finished?" Last day of the menu is week_start_date + (n-1),
// so the menu is still relevant for shopping while today's date is <= last
// day. Local date math matches the engine's timezone-naive convention.
export const isMenuStillUpcoming = ({
  weekStartDate,
  durationDays,
  todayYmd,
}: {
  weekStartDate: string
  durationDays: number
  todayYmd: string
}): boolean => {
  const [y, m, d] = weekStartDate.split('-').map((p) => Number.parseInt(p, 10))
  if (!y || !m || !d) return false
  const lastDay = new Date(y, m - 1, d + Math.max(0, durationDays - 1))
  const ly = lastDay.getFullYear()
  const lm = String(lastDay.getMonth() + 1).padStart(2, '0')
  const ld = String(lastDay.getDate()).padStart(2, '0')
  const lastYmd = `${ly}-${lm}-${ld}`
  return lastYmd >= todayYmd
}
