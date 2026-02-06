interface GameOverlayProps {
  won: boolean
  over: boolean
  onNewGame: () => void
  onContinue: () => void
}

export function GameOverlay({ won, over, onNewGame, onContinue }: GameOverlayProps) {
  const active = won || over

  return (
    <div
      className={`overlay-fade absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-4 ${
        active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      } ${won ? 'bg-[rgba(237,194,46,0.5)]' : 'bg-[rgba(238,228,218,0.73)]'}`}
    >
      <div className={`text-[40px] font-extrabold ${won ? 'text-text-light' : 'text-text-dark'}`}>
        {won ? 'You Win!' : 'Game Over'}
      </div>
      <div className="flex gap-2">
        {won && (
          <button
            onClick={onContinue}
            className="bg-btn hover:bg-btn-hover text-text-light border-none rounded-md px-5 py-2.5 text-sm font-bold cursor-pointer transition-colors"
          >
            Continue
          </button>
        )}
        <button
          onClick={onNewGame}
          className="bg-btn hover:bg-btn-hover text-text-light border-none rounded-md px-5 py-2.5 text-sm font-bold cursor-pointer transition-colors"
        >
          New Game
        </button>
      </div>
    </div>
  )
}
