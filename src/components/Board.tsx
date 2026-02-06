import { useRef, useState, useEffect } from 'react'
import { GRID_SIZE } from '../game/constants.ts'
import type { Tile as TileType } from '../game/types.ts'
import { Tile } from './Tile.tsx'
import { GameOverlay } from './GameOverlay.tsx'

interface BoardProps {
  tiles: TileType[]
  won: boolean
  over: boolean
  onNewGame: () => void
  onContinue: () => void
}

export function Board({ tiles, won, over, onNewGame, onContinue }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState(0)

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerSize(containerRef.current.offsetWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const bgCells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
    <div key={i} className="bg-cell rounded-md" />
  ))

  return (
    <div className="relative">
      <div className="bg-board rounded-lg p-2 grid gap-2 aspect-square"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      >
        {bgCells}
      </div>
      <div ref={containerRef} className="absolute top-2 left-2 right-2 bottom-2">
        {containerSize > 0 && tiles.map(tile => (
          <Tile key={tile.id} tile={tile} containerSize={containerSize} />
        ))}
      </div>
      <GameOverlay won={won} over={over} onNewGame={onNewGame} onContinue={onContinue} />
    </div>
  )
}
