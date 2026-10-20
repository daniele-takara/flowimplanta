import { useEffect } from "react";

export default function RedirectTo({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );
}