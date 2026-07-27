import { Badge } from "@/components/ui/badge";

export function CeapBadge({ ceap }: { ceap: string }) {
  if (!ceap) return null;
  
  const getSeverityColor = (ceapString: string) => {
    if (ceapString.includes("C6")) return "bg-[#dc2626] text-white";
    if (ceapString.includes("C5")) return "bg-[#ea580c] text-white";
    if (ceapString.includes("C4")) return "bg-[#ea580c] text-white";
    if (ceapString.includes("C3")) return "bg-[#ca8a04] text-white";
    if (ceapString.includes("C2") || ceapString.includes("C1")) return "bg-[#16a34a] text-white";
    return "bg-[#6b7280] text-white";
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">CEAP:</span>
      <Badge className={`${getSeverityColor(ceap)} font-bold font-mono text-sm px-2 py-0.5`} variant="secondary">
        {ceap}
      </Badge>
    </div>
  );
}
