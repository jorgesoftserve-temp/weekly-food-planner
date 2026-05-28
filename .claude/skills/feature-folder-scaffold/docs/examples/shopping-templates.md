# Worked example — scaffold `shopping-templates` CRUD feature

Hypothetical feature: workspaces can save **reusable grocery list templates** (e.g. "weeknight basics", "party prep") that can be one-clicked when generating a menu. This example assumes the `shopping_templates` table and matching module already exist; the skill only scaffolds the app folder.

---

## Input

```yaml
feature: shopping-templates
title: "Shopping templates"
description: "Reusable grocery lists for recurring meal patterns."
icon: ListChecks

module: shopping_templates
record: ShoppingTemplateRecord
keys: shoppingTemplateKeys
hooks:
  list: useShoppingTemplatesList
  create: useCreateShoppingTemplate
  update: useUpdateShoppingTemplate
  softDelete: useSoftDeleteShoppingTemplate
mutationPayloadType: CreateShoppingTemplatePayload
patchType: UpdateShoppingTemplatePatch

formFields:
  - { name: name,        label: "Name",        type: text,     required: true, minLength: 1, maxLength: 80 }
  - { name: description, label: "Description", type: textarea, required: false, maxLength: 500 }
  - { name: visibility,  label: "Visibility",  type: select,   required: true, options: [{ value: workspace, label: "Workspace" }, { value: personal, label: "Just me" }] }

listColumns:
  - { field: name,        label: "Name" }
  - { field: visibility,  label: "Visibility" }
  - { field: created_at,  label: "Created", format: "date" }

zustand: false
```

---

## Scaffold feature `shopping-templates` (CRUD, list + dialog + soft delete)

### Files emitted

```
apps/web/app/(app)/shopping-templates/page.tsx
apps/web/app/(app)/shopping-templates/_components/shopping-template-form.tsx
apps/web/app/(app)/shopping-templates/_components/shopping-template-form-dialog.tsx
apps/web/app/(app)/shopping-templates/_components/delete-shopping-template-dialog.tsx
apps/web/integration/shopping-templates/shopping-templates.integration.test.ts
```

Inline patches:
- `apps/web/middleware.ts` — `/shopping-templates` added to protected prefixes.
- `apps/web/components/app-shell/app-sidebar.tsx` — nav entry inserted after `Recipes` and before `Menu`.

### Key file shapes

#### `page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { ListChecks, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useShoppingTemplatesList } from '@weekly-food-planner/supabase/react'
import type { ShoppingTemplateRecord } from '@weekly-food-planner/supabase'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { DeleteShoppingTemplateDialog } from './_components/delete-shopping-template-dialog'
import { ShoppingTemplateFormDialog } from './_components/shopping-template-form-dialog'

type EditTarget = { mode: 'create' } | { mode: 'edit'; templateId: string }

const ShoppingTemplatesPage = () => {
  const supabase = useSupabase()
  const { workspace, isLoading: workspaceLoading } = useActiveWorkspace()
  const canManage = workspace?.role === 'creator' || workspace?.role === 'admin'
  const templatesQuery = useShoppingTemplatesList({
    supabase,
    workspaceId: workspace?.id ?? null,
    enabled: !!workspace,
  })
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ShoppingTemplateRecord | null>(null)
  // ... render PageHeader, Skeleton / EmptyState / Table per the members reference
}

export default ShoppingTemplatesPage
```

#### `_components/shopping-template-form.tsx`

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  visibility: z.enum(['workspace', 'personal']),
})

export type ShoppingTemplateFormValues = z.infer<typeof schema>

export const ShoppingTemplateForm = ({
  defaultValues,
  onSubmit,
  isSubmitting,
}: {
  defaultValues?: Partial<ShoppingTemplateFormValues>
  onSubmit: ({ values }: { values: ShoppingTemplateFormValues }) => void
  isSubmitting?: boolean
}) => {
  const form = useForm<ShoppingTemplateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', visibility: 'workspace', ...defaultValues },
  })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onSubmit({ values }))} className="flex flex-col gap-4">
        {/* name input */}
        {/* description textarea */}
        {/* visibility select */}
        <Button type="submit" disabled={isSubmitting}>Save</Button>
      </form>
    </Form>
  )
}
```

#### `_components/shopping-template-form-dialog.tsx`

```tsx
'use client'

import { useCreateShoppingTemplate, useUpdateShoppingTemplate } from '@weekly-food-planner/supabase/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { ShoppingTemplateForm } from './shopping-template-form'

export const ShoppingTemplateFormDialog = ({
  mode,
  workspaceId,
  templateId,
  open,
  onOpenChange,
}: {
  mode: 'create' | 'edit'
  workspaceId: string
  templateId?: string
  open: boolean
  onOpenChange: ({ open }: { open: boolean }) => void
}) => {
  const supabase = useSupabase()
  const createMutation = useCreateShoppingTemplate({ supabase, workspaceId })
  const updateMutation = useUpdateShoppingTemplate({ supabase, workspaceId })
  // ... fetch defaults if mode === 'edit', wire onSubmit to the right mutation, close on success
  return (
    <Sheet open={open} onOpenChange={(open) => onOpenChange({ open })}>
      <SheetContent side="right" className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'New template' : 'Edit template'}</SheetTitle>
        </SheetHeader>
        <ShoppingTemplateForm
          defaultValues={/* ... */}
          onSubmit={/* ... */}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </SheetContent>
    </Sheet>
  )
}
```

#### `_components/delete-shopping-template-dialog.tsx`

```tsx
'use client'

import { useSoftDeleteShoppingTemplate } from '@weekly-food-planner/supabase/react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useSupabase } from '@/lib/hooks/use-supabase'

export const DeleteShoppingTemplateDialog = ({
  template,
  open,
  onOpenChange,
}: {
  template: { id: string; name: string } | null
  open: boolean
  onOpenChange: ({ open }: { open: boolean }) => void
}) => {
  const supabase = useSupabase()
  const softDelete = useSoftDeleteShoppingTemplate({ supabase, workspaceId: /* ... */ })
  return (
    <AlertDialog open={open} onOpenChange={(open) => onOpenChange({ open })}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{template?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>This template will move to trash. You can restore it within 30 days.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => template && softDelete.mutate({ id: template.id })}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

#### `apps/web/integration/shopping-templates/shopping-templates.integration.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createIntegrationFixture } from '@weekly-food-planner/test-utils'

const ENABLED = process.env.INTEGRATION_ENABLED === '1'
;(ENABLED ? describe : describe.skip)('shopping-templates (integration)', () => {
  let fixture: Awaited<ReturnType<typeof createIntegrationFixture>>
  beforeAll(async () => { fixture = await createIntegrationFixture() })
  afterAll(async () => { await fixture.cleanup() })

  it('creator can create, list, update, and soft-delete a template', async () => { /* ... */ })
  it('member role cannot mutate (RLS denies)', async () => { /* ... */ })
  it('soft-deleted templates do not appear in the list', async () => { /* ... */ })
  it('rejects creation when name is missing', async () => { /* ... */ })
})
```

### Inline patches

#### `apps/web/middleware.ts`

```ts
// add '/shopping-templates' to the protected prefixes array
const PROTECTED_PREFIXES = ['/dashboard', '/members', '/recipes', '/menu', '/grocery', '/shopping-templates']
```

#### `apps/web/components/app-shell/app-sidebar.tsx`

```tsx
// inside the nav items list, after Recipes and before Menu
{ label: 'Templates', href: '/shopping-templates', icon: ListChecks },
```

### Commands

```sh
# 1. Typecheck the new files
pnpm typecheck

# 2. Run the new integration test (requires Supabase local + env vars)
INTEGRATION_ENABLED=1 SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... \
  pnpm --filter @weekly-food-planner/web test -- shopping-templates

# 3. Browser test
pnpm --filter @weekly-food-planner/supabase db:start && pnpm dev
# Visit http://127.0.0.1:3000/shopping-templates (after login as creator/admin)
```

### Things you may need to follow up on

- The `visibility` field is a fixed enum on the form. If product wants a third value later (`workspace_admins_only`?), update both the form schema AND the underlying DB enum (use the `supabase-migration-author` agent for the latter).
- No Zustand store was created because the form is single-step. If a future iteration adds a multi-step wizard, scaffold a store at `_store.ts`.
- The dashboard does not yet surface shopping templates. If the user wants a "your most-used templates" card, that's a follow-up edit to `apps/web/app/(app)/dashboard/page.tsx`.

### Hand-offs

- UI polish (icons, microcopy, spacing) → `ui-component-builder` agent.
- A11y review → `accessibility-auditor` agent (keyboard nav on the Sheet drawer, AlertDialog focus return).
- Product UX review → `ux-reviewer` agent.
- Additional integration scenarios beyond the canonical four → `vitest-integration-author` agent.
- If `useShoppingTemplatesList` etc. don't exist yet, the scaffold aborts up front — extend the module first via `route-handler-engineer` (for the API) and a direct edit to `packages/supabase/src/module/shopping-templates.{ts,react.ts}`.

### Flags

- **Module hook names assumed from convention.** The skill verified the existence of `useShoppingTemplatesList` etc. before emitting; if the actual hook names diverge, the emitted code references the real names from the file.
- **AlertDialog vs Sheet.** The delete confirm uses `AlertDialog` (modal, destructive); the form uses `Sheet` (right-side drawer). This matches the recipes feature's pattern. If you prefer Dialog for the form, swap the import set.
- **`onOpenChange` signature is RO-RO.** `({ open }: { open: boolean }) => void` — keeps the form-dialog and delete-dialog props consistent with the rest of the app's callbacks.
