const BEST_KEY = 'best2048_5x5'

export function loadBest(): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

export function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // storage unavailable
  }
}
