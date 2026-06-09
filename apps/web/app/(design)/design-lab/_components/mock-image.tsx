'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// Mock cover/thumbnail image for the design lab. Loads a real photo so the
// image-forward layouts can actually be judged, but falls back to the emoji +
// gradient placeholder on any load error (or missing src) so the lab still works
// offline / if the image host rate-limits. Dev-only review surface — a plain
// <img> is intentional (no next/image remote-pattern config needed).
export const MockImage = ({
  src,
  alt,
  emoji,
  className,
  emojiClassName,
}: {
  src?: string
  alt: string
  emoji: string
  className?: string
  emojiClassName?: string
}) => {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div
        className={cn('flex items-center justify-center bg-gradient-empty', className)}
        role="img"
        aria-label={alt}
      >
        <span aria-hidden className={cn('text-5xl', emojiClassName)}>
          {emoji}
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}
