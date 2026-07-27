interface ScoreInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

const SEVERITY_OPTIONS = [
  { score: 0, label: "0 - None" },
  { score: 1, label: "1 - Mild" },
  { score: 2, label: "2 - Moderate" },
  { score: 3, label: "3 - Severe" },
] as const;

export function ScoreInput({ label, value, onChange }: ScoreInputProps) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex gap-0">
        {SEVERITY_OPTIONS.map(({ score, label: btnLabel }) => {
          const isSelected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={(e) => { e.preventDefault(); onChange(score); }}
              className={[
                "flex-1 px-2 py-2 text-xs sm:text-sm font-medium border transition-all cursor-pointer select-none",
                // first button rounded left, last rounded right
                score === 0 ? "rounded-l-md" : "",
                score === 3 ? "rounded-r-md" : "",
                // avoid double borders between buttons
                score > 0 ? "-ml-px" : "",
                isSelected
                  ? "bg-[#1a6b5c] text-white font-bold border-[#1a6b5c] z-10 relative"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
              ].join(" ")}
            >
              {btnLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
