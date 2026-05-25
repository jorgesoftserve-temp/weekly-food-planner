'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useLabelSearch } from '@weekly-food-planner/supabase/react'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { cn } from '@/lib/utils'

export type MultiLabelComboboxProps = {
  enumType: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyPlaceholder?: string
  className?: string
  disabled?: boolean
}

// Multi-select combobox backed by /enum_metadata (via useLabelSearch). User
// can pick from suggestions OR type a new value and press Enter — the
// downstream createRecipe / updateRecipe call funnels new values through
// sys_save_label so they're persisted to enum_metadata server-side.
export const MultiLabelCombobox = ({
  enumType,
  value,
  onChange,
  placeholder = 'Search…',
  emptyPlaceholder = 'No labels yet — start typing to add one.',
  className,
  disabled,
}: MultiLabelComboboxProps) => {
  const supabase = useSupabase()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const labelsQuery = useLabelSearch({
    supabase,
    enumType,
    query,
    limit: 8,
    enabled: open,
  })

  const trimmedQuery = query.trim()
  const selectedSet = useMemo(() => new Set(value), [value])

  // Surface a synthetic "+ create X" item when the user's query doesn't match
  // any existing label exactly. The save-to-enum_metadata happens at submit.
  const suggestions = labelsQuery.data ?? []
  const hasExactMatch = suggestions.some(
    (item) => item.value.toLowerCase() === trimmedQuery.toLowerCase(),
  )
  const showCreateRow =
    trimmedQuery.length > 0 && !hasExactMatch && !selectedSet.has(trimmedQuery)

  const toggle = (next: string) => {
    const trimmed = next.trim()
    if (!trimmed) return
    if (selectedSet.has(trimmed)) {
      onChange(value.filter((v) => v !== trimmed))
    } else {
      onChange([...value, trimmed])
    }
  }

  const remove = (next: string) => {
    onChange(value.filter((v) => v !== next))
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                disabled={disabled}
                aria-label={`Remove ${tag}`}
                className="rounded-full transition-opacity hover:opacity-70 disabled:cursor-not-allowed"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="text-muted-foreground">
              {value.length > 0 ? `Add another${'…'}` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {labelsQuery.isLoading ? 'Loading…' : emptyPlaceholder}
              </CommandEmpty>
              {suggestions.length > 0 ? (
                <CommandGroup heading="Suggestions">
                  {suggestions.map((item) => {
                    const selected = selectedSet.has(item.value)
                    return (
                      <CommandItem
                        key={`${item.enum_type}:${item.value}`}
                        value={item.value}
                        onSelect={(picked) => {
                          toggle(picked)
                          setQuery('')
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            selected ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="flex-1 truncate">
                          {item.display_name ?? item.value}
                        </span>
                        {!item.is_official ? (
                          <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            custom
                          </span>
                        ) : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null}
              {showCreateRow ? (
                <CommandGroup heading="Create new">
                  <CommandItem
                    value={`__create__:${trimmedQuery}`}
                    onSelect={() => {
                      toggle(trimmedQuery)
                      setQuery('')
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add &ldquo;{trimmedQuery}&rdquo;
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
