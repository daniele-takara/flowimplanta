import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Mail, Loader2 } from "lucide-react";

export default function ClientHome() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((user) => {
      setUserName(user?.full_name || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-purple-50 flex items-center justify-center">
          <ClipboardCheck className="w-7 h-7 text-purple-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          {userName ? `Olá, ${userName.split(" ")[0]}` : "Bem-vindo(a)"}
        </h1>

        <p className="text-slate-500 mb-6">
          Para preencher as regras de cálculo da sua empresa, acesse o link que foi enviado para o seu e-mail.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-left">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">
                Não recebeu o link?
              </p>
              <p className="text-sm text-amber-700">
                Entre em contato com o time de implantação pelo e-mail{" "}
                <strong>implantacao@pontotel.com.br</strong>
              </p>
            </div>
          </div>
        </div>

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