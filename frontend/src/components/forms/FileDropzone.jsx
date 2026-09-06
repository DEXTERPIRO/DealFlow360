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
      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-pop-violet bg-violet-50/80 shadow-pop'
          : 'border-slate-900 hover:border-slate-900 bg-white hover:bg-amber-50/60 shadow-pop-sm hover:shadow-pop'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2.5">
        <div className="w-12 h-12 rounded-2xl bg-pop-amber text-slate-900 border-2 border-slate-900 shadow-pop-xs flex items-center justify-center">
          <UploadCloud className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-heading font-extrabold text-slate-900">
            {uploading
              ? 'Processing & optimizing media...'
              : isDragActive
              ? 'Drop files here to upload'
              : 'Drag & drop pitch decks, teasers, or product media'}
          </p>
          <p className="text-[10px] text-slate-600 font-mono font-bold mt-1">
            Supports PNG, JPG, WebP, PDF (up to 10MB)
          </p>
        </div>
      </div>
    </div>
  );
};
