import { cn } from "@/lib/utils";

interface SegmentedSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  options?: { value: number; label: string }[];
}

export function SegmentedSlider({ 
  label, 
  value, 
  onChange,
  options = [
    { value: 0, label: "0 - None" },
    { value: 1, label: "1 - Mild" },
    { value: 2, label: "2 - Moderate" },
    { value: 3, label: "3 - Severe" }
  ]
}: SegmentedSliderProps) {

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value);
    if (!isNaN(n) && n >= 0 && n <= 3) onChange(n);
  };

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm text-slate-800">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => { e.preventDefault(); onChange(opt.value); }}
              className={cn(
                "flex-1 h-9 rounded-md border text-xs sm:text-sm font-medium transition-all cursor-pointer select-none",
                value === opt.value
                  ? "bg-[#1a6b5c] text-white border-[#1a6b5c] font-bold shadow-sm"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0}
          max={3}
          value={value}
          onChange={handleNumberInput}
          className="w-14 h-9 rounded-md border border-slate-300 text-center text-sm font-bold text-[#1a6b5c] bg-white focus:outline-none focus:ring-2 focus:ring-[#1a6b5c]/40 focus:border-[#1a6b5c]"
        />
      </div>
    </div>
  );
}
