import { useState, useCallback, useRef } from 'react'
import type { Tile, Direction } from '../game/types.ts'
import { SLIDE_DURATION } from '../game/constants.ts'
import {
  createInitialTiles,
  moveTiles,
  addRandomTile,
  canMove,
  hasWon,
  clearAnimationFlags,
} from '../game/logic.ts'
import { loadBest, saveBest } from '../utils/storage.ts'

interface Snapshot {
  tiles: Tile[]
  score: number
}

export function useGame() {
  const [tiles, setTiles] = useState<Tile[]>(() => createInitialTiles())
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => loadBest())
  const [over, setOver] = useState(false)
  const [showWin, setShowWin] = useState(false)

  // Refs for latest values accessible in callbacks/timeouts
  const scoreRef = useRef(0)
  const bestRef = useRef(best)
  const wonRef = useRef(false)
  const overRef = useRef(false)
  const prevRef = useRef<Snapshot | null>(null)
  const movingRef = useRef(false)

  const move = useCallback((dir: Direction) => {
    if (movingRef.current || overRef.current) return

    setTiles(currentTiles => {
      const result = moveTiles(currentTiles, dir)
      if (!result.moved) return currentTiles

      movingRef.current = true

      // Save snapshot for undo
      prevRef.current = {
        tiles: currentTiles,
        score: scoreRef.current,
      }

      const newScore = scoreRef.current + result.scoreGained
      scoreRef.current = newScore
      setScore(newScore)

      if (newScore > bestRef.current) {
        bestRef.current = newScore
        setBest(newScore)
        saveBest(newScore)
      }

      // After slide animation, add new tile
      setTimeout(() => {
        setTiles(slidTiles => {
          const cleared = clearAnimationFlags(slidTiles)
          const newTile = addRandomTile(cleared)
          const withNew = newTile ? [...cleared, newTile] : cleared

          if (!wonRef.current && hasWon(withNew)) {
            wonRef.current = true
            setShowWin(true)
          }

          if (!canMove(withNew)) {
            overRef.current = true
            setOver(true)
          }

          movingRef.current = false
          return withNew
        })
      }, SLIDE_DURATION)

      return result.tiles
    })
  }, [])

  const newGame = useCallback(() => {
    const initial = createInitialTiles()
    setTiles(initial)
    scoreRef.current = 0
    setScore(0)
    wonRef.current = false
    overRef.current = false
    setOver(false)
    setShowWin(false)
    prevRef.current = null
    movingRef.current = false
  }, [])

  const undo = useCallback(() => {
    if (!prevRef.current) return
    setTiles(prevRef.current.tiles)
    scoreRef.current = prevRef.current.score
    setScore(prevRef.current.score)
    overRef.current = false
    setOver(false)
    setShowWin(false)
    prevRef.current = null
  }, [])

  const continueAfterWin = useCallback(() => {
    setShowWin(false)
  }, [])

  return {
    tiles,
    score,
    best,
    won: showWin,
    over,
    move,
    newGame,
    undo,
    continueAfterWin,
  }
}
