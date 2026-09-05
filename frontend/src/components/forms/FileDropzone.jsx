import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../api/axiosClient';
import toast from 'react-hot-toast';

export const FileDropzone = ({ dealId, onUploadSuccess, type = 'products' }) => {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (!acceptedFiles.length) return;
      const file = acceptedFiles[0];

      const formData = new FormData();
      formData.append('file', file);
      if (dealId) {
        formData.append('dealId', dealId);
      }

      setUploading(true);
      try {
        const endpoint = type === 'logos' ? '/uploads/logos' : '/uploads/products';
        const res = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        toast.success(`Uploaded ${file.name} successfully!`);
        if (onUploadSuccess) {
          onUploadSuccess(res.data.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'File upload failed');
      } finally {
        setUploading(false);
      }
    },
    [dealId, onUploadSuccess, type]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-brand-400">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-300">
            {uploading
              ? 'Processing & optimizing media...'
              : isDragActive
              ? 'Drop files here to upload'
              : 'Drag & drop pitch decks, teasers, or logos'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Supports PNG, JPG, WebP, PDF (up to 10MB)</p>
        </div>
      </div>
    </div>
  );
};
