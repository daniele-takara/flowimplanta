import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { SCHEDULE_TEMPLATE } from "@/lib/mockData";
import { ArrowLeft, Save, Hash, AlertCircle } from "lucide-react";

export default function NewProject() {
  const navigate = useNavigate();
  const [dealId, setDealId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    const trimmed = dealId.trim();
    if (!trimmed) {
      setError("Informe o ID Deal Pipedrive para criar o projeto.");
      return;
    }
    const numId = Number(trimmed);
    if (isNaN(numId) || numId <= 0) {
      setError("ID Deal Pipedrive deve ser um número válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const project = await base44.entities.Project.create({
        name: `Projeto #${numId}`,
        client_name: "—",
        pipedrive_deal_id: numId,
        status: "Planejamento",
        current_phase: "Abertura de projeto",
        progress_percent: 0,
      });

      // Criar fases do cronograma
      const phases = SCHEDULE_TEMPLATE.map((p, i) => ({
        project_id: project.id,
        phase_name: p.phase_name,
        progress_percent: 0,
        status: "Não iniciado",
        order: i + 1,
      }));
      await base44.entities.SchedulePhase.bulkCreate(phases);

      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e.message || "Erro ao criar projeto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/projects" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Novo Projeto</h1>
          <p className="text-slate-400 text-sm">O projeto é criado a partir de um deal no Pipedrive</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl mb-6">
          <Hash className="w-6 h-6 text-orange-600" />
        </div>

        <h2 className="text-lg font-semibold text-slate-800 mb-1">ID Deal Pipedrive</h2>
        <p className="text-sm text-slate-400 mb-6">
          Informe o ID do deal no Pipedrive. Após criar, clique em <strong>"Atualizar dados do Pipedrive"</strong> dentro do projeto para importar todos os dados automaticamente.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            ID Deal Pipedrive <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            placeholder="Ex: 12960"
            value={dealId}
            onChange={e => { setDealId(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/projects")}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dealId.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            {saving ? "Criando projeto..." : "Criar Projeto"}
          </button>
        </div>

        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600 mb-1">O que acontece depois:</p>
          <p>1. Projeto criado com o ID do deal vinculado</p>
          <p>2. Dentro do projeto, clique <strong>"Atualizar dados do Pipedrive"</strong></p>
          <p>3. Nome, cliente, responsáveis e campos customizados são importados automaticamente</p>
        </div>
      </div>
    </div>
  );
}