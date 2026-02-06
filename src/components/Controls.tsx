interface ControlsProps {
  onNewGame: () => void
  onUndo: () => void
}

export function Controls({ onNewGame, onUndo }: ControlsProps) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={onNewGame}
        className="bg-btn hover:bg-btn-hover text-text-light border-none rounded-md px-5 py-2.5 text-sm font-bold cursor-pointer transition-colors"
      >
        New Game
      </button>
      <button
        onClick={onUndo}
        className="bg-btn hover:bg-btn-hover text-text-light border-none rounded-md px-5 py-2.5 text-sm font-bold cursor-pointer transition-colors"
      >
        Undo
      </button>
    </div>
  )
}
