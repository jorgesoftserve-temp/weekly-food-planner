import type { MemberSnapshot } from '../types.js'

export const makeMember = ({
  id = 'm1',
  name = 'Alice',
  role = 'creator',
  ageCategory = 'adult',
  dailyCalorieTarget,
  mealFrequency,
  dietaryRestrictions = [],
  allergies = [],
  ingredientDislikes = [],
}: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  id,
  name,
  role,
  ageCategory,
  ...(dailyCalorieTarget !== undefined ? { dailyCalorieTarget } : {}),
  ...(mealFrequency !== undefined ? { mealFrequency } : {}),
  dietaryRestrictions,
  allergies,
  ingredientDislikes,
})
