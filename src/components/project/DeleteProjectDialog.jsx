import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";

export default function DeleteProjectDialog({ project, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [permError, setPermError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setPermError(null);
    try {
      const res = await base44.functions.invoke("deleteProject", { project_id: project.id });
      if (res.data?.success) {
        onDeleted(project.id);
        onClose();
      } else {
        setPermError(res.data?.error || "Erro ao excluir projeto");
      }
    } catch (e) {
      setPermError(e.message || "Erro ao excluir projeto");
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-800">Excluir Projeto</h3>
            <p className="text-sm text-slate-500 mt-1">
              Tem certeza que deseja excluir o projeto{" "}
              <strong className="text-slate-700">"{project.name}"</strong>?
            </p>
            {project.pipedrive_deal_id && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                ⚠️ Este projeto foi importado do Pipedrive (deal #{project.pipedrive_deal_id}).
                A exclusão remove apenas o registro local — o deal no Pipedrive não é afetado.
              </div>
            )}
            {permError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-medium">{permError}</p>
              </div>
            )}
            <p className="text-xs text-red-500 mt-2 font-medium">Esta ação não pode ser desfeita.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={deleting}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
            {deleting ? "Excluindo..." : "Excluir Projeto"}
          </button>
        </div>
      </div>
    </div>
  );
}