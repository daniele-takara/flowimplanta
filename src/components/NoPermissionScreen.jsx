import { ShieldOff } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function NoPermissionScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldOff className="w-7 h-7 text-red-500" />
        </div>

        <h1 className="text-xl font-bold text-slate-800 mb-2">
          Sem permissão de acesso
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          O administrador precisa liberar suas permissões para que você possa acessar o sistema.
        </p>

        <button
          onClick={() => base44.auth.logout("/login")}
          className="text-sm text-slate-400 hover:text-slate-600 underline transition-colors"
        >
          Sair
        </button>
      </div>
    </div>
  );
}