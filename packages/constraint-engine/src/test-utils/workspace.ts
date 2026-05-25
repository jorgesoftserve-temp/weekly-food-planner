import type {
  MealFrequencyEntry,
  WorkspaceSnapshot,
} from '../types.js'

const DEFAULT_FREQUENCY: MealFrequencyEntry[] = [
  { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
  { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
]

export const makeWorkspace = ({
  id = 'w1',
  type = 'individual',
  name = 'Home',
  sharedMealFrequency = DEFAULT_FREQUENCY,
}: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot => ({
  id,
  type,
  name,
  sharedMealFrequency,
})
