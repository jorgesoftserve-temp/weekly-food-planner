'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { MealFrequencyEntry } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export type MealFrequencyFieldsProps = {
  value: MealFrequencyEntry[]
  onChange: (next: MealFrequencyEntry[]) => void
  disabled?: boolean
}

// Inline editor for a member's (or per-menu override's) meal_frequency array.
// Kept dumb on purpose: parent owns the value and decides defaults — this
// component only renders rows, lets the user edit/add/remove them, and bubbles
// the next array up. Reused by member-form (Phase 1) and the per-menu override
// panel (Phase 2).
export const MealFrequencyFields = ({
  value,
  onChange,
  disabled,
}: MealFrequencyFieldsProps) => {
  const updateEntry = (index: number, patch: Partial<MealFrequencyEntry>) => {
    const next = value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    onChange(next)
  }
  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }
  const addEntry = () => {
    // Default to lunch at noon — easy to edit. The user pinpoints the key/title.
    onChange([
      ...value,
      {
        key: `meal_${value.length + 1}`,
        title: 'New meal',
        mealType: 'lunch',
        defaultHour: 12,
      },
    ])
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No meals yet. Click &ldquo;Add meal&rdquo; to define when this member
          eats.
        </p>
      ) : null}
      {value.map((entry, index) => (
        <div
          key={`${entry.key}-${index}`}
          className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_140px_100px_auto]"
        >
          <Input
            value={entry.key}
            onChange={(e) => updateEntry(index, { key: e.target.value })}
            placeholder="key (e.g. breakfast)"
            disabled={disabled}
          />
          <Input
            value={entry.title}
            onChange={(e) => updateEntry(index, { title: e.target.value })}
            placeholder="Title (e.g. Breakfast)"
            disabled={disabled}
          />
          <Select
            value={entry.mealType}
            onValueChange={(next) =>
              updateEntry(index, { mealType: next as MealFrequencyEntry['mealType'] })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {mt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            max={23}
            step={1}
            inputMode="numeric"
            value={entry.defaultHour}
            onChange={(e) =>
              updateEntry(index, {
                defaultHour: Math.max(0, Math.min(23, Number.parseInt(e.target.value, 10) || 0)),
              })
            }
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeEntry(index)}
            aria-label="Remove meal"
            disabled={disabled}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addEntry}
        disabled={disabled}
        className="self-start"
      >
        <Plus className="size-4" />
        Add meal
      </Button>
    </div>
  )
}
