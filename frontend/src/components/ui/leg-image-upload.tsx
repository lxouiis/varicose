import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X } from 'lucide-react';

export type ViewType = 'front' | 'medial' | 'lateral' | 'posterior';

export interface LegPhoto {
  view_type: ViewType;
  file: File;
  url: string;
}

const VIEW_LABELS: { view_type: ViewType; label: string }[] = [
  { view_type: 'front',     label: 'Front / Anterior' },
  { view_type: 'medial',    label: 'Medial' },
  { view_type: 'lateral',   label: 'Lateral' },
  { view_type: 'posterior',  label: 'Posterior' },
];

interface SingleSlotProps {
  label: string;
  photo: LegPhoto | null;
  onAdd: (file: File) => void;
  onRemove: () => void;
}

function SingleSlot({ label, photo, onAdd, onRemove }: SingleSlotProps) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) onAdd(accepted[0]);
  }, [onAdd]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false,
  });

  if (photo) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-slate-300">
        <img src={photo.url} alt={label} className="w-full h-36 object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
          <span className="text-xs font-semibold text-white">{label}</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed h-36 cursor-pointer transition-colors ${
        isDragActive
          ? 'border-[#1a6b5c] bg-[#1a6b5c]/5'
          : 'border-slate-300 hover:border-[#1a6b5c] hover:bg-slate-50'
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-6 w-6 text-slate-400 mb-1.5" />
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <span className="text-[10px] text-slate-400 mt-0.5">Click or drop</span>
    </div>
  );
}

interface LegImageUploadProps {
  leg: 'Right' | 'Left';
  photos: LegPhoto[];
  onChange: (photos: LegPhoto[]) => void;
}

export function LegImageUpload({ leg, photos, onChange }: LegImageUploadProps) {
  const getPhoto = (vt: ViewType) => photos.find(p => p.view_type === vt) ?? null;

  const handleAdd = (vt: ViewType, file: File) => {
    const existing = photos.find(p => p.view_type === vt);
    if (existing) URL.revokeObjectURL(existing.url);
    const next = photos.filter(p => p.view_type !== vt);
    next.push({ view_type: vt, file, url: URL.createObjectURL(file) });
    onChange(next);
  };

  const handleRemove = (vt: ViewType) => {
    const existing = photos.find(p => p.view_type === vt);
    if (existing) URL.revokeObjectURL(existing.url);
    onChange(photos.filter(p => p.view_type !== vt));
  };

  return (
    <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg border">
      <h4 className="font-semibold text-sm text-slate-800 border-b pb-2">{leg} Leg — Clinical Photos</h4>
      <div className="grid grid-cols-2 gap-3">
        {VIEW_LABELS.map(({ view_type, label }) => (
          <SingleSlot
            key={view_type}
            label={label}
            photo={getPhoto(view_type)}
            onAdd={(file) => handleAdd(view_type, file)}
            onRemove={() => handleRemove(view_type)}
          />
        ))}
      </div>
    </div>
  );
}
