import { GRID_SIZE, TILE_COLORS, SUPER_TILE_COLOR } from '../game/constants.ts'
import type { Tile as TileType } from '../game/types.ts'

interface TileProps {
  tile: TileType
  containerSize: number
}

export function Tile({ tile, containerSize }: TileProps) {
  const gap = 8
  const tileSize = (containerSize - gap * (GRID_SIZE - 1)) / GRID_SIZE
  const colors = TILE_COLORS[tile.value] ?? SUPER_TILE_COLOR

  const fontSize = tile.value >= 1024
    ? tileSize * 0.3
    : tile.value >= 128
      ? tileSize * 0.38
      : tileSize * 0.45

  let className = 'tile-slide absolute flex items-center justify-center rounded-md font-bold'
  if (tile.isNew) className += ' tile-new'
  if (tile.isMerged) className += ' tile-merged'

  return (
    <div
      className={className}
      style={{
        width: tileSize,
        height: tileSize,
        top: tile.row * (tileSize + gap),
        left: tile.col * (tileSize + gap),
        fontSize,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {tile.value}
    </div>
  )
}
