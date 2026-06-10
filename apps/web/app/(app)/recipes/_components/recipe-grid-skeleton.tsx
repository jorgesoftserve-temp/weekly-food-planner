import { Skeleton } from '@/components/ui/skeleton'

// Card-shaped skeleton grid — mirrors the 1/2/3 col responsive layout.
// One export per file, fat-arrow, no props needed.
export const RecipeGridSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no identity
      <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-border shadow-md">
        <Skeleton className="h-36 w-full rounded-none" />
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-5 w-12 rounded-pill" />
          </div>
        </div>
      </div>
    ))}
  </div>
)
