export interface Tile {
  id: number
  value: number
  row: number
  col: number
  isNew?: boolean
  isMerged?: boolean
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface GameState {
  tiles: Tile[]
  score: number
  best: number
  won: boolean
  over: boolean
}

export interface MoveResult {
  tiles: Tile[]
  scoreGained: number
  moved: boolean
}
