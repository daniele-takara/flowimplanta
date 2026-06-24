import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Copy, ExternalLink, ChevronRight, Clock, Search, User, Hash, AlertTriangle } from "lucide-react";

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

function Card({ rule, onStatusChange, onOpenDetail, implantacaoUsers, loadingUsers, onSaveEmpresaId, onSaveImplantacao }) {
  const [updating, setUpdating] = useState(false);
  const [localEmpresaId, setLocalEmpresaId] = useState(rule.empresa_id || "");
  const [localImplantacaoId, setLocalImplantacaoId] = useState(rule.implantacao_user_id || "");
  const [validationMsg, setValidationMsg] = useState("");
  const [savingField, setSavingField] = useState(null);

  const nextStatus = (current) => {
    const idx = COLUMNS.findIndex(c => c.key === current);
    return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  };

  const prevStatus = (current) => {
    const idx = COLUMNS.findIndex(c => c.key === current);
    return idx > 0 ? COLUMNS[idx - 1].key : null;
  };

  const canAdvance = () => {
    const eid = localEmpresaId.trim();
    const uid = localImplantacaoId;
    return eid && uid;
  };

  const moveTo = async (newStatus) => {
    const idxCurrent = COLUMNS.findIndex(c => c.key === rule.status);
    const idxTarget = COLUMNS.findIndex(c => c.key === newStatus);

    if (idxTarget > idxCurrent) {
      // Avançando — validar
      if (!canAdvance()) {
        setValidationMsg("Preencha o ID do cliente e selecione o usuário de implantação antes de avançar.");
        return;
      }
    }

    setUpdating(true);
    setValidationMsg("");
    try {
      await base44.functions.invoke("updateStandaloneStatus", {
        id: rule.id,
        status: newStatus,
        empresa_id: localEmpresaId.trim(),
        implantacao_user_id: localImplantacaoId,
        implantacao_user_name: implantacaoUsers.find(u => u.id === localImplantacaoId)?.full_name || "",
      });
      onStatusChange(rule.id, newStatus);
    } catch (e) {
      const msg = e?.response?.data?.error || "Erro ao atualizar status";
      setValidationMsg(msg);
    }
    setUpdating(false);
  };

  const handleEmpresaBlur = async () => {
    if (localEmpresaId.trim() === (rule.empresa_id || "")) return;
    setSavingField("empresa_id");
    try {
      await base44.entities.StandaloneCalcRule.update(rule.id, { empresa_id: localEmpresaId.trim() });
      onSaveEmpresaId(rule.id, localEmpresaId.trim());
    } catch (e) { /* silently ignore */ }
    setSavingField(null);
  };

  const handleImplantacaoChange = async (e) => {
    const val = e.target.value;
    setLocalImplantacaoId(val);
    setSavingField("implantacao");
    const selectedUser = implantacaoUsers.find(u => u.id === val);
    try {
      await base44.entities.StandaloneCalcRule.update(rule.id, {
        implantacao_user_id: val || null,
        implantacao_user_name: selectedUser?.full_name || "",
      });
      onSaveImplantacao(rule.id, val, selectedUser?.full_name || "");
    } catch (e) { /* silently ignore */ }
    setSavingField(null);
  };

  const link = `${window.location.origin}/calculo`;

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

      {/* ID do Cliente */}
      <div className="mb-2">
        <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
          <Hash className="w-3 h-3" /> ID do Cliente
        </label>
        <div className="relative">
          <input
            value={localEmpresaId}
            onChange={e => setLocalEmpresaId(e.target.value)}
            onBlur={handleEmpresaBlur}
            placeholder="Ex: ABC123"
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          {savingField === "empresa_id" && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></span>
          )}
        </div>
        <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
          ID = valor entre <strong>lar21@</strong> e <strong>.com</strong> no e-mail
        </p>
      </div>

      {/* Usuário de Implantação */}
      <div className="mb-2">
        <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
          <User className="w-3 h-3" /> Usuário Implantação
        </label>
        <div className="relative">
          <select
            value={localImplantacaoId}
            onChange={handleImplantacaoChange}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          >
            <option value="">Selecionar...</option>
            {loadingUsers ? (
              <option disabled>Carregando...</option>
            ) : (
              implantacaoUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))
            )}
          </select>
          {savingField === "implantacao" && (
            <span className="absolute right-6 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></span>
          )}
        </div>
      </div>

      {/* Mensagem de validação */}
      {validationMsg && (
        <div className="mb-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{validationMsg}</span>
        </div>
      )}

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

  const link = `${window.location.origin}/calculo`;

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
              <span className="text-slate-400">ID do Cliente:</span>
              <span className="ml-2 font-medium text-slate-700">{rule.empresa_id || "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Usuário Implantação:</span>
              <span className="ml-2 font-medium text-slate-700">{rule.implantacao_user_name || "—"}</span>
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
  const [search, setSearch] = useState("");
  const [implantacaoUsers, setImplantacaoUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const fixedLink = `${window.location.origin}/calculo`;

  const load = useCallback(async () => {
    try {
      const list = await base44.entities.StandaloneCalcRule.list("-created_date", 100);
      setRules(list || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getImplantacaoUsers");
      setImplantacaoUsers(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => { load(); loadUsers(); }, [load, loadUsers]);

  const handleStatusChange = (id, newStatus) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const handleSaveEmpresaId = (id, empresaId) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, empresa_id: empresaId } : r));
  };

  const handleSaveImplantacao = (id, userId, userName) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, implantacao_user_id: userId, implantacao_user_name: userName } : r));
  };

  const filteredRules = search.trim()
    ? rules.filter(r => {
        const q = search.toLowerCase();
        return (
          (r.client_name || "").toLowerCase().includes(q) ||
          (r.client_email || "").toLowerCase().includes(q) ||
          (r.empresa_id || "").toLowerCase().includes(q)
        );
      })
    : rules;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kanban Regras de Cálculo Morfeu</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie as submissões de regras de cálculo dos clientes</p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(fixedLink); alert("Link copiado!"); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copiar Link
        </button>
      </div>

      {/* Campo de busca */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar por nome da empresa, e-mail ou ID do cliente..."
          className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const items = filteredRules.filter(r => r.status === col.key);
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
                    implantacaoUsers={implantacaoUsers}
                    loadingUsers={loadingUsers}
                    onSaveEmpresaId={handleSaveEmpresaId}
                    onSaveImplantacao={handleSaveImplantacao}
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