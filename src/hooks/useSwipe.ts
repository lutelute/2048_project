import { useRef, useEffect, type RefObject } from 'react'
import type { Direction } from '../game/types.ts'

const MIN_SWIPE = 30

export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (dir: Direction) => void,
) {
  const start = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      start.current = { x: touch.clientX, y: touch.clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!start.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (Math.max(absDx, absDy) < MIN_SWIPE) return

      let dir: Direction
      if (absDx > absDy) {
        dir = dx > 0 ? 'right' : 'left'
      } else {
        dir = dy > 0 ? 'down' : 'up'
      }
      onSwipe(dir)
      start.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [ref, onSwipe])
}
