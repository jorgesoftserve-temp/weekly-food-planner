// Pick a unique `meal_key` for a new slot in the same (day, target_member_id)
// bucket. Matches the custom-menu builder's pattern: `{meal_type}` for the
// first occurrence on the day, `{meal_type}_{N}` for subsequent ones. The DB
// constraint on (menu_id, day_of_week, meal_key, target_member_id) is
// NULLS NOT DISTINCT, so callers must filter `existingKeys` to the same
// target_member_id bucket (null included) before calling.
//
// Throws when 7 occurrences of the same meal_type already exist on the same
// (day, member) bucket — that's an absurd amount of one meal in one day, and
// surfacing it as a 422 is friendlier than silently overwriting a slot.
export const pickMealKey = ({
  mealType,
  existingKeys,
}: {
  mealType: string
  existingKeys: string[]
}): string => {
  const used = new Set(existingKeys)
  if (!used.has(mealType)) return mealType
  for (let i = 2; i <= 7; i++) {
    const candidate = `${mealType}_${i}`
    if (!used.has(candidate)) return candidate
  }
  throw new Error(`no free meal_key slot for ${mealType} (already 7 in use)`)
}
