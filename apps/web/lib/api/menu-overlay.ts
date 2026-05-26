import type {
  GenerateMenuOptions,
  MealFrequencyEntry,
  MemberFrequencyOverride,
  MemberSnapshot,
} from '@weekly-food-planner/constraint-engine'

export type RawOverlay = Partial<{
  calorieTolerance: number
  repetitionLimit: number
  preferredCuisines: string[]
  ingredientExclusions: string[]
  additionalDietaryRestrictions: string[]
  additionalAllergies: string[]
  // Per-menu meal-frequency override (PRODUCT_PRD §4.3). Validation of the
  // entry shape happens at the route layer; this helper only filters out
  // overrides whose memberId doesn't match a participating member.
  memberFrequencyOverrides: Array<{
    memberId: string
    mealFrequency: MealFrequencyEntry[]
  }>
}>

// Silent dedup per PRODUCT_PRD §4.2 and ARCHITECTURE_PRD §5 step 2.
// Drops overlay values that already exist on any member's matching profile;
// `ingredientExclusions` has no member-profile equivalent so it passes through.
//
// `members` is the EFFECTIVE participant list — the caller has already
// filtered it down to whoever participates in this menu (PRODUCT_PRD §4.3).
// `memberFrequencyOverrides` are filtered to that same participant set so
// non-participants can't sneak past with an override entry.
export const computeEffectiveOverlay = ({
  raw,
  members,
}: {
  raw: RawOverlay | undefined
  members: MemberSnapshot[]
}): GenerateMenuOptions | undefined => {
  if (!raw) return undefined

  const memberDietary = new Set<string>()
  const memberAllergies = new Set<string>()
  const participantIds = new Set<string>()
  for (const member of members) {
    participantIds.add(member.id)
    for (const restriction of member.dietaryRestrictions) memberDietary.add(restriction)
    for (const allergy of member.allergies) memberAllergies.add(allergy)
  }

  const additionalDietaryRestrictions = (raw.additionalDietaryRestrictions ?? []).filter(
    (value) => !memberDietary.has(value),
  )
  const additionalAllergies = (raw.additionalAllergies ?? []).filter(
    (value) => !memberAllergies.has(value),
  )
  const memberFrequencyOverrides: MemberFrequencyOverride[] = (
    raw.memberFrequencyOverrides ?? []
  ).filter((entry) => participantIds.has(entry.memberId))

  const cleaned: GenerateMenuOptions = {}
  if (raw.calorieTolerance !== undefined) cleaned.calorieTolerance = raw.calorieTolerance
  if (raw.repetitionLimit !== undefined) cleaned.repetitionLimit = raw.repetitionLimit
  if (raw.preferredCuisines && raw.preferredCuisines.length > 0) {
    cleaned.preferredCuisines = raw.preferredCuisines
  }
  if (raw.ingredientExclusions && raw.ingredientExclusions.length > 0) {
    cleaned.ingredientExclusions = raw.ingredientExclusions
  }
  if (additionalDietaryRestrictions.length > 0) {
    cleaned.additionalDietaryRestrictions = additionalDietaryRestrictions
  }
  if (additionalAllergies.length > 0) {
    cleaned.additionalAllergies = additionalAllergies
  }
  if (memberFrequencyOverrides.length > 0) {
    cleaned.memberFrequencyOverrides = memberFrequencyOverrides
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}
