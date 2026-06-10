'use client'

import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCreateRecipe,
  useReplaceRecipeDietaryTags,
  useReplaceRecipeIngredients,
  useReplaceRecipeInstructions,
  useUpdateRecipe,
} from '@weekly-food-planner/supabase/react'
import type {
  CreateRecipePayload,
  RecipeIngredientInput,
  RecipeInstructionInput,
  RecipeRecord,
} from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { IngredientPicker } from '@/components/forms/ingredient-picker'
import { MultiLabelCombobox } from '@/components/forms/multi-label-combobox'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'slice',
  'pinch',
  'clove',
  'can',
  'pack',
] as const

// All numeric fields live as strings in form state so HTML inputs and the
// zod schema agree on the runtime type. Conversion to numbers happens once
// in toCreatePayload below — keeps zod input == output and avoids the
// shadcn FormField generic-mismatch that triggers on zod transforms.
const positiveIntString = z
  .string()
  .refine(
    (val) => {
      const n = Number.parseInt(val, 10)
      return Number.isFinite(n) && n.toString() === val.trim() && n >= 1
    },
    { message: 'Must be a whole number ≥ 1' },
  )

const optionalPositiveIntString = z.string().refine(
  (val) => {
    if (val === '' || val.trim() === '') return true
    const n = Number.parseInt(val, 10)
    return Number.isFinite(n) && n.toString() === val.trim() && n >= 1
  },
  { message: 'Must be a whole number ≥ 1 (or empty)' },
)

const positiveNumberString = z.string().refine(
  (val) => {
    const n = Number.parseFloat(val)
    return Number.isFinite(n) && n > 0
  },
  { message: 'Must be greater than 0' },
)

const recipeFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string(),
  meal_type: z.enum(MEAL_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  servings: positiveIntString,
  cuisine: z.string(),
  prep_time_minutes: optionalPositiveIntString,
  cook_time_minutes: optionalPositiveIntString,
  dietary_tags: z.array(z.string()),
  ingredients: z
    .array(
      z.object({
        ingredient_id: z.string().min(1, 'Pick an ingredient'),
        quantity: positiveNumberString,
        unit: z.enum(UNITS),
      }),
    )
    .min(1, 'Add at least one ingredient'),
  instructions: z.array(
    z.object({
      description: z.string().trim().min(1, 'Step cannot be empty'),
    }),
  ),
})

type RecipeFormValues = z.infer<typeof recipeFormSchema>

const emptyDefaults: RecipeFormValues = {
  name: '',
  description: '',
  meal_type: 'dinner',
  difficulty: 'easy',
  servings: '1',
  cuisine: '',
  prep_time_minutes: '',
  cook_time_minutes: '',
  dietary_tags: [],
  ingredients: [{ ingredient_id: '', quantity: '1', unit: 'cup' }],
  instructions: [],
}

const valuesFromRecord = (record: RecipeRecord): RecipeFormValues => ({
  name: record.name,
  description: record.description ?? '',
  meal_type: record.meal_type,
  difficulty: record.difficulty,
  servings: record.servings.toString(),
  cuisine: record.cuisine ?? '',
  prep_time_minutes:
    record.prep_time_minutes !== null ? record.prep_time_minutes.toString() : '',
  cook_time_minutes:
    record.cook_time_minutes !== null ? record.cook_time_minutes.toString() : '',
  dietary_tags: record.recipe_dietary_tags.map((t) => t.tag),
  ingredients:
    record.recipe_ingredients.length > 0
      ? record.recipe_ingredients.map((ing) => ({
          ingredient_id: ing.ingredient_id,
          quantity:
            typeof ing.quantity === 'number'
              ? ing.quantity.toString()
              : ing.quantity,
          unit: ing.unit,
        }))
      : [{ ingredient_id: '', quantity: '1', unit: 'cup' }],
  instructions: [...record.recipe_instructions]
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({ description: step.description })),
})

const optionalTrim = (s: string): string | undefined => {
  const t = s.trim()
  return t.length > 0 ? t : undefined
}

const optionalInt = (s: string): number | undefined => {
  const t = s.trim()
  if (t.length === 0) return undefined
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

const toCreatePayload = (values: RecipeFormValues): CreateRecipePayload => ({
  name: values.name,
  description: optionalTrim(values.description),
  meal_type: values.meal_type,
  difficulty: values.difficulty,
  servings: Number.parseInt(values.servings, 10),
  cuisine: optionalTrim(values.cuisine),
  prep_time_minutes: optionalInt(values.prep_time_minutes),
  cook_time_minutes: optionalInt(values.cook_time_minutes),
  dietary_tags: values.dietary_tags,
  ingredients: values.ingredients.map((ing) => ({
    ingredient_id: ing.ingredient_id,
    quantity: Number.parseFloat(ing.quantity),
    unit: ing.unit,
  })),
  instructions: values.instructions.map((step, index) => ({
    step_order: index + 1,
    description: step.description,
  })),
})

export type RecipeFormProps =
  | {
      workspaceId: string
      mode: 'create'
      // Hosts can read the created recipe id (e.g. to auto-fill a slot in
      // the custom menu builder). Edit mode never carries a value here.
      onClose?: (createdRecipeId?: string) => void
    }
  | {
      workspaceId: string
      mode: 'edit'
      recipe: RecipeRecord
      onClose?: () => void
    }

const valuesToIngredientInputs = (
  values: RecipeFormValues,
): RecipeIngredientInput[] =>
  values.ingredients.map((ing) => ({
    ingredient_id: ing.ingredient_id,
    quantity: Number.parseFloat(ing.quantity),
    unit: ing.unit,
  }))

const valuesToInstructionInputs = (
  values: RecipeFormValues,
): RecipeInstructionInput[] =>
  values.instructions.map((step, index) => ({
    step_order: index + 1,
    description: step.description,
  }))

export const RecipeForm = (props: RecipeFormProps) => {
  const router = useRouter()
  const supabase = useSupabase()

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues:
      props.mode === 'edit' ? valuesFromRecord(props.recipe) : emptyDefaults,
  })

  const ingredientArray = useFieldArray({
    control: form.control,
    name: 'ingredients',
  })
  const instructionArray = useFieldArray({
    control: form.control,
    name: 'instructions',
  })

  const recipeIdForEdit = props.mode === 'edit' ? props.recipe.id : ''

  const createMutation = useCreateRecipe({
    supabase,
    workspaceId: props.workspaceId,
  })
  const updateMutation = useUpdateRecipe({
    supabase,
    workspaceId: props.workspaceId,
    recipeId: recipeIdForEdit,
  })
  const replaceIngredients = useReplaceRecipeIngredients({
    supabase,
    workspaceId: props.workspaceId,
    recipeId: recipeIdForEdit,
  })
  const replaceInstructions = useReplaceRecipeInstructions({
    supabase,
    workspaceId: props.workspaceId,
    recipeId: recipeIdForEdit,
  })
  const replaceDietaryTags = useReplaceRecipeDietaryTags({
    supabase,
    workspaceId: props.workspaceId,
    recipeId: recipeIdForEdit,
  })

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    replaceIngredients.isPending ||
    replaceInstructions.isPending ||
    replaceDietaryTags.isPending

  // Default the cancel/post-save navigation to /recipes when used as a
  // standalone page; the drawer host overrides this with onClose to close
  // the sheet and stay on the list. `createdRecipeId` is only set after a
  // successful create — hosts use it to auto-fill UI that pivots on the
  // newly-created recipe (e.g. the custom-menu builder's slot picker).
  const dismiss = (createdRecipeId?: string) => {
    if (props.onClose) {
      if (props.mode === 'create') {
        props.onClose(createdRecipeId)
      } else {
        props.onClose()
      }
    } else {
      router.push('/recipes')
      router.refresh()
    }
  }

  const handleSubmit: SubmitHandler<RecipeFormValues> = async (values) => {
    try {
      if (props.mode === 'create') {
        const created = await createMutation.mutateAsync(toCreatePayload(values))
        notifySuccess('Recipe created', values.name)
        dismiss(created.id)
        return
      }
      // Edit mode: scalars first so a downstream array failure doesn't leave
      // the recipe row referencing a missing FK; then the three arrays in
      // parallel since they touch different tables.
      await updateMutation.mutateAsync({
        name: values.name,
        description: optionalTrim(values.description) ?? null,
        meal_type: values.meal_type,
        difficulty: values.difficulty,
        servings: Number.parseInt(values.servings, 10),
        cuisine: optionalTrim(values.cuisine) ?? null,
        prep_time_minutes: optionalInt(values.prep_time_minutes) ?? null,
        cook_time_minutes: optionalInt(values.cook_time_minutes) ?? null,
      })
      await Promise.all([
        replaceIngredients.mutateAsync({
          ingredients: valuesToIngredientInputs(values),
        }),
        replaceInstructions.mutateAsync({
          instructions: valuesToInstructionInputs(values),
        }),
        replaceDietaryTags.mutateAsync({ tags: values.dietary_tags }),
      ])
      notifySuccess('Recipe updated', values.name)
      dismiss()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong saving the recipe.'
      notifyError(
        props.mode === 'create'
          ? 'Could not create recipe'
          : 'Could not save changes',
        message,
      )
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-5"
      >
        {/* ── Section: Basics ───────────────────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
          <h2 className="font-semibold">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Tomato pasta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="meal_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meal type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a meal type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MEAL_TYPES.map((meal) => (
                        <SelectItem key={meal} value={meal}>
                          {meal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a difficulty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIFFICULTIES.map((diff) => (
                        <SelectItem key={diff} value={diff}>
                          {diff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="servings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Servings</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cuisine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuisine</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Italian" {...field} />
                  </FormControl>
                  <FormDescription>
                    Free text — added to the label catalogue automatically.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prep_time_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prep time (min)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cook_time_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cook time (min)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="One-line note about this recipe (optional)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* ── Section: Dietary ──────────────────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
          <h2 className="font-semibold">Dietary tags</h2>
          <FormField
            control={form.control}
            name="dietary_tags"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <MultiLabelCombobox
                    enumType="dietary_tag"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search or add a new tag"
                  />
                </FormControl>
                <FormDescription>
                  e.g. vegetarian, gluten-free. New values are saved to the
                  catalogue on submit.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        {/* ── Section: Ingredients ──────────────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">Ingredients</h2>
              <p className="text-sm text-muted-foreground">
                The constraint engine reads these to build the grocery list.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-dashed"
              onClick={() =>
                ingredientArray.append({
                  ingredient_id: '',
                  quantity: '1',
                  unit: 'cup',
                })
              }
            >
              <Plus className="size-4" />
              Add ingredient
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {ingredientArray.fields.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_120px_120px_auto]"
              >
                <FormField
                  control={form.control}
                  name={`ingredients.${index}.ingredient_id`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <IngredientPicker
                          value={field.value || null}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`ingredients.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          placeholder="Qty"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`ingredients.${index}.unit`}
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => ingredientArray.remove(index)}
                  aria-label="Remove ingredient"
                  disabled={ingredientArray.fields.length <= 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {form.formState.errors.ingredients?.message ? (
              <p className="text-sm font-medium text-destructive">
                {form.formState.errors.ingredients.message}
              </p>
            ) : null}
          </div>
        </section>

        {/* ── Section: Instructions ─────────────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">Instructions</h2>
              <p className="text-sm text-muted-foreground">
                Optional. Step order is the order shown below.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-dashed"
              onClick={() => instructionArray.append({ description: '' })}
            >
              <Plus className="size-4" />
              Add step
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {instructionArray.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No steps yet. Click &ldquo;Add step&rdquo; to write one out.
              </p>
            ) : null}
            {instructionArray.fields.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2">
                <span className="mt-2.5 flex shrink-0 items-center gap-1 text-muted-foreground">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent-strong">
                    {index + 1}
                  </span>
                </span>
                <FormField
                  control={form.control}
                  name={`instructions.${index}.description`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Bring water to a boil…"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => instructionArray.remove(index)}
                  aria-label="Remove step"
                  className="mt-1"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer actions ────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => dismiss()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? props.mode === 'create'
                ? 'Creating…'
                : 'Saving…'
              : props.mode === 'create'
                ? 'Create recipe'
                : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
