'use client'

import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCreateMember,
  useSetMemberAllergies,
  useSetMemberDietaryRestrictions,
  useSetMemberIngredientDislikes,
  useUpdateMember,
} from '@weekly-food-planner/supabase/react'
import type {
  AccentColor,
  CreateMemberPayload,
  MealFrequencyEntry,
  MemberRecord,
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
import { IngredientPicker } from '@/components/forms/ingredient-picker'
import { MealFrequencyFields } from '@/components/forms/meal-frequency-fields'
import { MultiLabelCombobox } from '@/components/forms/multi-label-combobox'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { notifyError, notifySuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

const AGE_CATEGORIES = [
  'infant',
  'toddler',
  'child',
  'teen',
  'adult',
  'senior',
] as const
const ASSIGNABLE_ROLES = ['admin', 'member'] as const

// Mirror of the swatch list in appearance-card.tsx — light-mode HSL solids.
// The admin sets a member's accent here; the card subtree renders via tokens.
const ACCENT_SWATCHES: Array<{ value: AccentColor; label: string; swatch: string }> = [
  { value: 'strawberry', label: 'Strawberry', swatch: 'hsl(359 79% 56%)' },
  { value: 'moss',       label: 'Moss',       swatch: 'hsl(114 38% 45%)' },
  { value: 'teal',       label: 'Teal',       swatch: 'hsl(159 35% 40%)' },
  { value: 'amber',      label: 'Amber',      swatch: 'hsl(38 80% 44%)'  },
  { value: 'ocean',      label: 'Ocean',      swatch: 'hsl(205 75% 43%)' },
  { value: 'plum',       label: 'Plum',       swatch: 'hsl(285 45% 48%)' },
]

const ACCENT_VALUES = ACCENT_SWATCHES.map((a) => a.value) as [AccentColor, ...AccentColor[]]

const mealFrequencyEntrySchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  defaultHour: z.number().int().min(0).max(23),
})

// `daily_calorie_target` stays as a string in form state so the numeric input
// agrees with zod's input type. Conversion happens at submit time.
const memberFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  role: z.enum(ASSIGNABLE_ROLES),
  age_category: z.enum(AGE_CATEGORIES),
  accent_color: z.enum(ACCENT_VALUES).nullable().optional(),
  daily_calorie_target: z
    .string()
    .refine(
      (val) => {
        if (val.trim() === '') return true
        const n = Number.parseInt(val, 10)
        return Number.isFinite(n) && n > 0
      },
      { message: 'Must be a positive integer or empty' },
    ),
  use_custom_meal_frequency: z.boolean(),
  meal_frequency: z
    .array(mealFrequencyEntrySchema)
    .refine(
      (entries) => new Set(entries.map((e) => e.key)).size === entries.length,
      { message: 'Meal keys must be unique' },
    ),
  dietary_restrictions: z.array(z.string()),
  allergies: z.array(z.string()),
  ingredient_dislikes: z.array(z.object({ ingredient_id: z.string() })),
})

type MemberFormValues = z.infer<typeof memberFormSchema>

const DEFAULT_FREQUENCY: MealFrequencyEntry[] = [
  { key: 'breakfast', title: 'Breakfast', mealType: 'breakfast', defaultHour: 7 },
  { key: 'lunch', title: 'Lunch', mealType: 'lunch', defaultHour: 12 },
  { key: 'dinner', title: 'Dinner', mealType: 'dinner', defaultHour: 19 },
]

const emptyDefaults: MemberFormValues = {
  name: '',
  role: 'member',
  age_category: 'adult',
  accent_color: null,
  daily_calorie_target: '',
  use_custom_meal_frequency: false,
  meal_frequency: DEFAULT_FREQUENCY,
  dietary_restrictions: [],
  allergies: [],
  ingredient_dislikes: [],
}

const valuesFromRecord = (record: MemberRecord): MemberFormValues => {
  // Members with role=creator come through the API as such; the form blocks
  // editing the role for them but the rest of the fields are still editable.
  const role: MemberFormValues['role'] =
    record.role === 'admin' || record.role === 'member' ? record.role : 'member'
  return {
    name: record.name,
    role,
    age_category: record.age_category,
    accent_color: record.accent_color ?? null,
    daily_calorie_target:
      record.daily_calorie_target !== null
        ? record.daily_calorie_target.toString()
        : '',
    use_custom_meal_frequency: record.meal_frequency !== null,
    meal_frequency: record.meal_frequency ?? DEFAULT_FREQUENCY,
    dietary_restrictions: record.member_dietary_restrictions.map((r) => r.restriction),
    allergies: record.member_allergies.map((a) => a.allergy),
    ingredient_dislikes: record.member_ingredient_dislikes.map((d) => ({
      ingredient_id: d.ingredient_id,
    })),
  }
}

const toCreatePayload = (values: MemberFormValues): CreateMemberPayload => ({
  name: values.name,
  role: values.role,
  age_category: values.age_category,
  accent_color: values.accent_color ?? null,
  daily_calorie_target:
    values.daily_calorie_target.trim() === ''
      ? null
      : Number.parseInt(values.daily_calorie_target, 10),
  meal_frequency: values.use_custom_meal_frequency ? values.meal_frequency : null,
  dietary_restrictions: values.dietary_restrictions,
  allergies: values.allergies,
  ingredient_dislikes: values.ingredient_dislikes
    .map((d) => d.ingredient_id)
    .filter((id) => id.length > 0),
})

export type MemberFormProps =
  | {
      mode: 'create'
      workspaceId: string
      onClose: () => void
    }
  | {
      mode: 'edit'
      workspaceId: string
      member: MemberRecord
      onClose: () => void
    }

export const MemberForm = (props: MemberFormProps) => {
  const supabase = useSupabase()
  const memberId = props.mode === 'edit' ? props.member.id : ''
  const isCreatorMember = props.mode === 'edit' && props.member.role === 'creator'

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues:
      props.mode === 'edit' ? valuesFromRecord(props.member) : emptyDefaults,
  })

  const dislikeArray = useFieldArray({
    control: form.control,
    name: 'ingredient_dislikes',
  })

  const useCustomFrequency = form.watch('use_custom_meal_frequency')

  const createMutation = useCreateMember({
    supabase,
    workspaceId: props.workspaceId,
  })
  const updateMutation = useUpdateMember({
    supabase,
    workspaceId: props.workspaceId,
    memberId,
  })
  const setDietary = useSetMemberDietaryRestrictions({
    supabase,
    workspaceId: props.workspaceId,
    memberId,
  })
  const setAllergiesMutation = useSetMemberAllergies({
    supabase,
    workspaceId: props.workspaceId,
    memberId,
  })
  const setDislikes = useSetMemberIngredientDislikes({
    supabase,
    workspaceId: props.workspaceId,
    memberId,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit: SubmitHandler<MemberFormValues> = async (values) => {
    setIsSubmitting(true)
    try {
      if (props.mode === 'create') {
        await createMutation.mutateAsync(toCreatePayload(values))
        notifySuccess('Member added', values.name)
        props.onClose()
        return
      }
      // Edit: scalars first so a junction-table error doesn't leave the
      // member row partially updated; then the three junction sets in parallel.
      await updateMutation.mutateAsync({
        name: values.name,
        ...(isCreatorMember ? {} : { role: values.role }),
        age_category: values.age_category,
        accent_color: values.accent_color ?? null,
        daily_calorie_target:
          values.daily_calorie_target.trim() === ''
            ? null
            : Number.parseInt(values.daily_calorie_target, 10),
        meal_frequency: values.use_custom_meal_frequency
          ? values.meal_frequency
          : null,
      })
      await Promise.all([
        setDietary.mutateAsync({ values: values.dietary_restrictions }),
        setAllergiesMutation.mutateAsync({ values: values.allergies }),
        setDislikes.mutateAsync({
          ingredientIds: values.ingredient_dislikes
            .map((d) => d.ingredient_id)
            .filter((id) => id.length > 0),
        }),
      ])
      notifySuccess('Member updated', values.name)
      props.onClose()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong saving the member.'
      notifyError(
        props.mode === 'create'
          ? 'Could not add member'
          : 'Could not save changes',
        message,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-8"
      >
        <section className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Alice" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isCreatorMember}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCreatorMember ? (
                  <FormDescription>
                    The creator role is owned by the signup trigger and cannot
                    be changed.
                  </FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="age_category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an age category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {AGE_CATEGORIES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
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
            name="daily_calorie_target"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daily calorie target</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Optional"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Used by the calorie-balancing soft constraint.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accent_color"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Accent color</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      aria-pressed={field.value == null}
                      className={cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-sm font-medium',
                        field.value == null
                          ? 'border-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {field.value == null ? <Check className="size-3.5" /> : null}
                      Auto
                    </button>
                    {ACCENT_SWATCHES.map((a) => {
                      const selected = field.value === a.value
                      return (
                        <button
                          key={a.value}
                          type="button"
                          onClick={() => field.onChange(a.value)}
                          aria-pressed={selected}
                          aria-label={a.label}
                          title={a.label}
                          className={cn(
                            'flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background',
                            selected ? 'ring-2 ring-foreground' : '',
                          )}
                          style={{ backgroundColor: a.swatch }}
                        >
                          {selected ? (
                            <Check className="size-4 text-white" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </FormControl>
                <FormDescription>
                  Shown on this member&apos;s card, chips, and badges. Auto
                  derives a stable color from the member.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium">Meal schedule</h2>
              <p className="text-sm text-muted-foreground">
                Override the workspace default for this member. Leave off to
                inherit from the workspace schedule.
              </p>
            </div>
            <FormField
              control={form.control}
              name="use_custom_meal_frequency"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Button
                      type="button"
                      variant={field.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => field.onChange(!field.value)}
                    >
                      {field.value ? 'Customized' : 'Inherit from workspace'}
                    </Button>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          {useCustomFrequency ? (
            <FormField
              control={form.control}
              name="meal_frequency"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MealFrequencyFields
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Inheriting the workspace meal schedule.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">Dietary profile</h2>
          <FormField
            control={form.control}
            name="dietary_restrictions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dietary restrictions</FormLabel>
                <FormControl>
                  <MultiLabelCombobox
                    enumType="dietary_restriction"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Add a restriction (vegetarian, vegan, etc.)"
                  />
                </FormControl>
                <FormDescription>
                  Applied to every recipe the engine picks for this member.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="allergies"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Allergies</FormLabel>
                <FormControl>
                  <MultiLabelCombobox
                    enumType="food_allergy"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Add an allergy (peanut, dairy, etc.)"
                  />
                </FormControl>
                <FormDescription>
                  Hard-filters any recipe whose ingredients carry a matching
                  allergen.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium">Ingredient dislikes</h2>
              <p className="text-sm text-muted-foreground">
                Soft preference — the engine penalises but does not exclude
                these.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dislikeArray.append({ ingredient_id: '' })}
            >
              <Plus className="size-4" />
              Add dislike
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {dislikeArray.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No dislikes added.
              </p>
            ) : null}
            {dislikeArray.fields.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-md border border-border p-3"
              >
                <FormField
                  control={form.control}
                  name={`ingredient_dislikes.${index}.ingredient_id`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => dislikeArray.remove(index)}
                  aria-label="Remove dislike"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onClose()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? props.mode === 'create'
                ? 'Adding…'
                : 'Saving…'
              : props.mode === 'create'
                ? 'Add member'
                : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
