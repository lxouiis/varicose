import { useState, useRef } from "react";
import { Upload, X, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DopplerSlotImage {
  leg: "right" | "left";
  phase: "deep" | "sfj_gsv" | "spj_ssv" | "accessory";
  segment: string;
  view: string;
  filePath?: string;
  fileName: string;
  previewUrl: string;
  file?: File;
  // Clinical data
  compressible?: boolean;
  spontaneous?: boolean;
  refluxMs?: number;
  refluxPositive?: boolean;
  diameterMm?: number;
  outwardFlow350?: boolean;
}

// ─── Phase definitions ────────────────────────────────────────────────────────

interface SlotDef {
  segment: string;
  view: string;
  label: string;
  dataType: "deep" | "gsv" | "ssv_accessory" | "perforator";
}

const PHASES: {
  id: "deep" | "sfj_gsv" | "spj_ssv" | "accessory";
  title: string;
  subtitle: string;
  slots: SlotDef[];
}[] = [
  {
    id: "deep",
    title: "Phase 1 — Deep System (DVT Exclusion)",
    subtitle: "Compression and flow assessment of deep venous system",
    slots: [
      { segment: "cfv", view: "transverse_compression", label: "CFV Transverse Compression", dataType: "deep" },
      { segment: "femoral_prox", view: "compression", label: "Femoral Vein Proximal Compression", dataType: "deep" },
      { segment: "femoral_mid", view: "compression", label: "Femoral Vein Mid Compression", dataType: "deep" },
      { segment: "femoral_dist", view: "compression", label: "Femoral Vein Distal Compression", dataType: "deep" },
      { segment: "popliteal", view: "compression", label: "Popliteal Vein Compression", dataType: "deep" },
      { segment: "cfv", view: "longitudinal_flow", label: "CFV Longitudinal Flow (color + spectral)", dataType: "deep" },
      { segment: "popliteal", view: "longitudinal_flow", label: "Popliteal Longitudinal Flow", dataType: "deep" },
    ],
  },
  {
    id: "sfj_gsv",
    title: "Phase 2 — SFJ & GSV",
    subtitle: "Saphenofemoral junction and great saphenous vein",
    slots: [
      { segment: "sfj", view: "anatomy_mickey", label: "SFJ Anatomy (Mickey Mouse view)", dataType: "gsv" },
      { segment: "sfj", view: "terminal_valve_spectral", label: "SFJ Terminal Valve Spectral Doppler", dataType: "gsv" },
      { segment: "gsv_prox_thigh", view: "diameter", label: "GSV Proximal Thigh Diameter", dataType: "gsv" },
      { segment: "gsv_mid_thigh", view: "diameter", label: "GSV Mid Thigh Diameter", dataType: "gsv" },
      { segment: "gsv_knee", view: "diameter", label: "GSV Knee Diameter", dataType: "gsv" },
      { segment: "gsv_mid_calf", view: "diameter", label: "GSV Mid Calf Diameter", dataType: "gsv" },
      { segment: "gsv_mid_thigh", view: "reflux", label: "GSV Reflux Mid Thigh", dataType: "gsv" },
      { segment: "gsv_knee", view: "reflux", label: "GSV Reflux Knee", dataType: "gsv" },
    ],
  },
  {
    id: "spj_ssv",
    title: "Phase 3 — SPJ & SSV",
    subtitle: "Saphenopopliteal junction and small saphenous vein",
    slots: [
      { segment: "spj", view: "anatomy_transverse", label: "SPJ Anatomy Transverse", dataType: "ssv_accessory" },
      { segment: "spj", view: "competence_spectral", label: "SPJ Competence Spectral Doppler", dataType: "ssv_accessory" },
      { segment: "ssv_prox_calf", view: "diameter", label: "SSV Proximal Calf Diameter", dataType: "ssv_accessory" },
      { segment: "ssv_mid_calf", view: "diameter", label: "SSV Mid Calf Diameter", dataType: "ssv_accessory" },
    ],
  },
  {
    id: "accessory",
    title: "Phase 4 — Accessory Veins & Perforators",
    subtitle: "AASV and incompetent perforating veins",
    slots: [
      { segment: "aasv", view: "diameter_reflux", label: "AASV Diameter + Reflux", dataType: "perforator" },
      { segment: "ipv_medial_calf", view: "compression", label: "IPV Medial Calf", dataType: "perforator" },
      { segment: "ipv_medial_thigh", view: "compression", label: "IPV Medial Thigh", dataType: "perforator" },
    ],
  },
];

// ─── Helper: generate filename ────────────────────────────────────────────────

function genFileName(leg: string, phase: string, segment: string, view: string, ext: string): string {
  return `${leg}_${phase}_${segment}_${view}.${ext}`;
}

// ─── Toggle button ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, trueLabel = "Yes", falseLabel = "No" }: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
          value === true ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-500 border-slate-200 hover:border-teal-400"
        }`}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
          value === false ? "bg-red-500 text-white border-red-500" : "bg-white text-slate-500 border-slate-200 hover:border-red-300"
        }`}
      >
        {falseLabel}
      </button>
    </div>
  );
}

// ─── Single upload slot ────────────────────────────────────────────────────────

function UploadSlot({
  leg,
  phase,
  slot,
  data,
  onChange,
}: {
  leg: "right" | "left";
  phase: "deep" | "sfj_gsv" | "spj_ssv" | "accessory";
  slot: SlotDef;
  data: DopplerSlotImage | undefined;
  onChange: (img: DopplerSlotImage | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = genFileName(leg, phase, slot.segment, slot.view, ext);
    const previewUrl = URL.createObjectURL(file);
    onChange({
      leg,
      phase,
      segment: slot.segment,
      view: slot.view,
      fileName,
      previewUrl,
      file,
    });
    e.target.value = "";
  };

  const updateField = (field: keyof DopplerSlotImage, value: any) => {
    const currentData = data || {
      leg,
      phase,
      segment: slot.segment,
      view: slot.view,
      fileName: "",
      previewUrl: "",
    };
    
    const updated: DopplerSlotImage = { ...currentData, [field]: value };
    // Auto-set refluxPositive when refluxMs > 500
    if (field === "refluxMs") {
      updated.refluxPositive = (value as number) > 500;
    }
    onChange(updated);
  };

  return (
    <div className="border rounded-lg bg-white p-3 space-y-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden min-w-0">
      <p className="text-xs font-semibold text-slate-700 leading-tight truncate">{slot.label}</p>

      {/* Upload area */}
      {!data ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center gap-1 py-3 border-2 border-dashed border-slate-200 rounded-md hover:border-teal-400 hover:bg-teal-50 transition-colors"
        >
          <Upload className="h-4 w-4 text-slate-400" />
          <span className="text-[10px] text-slate-400">JPG / PNG / PDF / DCM</span>
        </button>
      ) : (
        <div className="relative">
          {data.previewUrl && (
            <img
              src={data.previewUrl}
              alt={slot.label}
              className="w-full h-20 object-cover rounded-md border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-500 truncate max-w-[80%]">{data.fileName}</span>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-red-400 hover:text-red-600 ml-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf,.dcm,.frm"
        className="hidden"
        onChange={handleFile}
      />

      {/* Clinical data inputs based on slot type */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        {slot.dataType === "deep" && (
          <>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Compressible</span>
              <div className="flex-1 min-w-0 flex justify-end">
                <Toggle value={data?.compressible} onChange={(v) => updateField("compressible", v)} />
              </div>
            </div>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Spontaneous Flow</span>
              <div className="flex-1 min-w-0 flex justify-end">
                <Toggle value={data?.spontaneous} onChange={(v) => updateField("spontaneous", v)} />
              </div>
            </div>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Reflux &gt;1000ms</span>
              <div className="flex-1 min-w-0 flex justify-end">
                <Toggle value={data?.refluxPositive} onChange={(v) => updateField("refluxPositive", v)} />
              </div>
            </div>
          </>
        )}

        {(slot.dataType === "gsv" || slot.dataType === "ssv_accessory") && (
          <>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Diameter (mm)</span>
              <input
                type="text"
                inputMode="decimal"
                value={data?.diameterMm ?? ""}
                onChange={(e) => updateField("diameterMm", parseFloat(e.target.value) || 0)}
                placeholder="—"
                className="flex-1 min-w-0 w-full max-w-full box-border h-6 text-xs border border-slate-200 rounded px-1.5 focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Reflux (ms)</span>
              <input
                type="text"
                inputMode="decimal"
                value={data?.refluxMs ?? ""}
                onChange={(e) => updateField("refluxMs", parseInt(e.target.value) || 0)}
                placeholder="—"
                className="flex-1 min-w-0 w-full max-w-full box-border h-6 text-xs border border-slate-200 rounded px-1.5 focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Reflux &gt;500ms</span>
              <div className="flex-1 min-w-0 flex justify-end">
                <span
                  className={`text-[10px] font-bold py-0.5 rounded text-center shrink-0 w-12 ${
                    data?.refluxMs === undefined || Number.isNaN(data?.refluxMs)
                      ? "bg-slate-100 text-slate-400"
                      : data.refluxMs > 500
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {data?.refluxMs !== undefined && !Number.isNaN(data?.refluxMs)
                    ? data.refluxMs > 500
                      ? "Yes"
                      : "No"
                    : "—"}
                </span>
              </div>
            </div>
          </>
        )}

        {slot.dataType === "perforator" && (
          <>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Diameter (mm)</span>
              <input
                type="text"
                inputMode="decimal"
                value={data?.diameterMm ?? ""}
                onChange={(e) => updateField("diameterMm", parseFloat(e.target.value) || 0)}
                placeholder="—"
                className="flex-1 min-w-0 w-full max-w-full box-border h-6 text-xs border border-slate-200 rounded px-1.5 focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] text-slate-500 w-[100px] shrink-0">Outward Flow &gt;350</span>
              <div className="flex-1 min-w-0 flex justify-end">
                <Toggle value={data?.outwardFlow350} onChange={(v) => updateField("outwardFlow350", v)} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quick Upload card ─────────────────────────────────────────────────────────

const VEIN_MAP: Record<string, string[]> = {
  Deep: ["CFV", "Femoral V", "Popliteal V", "ATV", "PTV", "Peroneal"],
  Superficial: ["GSV", "SSV", "SFJ", "SPJ", "AASV"],
};
const SEGMENT_MAP: Record<string, string[]> = {
  "Femoral V": ["Proximal", "Mid", "Distal"],
  "GSV": ["Proximal", "Mid", "Distal"],
  "SSV": ["Proximal Calf", "Mid", "Distal"],
};

function QuickUpload({ leg, onAdd }: { leg: "right" | "left"; onAdd: (img: DopplerSlotImage) => void }) {
  const [system, setSystem] = useState("");
  const [vein, setVein] = useState("");
  const [segment, setSegment] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const veins = system ? VEIN_MAP[system] || [] : [];
  const segments = vein ? SEGMENT_MAP[vein] || [] : [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vein) return;
    const ext = file.name.split(".").pop() || "jpg";
    const seg = segment || "main";
    const fileName = genFileName(leg, system.toLowerCase(), vein.toLowerCase().replace(/\s+/g, "_"), seg.toLowerCase().replace(/\s+/g, "_"), ext);
    const previewUrl = URL.createObjectURL(file);
    onAdd({
      leg,
      phase: "deep", // generic
      segment: vein.toLowerCase().replace(/\s+/g, "_") + (segment ? `_${segment.toLowerCase()}` : ""),
      view: "quick_upload",
      fileName,
      previewUrl,
      file,
    });
    setSystem(""); setVein(""); setSegment("");
    e.target.value = "";
  };

  const SELECT = "h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-teal-400";

  return (
    <div className="mt-4 p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50/60 space-y-3">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quick Upload — Additional Images</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className={SELECT} value={system} onChange={(e) => { setSystem(e.target.value); setVein(""); setSegment(""); }}>
          <option value="">System…</option>
          {Object.keys(VEIN_MAP).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={SELECT} value={vein} onChange={(e) => { setVein(e.target.value); setSegment(""); }} disabled={!system}>
          <option value="">Vein…</option>
          {veins.map((v) => <option key={v}>{v}</option>)}
        </select>
        {segments.length > 0 && (
          <select className={SELECT} value={segment} onChange={(e) => setSegment(e.target.value)} disabled={!vein}>
            <option value="">Segment…</option>
            {segments.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        <button
          type="button"
          disabled={!vein}
          onClick={() => inputRef.current?.click()}
          className="h-8 flex items-center justify-center gap-1 px-3 rounded border border-teal-600 bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="h-3 w-3" /> Upload
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf,.dcm,.frm" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Main DopplerUpload component ─────────────────────────────────────────────

interface DopplerUploadProps {
  images: DopplerSlotImage[];
  onChange: (images: DopplerSlotImage[]) => void;
}

export function DopplerUpload({ images, onChange }: DopplerUploadProps) {
  const [activeLeg, setActiveLeg] = useState<"right" | "left">("right");

  const getSlotKey = (leg: string, phase: string, segment: string, view: string) =>
    `${leg}__${phase}__${segment}__${view}`;

  const imageMap = new Map<string, DopplerSlotImage>();
  images.forEach((img) => {
    imageMap.set(getSlotKey(img.leg, img.phase, img.segment, img.view), img);
  });

  const handleSlotChange = (
    leg: "right" | "left",
    phase: "deep" | "sfj_gsv" | "spj_ssv" | "accessory",
    slot: SlotDef,
    img: DopplerSlotImage | undefined
  ) => {
    const key = getSlotKey(leg, phase, slot.segment, slot.view);
    const updated = images.filter(
      (i) => getSlotKey(i.leg, i.phase, i.segment, i.view) !== key
    );
    if (img) updated.push(img);
    onChange(updated);
  };

  const handleQuickAdd = (img: DopplerSlotImage) => {
    onChange([...images, img]);
  };

  const quickUploads = images.filter((i) => i.view === "quick_upload" && i.leg === activeLeg);

  return (
    <div className="space-y-4">
      {/* Leg Tabs */}
      <div className="flex gap-0 border border-slate-200 rounded-lg overflow-hidden w-fit">
        {(["right", "left"] as const).map((leg) => (
          <button
            key={leg}
            type="button"
            onClick={() => setActiveLeg(leg)}
            className={`px-6 py-2 text-sm font-semibold capitalize transition-colors ${
              activeLeg === leg
                ? "bg-[#1a6b5c] text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {leg} Leg
          </button>
        ))}
      </div>

      {/* Phase cards */}
      {PHASES.map((phase) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          leg={activeLeg}
          imageMap={imageMap}
          onSlotChange={(slot, img) => handleSlotChange(activeLeg, phase.id, slot, img)}
        />
      ))}

      {/* Quick Upload */}
      <QuickUpload leg={activeLeg} onAdd={handleQuickAdd} />

      {/* Quick upload gallery */}
      {quickUploads.length > 0 && (
        <div className="p-4 border rounded-lg bg-white space-y-2">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            {activeLeg.charAt(0).toUpperCase() + activeLeg.slice(1)} Leg — Quick Uploads ({quickUploads.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {quickUploads.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.previewUrl}
                  alt={img.fileName}
                  className="w-full h-16 object-cover rounded border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <p className="text-[9px] text-slate-500 truncate mt-0.5">{img.segment.replace(/_/g, " ")}</p>
                <button
                  type="button"
                  onClick={() => onChange(images.filter((i) => i !== img))}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phase card (collapsible) ─────────────────────────────────────────────────

function PhaseCard({
  phase,
  leg,
  imageMap,
  onSlotChange,
}: {
  phase: typeof PHASES[number];
  leg: "right" | "left";
  imageMap: Map<string, DopplerSlotImage>;
  onSlotChange: (slot: SlotDef, img: DopplerSlotImage | undefined) => void;
}) {
  const [open, setOpen] = useState(true);
  const uploaded = phase.slots.filter(
    (s) => imageMap.has(`${leg}__${phase.id}__${s.segment}__${s.view}`)
  ).length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-slate-800">{phase.title}</p>
          <p className="text-xs text-slate-500">{phase.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            uploaded === phase.slots.length ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-500"
          }`}>
            {uploaded}/{phase.slots.length} uploaded
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {phase.slots.map((slot) => {
            const key = `${leg}__${phase.id}__${slot.segment}__${slot.view}`;
            return (
              <UploadSlot
                key={key}
                leg={leg}
                phase={phase.id}
                slot={slot}
                data={imageMap.get(key)}
                onChange={(img) => onSlotChange(slot, img)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
