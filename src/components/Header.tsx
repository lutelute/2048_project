import { ScoreBox } from './ScoreBox.tsx'

interface HeaderProps {
  score: number
  best: number
}

export function Header({ score, best }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="text-5xl font-extrabold text-text-dark max-sm:text-4xl">
        2048
      </div>
      <div className="flex gap-2">
        <ScoreBox label="Score" value={score} />
        <ScoreBox label="Best" value={best} />
      </div>
    </div>
  )
}
