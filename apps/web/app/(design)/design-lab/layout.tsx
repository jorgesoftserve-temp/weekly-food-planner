import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import './design-lab.css'

// Dev-only review surface for the v1.8 redesign mocks. Not exposed in production
// builds. Unauthenticated + no Supabase — everything inside renders from static
// mock data. The cozy skin is scoped to data-skin="cozy" so the live app is
// untouched (see docs/design/cozy-restyle-spec.md).
const DesignLabLayout = ({ children }: { children: ReactNode }) => {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div data-skin="cozy" className="min-h-screen bg-muted/40">
      {children}
    </div>
  )
}

export default DesignLabLayout
