import { describe, expect, it } from 'vitest'
import { deriveInventoryDisplayTag } from '../inventory-items.js'

// Pure read-side derivation: the `source` enum never changes; the *display tag*
// graduates a `purchase` item from Menu → Pantry once its linked menu's week has
// ended. PRODUCT_PRD §15.4 / ARCHITECTURE_PRD §17.7.
describe('deriveInventoryDisplayTag', () => {
  const upcomingMenu = { week_start_date: '2026-05-25', duration_days: 7 }
  const endedMenu = { week_start_date: '2026-05-04', duration_days: 7 }
  const today = '2026-05-26'

  it('maps manual → pantry', () => {
    expect(
      deriveInventoryDisplayTag({ source: 'manual', sourceMenu: null, todayYmd: today }),
    ).toBe('pantry')
  })

  it('maps leftover → leftover regardless of menu', () => {
    expect(
      deriveInventoryDisplayTag({ source: 'leftover', sourceMenu: endedMenu, todayYmd: today }),
    ).toBe('leftover')
  })

  it('maps purchase → menu while the linked menu week is still current', () => {
    expect(
      deriveInventoryDisplayTag({ source: 'purchase', sourceMenu: upcomingMenu, todayYmd: today }),
    ).toBe('menu')
  })

  it('graduates purchase → pantry once the linked menu week has ended', () => {
    expect(
      deriveInventoryDisplayTag({ source: 'purchase', sourceMenu: endedMenu, todayYmd: today }),
    ).toBe('pantry')
  })

  it('treats a purchase with no linked menu as pantry', () => {
    expect(
      deriveInventoryDisplayTag({ source: 'purchase', sourceMenu: null, todayYmd: today }),
    ).toBe('pantry')
  })

  it('keeps purchase as menu on the menu week boundary (last day == today)', () => {
    // week_start 2026-05-20 + 7 days → last day 2026-05-26 == today, still current.
    expect(
      deriveInventoryDisplayTag({
        source: 'purchase',
        sourceMenu: { week_start_date: '2026-05-20', duration_days: 7 },
        todayYmd: today,
      }),
    ).toBe('menu')
  })
})
