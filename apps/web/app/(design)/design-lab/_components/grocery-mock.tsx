'use client'

import { ArrowLeftRight, Check, Download } from 'lucide-react'
import { CozyShell } from './cozy-shell'
import { MOCK_GROCERY_GROUPS } from './mock-data'

// Todoist-style checkable density, grouped by aisle/category inside cozy cards.
// Completed items read as "done" via the moss/success token (frees strawberry
// for primary actions). Each line carries a free-text note row (#10): a small
// no-metadata comment where the user can jot a substitution / brand / reminder,
// plus a "Replace" affordance. New functionality, mock only.
export const GroceryMock = () => {
  const allItems = MOCK_GROCERY_GROUPS.flatMap((g) => g.items)
  const remaining = allItems.filter((i) => !i.done).length

  return (
    <CozyShell active="grocery" title="Grocery list">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Shopping list</h2>
            <p className="text-sm text-muted-foreground">
              {remaining} of {allItems.length} items left to buy
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium">
            <Download className="size-4" /> Export
          </button>
        </div>

        {MOCK_GROCERY_GROUPS.map((group) => {
          const left = group.items.filter((i) => !i.done).length
          return (
            <div key={group.category} className="cozy-card bg-card">
              <div className="flex items-center justify-between px-4 pb-1 pt-4">
                <h3 className="text-sm font-semibold">{group.category}</h3>
                <span className="text-xs text-muted-foreground">{left} left</span>
              </div>
              <div className="divide-y divide-border">
                {group.items.map((item) => (
                  <div key={item.name} className="px-4 py-2.5">
                    {/* Main row */}
                    <div className="flex min-h-9 items-center gap-3">
                      <span
                        className={
                          item.done
                            ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-success-tint text-success'
                            : 'size-6 shrink-0 rounded-full border-2 border-border'
                        }
                      >
                        {item.done ? <Check className="size-4" /> : null}
                      </span>
                      <span
                        className={
                          item.done
                            ? 'flex-1 text-sm text-muted-foreground line-through'
                            : 'flex-1 text-sm'
                        }
                      >
                        {item.name}
                      </span>
                      <button className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                        <ArrowLeftRight className="size-3.5" /> Replace
                      </button>
                      <span className="shrink-0 text-sm text-muted-foreground">{item.qty}</span>
                    </div>
                    {/* Free-text note — half-width bottom row, aligned past the checkbox */}
                    <div className="ml-9 mt-1 max-w-[60%]">
                      <input
                        defaultValue={item.note ?? ''}
                        placeholder="Add a note…"
                        className="w-full rounded-lg bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-muted"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </CozyShell>
  )
}
