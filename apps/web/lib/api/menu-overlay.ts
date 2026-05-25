import type {
  GenerateMenuOptions,
  MemberSnapshot,
} from '@weekly-food-planner/constraint-engine'

export type RawOverlay = Partial<{
  calorieTolerance: number
  repetitionLimit: number
  preferredCuisines: string[]
  ingredientExclusions: string[]
  additionalDietaryRestrictions: string[]
  additionalAllergies: string[]
}>

// Silent dedup per PRODUCT_PRD §4.2 and ARCHITECTURE_PRD §5 step 2.
// Drops overlay values that already exist on any member's matching profile;
// `ingredientExclusions` has no member-profile equivalent so it passes through.
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
  for (const member of members) {
    for (const restriction of member.dietaryRestrictions) memberDietary.add(restriction)
    for (const allergy of member.allergies) memberAllergies.add(allergy)
  }

  const additionalDietaryRestrictions = (raw.additionalDietaryRestrictions ?? []).filter(
    (value) => !memberDietary.has(value),
  )
  const additionalAllergies = (raw.additionalAllergies ?? []).filter(
    (value) => !memberAllergies.has(value),
  )

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

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}
