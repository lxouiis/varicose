import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X } from 'lucide-react';

export type UploadedImage = { url: string; file: File };

interface ImageUploadProps {
  title: string;
  files: UploadedImage[];
  onChange: (files: UploadedImage[]) => void;
}

export function ImageUpload({ title, files, onChange }: ImageUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));
    onChange([...files, ...newFiles]);
  }, [files, onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] }
  });

  const removeFile = (index: number) => {
    const newFiles = [...files];
    URL.revokeObjectURL(newFiles[index].url);
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-slate-800">{title}</h4>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-700">Drag & drop files here, or click to select</p>
        <p className="text-xs text-muted-foreground mt-1">Supports JPG and PNG</p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {files.map((f, i) => (
            <div key={i} className="relative group rounded-md overflow-hidden border">
              <img src={f.url} alt="upload" className="h-24 w-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
