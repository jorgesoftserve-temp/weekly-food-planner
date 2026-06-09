// React-only barrel: hooks that consume the CRUD modules via @tanstack/react-query.
// Imported from `@weekly-food-planner/supabase/react` so server-only callers
// don't pull in React or React Query.

export * from './module/workspaces.react.js'
export * from './module/members.react.js'
export * from './module/recipes.react.js'
export * from './module/ingredients.react.js'
export * from './module/labels.react.js'
export * from './module/menus.react.js'
export * from './module/grocery.react.js'
export * from './module/profiles.react.js'
