import { cn } from "@/lib/utils";

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
  activeColor?: "primary" | "destructive" | "warning" | "success";
}

export function ChipToggle({ 
  label, 
  selected, 
  onClick, 
  className,
  activeColor = "primary"
}: ChipToggleProps) {
  
  const activeClassMap: Record<string, string> = {
    primary: "bg-[#1a6b5c] text-white border-[#1a6b5c] hover:bg-[#134d42]",
    destructive: "bg-red-600 text-white border-red-600 hover:bg-red-700",
    warning: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    success: "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600",
  };

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition-all cursor-pointer select-none",
        selected 
          ? activeClassMap[activeColor] 
          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400",
        className
      )}
    >
      {label}
    </button>
  );
}

