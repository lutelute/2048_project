interface ScoreBoxProps {
  label: string
  value: number
}

export function ScoreBox({ label, value }: ScoreBoxProps) {
  return (
    <div className="bg-board rounded-md px-4 py-2 text-center min-w-[80px] max-sm:min-w-[64px] max-sm:px-2.5 max-sm:py-1.5">
      <div className="text-[11px] font-semibold text-label uppercase tracking-wider">
        {label}
      </div>
      <div className="text-[22px] font-bold text-white max-sm:text-lg">
        {value}
      </div>
    </div>
  )
}
