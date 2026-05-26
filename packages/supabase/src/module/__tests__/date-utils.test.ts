import { describe, expect, it } from 'vitest'
import { isMenuStillUpcoming, todayYmd } from '../date-utils.js'

describe('todayYmd', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isMenuStillUpcoming', () => {
  it('is true when last day equals today', () => {
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-05-20',
        durationDays: 7,
        todayYmd: '2026-05-26',
      }),
    ).toBe(true)
  })

  it('is true when last day is in the future', () => {
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-05-25',
        durationDays: 7,
        todayYmd: '2026-05-26',
      }),
    ).toBe(true)
  })

  it('is false when last day is in the past', () => {
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-05-10',
        durationDays: 7,
        todayYmd: '2026-05-26',
      }),
    ).toBe(false)
  })

  it('handles single-day menus (durationDays = 1)', () => {
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-05-26',
        durationDays: 1,
        todayYmd: '2026-05-26',
      }),
    ).toBe(true)
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-05-25',
        durationDays: 1,
        todayYmd: '2026-05-26',
      }),
    ).toBe(false)
  })

  it('crosses month boundaries correctly', () => {
    // Apr 28 + 7 days = May 4
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-04-28',
        durationDays: 7,
        todayYmd: '2026-05-03',
      }),
    ).toBe(true)
    expect(
      isMenuStillUpcoming({
        weekStartDate: '2026-04-28',
        durationDays: 7,
        todayYmd: '2026-05-05',
      }),
    ).toBe(false)
  })

  it('returns false on malformed weekStartDate', () => {
    expect(
      isMenuStillUpcoming({
        weekStartDate: 'not-a-date',
        durationDays: 7,
        todayYmd: '2026-05-26',
      }),
    ).toBe(false)
  })
})
