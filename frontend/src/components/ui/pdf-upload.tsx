import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, UploadCloud, X } from 'lucide-react';

export interface PdfFile {
  file: File;
  url: string;
  fileExtension: string; // e.g. 'pdf', 'frm', 'dcm'
}

interface PdfUploadProps {
  title: string;
  files: PdfFile[];
  onChange: (files: PdfFile[]) => void;
}

export function PdfUpload({ title, files, onChange }: PdfUploadProps) {
  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map(file => ({
      file,
      url: URL.createObjectURL(file),
      fileExtension: file.name.split('.').pop()?.toLowerCase() ?? '',
    }));
    onChange([...files, ...newFiles]);
  }, [files, onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/octet-stream': ['.frm', '.dcm'],
    },
  });

  const removeFile = (index: number) => {
    URL.revokeObjectURL(files[index].url);
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-slate-800">{title}</h4>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-[#1a6b5c] bg-[#1a6b5c]/5'
            : 'border-slate-300 hover:border-[#1a6b5c] hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-700">Drag & drop files here, or click to select</p>
        <p className="text-xs text-muted-foreground mt-1">Doppler Report (PDF, DICOM, or .frm format supported)</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 mt-3">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white group">
              <FileText className="h-8 w-8 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{f.file.name}</p>
                <p className="text-xs text-slate-400">{(f.file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
