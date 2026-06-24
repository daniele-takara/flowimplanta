import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Copy, ChevronRight, Clock, Search, User, Hash, AlertTriangle, FileDown, Loader2, Trash2, Undo2, ChevronDown, ChevronUp } from "lucide-react";
import { generateCalcRulesPDF } from "@/lib/calcRulesPdfExport";
import { uploadAndOpenPDF } from "@/lib/pdfDownload";
import { usePermissions } from "@/lib/usePermissions";

const COLUMNS = [
  { key: "preenchimento", label: "Preenchimento em andamento", color: "bg-purple-50 border-purple-300", badge: "bg-purple-200 text-purple-700" },
  { key: "pendente", label: "Pendente", color: "bg-slate-100 border-slate-300", badge: "bg-slate-200 text-slate-700" },
  { key: "em_revisao", label: "Em Parametrização", color: "bg-amber-50 border-amber-300", badge: "bg-amber-200 text-amber-700" },
  { key: "validado", label: "Pendente Info. Cliente", color: "bg-blue-50 border-blue-300", badge: "bg-blue-200 text-blue-700" },
  { key: "concluido", label: "Concluído", color: "bg-green-50 border-green-300", badge: "bg-green-200 text-green-700" },
];

const DELETED_COLUMN = { key: "excluido", label: "Excluídos", color: "bg-red-50/50 border-red-200 border-dashed", badge: "bg-red-200 text-red-700" };

const STATUS_LABELS = {
  preenchimento: "Preenchimento em andamento",
  pendente: "Pendente",
  em_revisao: "Em Parametrização",
  validado: "Pendente Info. Cliente",
  concluido: "Concluído",
  excluido: "Excluído",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Card({ rule, onStatusChange, onOpenDetail, implantacaoUsers, loadingUsers, onSaveEmpresaId, onSaveImplantacao, onDelete, onReactivate, canEdit, canDelete }) {
  const [updating, setUpdating] = useState(false);
  const [localEmpresaId, setLocalEmpresaId] = useState(rule.empresa_id || "");
  const [localImplantacaoId, setLocalImplantacaoId] = useState(rule.implantacao_user_id || "");
  const [validationMsg, setValidationMsg] = useState("");
  const [savingField, setSavingField] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await base44.functions.invoke("getCalcRuleForPdf", { id: rule.id });
      const data = res.data;
      const pdfBytes = await generateCalcRulesPDF({
        project: data.project,
        companyData: data.companyData,
        allStepData: data.allStepData,
      });
      await uploadAndOpenPDF(pdfBytes, `Regras_${(rule.client_name || "cliente").replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      alert("Erro ao gerar PDF. Tente novamente.");
    }
    setGeneratingPdf(false);
  };

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.StandaloneCalcRule.update(rule.id, {
        status: "excluido",
        deleted_at: new Date().toISOString(),
      });
      onDelete(rule.id);
    } catch (e) {
      alert("Erro ao excluir. Tente novamente.");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await base44.entities.StandaloneCalcRule.update(rule.id, {
        status: "pendente",
        deleted_at: null,
      });
      onReactivate(rule.id);
    } catch (e) {
      alert("Erro ao reativar. Tente novamente.");
    }
    setReactivating(false);
  };

  const isDeleted = rule.status === "excluido";
  const link = `${window.location.origin}/calculo`;

  return (
    <div className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow transition-shadow ${isDeleted ? "opacity-75" : ""}`}>
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
            disabled={!canEdit}
            placeholder="Ex: ABC123"
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
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
            disabled={!canEdit}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
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

      {isDeleted ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(canEdit || canDelete) && (
            <button
              onClick={handleReactivate}
              disabled={reactivating}
              className="text-xs px-2 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50 flex items-center gap-1"
              title="Reativar card"
            >
              {reactivating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
              Reativar
            </button>
          )}
          <span className="text-[10px] text-slate-400">
            Expira em {(() => {
              if (!rule.deleted_at) return "";
              const exp = new Date(rule.deleted_at);
              exp.setDate(exp.getDate() + 15);
              const dias = Math.max(0, Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24)));
              return `${dias}d`;
            })()}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          {canEdit && prevStatus(rule.status) && (
            <button
              onClick={() => moveTo(prevStatus(rule.status))}
              disabled={updating}
              className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30"
            >
              ◀
            </button>
          )}
          {canEdit && nextStatus(rule.status) && (
            <button
              onClick={() => moveTo(nextStatus(rule.status))}
              disabled={updating}
              className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-30"
            >
              ▶
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
              title="Baixar PDF das regras"
            >
              {generatingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => { navigator.clipboard.writeText(link); alert("Link copiado!"); }}
              className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-purple-300 hover:bg-purple-50"
              title="Copiar link do cliente"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          {(canEdit || canDelete) && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={updating}
              className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30"
              title="Excluir card"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-5 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-slate-700 mb-4">Tem certeza que deseja excluir este card? Ele ficará disponível para reativação por <strong>15 dias</strong>.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailModal({ rule, onClose, onRefresh, canEdit }) {
  const [notes, setNotes] = useState(rule.reviewer_notes || "");
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await base44.functions.invoke("getCalcRuleForPdf", { id: rule.id });
      const data = res.data;
      const pdfBytes = await generateCalcRulesPDF({
        project: data.project,
        companyData: data.companyData,
        allStepData: data.allStepData,
      });
      await uploadAndOpenPDF(pdfBytes, `Regras_${(rule.client_name || "cliente").replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      alert("Erro ao gerar PDF. Tente novamente.");
    }
    setGeneratingPdf(false);
  };

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
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${rule.status === "excluido" ? DELETED_COLUMN.badge : (COLUMNS.find(c => c.key === rule.status)?.badge)}`}>
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
              disabled={!canEdit}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-24 disabled:bg-slate-50 disabled:cursor-not-allowed"
              placeholder="Anotações sobre esta submissão..."
            />
            {canEdit && (
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar anotações"}
            </button>
            )}
          </div>

          {canEdit && (
          <div className="border-t pt-4 flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50"
            >
              {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {generatingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalcRulesKanban() {
  const { canEditKanban: canEdit, canDeleteKanbanCards: canDelete } = usePermissions();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState(null);
  const [search, setSearch] = useState("");
  const [implantacaoUsers, setImplantacaoUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deletedExpanded, setDeletedExpanded] = useState(false);
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

  const handleDelete = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: "excluido", deleted_at: new Date().toISOString() } : r));
  };

  const handleReactivate = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: "pendente", deleted_at: null } : r));
  };

  // Filter out cards deleted more than 15 days ago
  const activeRules = rules.filter(r => {
    if (r.status === "excluido" && r.deleted_at) {
      const exp = new Date(r.deleted_at);
      exp.setDate(exp.getDate() + 15);
      if (new Date() > exp) return false; // expired
    }
    return true;
  });

  const filteredRules = search.trim()
    ? activeRules.filter(r => {
        const q = search.toLowerCase();
        return (
          (r.client_name || "").toLowerCase().includes(q) ||
          (r.client_email || "").toLowerCase().includes(q) ||
          (r.empresa_id || "").toLowerCase().includes(q) ||
          (r.implantacao_user_name || "").toLowerCase().includes(q)
        );
      })
    : activeRules;

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
          placeholder="Pesquisar por nome da empresa, e-mail, ID do cliente ou usuário de implantação..."
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

      <div className="flex gap-4">
        <div className="grid grid-cols-5 gap-4 flex-1">
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
                    onDelete={handleDelete}
                    onReactivate={handleReactivate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                ))}
              </div>
            </div>
          );
        })}

        </div>

        {/* Excluídos — collapsed column */}
        <div className={`rounded-xl border-2 ${DELETED_COLUMN.color} min-h-[300px] transition-all duration-200 ${deletedExpanded ? "p-3 flex-1" : "w-10 cursor-pointer hover:bg-red-50 flex flex-col items-center justify-start pt-3"}`} onClick={() => !deletedExpanded && setDeletedExpanded(true)}>
          <div className="flex items-center justify-between mb-3">
            {deletedExpanded ? (
              <>
                <h3 className="text-sm font-semibold text-slate-700">{DELETED_COLUMN.label}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DELETED_COLUMN.badge}`}>{filteredRules.filter(r => r.status === "excluido").length}</span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="text-[10px] text-red-400 font-medium text-center leading-tight">{filteredRules.filter(r => r.status === "excluido").length}</span>
              </div>
            )}
          </div>
          {deletedExpanded && (
            <>
              <button
                onClick={() => setDeletedExpanded(false)}
                className="mb-2 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <ChevronUp className="w-3 h-3" /> Recolher
              </button>
              <div className="space-y-2">
                {filteredRules.filter(r => r.status === "excluido").length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8 italic">Nenhum card excluído</p>
                )}
                {filteredRules.filter(r => r.status === "excluido").map(rule => (
                  <Card
                    key={rule.id}
                    rule={rule}
                    onStatusChange={handleStatusChange}
                    onOpenDetail={setSelectedRule}
                    implantacaoUsers={implantacaoUsers}
                    loadingUsers={loadingUsers}
                    onSaveEmpresaId={handleSaveEmpresaId}
                    onSaveImplantacao={handleSaveImplantacao}
                    onDelete={handleDelete}
                    onReactivate={handleReactivate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedRule && (
        <DetailModal
          rule={selectedRule}
          onClose={() => setSelectedRule(null)}
          onRefresh={load}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}