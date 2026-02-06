import { GRID_SIZE, WIN_VALUE } from './constants.ts'
import type { Tile, Direction, MoveResult } from './types.ts'

let nextId = 1
export function resetIdCounter(start = 1) {
  nextId = start
}
function genId() {
  return nextId++
}

type Grid = number[][]

function emptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

function tilesToGrid(tiles: Tile[]): Grid {
  const g = emptyGrid()
  for (const t of tiles) {
    g[t.row][t.col] = t.value
  }
  return g
}

function emptyCells(grid: Grid): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = []
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === 0) cells.push({ row: r, col: c })
  return cells
}

// Slide a row toward index 0 (left), returning new values + score
function slideRow(row: number[]): { values: number[]; scored: number; mergedAt: Set<number> } {
  let arr = row.filter(v => v !== 0)
  let scored = 0
  const mergedAt = new Set<number>()

  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2
      scored += arr[i]
      mergedAt.add(i)
      arr[i + 1] = 0
      i++
    }
  }
  arr = arr.filter(v => v !== 0)
  while (arr.length < GRID_SIZE) arr.push(0)
  return { values: arr, scored, mergedAt }
}

// --- Public API ---

export function createInitialTiles(): Tile[] {
  resetIdCounter()
  const grid = emptyGrid()
  const tiles: Tile[] = []

  for (let i = 0; i < 2; i++) {
    const cells = emptyCells(grid)
    if (cells.length === 0) break
    const cell = cells[Math.floor(Math.random() * cells.length)]
    const value = Math.random() < 0.9 ? 2 : 4
    grid[cell.row][cell.col] = value
    tiles.push({ id: genId(), value, row: cell.row, col: cell.col, isNew: true })
  }

  return tiles
}

export function moveTiles(tiles: Tile[], direction: Direction): MoveResult {
  // Work on a simple grid, then reconcile tile IDs
  const oldGrid = tilesToGrid(tiles)
  const newGrid = emptyGrid()
  let totalScored = 0
  let moved = false

  // mergedPositions: set of "r,c" in newGrid that resulted from a merge
  const mergedPositions = new Set<string>()

  const isHorizontal = direction === 'left' || direction === 'right'
  const isReverse = direction === 'right' || direction === 'down'

  for (let line = 0; line < GRID_SIZE; line++) {
    // Extract the line (row or column)
    const extracted: number[] = []
    for (let i = 0; i < GRID_SIZE; i++) {
      extracted.push(isHorizontal ? oldGrid[line][i] : oldGrid[i][line])
    }

    if (isReverse) extracted.reverse()

    const { values, scored, mergedAt } = slideRow(extracted)
    totalScored += scored

    if (isReverse) values.reverse()

    // Write back to newGrid and detect movement
    for (let i = 0; i < GRID_SIZE; i++) {
      const r = isHorizontal ? line : i
      const c = isHorizontal ? i : line
      newGrid[r][c] = values[i]

      const origVal = oldGrid[r][c]
      if (origVal !== values[i]) moved = true

      // Map mergedAt indices back to actual positions
      const slideIdx = isReverse ? GRID_SIZE - 1 - i : i
      if (mergedAt.has(slideIdx)) {
        mergedPositions.add(`${r},${c}`)
      }
    }
  }

  if (!moved) {
    return { tiles, scoreGained: 0, moved: false }
  }

  // Reconcile tile IDs: for each non-zero cell in newGrid, try to find
  // the best matching old tile (same value or half value for merges)
  // Simple approach: build new tile array with fresh/reused IDs
  const usedOldIds = new Set<number>()
  const oldTileMap = new Map<string, Tile>()
  for (const t of tiles) {
    oldTileMap.set(`${t.row},${t.col}`, t)
  }

  const newTiles: Tile[] = []

  // For ID reuse, we need to figure out which old tile slid to which new position.
  // Simpler approach: for each line, track how non-zero tiles map.
  for (let line = 0; line < GRID_SIZE; line++) {
    // Gather old tiles in this line, in the direction of movement
    const oldInLine: Tile[] = []
    for (let i = 0; i < GRID_SIZE; i++) {
      const r = isHorizontal ? line : i
      const c = isHorizontal ? i : line
      const t = oldTileMap.get(`${r},${c}`)
      if (t) oldInLine.push(t)
    }
    if (isReverse) oldInLine.reverse()

    // Get new values in this line
    const newVals: { r: number; c: number; val: number; merged: boolean }[] = []
    for (let i = 0; i < GRID_SIZE; i++) {
      const idx = isReverse ? GRID_SIZE - 1 - i : i
      const r = isHorizontal ? line : idx
      const c = isHorizontal ? idx : line
      if (newGrid[r][c] !== 0) {
        newVals.push({ r, c, val: newGrid[r][c], merged: mergedPositions.has(`${r},${c}`) })
      }
    }

    // Match old tiles to new positions
    let oldIdx = 0
    for (const nv of newVals) {
      if (nv.merged) {
        // Consumes 2 old tiles
        const t1 = oldInLine[oldIdx]
        oldIdx += 2
        newTiles.push({
          id: t1?.id ?? genId(),
          value: nv.val,
          row: nv.r,
          col: nv.c,
          isMerged: true,
        })
        if (t1) usedOldIds.add(t1.id)
      } else {
        const t = oldInLine[oldIdx]
        oldIdx++
        newTiles.push({
          id: t?.id ?? genId(),
          value: nv.val,
          row: nv.r,
          col: nv.c,
        })
        if (t) usedOldIds.add(t.id)
      }
    }
  }

  return { tiles: newTiles, scoreGained: totalScored, moved: true }
}

export function addRandomTile(tiles: Tile[]): Tile | null {
  const grid = tilesToGrid(tiles)
  const cells = emptyCells(grid)
  if (cells.length === 0) return null
  const cell = cells[Math.floor(Math.random() * cells.length)]
  const value = Math.random() < 0.9 ? 2 : 4
  return { id: genId(), value, row: cell.row, col: cell.col, isNew: true }
}

export function canMove(tiles: Tile[]): boolean {
  const grid = tilesToGrid(tiles)
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) return true
      if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true
      if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true
    }
  return false
}

export function hasWon(tiles: Tile[]): boolean {
  return tiles.some(t => t.value >= WIN_VALUE)
}

export function clearAnimationFlags(tiles: Tile[]): Tile[] {
  return tiles.map(t =>
    t.isNew || t.isMerged ? { ...t, isNew: false, isMerged: false } : t
  )
}
