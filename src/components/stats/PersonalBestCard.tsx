import './PersonalBestCard.css'

interface Props {
  bestDayCount: number
  longestStreak: number
}

export function PersonalBestCard({ bestDayCount, longestStreak }: Props) {
  if (bestDayCount === 0 && longestStreak === 0) return null

  return (
    <div className="personal-best">
      {bestDayCount > 0 && (
        <div className="personal-best__item">
          <span className="personal-best__icon">🏆</span>
          <span className="personal-best__text">
            <strong>{bestDayCount}</strong> słów opanowanych jednego dnia
          </span>
        </div>
      )}
      {longestStreak > 0 && (
        <div className="personal-best__item">
          <span className="personal-best__icon">🔥</span>
          <span className="personal-best__text">
            Najdłuższa seria: <strong>{longestStreak} dni</strong>
          </span>
        </div>
      )}
    </div>
  )
}
