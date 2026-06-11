import { describe, expect, it } from 'vitest'
import { computeLeftoverExpiry } from '../leftovers'

// (v2.0 Phase 5 / item 7) Per-leftover expiry defaulting. The ingredient's own
// shelf life wins; the workspace fallback applies only when it's unknown.

describe('computeLeftoverExpiry', () => {
  it("uses the ingredient's max_storage_days when known", () => {
    expect(
      computeLeftoverExpiry({
        cookedAtYmd: '2026-06-11',
        maxStorageDays: 5,
        leftoverMaxDays: 3,
      }),
    ).toBe('2026-06-16')
  })

  it('falls back to the workspace leftover_max_days when shelf life is unknown', () => {
    expect(
      computeLeftoverExpiry({
        cookedAtYmd: '2026-06-11',
        maxStorageDays: null,
        leftoverMaxDays: 3,
      }),
    ).toBe('2026-06-14')
  })

  it('rolls across month boundaries', () => {
    expect(
      computeLeftoverExpiry({
        cookedAtYmd: '2026-06-29',
        maxStorageDays: 4,
        leftoverMaxDays: 3,
      }),
    ).toBe('2026-07-03')
  })

  it('rolls across year boundaries', () => {
    expect(
      computeLeftoverExpiry({
        cookedAtYmd: '2026-12-30',
        maxStorageDays: null,
        leftoverMaxDays: 3,
      }),
    ).toBe('2027-01-02')
  })

  it('treats a zero shelf life as same-day expiry (not the fallback)', () => {
    expect(
      computeLeftoverExpiry({
        cookedAtYmd: '2026-06-11',
        maxStorageDays: 0,
        leftoverMaxDays: 3,
      }),
    ).toBe('2026-06-11')
  })
})
