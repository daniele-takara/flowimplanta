import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Copy, CheckCircle2, Zap, ExternalLink, RefreshCw, AlertCircle,
  Plus, Pencil, Trash2, Save, X, Download, Info, ChevronDown, ChevronRight
} from "lucide-react";

const CRONOGRAMA_GID = "1377224895";
const WEBHOOK_URL = "https://api.base44.app/api/apps/69e295c073bbccc7f63f6156/functions/pipedriveWebhook";

const ENTIDADE_OPTIONS = ["deal", "activity"];
const CAMPO_KEY_OPTIONS = ["stage_id", "done"];
const CAMPO_DATA_OPTIONS = ["update_time", "marked_as_done_time", "add_time", "expected_close_date"];
const FASE_OPTIONS = [
  "Abertura de projeto", "Parametrização", "Homologação", "Rollout", "Go-live", "Pós Go-live",
];

const inputCls = "w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const selectCls = `${inputCls} cursor-pointer`;

// ── Form de criação/edição de uma regra ───────────────────────────────────────

function RuleForm({ rule, onSave, onCancel }) {
  const [form, setForm] = useState({
    pipedrive_entidade: rule?.pipedrive_entidade || "deal",
    pipedrive_campo_key: rule?.pipedrive_campo_key || "stage_id",
    pipedrive_valor_disparo: rule?.pipedrive_valor_disparo || "",
    pipedrive_campo_identificacao: rule?.pipedrive_campo_identificacao || "",
    pipedrive_valor_identificacao: rule?.pipedrive_valor_identificacao || "",
    pipedrive_campo_data: rule?.pipedrive_campo_data || "update_time",
    base44_fase: rule?.base44_fase || "",
    base44_atividade: rule?.base44_atividade || "*",
    atualiza_inicio: rule?.atualiza_inicio ?? false,
    atualiza_fim: rule?.atualiza_fim ?? false,
    ativo: rule?.ativo ?? true,
    descricao: rule?.descricao || "",
    ordem: rule?.ordem || 0,
  });
  const [saving, setSaving] = useState(false);

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const isActivity = form.pipedrive_entidade === "activity";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{rule ? "Editar Regra" : "Nova Regra"}</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
            <input className={inputCls} value={form.descricao} onChange={e => f("descricao", e.target.value)} placeholder="Ex: Concluir reunião de escopo" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Entidade Pipedrive *</label>
              <select className={selectCls} value={form.pipedrive_entidade} onChange={e => f("pipedrive_entidade", e.target.value)}>
                {ENTIDADE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Campo Key *</label>
              <select className={selectCls} value={form.pipedrive_campo_key} onChange={e => f("pipedrive_campo_key", e.target.value)}>
                {CAMPO_KEY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Valor de Disparo *</label>
            <input className={inputCls} value={form.pipedrive_valor_disparo} onChange={e => f("pipedrive_valor_disparo", e.target.value)}
              placeholder={form.pipedrive_entidade === "deal" ? "Ex: 142 (stage_id)" : "Ex: TRUE"} required />
          </div>

          {isActivity && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Campo Identificação</label>
                <input className={inputCls} value={form.pipedrive_campo_identificacao} onChange={e => f("pipedrive_campo_identificacao", e.target.value)} placeholder="Ex: subject" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Valor Identificação</label>
                <input className={inputCls} value={form.pipedrive_valor_identificacao} onChange={e => f("pipedrive_valor_identificacao", e.target.value)} placeholder="Ex: Reunião de escopo" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Campo de Data</label>
            <select className={selectCls} value={form.pipedrive_campo_data} onChange={e => f("pipedrive_campo_data", e.target.value)}>
              {CAMPO_DATA_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Fase Base44 *</label>
              <select className={selectCls} value={form.base44_fase} onChange={e => f("base44_fase", e.target.value)} required>
                <option value="">Selecione...</option>
                {FASE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                <option value="__custom">Outra (digitar)</option>
              </select>
              {form.base44_fase === "__custom" && (
                <input className={`${inputCls} mt-1`} placeholder="Nome exato da fase" onChange={e => f("base44_fase", e.target.value)} />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Atividade Base44 *</label>
              <input className={inputCls} value={form.base44_atividade} onChange={e => f("base44_atividade", e.target.value)}
                placeholder="* para todas, ou nome exato" required />
              <p className="text-xs text-slate-400 mt-0.5">Use * para aplicar em todas as atividades da fase</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
              <input type="checkbox" checked={form.atualiza_inicio} onChange={e => f("atualiza_inicio", e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="text-xs text-slate-700 font-medium">Preencher início executado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
              <input type="checkbox" checked={form.atualiza_fim} onChange={e => f("atualiza_fim", e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="text-xs text-slate-700 font-medium">Preencher fim executado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
              <input type="checkbox" checked={form.ativo} onChange={e => f("ativo", e.target.checked)} className="w-4 h-4 accent-green-600" />
              <span className="text-xs text-slate-700 font-medium">Regra ativa</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Ordem</label>
            <input type="number" className={inputCls} value={form.ordem} onChange={e => f("ordem", Number(e.target.value))} min={0} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Linha de regra ────────────────────────────────────────────────────────────

function RuleRow({ rule, onEdit, onDelete, onToggle }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Excluir a regra "${rule.descricao || rule.id}"?`)) return;
    setDeleting(true);
    await onDelete(rule.id);
    setDeleting(false);
  };

  const tagCls = "text-xs px-1.5 py-0.5 rounded font-mono";

  return (
    <tr className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${!rule.ativo ? "opacity-50" : ""}`}>
      <td className="px-3 py-2.5 text-xs text-slate-500 w-8">{rule.ordem ?? "—"}</td>
      <td className="px-3 py-2.5">
        <span className={`${tagCls} ${rule.pipedrive_entidade === "deal" ? "bg-orange-50 text-orange-700" : "bg-purple-50 text-purple-700"}`}>
          {rule.pipedrive_entidade}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[120px]">
        <span className="font-mono">{rule.pipedrive_campo_key}</span>
        {" = "}
        <span className="font-semibold">{rule.pipedrive_valor_disparo}</span>
        {rule.pipedrive_valor_identificacao && (
          <div className="text-slate-400 truncate" title={rule.pipedrive_valor_identificacao}>
            subject: {rule.pipedrive_valor_identificacao}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[180px]">
        <span className="font-semibold">{rule.base44_fase}</span>
        <div className="text-slate-400 truncate" title={rule.base44_atividade}>{rule.base44_atividade}</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1 flex-wrap">
          {rule.atualiza_inicio && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">início</span>}
          {rule.atualiza_fim && <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">fim</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[120px] truncate" title={rule.descricao}>{rule.descricao || "—"}</td>
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.ativo ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>
          {rule.ativo ? "Ativa" : "Inativa"}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(rule)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onToggle(rule)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            {rule.ativo ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

// ── Importar da planilha (com confirmação) ────────────────────────────────────

function ImportFromSheet({ existingCount, onImported }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // regras prontas para importar
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await base44.functions.invoke("readSheetMapping", { gid: CRONOGRAMA_GID });
      const data = res.data;
      if (data.error) { setError(data.error); setLoading(false); return; }

      // Converter linhas da planilha para o formato PipedriveRule
      const converted = (data.rows || []).map((row, i) => {
        const iniKey = Object.keys(row).find(k => /in.?cio/i.test(k)) || "início";
        return {
          pipedrive_entidade: row.pipedrive_entidade || "deal",
          pipedrive_campo_key: row.pipedrive_campo_key || "stage_id",
          pipedrive_valor_disparo: row.pipedrive_valor_disparo || "",
          pipedrive_campo_identificacao: row.pipedrive_campo_identificacao || "",
          pipedrive_valor_identificacao: row.pipedrive_valor_identificacao || "",
          pipedrive_campo_data: row.pipedrive_campo_data || "update_time",
          base44_fase: row.base44_fase || "",
          base44_atividade: row.base44_atividade || "*",
          atualiza_inicio: (row[iniKey] || "").toLowerCase() === "sim",
          atualiza_fim: (row.fim || "").toLowerCase() === "sim",
          ativo: true,
          descricao: row.pipedrive_valor_identificacao || row.base44_atividade || `Regra ${i + 1}`,
          ordem: i,
        };
      }).filter(r => r.pipedrive_valor_disparo && r.base44_fase);

      setPreview(converted);
      if (existingCount > 0) setConfirming(true);
      else await doImport(converted);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const doImport = async (rows) => {
    setLoading(true);
    // Se existem regras e o usuário confirmou substituição, apagar todas primeiro
    if (existingCount > 0) {
      const existing = await base44.entities.PipedriveRule.list();
      await Promise.all(existing.map(r => base44.entities.PipedriveRule.delete(r.id)));
    }
    await base44.entities.PipedriveRule.bulkCreate(rows);
    setPreview(null);
    setConfirming(false);
    onImported();
    setLoading(false);
  };

  return (
    <div>
      {!confirming && (
        <button
          onClick={loadPreview}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Importar da planilha
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {confirming && preview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">Substituir regras atuais?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Existem <strong>{existingCount}</strong> regra(s) cadastrada(s). A importação vai <strong>substituir todas</strong> pelas {preview.length} regras da planilha.
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setConfirming(false); setPreview(null); }} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => doImport(preview)} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Substituir regras
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Teste manual ──────────────────────────────────────────────────────────────

function TestSync() {
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  const handleTest = async () => {
    if (!projectId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("syncScheduleFromPipedrive", { project_id: projectId.trim() });
      setResult({ ok: true, data: res.data });
    } catch (e) {
      setResult({ ok: false, error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide hover:bg-slate-100 transition-colors">
        Teste Manual — Atualizar Cronograma
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="p-4 border-t border-slate-200">
          <div className="flex gap-2 mb-3">
            <input type="text" value={projectId} onChange={e => setProjectId(e.target.value)} placeholder="ID do projeto Base44"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
            <button onClick={handleTest} disabled={loading || !projectId.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Executar
            </button>
          </div>
          {result && (
            <div className={`rounded-lg p-3 text-xs ${result.ok && result.data?.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              {result.ok && result.data?.ok ? (
                <div className="space-y-0.5">
                  <p className="font-bold">✓ Sincronização concluída</p>
                  <p>Deal #{result.data.deal_id} · Stage: {result.data.deal_stage_id}</p>
                  <p>Activities: {result.data.activities_found} ({result.data.activities_done} concluídas)</p>
                  <p>Regras: {result.data.rules_total} cadastradas · {result.data.rules_applied} aplicadas</p>
                  <p>Atividades atualizadas: <strong>{result.data.updated}</strong></p>
                  {result.data.activities?.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                      {result.data.activities.map((a, i) => (
                        <li key={i}>{a.name} ({a.phase}) — {JSON.stringify(a.patch)}</li>
                      ))}
                    </ul>
                  )}
                  {result.data.match_errors?.length > 0 && (
                    <div className="mt-2 text-amber-700 bg-amber-50 rounded p-2">
                      <p className="font-bold">Inconsistências:</p>
                      <ul className="list-disc pl-4">{result.data.match_errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>Erro: {result.data?.error || result.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TabIntegracaoPipedrive() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.PipedriveRule.list("ordem");
    setRules(list || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (editing) {
      await base44.entities.PipedriveRule.update(editing.id, form);
    } else {
      await base44.entities.PipedriveRule.create(form);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.PipedriveRule.delete(id);
    load();
  };

  const handleToggle = async (rule) => {
    await base44.entities.PipedriveRule.update(rule.id, { ativo: !rule.ativo });
    load();
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">Regras de Integração Pipedrive → Cronograma</p>
          <p className="text-xs text-blue-600 mt-0.5">
            O Base44 é a fonte de verdade. As regras aqui cadastradas são lidas pelo botão "Atualizar Cronograma (Pipedrive)" em cada projeto.
            A planilha pode ser usada apenas para carga inicial.
          </p>
        </div>
      </div>

      {/* Segurança */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span><strong>Lógica de segurança:</strong> datas já preenchidas manualmente nunca são sobrescritas. Planned_start e planned_end nunca são alterados.</span>
      </div>

      {/* Regras cadastradas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Regras de Cronograma</h3>
            <p className="text-xs text-slate-400 mt-0.5">{rules.length} regra(s) cadastrada(s) · lidas exclusivamente pelo botão no projeto</p>
          </div>
          <div className="flex items-center gap-2">
            <ImportFromSheet existingCount={rules.length} onImported={load} />
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Regra
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2 text-sm">
            <Zap className="w-8 h-8 opacity-20" />
            <p>Nenhuma regra cadastrada.</p>
            <p className="text-xs">Crie uma regra ou importe da planilha Google Sheets.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["#", "Entidade", "Gatilho", "Destino Base44", "Ação", "Descrição", "Status", ""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onEdit={r => { setEditing(r); setShowForm(true); }}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Webhook Pipedrive (atualização automática)</p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
          <code className="flex-1 text-xs text-slate-700 break-all">{WEBHOOK_URL}</code>
          <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); }} className="shrink-0 p-1 text-slate-400 hover:text-blue-600">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Configurar no Pipedrive:</strong> Ferramentas → Webhooks → Adicionar Webhook. Método POST,
            eventos: <code className="bg-amber-100 px-1 rounded">updated.deal</code> e <code className="bg-amber-100 px-1 rounded">updated.activity</code>.
            <a href="https://pipedrive.readme.io/docs/guide-for-webhooks" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 text-amber-700 hover:underline">
              <ExternalLink className="w-3 h-3" /> Documentação
            </a>
          </div>
        </div>
      </div>

      {/* Teste */}
      <TestSync />

      {/* Form modal */}
      {showForm && (
        <RuleForm
          rule={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}