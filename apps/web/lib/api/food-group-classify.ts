/**
 * food-group-classify.ts  (server-only — never imported by any client component)
 *
 * HARD BOUNDARY: this module is a catalog annotation only. It reads
 * ingredients.food_group_source='unset' rows and writes
 * food_group + food_group_source='ai'. It is NEVER called by the constraint
 * engine, the menu input builder, or any generation path, and NEVER touches
 * accepted_seed. See v2.0 plan Phase 0 and ARCHITECTURE_PRD §4.2.
 *
 * Uses @anthropic-ai/sdk with tool_choice pinned to 'classify_ingredient'
 * (bounded classification) and prompt caching on the static system turn so
 * the fixed 10-label list + instructions are cached across repeated calls.
 *
 * Graceful degradation: if ANTHROPIC_API_KEY is unset the function returns
 * { ok: false, reason: 'no_api_key' } without throwing, leaving the
 * ingredient at food_group_source='unset'. The app is fully functional
 * without a key — food_group is nullable and only used for shopping UI
 * grouping (Phase 2).
 */

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { supabaseAdminClient } from '@/utils/supabase/admin'
import { updateIngredientFoodGroup } from '@weekly-food-planner/supabase'

// ---------------------------------------------------------------------------
// 10 official food_group label values registered by migration
// 20260610221508_tbl_ingredients_add_food_group_with_index.sql.
// Keep in sync with that migration's INSERT INTO enum_metadata block.
// ---------------------------------------------------------------------------
const FOOD_GROUP_VALUES = [
  'vegetables',
  'fruits',
  'grains',
  'proteins',
  'dairy',
  'fats_oils',
  'herbs_spices',
  'condiments',
  'beverages',
  'other',
] as const

type FoodGroupValue = (typeof FOOD_GROUP_VALUES)[number]

// Zod schema used to validate the tool output before persisting.
const classifyResultSchema = z.object({
  food_group: z.enum(FOOD_GROUP_VALUES),
})

// ---------------------------------------------------------------------------
// Tool definition — pinned via tool_choice so Claude always calls it.
// ---------------------------------------------------------------------------
const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classify_ingredient',
  description: 'Classify an ingredient into exactly one food group.',
  input_schema: {
    type: 'object',
    properties: {
      food_group: {
        type: 'string',
        enum: [...FOOD_GROUP_VALUES],
        description: 'The single food group this ingredient belongs to.',
      },
    },
    required: ['food_group'],
  },
}

// ---------------------------------------------------------------------------
// Static system prompt — placed behind cache_control ephemeral so the stable
// instructions + label list are cached across calls (≥1024 tokens minimum;
// this prompt is short but haiku-4-5's threshold is 1024 tokens so caching
// will apply when it's part of a larger prompt block; we attach it anyway
// for correctness and forward compatibility).
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You classify food ingredients into food groups for a meal-planning application.

You will be given an ingredient name. Respond ONLY by calling the classify_ingredient tool with one of these exact values:

- vegetables    : fresh, frozen, or canned vegetables (including alliums, roots, leafy greens)
- fruits        : fresh, frozen, dried, or canned fruit
- grains        : bread, rice, pasta, cereals, oats, flour, and other grain-based staples
- proteins      : meat, poultry, seafood, eggs, legumes (beans, lentils, chickpeas), tofu, tempeh, nuts, seeds
- dairy         : milk, cheese, butter, yogurt, cream, and dairy alternatives
- fats_oils     : cooking oils, ghee, lard, shortening
- herbs_spices  : dried or fresh herbs, spices, seasonings, and spice blends
- condiments    : sauces, vinegar, mustard, ketchup, dressings, pastes, soy sauce, fish sauce
- beverages     : drinks, juices, stocks, broths, wine, beer used as ingredients
- other         : anything that does not clearly fit one of the above groups

Rules:
- Choose the SINGLE most appropriate group.
- Prefer specificity: an ingredient that fits "proteins" should not be classified as "other".
- Do not add any explanation outside the tool call.`

// ---------------------------------------------------------------------------
// Return type (RO-RO)
// ---------------------------------------------------------------------------
type ClassifyOk = {
  ok: true
  ingredientId: string
  foodGroup: FoodGroupValue
}

type ClassifyFail = {
  ok: false
  reason: 'no_api_key' | 'api_error' | 'invalid_response' | 'persist_error'
  detail?: string
}

type ClassifyResult = ClassifyOk | ClassifyFail

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies a user-created ingredient that has no food group yet
 * (food_group_source = 'unset') and persists the result.
 *
 * HARD BOUNDARY: must never be called from the constraint engine, menu input
 * builder, or any generation/seed path. Catalog annotation only.
 *
 * Fire-and-forget usage from the ingredient creation route:
 *   void classifyIngredientFoodGroup({ ingredientId, ingredientName })
 *
 * The caller must NOT await this for the ingredient creation response —
 * classification is non-blocking so ingredient creation never fails on a
 * classify error.
 */
export const classifyIngredientFoodGroup = async ({
  ingredientId,
  ingredientName,
}: {
  ingredientId: string
  ingredientName: string
}): Promise<ClassifyResult> => {
  // Graceful degradation: no key → leave at 'unset', no throw.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: 'no_api_key' }
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      // claude-haiku-4-5 — cheapest model; bounded classification needs no
      // reasoning depth. Model ID confirmed from claude-api skill model catalog.
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      // Static system prompt cached so the instructions + label list are
      // re-used across repeated classification calls (cache_control ephemeral).
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // cache_control caches the static system block. Minimum cacheable
          // prefix is 1024 tokens on haiku-4-5; this prompt is ~300 tokens so
          // the breakpoint is set for correctness and will silently no-cache
          // if below threshold, which is fine — it does not error.
          cache_control: { type: 'ephemeral' },
        },
      ],
      // Dynamic user turn — ingredient name only, uncached.
      messages: [
        {
          role: 'user',
          content: `Classify this ingredient: "${ingredientName}"`,
        },
      ],
      tools: [CLASSIFY_TOOL],
      // Pin to tool_choice so the model always returns a structured result,
      // never a free-text refusal or hedged answer.
      tool_choice: { type: 'tool', name: 'classify_ingredient' },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'api_error', detail }
  }

  // Extract the tool-use block.
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  if (!toolUse) {
    return {
      ok: false,
      reason: 'invalid_response',
      detail: 'no tool_use block in response',
    }
  }

  // Validate the tool output against the Zod schema before persisting.
  const parsed = classifyResultSchema.safeParse(toolUse.input)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_response',
      detail: `schema validation failed: ${JSON.stringify(parsed.error.issues)}`,
    }
  }

  const foodGroup = parsed.data.food_group

  // Register the value in enum_metadata (idempotent — the 10 official values
  // already exist, but we call it to honour the sys_save_label contract for
  // any future expansion).
  // Using supabaseAdminClient: catalog writes bypass RLS (service-managed
  // per DATABASE_PRD §8). This is the same pattern as seed-ingredients.
  const admin = supabaseAdminClient()
  const { error: labelErr } = await admin.rpc('sys_save_label', {
    p_enum_type: 'food_group',
    p_value: foodGroup,
  })
  if (labelErr) {
    return {
      ok: false,
      reason: 'persist_error',
      detail: `sys_save_label: ${labelErr.message}`,
    }
  }

  // Persist the classification onto the ingredient row.
  try {
    await updateIngredientFoodGroup({
      admin,
      ingredientId,
      patch: {
        foodGroup,
        foodGroupSource: 'ai',
      },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'persist_error', detail }
  }

  return { ok: true, ingredientId, foodGroup }
}
