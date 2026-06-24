import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, Copy, Loader2, Plus, ExternalLink, MessageSquare, ChevronRight, Clock } from "lucide-react";

const COLUMNS = [
  { key: "pendente", label: "Pendente", color: "bg-slate-100 border-slate-300", badge: "bg-slate-200 text-slate-700" },
  { key: "em_revisao", label: "Em Revisão", color: "bg-amber-50 border-amber-300", badge: "bg-amber-200 text-amber-700" },
  { key: "validado", label: "Validado", color: "bg-blue-50 border-blue-300", badge: "bg-blue-200 text-blue-700" },
  { key: "concluido", label: "Concluído", color: "bg-green-50 border-green-300", badge: "bg-green-200 text-green-700" },
];

const STATUS_LABELS = {
  pendente: "Pendente",
  em_revisao: "Em Revisão",
  validado: "Validado",
  concluido: "Concluído",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Card({ rule, onStatusChange, onOpenDetail }) {
  const [updating, setUpdating] = useState(false);

  const moveTo = async (newStatus) => {
    setUpdating(true);
    try {
      await base44.functions.invoke("updateStandaloneStatus", { id: rule.id, status: newStatus });
      onStatusChange(rule.id, newStatus);
    } catch (e) {
      alert("Erro ao atualizar status");
    }
    setUpdating(false);
  };

  const nextStatus = (current) => {
    const idx = COLUMNS.findIndex(c => c.key === current);
    return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  };

  const prevStatus = (current) => {
    const idx = COLUMNS.findIndex(c => c.key === current);
    return idx > 0 ? COLUMNS[idx - 1].key : null;
  };

  const link = `${window.location.origin}/calculo/${rule.token}`;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{rule.client_name || "Sem nome"}</p>
          <p className="text-xs text-slate-500 truncate">{rule.client_email || "Sem e-mail"}</p>
        </div>
        <button
          onClick={() => onOpenDetail(rule)}
          className="text-slate-300 hover:text-blue-500 shrink-0 ml-2"
          title="Ver detalhes"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Clock className="w-3 h-3" />
        <span>{rule.created_date ? formatDate(rule.created_date) : ""}</span>
      </div>

      {rule.reviewed_by && (
        <p className="text-xs text-slate-400 mb-2">Revisado por: {rule.reviewed_by}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {prevStatus(rule.status) && (
          <button
            onClick={() => moveTo(prevStatus(rule.status))}
            disabled={updating}
            className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30"
          >
            ◀
          </button>
        )}
        {nextStatus(rule.status) && (
          <button
            onClick={() => moveTo(nextStatus(rule.status))}
            disabled={updating}
            className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30"
          >
            ▶
          </button>
        )}
        <button
          onClick={() => { navigator.clipboard.writeText(link); alert("Link copiado!"); }}
          className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-purple-300 hover:bg-purple-50"
          title="Copiar link do cliente"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function DetailModal({ rule, onClose, onRefresh }) {
  const [notes, setNotes] = useState(rule.reviewer_notes || "");
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("updateStandaloneStatus", { id: rule.id, status: rule.status, reviewer_notes: notes });
      onRefresh();
    } catch (e) {
      alert("Erro ao salvar anotações");
    }
    setSaving(false);
  };

  const link = `${window.location.origin}/calculo/${rule.token}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">{rule.client_name || "Sem nome"}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>

          <div className="space-y-3 text-sm mb-6">
            <div>
              <span className="text-slate-400">E-mail:</span>
              <span className="ml-2 font-medium text-slate-700">{rule.client_email || "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Status:</span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${COLUMNS.find(c => c.key === rule.status)?.badge}`}>
                {STATUS_LABELS[rule.status]}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Criado em:</span>
              <span className="ml-2 font-medium text-slate-700">{formatDate(rule.created_date)}</span>
            </div>
            {rule.reviewed_by && (
              <div>
                <span className="text-slate-400">Revisado por:</span>
                <span className="ml-2 font-medium text-slate-700">{rule.reviewed_by}</span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Anotações do revisor</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-24"
              placeholder="Anotações sobre esta submissão..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar anotações"}
            </button>
          </div>

          <div className="border-t pt-4 flex items-center gap-2">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir link do cliente
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(link); alert("Link copiado!"); }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalcRulesKanban() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [newLink, setNewLink] = useState("");

  const load = async () => {
    try {
      const list = await base44.entities.StandaloneCalcRule.list("-created_date", 100);
      setRules(list || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = (id, newStatus) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    setNewLink("");
    try {
      const res = await base44.functions.invoke("createStandaloneToken", {});
      const token = res.data?.token;
      if (token) setNewLink(`${window.location.origin}/calculo/${token}`);
    } catch (e) {
      alert("Erro ao gerar link");
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Regras de Cálculo — Kanban</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie as submissões de regras de cálculo dos clientes</p>
        </div>
        <button
          onClick={handleGenerateLink}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Novo Link
        </button>
      </div>

      {newLink && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
          <Link className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800 font-medium truncate flex-1">{newLink}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(newLink); alert("Link copiado!"); }}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg border border-green-300 bg-white text-green-700 hover:bg-green-50"
          >
            <Copy className="w-3 h-3" /> Copiar
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const items = rules.filter(r => r.status === col.key);
          return (
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-3 min-h-[300px]`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8 italic">Nenhuma submissão</p>
                )}
                {items.map(rule => (
                  <Card
                    key={rule.id}
                    rule={rule}
                    onStatusChange={handleStatusChange}
                    onOpenDetail={setSelectedRule}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedRule && (
        <DetailModal
          rule={selectedRule}
          onClose={() => setSelectedRule(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}