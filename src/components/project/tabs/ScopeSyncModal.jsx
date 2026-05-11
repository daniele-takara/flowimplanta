import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { SCOPE_MODULES, getModuleQuestions } from "@/lib/scopeTemplate.js";
import { X, RefreshCw, Plus, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronRight, Save, ShieldAlert } from "lucide-react";

// ── Config hash ────────────────────────────────────────────────────────────────
// Gera um hash determinístico da configuração de uma pergunta do TEMPLATE.
// Apenas campos de configuração — nunca resposta, nunca texto salvo no projeto.
function configHash(tq) {
  const sig = JSON.stringify({
    id: tq.id,
    type: tq.type,
    options: tq.options || [],
    rules: tq.rules || [],
    is_required: tq.is_required || false,
    active: tq.active !== false,
  });
  // Simple djb2 hash — não precisa ser criptográfico, só comparar
  let h = 5381;
  for (let i = 0; i < sig.length; i++) h = ((h << 5) + h) ^ sig.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ── Build template map ─────────────────────────────────────────────────────────
// Fonte de verdade: SCOPE_MODULES + overrides do banco.
// A chave é sempre o q-id canônico: q001, q066, q251, etc.
function buildTemplateMap(overridesMap) {
  const map = {};
  SCOPE_MODULES.forEach(mod => {
    getModuleQuestions(mod).forEach(q => {
      const override = overridesMap[q.id];
      const tq = {
        id: q.id,
        prompt: override?.prompt ?? q.prompt,
        description: override?.description ?? q.description ?? "",
        type: override?.type ?? q.type,
        options: override?.options ? JSON.parse(override.options) : (q.options || []),
        placeholder: override?.placeholder ?? q.placeholder ?? "",
        is_required: override?.is_required ?? false,
        rules: override?.rules ? JSON.parse(override.rules) : (q.rules || []),
        active: override?.active !== undefined ? override.active : true,
        section: mod.moduleLabel,
        order_number: q.order, // usa o `order` canônico do scopeTemplate
      };
      tq.hash = configHash(tq);
      map[q.id] = tq;
    });
  });
  return map;
}

// ── Normaliza o project item key → canonical q-id ─────────────────────────────
// order_number 1 → "q001", order_number 251 → "q251", order_number 66 → "q066"
function orderToQId(orderNumber) {
  const n = parseInt(orderNumber, 10);
  if (isNaN(n)) return null;
  // IDs com 3 dígitos onde n <= 999
  return `q${String(n).padStart(3, "0")}`;
}

// ── computeDiff ────────────────────────────────────────────────────────────────
// LÓGICA CORRETA:
//   - "nova pergunta"   = id canônico está no template mas NÃO existe no projeto
//   - "pergunta alterada" = id existe em ambos e o config_hash mudou
//   - "legada"          = existe no projeto mas NÃO no template ativo
//
// Chave de identificação: question_id (campo explícito) quando disponível,
// fallback para orderToQId(order_number) para items legados sem question_id.
// NÃO comparamos texto vs texto.
const CHANGED_QUESTIONS_SAFETY_LIMIT = 10;

function buildProjectIndex(scopeItems) {
  const byQId = {};
  scopeItems.forEach(item => {
    // Prioridade 1: question_id explícito (confiável)
    if (item.question_id) {
      byQId[item.question_id] = item;
      return;
    }
    // Fallback: derivar do order_number
    const qId = orderToQId(item.order_number);
    if (qId && !byQId[qId]) byQId[qId] = item; // não sobrescreve se já tem question_id
  });
  return byQId;
}

function computeDiff(templateMap, scopeItems) {
  const projectByQId = buildProjectIndex(scopeItems);

  const newQuestions = [];
  const changedQuestions = [];

  Object.values(templateMap).forEach(tq => {
    if (!tq.active) return;

    const pItem = projectByQId[tq.id];

    if (!pItem) {
      // Pergunta existe no template mas não no projeto → NOVA
      newQuestions.push({ templateQ: tq });
      return;
    }

    // Pergunta existe em ambos → comparar pelo hash salvo (meta)
    // O hash salvo fica em um campo de controle: observations_meta (JSON string)
    // Se não há hash salvo ainda, NÃO consideramos como alterada (evita falsos positivos)
    let savedHash = null;
    try {
      const meta = pItem._sync_meta ? JSON.parse(pItem._sync_meta) : null;
      savedHash = meta?.config_hash ?? null;
    } catch { savedHash = null; }

    if (savedHash !== null && savedHash !== tq.hash) {
      // Hash mudou → configuração alterada
      changedQuestions.push({ templateQ: tq, projectItem: pItem });
    }
    // Se savedHash === null → nunca sincronizado → não alterar (seguro)
  });

  // Legacy: no projeto mas não no template ativo
  const legacyQuestions = scopeItems.filter(item => {
    const qId = orderToQId(item.order_number);
    return qId && !templateMap[qId];
  });

  // Safety gate
  const tooManyChanges = changedQuestions.length > CHANGED_QUESTIONS_SAFETY_LIMIT;

  // Diagnóstico: logar resultado real do diff
  console.log(`[computeDiff] Novas: ${newQuestions.length} — ${newQuestions.map(n => n.templateQ.id).join(", ") || "nenhuma"}`);
  console.log(`[computeDiff] Alteradas: ${changedQuestions.length}`);
  console.log(`[computeDiff] Legadas: ${legacyQuestions.length}`);
  console.log(`[computeDiff] q066 → nova=${newQuestions.some(n => n.templateQ.id === "q066")}, alterada=${changedQuestions.some(c => c.templateQ.id === "q066")}`);
  console.log(`[computeDiff] projectByQId keys:`, Object.keys(projectByQId).join(", "));

  return { newQuestions, changedQuestions, legacyQuestions, tooManyChanges };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DiffSection({ title, count, icon: Icon, color, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className={`border rounded-xl overflow-hidden mb-3 ${color.border}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left ${color.bg}`}
      >
        <Icon className={`w-4 h-4 ${color.icon} shrink-0`} />
        <span className={`text-sm font-semibold ${color.text} flex-1`}>{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.badge}`}>{count}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && <div className={`px-4 pb-3 pt-1 ${color.body}`}>{children}</div>}
    </div>
  );
}

function DiffItem({ qId, label, detail }) {
  return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-2">
        <span className="text-xs font-mono font-bold text-slate-400 mt-0.5 shrink-0">{qId?.toUpperCase()}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-700 leading-snug">{label}</p>
          {detail && <p className="text-xs text-slate-400 mt-0.5">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Bootstrap legacy ──────────────────────────────────────────────────────────
// Para projetos sem hashes: grava _sync_meta + question_id em cada pergunta
// existente, SEM tocar em answer/observations/question.
// Também grava question_id explícito para que futuras buscas sejam precisas.
async function bootstrapLegacyProject(templateMap, scopeItems) {
  const now = new Date().toISOString();

  // Items que precisam de bootstrap: sem _sync_meta OU sem question_id
  const itemsToBootstrap = scopeItems.filter(item => {
    const needsMeta = (() => {
      try {
        const meta = item._sync_meta ? JSON.parse(item._sync_meta) : null;
        return !meta?.config_hash;
      } catch { return true; }
    })();
    return needsMeta || !item.question_id;
  });

  if (itemsToBootstrap.length === 0) return 0;

  // Constrói mapa reverso: order_number → question_id do template
  const orderToTemplateQId = {};
  Object.values(templateMap).forEach(tq => {
    orderToTemplateQId[tq.order_number] = tq.id;
  });

  let bootstrapped = 0;
  for (let i = 0; i < itemsToBootstrap.length; i += 5) {
    const batch = itemsToBootstrap.slice(i, i + 5);
    await Promise.all(batch.map(async item => {
      // Resolver question_id: usar explícito se existir, senão derivar do order_number
      const resolvedQId = item.question_id
        || orderToTemplateQId[item.order_number]
        || orderToQId(item.order_number);

      const tq = resolvedQId ? templateMap[resolvedQId] : null;
      const hashToSave = tq ? tq.hash : "legacy_no_template";
      const meta = JSON.stringify({ config_hash: hashToSave, bootstrapped_at: now, is_baseline: true });

      const updatePayload = { _sync_meta: meta };
      // Grava question_id explícito se não existia — chave de identidade para diff futuro
      if (!item.question_id && resolvedQId) updatePayload.question_id = resolvedQId;

      await base44.entities.ScopeItem.update(item.id, updatePayload);
      bootstrapped++;
    }));
  }
  return bootstrapped;
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function ScopeSyncModal({ projectId, scopeItems, onClose, onSynced }) {
  const [step, setStep] = useState("loading");
  const [diff, setDiff] = useState(null);
  const [applyNew, setApplyNew] = useState(true);
  const [applyChanged, setApplyChanged] = useState(true);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [bootstrapInfo, setBootstrapInfo] = useState(null); // { count }

  useEffect(() => { load(); }, []);

  async function load() {
    setStep("loading");
    const overridesList = await base44.entities.ScopeTemplateOverride.list("-version");
    const overridesMap = {};
    overridesList.forEach(o => { if (!overridesMap[o.question_id]) overridesMap[o.question_id] = o; });

    const templateMap = buildTemplateMap(overridesMap);

    // Diagnóstico: logar estado real para auditoria
    const templateIds = Object.keys(templateMap);
    console.log(`[ScopeSync] Template: ${templateIds.length} perguntas — ${templateIds.join(", ")}`);
    console.log(`[ScopeSync] q066 no template:`, !!templateMap["q066"], templateMap["q066"] ? `hash=${templateMap["q066"].hash}` : "AUSENTE");
    console.log(`[ScopeSync] Projeto: ${scopeItems.length} perguntas`);
    const projectQIds = scopeItems.map(i => i.question_id || orderToQId(i.order_number));
    console.log(`[ScopeSync] IDs no projeto (question_id ou order):`, projectQIds.join(", "));
    console.log(`[ScopeSync] q066 no projeto:`, projectQIds.includes("q066"));

    // Bootstrap: projeto legacy sem hashes → grava baseline silenciosamente
    const bootstrapped = await bootstrapLegacyProject(templateMap, scopeItems);
    if (bootstrapped > 0) {
      setBootstrapInfo({ count: bootstrapped });
      // Recarrega scopeItems do banco após bootstrap para ter os _sync_meta atualizados
      const freshItems = await base44.entities.ScopeItem.filter({ project_id: projectId });
      const computed = computeDiff(templateMap, freshItems);
      setDiff({ ...computed, templateMap });
    } else {
      const computed = computeDiff(templateMap, scopeItems);
      setDiff({ ...computed, templateMap });
    }

    setStep("diff");
  }

  async function applySync() {
    setStep("syncing");
    const user = await base44.auth.me();

    let added = 0;
    let updated = 0;

    try {
      // Adicionar novas perguntas
      if (applyNew) {
        for (const { templateQ } of diff.newQuestions) {
          const meta = JSON.stringify({ config_hash: templateQ.hash, synced_at: new Date().toISOString(), synced_by: user?.email });
          await base44.entities.ScopeItem.create({
            project_id: projectId,
            question_id: templateQ.id,
            order_number: templateQ.order_number,
            section: templateQ.section,
            question: templateQ.prompt,
            best_practice: templateQ.description || "",
            answer: "",
            observations: "",
            field_type: templateQ.type || "text",
            is_required: templateQ.is_required || false,
            _sync_meta: meta,
          });
          added++;
        }
      }

      // Atualizar metadados de perguntas com config alterada
      // NUNCA toca em: answer, observations
      if (applyChanged) {
        for (const { templateQ, projectItem } of diff.changedQuestions) {
          const meta = JSON.stringify({ config_hash: templateQ.hash, synced_at: new Date().toISOString(), synced_by: user?.email });
          await base44.entities.ScopeItem.update(projectItem.id, {
            question: templateQ.prompt,
            best_practice: templateQ.description || "",
            field_type: templateQ.type || "text",
            is_required: templateQ.is_required || false,
            _sync_meta: meta,
          });
          updated++;
        }
      }

      setResult({ added, updated, syncedBy: user?.email, syncedAt: new Date().toISOString() });
      setStep("done");
      if (onSynced) onSynced();
    } catch (err) {
      setErrorMsg(err.message || "Erro desconhecido");
      setStep("error");
    }
  }

  const totalChanges = (applyNew ? diff?.newQuestions?.length || 0 : 0) +
                       (applyChanged ? diff?.changedQuestions?.length || 0 : 0);
  const hasAnything = (diff?.newQuestions?.length || 0) + (diff?.changedQuestions?.length || 0) > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-slate-700 shrink-0">
          <RefreshCw className="w-5 h-5 text-white" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">Atualizar template do escopo</h2>
            <p className="text-xs text-slate-300 mt-0.5">Sincronização incremental por hash de configuração — respostas preservadas</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-500">Comparando configurações por hash...</p>
            </div>
          )}

          {step === "diff" && diff && (
            <div>
              {/* Bootstrap notice */}
              {bootstrapInfo && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-xs text-blue-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                  <span>
                    <strong>Baseline gerado:</strong> {bootstrapInfo.count} pergunta(s) sem histórico de sincronização receberam hash inicial.
                    Nenhum dado foi alterado — apenas metadados internos foram criados para comparação futura.
                  </span>
                </div>
              )}

              {/* Safety gate */}
              {diff.tooManyChanges && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700">Possível comparação incorreta detectada</p>
                    <p className="text-xs text-red-600 mt-1">
                      {diff.changedQuestions.length} perguntas foram marcadas como alteradas — isso excede o limite de segurança ({CHANGED_QUESTIONS_SAFETY_LIMIT}).
                      A sincronização de metadados foi bloqueada. Apenas novas perguntas podem ser adicionadas.
                    </p>
                  </div>
                </div>
              )}

              {!hasAnything ? (
                <div className="flex items-center gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Escopo já está atualizado!</p>
                    <p className="text-xs text-green-600 mt-0.5">Nenhuma diferença de configuração detectada entre o projeto e o template atual.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">
                    Comparação feita por <strong>config hash</strong> — somente diferenças reais de configuração são detectadas.
                    <strong className="text-slate-700"> Respostas e observações nunca são tocadas.</strong>
                  </p>

                  {/* New questions */}
                  <DiffSection
                    title="Novas perguntas (existem no template, não no projeto)"
                    count={diff.newQuestions.length}
                    icon={Plus}
                    defaultOpen={true}
                    color={{ border: "border-green-200", bg: "bg-green-50", icon: "text-green-600", text: "text-green-800", badge: "bg-green-200 text-green-800", body: "bg-white" }}
                  >
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input type="checkbox" checked={applyNew} onChange={e => setApplyNew(e.target.checked)} className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold text-green-700">Adicionar novas perguntas ao projeto</span>
                    </label>
                    {diff.newQuestions.map(({ templateQ }) => (
                      <DiffItem
                        key={templateQ.id}
                        qId={templateQ.id}
                        label={templateQ.prompt}
                        detail={`Seção: ${templateQ.section} · Tipo: ${templateQ.type}`}
                      />
                    ))}
                  </DiffSection>

                  {/* Changed questions — só mostra se não ultrapassou safety limit */}
                  {!diff.tooManyChanges && diff.changedQuestions.length > 0 && (
                    <DiffSection
                      title="Perguntas com configuração alterada (hash diferente)"
                      count={diff.changedQuestions.length}
                      icon={RefreshCw}
                      defaultOpen={true}
                      color={{ border: "border-amber-200", bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-800", badge: "bg-amber-200 text-amber-800", body: "bg-white" }}
                    >
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input type="checkbox" checked={applyChanged} onChange={e => setApplyChanged(e.target.checked)} className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold text-amber-700">Atualizar metadados — resposta e observações preservadas</span>
                      </label>
                      {diff.changedQuestions.map(({ templateQ }) => (
                        <DiffItem
                          key={templateQ.id}
                          qId={templateQ.id}
                          label={templateQ.prompt}
                          detail={`Hash template: ${templateQ.hash}`}
                        />
                      ))}
                    </DiffSection>
                  )}

                  {/* Legacy */}
                  <DiffSection
                    title="Perguntas legadas (não existem mais no template — preservadas)"
                    count={diff.legacyQuestions.length}
                    icon={AlertTriangle}
                    color={{ border: "border-slate-200", bg: "bg-slate-50", icon: "text-slate-400", text: "text-slate-600", badge: "bg-slate-200 text-slate-600", body: "bg-white" }}
                  >
                    <p className="text-xs text-slate-400 mb-2">Mantidas com respostas e histórico intactos. Nenhuma ação necessária.</p>
                    {diff.legacyQuestions.map(item => {
                      const qId = orderToQId(item.order_number);
                      return (
                        <DiffItem
                          key={item.id}
                          qId={qId}
                          label={item.question}
                          detail={item.answer ? `Resposta: ${item.answer.substring(0, 60)}` : "Sem resposta"}
                        />
                      );
                    })}
                  </DiffSection>
                </>
              )}
            </div>
          )}

          {step === "syncing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-500">Aplicando sincronização incremental...</p>
              <p className="text-xs text-slate-400">Respostas e observações sendo preservadas</p>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">Sincronização concluída com sucesso!</p>
                  <p className="text-xs text-green-600 mt-0.5">Hashes gravados — próxima sincronização será ainda mais precisa.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.added}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Perguntas adicionadas</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.updated}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Configurações atualizadas</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Sincronizado por {result.syncedBy} · {new Date(result.syncedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Erro na sincronização</p>
                <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">
            {step === "done" ? "Fechar" : "Cancelar"}
          </button>

          {step === "diff" && hasAnything && totalChanges > 0 && !diff.tooManyChanges && (
            <button
              onClick={applySync}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Aplicar {totalChanges} alteração(ões)
            </button>
          )}

          {step === "diff" && hasAnything && diff.tooManyChanges && applyNew && diff.newQuestions.length > 0 && (
            <button
              onClick={applySync}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar {diff.newQuestions.length} nova(s) pergunta(s)
            </button>
          )}

          {step === "diff" && !hasAnything && (
            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg">
              Fechar
            </button>
          )}

          {step === "error" && (
            <button onClick={load} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}