"use client";

interface ReadingProgressRingProps {
  pagesRead: number;
  goal: number | null | undefined;
  size?: number;
  strokeWidth?: number;
  showCaption?: boolean;
  className?: string;
}

export function ReadingProgressRing({
  pagesRead,
  goal,
  size = 64,
  strokeWidth = 6,
  showCaption = true,
  className = "",
}: ReadingProgressRingProps) {
  const hasGoal = typeof goal === "number" && goal > 0;
  const ratio = hasGoal ? Math.min(pagesRead / (goal as number), 1) : 0;
  const overflow = hasGoal && pagesRead > (goal as number);
  const percentage = hasGoal
    ? Math.round((pagesRead / (goal as number)) * 100)
    : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;

  const trackColor = "#e5e7eb"; // gray-200
  let strokeColor = "#3b82f6"; // blue-500
  if (hasGoal) {
    if (overflow || ratio >= 1) strokeColor = "#16a34a"; // green-600
    else if (ratio >= 0.66) strokeColor = "#10b981"; // emerald-500
    else if (ratio >= 0.33) strokeColor = "#3b82f6"; // blue-500
    else strokeColor = "#f59e0b"; // amber-500
  } else {
    strokeColor = "#9ca3af"; // gray-400
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={
          hasGoal
            ? `${percentage}% de l'objectif`
            : "Objectif de lecture non défini"
        }
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {hasGoal && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: "stroke-dasharray 0.4s ease-out" }}
          />
        )}
        <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={size * 0.28}
            fontWeight={700}
            fill="#111827"
          >
            {hasGoal ? `${percentage}%` : "—"}
          </text>
        </g>
      </svg>
      {showCaption && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-700">
            {hasGoal ? "Objectif hebdo" : "Pas d'objectif"}
          </span>
          {hasGoal ? (
            <span className="text-xs text-gray-500">
              {pagesRead} / {goal} pages
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              Définis-le dans le profil
            </span>
          )}
        </div>
      )}
    </div>
  );
}
