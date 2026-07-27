import { useState } from "react";
import type { DopplerSlotImage } from "./doppler-upload";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SegmentDef {
  id: string;
  d: string;
  width: number;
  labelX: number;
  labelY: number;
  leaderD: string;
  side: "left" | "right";
  isDashed?: boolean;
}

const ALL_SEGMENT_IDS = [
  "cfv", "femoral_prox", "femoral_mid", "femoral_dist", "popliteal",
  "sfj", "gsv_prox_thigh", "gsv_mid_thigh", "gsv_knee", "gsv_mid_calf",
  "spj", "ssv_prox_calf", "ssv_mid_calf", "aasv",
  "ipv_medial_thigh", "ipv_medial_calf"
];

const SEGMENT_META: Record<string, { label: string; fullName: string; system: "deep" | "superficial" | "perforator" }> = {
  cfv:              { label: "CFV",       fullName: "Common Femoral Vein", system: "deep" },
  femoral_prox:     { label: "Fem Prox",  fullName: "Femoral Vein Proximal", system: "deep" },
  femoral_mid:      { label: "Fem Mid",   fullName: "Femoral Vein Mid", system: "deep" },
  femoral_dist:     { label: "Fem Dist",  fullName: "Femoral Vein Distal", system: "deep" },
  popliteal:        { label: "Popliteal", fullName: "Popliteal Vein", system: "deep" },
  sfj:              { label: "SFJ",       fullName: "Saphenofemoral Junction", system: "superficial" },
  gsv_prox_thigh:   { label: "GSV Prox",  fullName: "GSV Proximal Thigh", system: "superficial" },
  gsv_mid_thigh:    { label: "GSV Mid",   fullName: "GSV Mid Thigh", system: "superficial" },
  gsv_knee:         { label: "GSV Knee",  fullName: "GSV Knee", system: "superficial" },
  gsv_mid_calf:     { label: "GSV Calf",  fullName: "GSV Mid Calf", system: "superficial" },
  spj:              { label: "SPJ",       fullName: "Saphenopopliteal Junction", system: "superficial" },
  ssv_prox_calf:    { label: "SSV Prox",  fullName: "SSV Proximal Calf", system: "superficial" },
  ssv_mid_calf:     { label: "SSV Mid",   fullName: "SSV Mid Calf", system: "superficial" },
  aasv:             { label: "AASV",      fullName: "Anterior Accessory Saphenous Vein", system: "superficial" },
  ipv_medial_thigh: { label: "IPV Thigh", fullName: "Incompetent Perforator Medial Thigh", system: "perforator" },
  ipv_medial_calf:  { label: "IPV Calf",  fullName: "Incompetent Perforator Medial Calf", system: "perforator" },
};

// SVG Canvas 280x600
const SEGMENT_PATHS: SegmentDef[] = [
  // DEEP SYSTEM (Left side, X=100)
  { id: "cfv",           d: "M 100 60 L 100 120", width: 6, labelX: 70, labelY: 90, leaderD: "M 100 90 L 80 90", side: "left" },
  { id: "femoral_prox",  d: "M 100 120 L 100 200", width: 6, labelX: 70, labelY: 160, leaderD: "M 100 160 L 80 160", side: "left" },
  { id: "femoral_mid",   d: "M 100 200 L 100 280", width: 6, labelX: 70, labelY: 240, leaderD: "M 100 240 L 80 240", side: "left" },
  { id: "femoral_dist",  d: "M 100 280 L 100 360", width: 6, labelX: 70, labelY: 320, leaderD: "M 100 320 L 80 320", side: "left" },
  { id: "popliteal",     d: "M 100 360 L 100 440", width: 6, labelX: 70, labelY: 400, leaderD: "M 100 400 L 80 400", side: "left" },

  // SUPERFICIAL SYSTEM (Right side, mostly X=160)
  { id: "sfj",           d: "M 100 90 Q 130 90 160 120", width: 4, labelX: 200, labelY: 100, leaderD: "M 135 102 L 190 100", side: "right" },
  { id: "gsv_prox_thigh",d: "M 160 120 L 160 200", width: 4, labelX: 200, labelY: 160, leaderD: "M 160 160 L 190 160", side: "right" },
  { id: "gsv_mid_thigh", d: "M 160 200 L 160 300", width: 4, labelX: 200, labelY: 250, leaderD: "M 160 250 L 190 250", side: "right" },
  { id: "gsv_knee",      d: "M 160 300 L 160 400", width: 4, labelX: 200, labelY: 350, leaderD: "M 160 350 L 190 350", side: "right" },
  { id: "gsv_mid_calf",  d: "M 160 400 L 160 500", width: 4, labelX: 200, labelY: 450, leaderD: "M 160 450 L 190 450", side: "right" },
  
  // AASV (Branches from GSV Prox laterally, X=190)
  { id: "aasv",          d: "M 160 140 Q 190 150 190 200 L 190 280", width: 4, labelX: 220, labelY: 210, leaderD: "M 190 210 L 210 210", side: "right" },

  // SPJ & SSV (SSV at X=130)
  { id: "spj",           d: "M 100 380 Q 130 380 130 400", width: 4, labelX: 200, labelY: 380, leaderD: "M 120 385 L 190 380", side: "right" },
  { id: "ssv_prox_calf", d: "M 130 400 L 130 450", width: 4, labelX: 200, labelY: 425, leaderD: "M 130 425 L 190 425", side: "right" },
  { id: "ssv_mid_calf",  d: "M 130 450 L 130 500", width: 4, labelX: 200, labelY: 475, leaderD: "M 130 475 L 190 475", side: "right" },

  // PERFORATORS (Dashed horizontal)
  { id: "ipv_medial_thigh", d: "M 100 240 L 160 240", width: 3, labelX: 210, labelY: 225, leaderD: "M 130 240 L 130 225 L 200 225", side: "right", isDashed: true },
  { id: "ipv_medial_calf",  d: "M 100 460 L 160 460", width: 3, labelX: 210, labelY: 490, leaderD: "M 130 460 L 130 490 L 200 490", side: "right", isDashed: true },
];

// ─── Coverage status ──────────────────────────────────────────────────────────

interface CoverageStatus {
  hasImage: boolean;
  hasData: boolean;
}

function getSegmentStatus(seg: string, leg: "right" | "left", images: DopplerSlotImage[]): CoverageStatus {
  const legImgs = images.filter((i) => i.leg === leg && i.segment === seg && i.view !== "quick_upload");
  const hasImage = legImgs.some((i) => !!i.file || !!i.previewUrl);
  const hasData = legImgs.some(
    (i) =>
      i.compressible !== undefined ||
      i.spontaneous !== undefined ||
      i.refluxMs !== undefined ||
      i.diameterMm !== undefined ||
      i.outwardFlow350 !== undefined
  );
  return { hasImage, hasData };
}

function getTooltipData(seg: string, leg: "right" | "left", images: DopplerSlotImage[]) {
  const legImgs = images.filter((i) => i.leg === leg && i.segment === seg && i.view !== "quick_upload");
  if (!legImgs.length) return null;
  return legImgs.reduce((acc, cur) => ({ ...acc, ...cur }), {} as DopplerSlotImage);
}

function segmentColor(status: CoverageStatus): { fill: string; stroke: string } {
  if (status.hasImage && status.hasData)   return { fill: "#1a6b5c", stroke: "#1a6b5c" };
  if (status.hasData && !status.hasImage)  return { fill: "#ffffff", stroke: "#1a6b5c" };
  if (status.hasImage && !status.hasData)  return { fill: "#f59e0b", stroke: "#f59e0b" };
  return { fill: "#e2e8f0", stroke: "#cbd5e1" };
}

function getJunctionColor(seg1: string, seg2: string, leg: "right" | "left", images: DopplerSlotImage[]) {
  const s1 = getSegmentStatus(seg1, leg, images);
  const s2 = getSegmentStatus(seg2, leg, images);
  const doc1 = s1.hasImage || s1.hasData;
  const doc2 = s2.hasImage || s2.hasData;
  if (doc1 && doc2) return "#1a6b5c";
  if (doc1 || doc2) return "#f59e0b";
  return "#cbd5e1";
}

// ─── Vessel Path Renderer ─────────────────────────────────────────────────────

function VesselPath({ d, status, width, isDashed, isHovered }: { d: string; status: CoverageStatus; width: number; isDashed?: boolean; isHovered: boolean }) {
  const { stroke } = segmentColor(status);
  const glowStyle = (isHovered || (status.hasImage && status.hasData)) 
    ? { filter: "drop-shadow(0 0 5px rgba(26,107,92,0.6))" } 
    : {};

  if (status.hasData && !status.hasImage) {
    return (
      <g style={glowStyle}>
        <path d={d} fill="none" stroke="#1a6b5c" strokeWidth={width + 2.5} strokeDasharray={isDashed ? "7,7" : "none"} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={width} strokeDasharray={isDashed ? "7,7" : "none"} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  
  return (
    <path 
      d={d} 
      fill="none" 
      stroke={stroke} 
      strokeWidth={width} 
      strokeDasharray={isDashed ? "6,6" : "none"} 
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={glowStyle}
    />
  );
}

// ─── SVG Component ────────────────────────────────────────────────────────────

function LegSvg({ leg, images, onHover }: { leg: "right" | "left"; images: DopplerSlotImage[]; onHover: (id: string | null, e?: React.MouseEvent) => void }) {
  return (
    <svg viewBox="0 0 280 600" className="w-full h-auto max-w-[280px] mx-auto" aria-label={`${leg} leg venous diagram`}>
      {/* Background Leg Silhouette */}
      <path 
        d="M 90 40 Q 140 10, 190 40 C 250 120, 230 420, 180 560 Q 140 590, 100 560 C 50 420, 30 120, 90 40 Z" 
        fill="#f8fafc" 
        stroke="#e2e8f0" 
        strokeWidth="2" 
      />

      {/* Faint distal deep system connection line */}
      <path d="M 100 440 L 100 520" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />

      {/* Segments */}
      {SEGMENT_PATHS.map((r) => {
        const status = getSegmentStatus(r.id, leg, images);
        const { fill, stroke } = segmentColor(status);
        
        const pillW = 56;
        const pillH = 18;
        const rectX = r.side === "left" ? r.labelX - pillW : r.labelX;
        const rectY = r.labelY - pillH / 2;
        const textX = r.side === "left" ? r.labelX - pillW / 2 : r.labelX + pillW / 2;

        return (
          <g 
            key={r.id}
            onMouseMove={(e) => onHover(r.id, e)} 
            onMouseLeave={() => onHover(null)} 
            className="cursor-pointer transition-opacity hover:opacity-80"
          >
            {/* Leader line */}
            <path d={r.leaderD} fill="none" stroke="#cbd5e1" strokeWidth="1" />
            
            {/* Vessel rendering */}
            <VesselPath d={r.d} status={status} width={r.width} isDashed={r.isDashed} isHovered={false} />
            
            {/* Perforator endpoints (circles) */}
            {r.isDashed && (
              <>
                <circle cx={r.d.split(" ")[1]} cy={r.d.split(" ")[2]} r="2.5" fill={stroke} />
                <circle cx={r.d.split(" ")[4]} cy={r.d.split(" ")[5]} r="2.5" fill={stroke} />
              </>
            )}

            {/* Label Pill */}
            <rect x={rectX} y={rectY} width={pillW} height={pillH} rx="5" fill={fill} stroke={stroke} strokeWidth="1" />
            <text 
              x={textX} 
              y={r.labelY + 3.5} 
              fontSize="9" 
              textAnchor="middle" 
              fill={fill === "#1a6b5c" || fill === "#f59e0b" ? "#fff" : "#475569"} 
              fontWeight="bold" 
              pointerEvents="none"
              letterSpacing="0.5"
            >
              {SEGMENT_META[r.id].label}
            </text>
          </g>
        );
      })}

      {/* Junction Dots */}
      <circle cx="100" cy="90" r="4" fill={getJunctionColor("cfv", "sfj", leg, images)} />
      <circle cx="100" cy="380" r="4" fill={getJunctionColor("popliteal", "spj", leg, images)} />
      <circle cx="160" cy="140" r="3" fill={getJunctionColor("gsv_prox_thigh", "aasv", leg, images)} />
    </svg>
  );
}

// ─── Coverage percentage badge ─────────────────────────────────────────────────

function CoverageBadge({ leg, images }: { leg: "right" | "left"; images: DopplerSlotImage[] }) {
  const documented = ALL_SEGMENT_IDS.filter((id) => {
    const s = getSegmentStatus(id, leg, images);
    return s.hasImage || s.hasData;
  }).length;
  const pct = Math.round((documented / ALL_SEGMENT_IDS.length) * 100);
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${
      pct >= 80 ? "bg-teal-50 border-teal-300 text-teal-800" :
      pct >= 50 ? "bg-amber-50 border-amber-300 text-amber-800" :
                  "bg-slate-100 border-slate-300 text-slate-600"
    }`}>
      {leg === "right" ? "Right" : "Left"} Leg: {documented}/{ALL_SEGMENT_IDS.length} segments ({pct}%)
    </div>
  );
}

// ─── Findings table ────────────────────────────────────────────────────────────

function FindingsTable({ leg, images }: { leg: "right" | "left"; images: DopplerSlotImage[] }) {
  const rows = ALL_SEGMENT_IDS.map((id) => {
    const legImgs = images.filter((i) => i.leg === leg && i.segment === id && i.view !== "quick_upload");
    if (!legImgs.length) return null;
    const merged = legImgs.reduce((acc, cur) => ({ ...acc, ...cur }), {} as DopplerSlotImage);
    return { id, label: SEGMENT_META[id]?.fullName || id, ...merged };
  }).filter(Boolean) as any[];

  if (!rows.length) return (
    <p className="text-xs text-slate-400 italic py-2">No clinical data recorded for this leg.</p>
  );

  return (
    <table className="w-full text-xs text-slate-700 border-collapse">
      <thead>
        <tr className="bg-slate-100">
          <th className="py-2 px-3 text-left font-semibold border-b border-slate-200">Segment</th>
          <th className="py-2 px-3 text-center font-semibold border-b border-slate-200">Diameter (mm)</th>
          <th className="py-2 px-3 text-center font-semibold border-b border-slate-200">Reflux (ms)</th>
          <th className="py-2 px-3 text-center font-semibold border-b border-slate-200">Reflux +ve</th>
          <th className="py-2 px-3 text-center font-semibold border-b border-slate-200">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const status = getSegmentStatus(row.id, leg, images);
          return (
            <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="py-1.5 px-3 font-medium">{row.label}</td>
              <td className="py-1.5 px-3 text-center">{row.diameterMm != null ? `${row.diameterMm}` : "—"}</td>
              <td className="py-1.5 px-3 text-center">{row.refluxMs != null ? `${row.refluxMs}` : "—"}</td>
              <td className="py-1.5 px-3 text-center">
                {row.refluxPositive !== undefined ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    row.refluxPositive ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                  }`}>
                    {row.refluxPositive ? "Yes" : "No"}
                  </span>
                ) : "—"}
              </td>
              <td className="py-1.5 px-3 text-center">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.hasImage && status.hasData ? "bg-teal-100 text-teal-700" :
                  status.hasImage ? "bg-amber-100 text-amber-700" :
                  status.hasData ? "bg-slate-100 text-slate-600" : "bg-gray-100 text-gray-400"
                }`}>
                  {status.hasImage && status.hasData ? "Complete" :
                   status.hasImage ? "Image only" :
                   status.hasData ? "Data only" : "—"}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface VenousDiagramProps {
  images: DopplerSlotImage[];
}

export function VenousDiagram({ images }: VenousDiagramProps) {
  const [hovered, setHovered] = useState<{ id: string, leg: "right"|"left", x: number, y: number } | null>(null);

  return (
    <div className="space-y-8 relative">
      <h3 className="text-xl font-bold text-[#1a6b5c] text-center">
        Doppler Documentation Coverage
      </h3>

      {/* Hover Tooltip Portal */}
      {hovered && (
        <div 
          className="fixed z-50 bg-slate-900 text-white p-3 rounded-md shadow-2xl text-xs space-y-1.5 pointer-events-none w-56 transform -translate-x-1/2 -translate-y-[120%]"
          style={{ top: hovered.y, left: hovered.x }}
        >
          <p className="font-bold text-sm text-teal-400 mb-2 border-b border-slate-700 pb-1">
            {SEGMENT_META[hovered.id].fullName}
          </p>
          
          {(() => {
            const data = getTooltipData(hovered.id, hovered.leg, images);
            if (!data) return <p className="text-slate-400 italic">No clinical data or images recorded.</p>;
            
            return (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Diameter:</span>
                  <span className="font-medium">{data.diameterMm !== undefined ? `${data.diameterMm} mm` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reflux:</span>
                  <span className="font-medium">{data.refluxMs !== undefined ? `${data.refluxMs} ms` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Compressible:</span>
                  <span className="font-medium">{data.compressible !== undefined ? (data.compressible ? "Yes" : "No") : "—"}</span>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-700">
                  <span className="text-slate-400">Image Upload:</span>
                  <span className={`font-bold ${data.previewUrl || data.file || data.filePath ? "text-green-400" : "text-amber-400"}`}>
                    {data.previewUrl || data.file || data.filePath ? "Uploaded ✓" : "Missing ✗"}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Diagrams */}
      <div className="grid grid-cols-2 gap-12 max-w-3xl mx-auto">
        {(["right", "left"] as const).map((leg) => (
          <div key={leg} className="flex flex-col items-center space-y-4">
            <h4 className="font-bold text-lg text-slate-800 capitalize">{leg} Leg Anatomy</h4>
            <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-100 w-full flex justify-center">
              <LegSvg 
                leg={leg} 
                images={images} 
                onHover={(id, e) => {
                  if (id && e) setHovered({ id, leg, x: e.clientX, y: e.clientY });
                  else setHovered(null);
                }} 
              />
            </div>
            <CoverageBadge leg={leg} images={images} />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 py-4 border-t border-b border-slate-200 bg-slate-50 rounded-lg mt-6">
        {[
          { fill: "#1a6b5c", stroke: "#1a6b5c", label: "Image + Data complete" },
          { fill: "#ffffff", stroke: "#1a6b5c", label: "Data only (no image)" },
          { fill: "#f59e0b", stroke: "#f59e0b", label: "Image only (data missing)" },
          { fill: "#e2e8f0", stroke: "#cbd5e1", label: "Not documented" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <rect x="2" y="2" width="16" height="16" rx="4" fill={item.fill} stroke={item.stroke} strokeWidth="2.5" />
            </svg>
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Findings tables */}
      <div className="grid md:grid-cols-2 gap-8 mt-8">
        {(["right", "left"] as const).map((leg) => (
          <div key={leg} className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="bg-slate-800 px-4 py-2">
              <h4 className="text-sm font-bold text-white capitalize">
                {leg} Leg — Doppler Findings
              </h4>
            </div>
            <div className="overflow-x-auto">
              <FindingsTable leg={leg} images={images} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
