import { useRef, useCallback } from 'react'
import { useGame } from './hooks/useGame.ts'
import { useKeyboard } from './hooks/useKeyboard.ts'
import { useSwipe } from './hooks/useSwipe.ts'
import { Header } from './components/Header.tsx'
import { Controls } from './components/Controls.tsx'
import { Board } from './components/Board.tsx'
import type { Direction } from './game/types.ts'

export default function App() {
  const { tiles, score, best, won, over, move, newGame, undo, continueAfterWin } = useGame()
  const boardRef = useRef<HTMLDivElement>(null)

  const handleMove = useCallback((dir: Direction) => {
    move(dir)
  }, [move])

  useKeyboard(handleMove)
  useSwipe(boardRef, handleMove)

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full max-w-[460px] p-4 max-sm:p-2.5" ref={boardRef}>
        <Header score={score} best={best} />
        <Controls onNewGame={newGame} onUndo={undo} />
        <Board
          tiles={tiles}
          won={won}
          over={over}
          onNewGame={newGame}
          onContinue={continueAfterWin}
        />
      </div>
    </div>
  )
}
