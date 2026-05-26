import type { GenerateMenuInput } from '../types.js'
import { makeWorkspace } from './workspace.js'
import { makeMember } from './member.js'
import { makeRecipe } from './recipe.js'

export const makeGenerateMenuInput = ({
  workspace = makeWorkspace(),
  members = [makeMember()],
  recipes = [
    makeRecipe({ id: 'r-bf-1', mealType: 'breakfast' }),
    makeRecipe({ id: 'r-bf-2', mealType: 'breakfast' }),
    makeRecipe({ id: 'r-dn-1', mealType: 'dinner' }),
    makeRecipe({ id: 'r-dn-2', mealType: 'dinner' }),
  ],
  ingredients = [],
  weekStartDate = '2026-06-01',
  seed = 42,
  options,
  now,
}: Partial<GenerateMenuInput> = {}): GenerateMenuInput => ({
  workspace,
  members,
  recipes,
  ingredients,
  weekStartDate,
  seed,
  ...(options !== undefined ? { options } : {}),
  ...(now !== undefined ? { now } : {}),
})
