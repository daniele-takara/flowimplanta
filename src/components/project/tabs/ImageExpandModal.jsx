import { X } from "lucide-react";

export default function ImageExpandModal({ src, alt, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-auto p-2" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 shadow text-lg font-bold transition-colors">&times;</button>
        <img src={src} alt={alt} className="max-w-full h-auto rounded-lg" />
        {alt && <p className="text-center text-sm text-slate-500 py-3 px-4">{alt}</p>}
      </div>
    </div>
  );
}