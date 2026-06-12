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
  // (v2.1 Track C) Inclusive (soft-bias) preferences added at generation
  // time. Unioned with each member's profile dietaryPreferences in the
  // engine's greedy selection. Never hard-filters. See ARCHITECTURE_PRD §20.3.
  additionalDietaryPreferences: { tags?: string[]; ingredients?: string[] }
  // (v2.1 Track C) Temporarily lift a profile EXCLUSIVE restriction/allergy
  // for this one generation. The member profile row is never modified.
  // filter.ts removes these from the effective hard sets before filtering.
  // See ARCHITECTURE_PRD §20.4.
  relaxedDietaryRestrictions: string[]
  relaxedAllergies: string[]
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
// (v2.1 Track C) Extended with:
//   - additionalDietaryPreferences (additive / inclusive) — no dedup needed
//     because inclusive prefs are pure soft-bias and adding a duplicate at
//     generation time is a harmless no-op in the engine.
//   - relaxedDietaryRestrictions / relaxedAllergies (subtractive) — remove
//     those values from the effective hard sets for THIS generation only. The
//     member profile is never modified. Only values that actually appear on at
//     least one member's profile are forwarded (relaxing a value no member has
//     is a no-op but is not an error).
//
// `members` is the EFFECTIVE participant list — the caller has already
// filtered it down to whoever participates in this menu (PRODUCT_PRD §4.3).
// `memberFrequencyOverrides` are filtered to that same participant set so
// non-participants can't sneak past with an override entry.
//
// All non-empty fields funnel into inputs_hash via the engine — a
// relaxed/preference-tuned generation is legitimately a different generation.
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

  // Additive exclusion dedup — drop values already on every member's profile.
  const additionalDietaryRestrictions = (raw.additionalDietaryRestrictions ?? []).filter(
    (value) => !memberDietary.has(value),
  )
  const additionalAllergies = (raw.additionalAllergies ?? []).filter(
    (value) => !memberAllergies.has(value),
  )

  // (v2.1) Subtractive override: only forward relaxations for values that
  // appear on at least one participant's profile. Relaxing a value no one
  // has is a harmless no-op but would still alter inputs_hash — omitting it
  // keeps hash stability when the caller passes phantom values.
  const relaxedDietaryRestrictions = (raw.relaxedDietaryRestrictions ?? []).filter(
    (value) => memberDietary.has(value),
  )
  const relaxedAllergies = (raw.relaxedAllergies ?? []).filter(
    (value) => memberAllergies.has(value),
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
  // (v2.1) Inclusive preferences — pass through as-is (no dedup; additive).
  const prefTags = raw.additionalDietaryPreferences?.tags ?? []
  const prefIngredients = raw.additionalDietaryPreferences?.ingredients ?? []
  if (prefTags.length > 0 || prefIngredients.length > 0) {
    cleaned.additionalDietaryPreferences = {}
    if (prefTags.length > 0) cleaned.additionalDietaryPreferences.tags = prefTags
    if (prefIngredients.length > 0) {
      cleaned.additionalDietaryPreferences.ingredients = prefIngredients
    }
  }
  // (v2.1) Subtractive overrides — only include when non-empty after dedup.
  if (relaxedDietaryRestrictions.length > 0) {
    cleaned.relaxedDietaryRestrictions = relaxedDietaryRestrictions
  }
  if (relaxedAllergies.length > 0) {
    cleaned.relaxedAllergies = relaxedAllergies
  }
  if (memberFrequencyOverrides.length > 0) {
    cleaned.memberFrequencyOverrides = memberFrequencyOverrides
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}
