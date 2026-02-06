import { useEffect } from 'react'
import type { Direction } from '../game/types.ts'

const KEY_MAP: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
}

export function useKeyboard(onMove: (dir: Direction) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.key]
      if (dir) {
        e.preventDefault()
        onMove(dir)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onMove])
}
