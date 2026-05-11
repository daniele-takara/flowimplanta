import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { SCOPE_MODULES, getModuleQuestions } from "@/lib/scopeTemplate.js";
import { X, RefreshCw, Plus, Pencil, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronRight, Save } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildTemplateMap(overridesMap) {
  const map = {};
  SCOPE_MODULES.forEach(mod => {
    getModuleQuestions(mod).forEach(q => {
      const override = overridesMap[q.id];
      map[q.id] = {
        id: q.id,
        prompt: override?.prompt ?? q.prompt,
        description: override?.description ?? q.description,
        type: override?.type ?? q.type,
        options: override?.options ? JSON.parse(override.options) : q.options,
        placeholder: override?.placeholder ?? q.placeholder,
        is_required: override?.is_required ?? false,
        rules: override?.rules ? JSON.parse(override.rules) : (q.rules || []),
        active: override?.active !== undefined ? override.active : true,
        section: mod.moduleLabel,
        order_number: parseInt(q.id.replace("q", ""), 10),
      };
    });
  });
  return map;
}

function computeDiff(templateMap, scopeItems) {
  const projectMap = {};
  scopeItems.forEach(item => {
    const key = `q${String(item.order_number).padStart(3, "0")}`;
    projectMap[key] = item;
  });

  const newQuestions = [];
  const changedQuestions = [];

  Object.values(templateMap).forEach(tq => {
    if (!tq.active) return; // skip inactive template questions
    const pItem = projectMap[tq.id];

    if (!pItem) {
      newQuestions.push({ templateQ: tq, projectItem: null });
      return;
    }

    const changes = [];
    if ((pItem.question || "") !== (tq.prompt || "")) changes.push({ field: "prompt", from: pItem.question, to: tq.prompt });
    if ((pItem.best_practice || "") !== (tq.description || "")) changes.push({ field: "description", from: pItem.best_practice, to: tq.description });

    if (changes.length > 0) {
      changedQuestions.push({ templateQ: tq, projectItem: pItem, changes });
    }
  });

  // Legacy: project questions not in template anymore
  const legacyQuestions = scopeItems.filter(item => {
    const key = `q${String(item.order_number).padStart(3, "0")}`;
    return !templateMap[key];
  });

  return { newQuestions, changedQuestions, legacyQuestions };
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
          {detail && <p className="text-xs text-slate-400 mt-0.5 truncate">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function ScopeSyncModal({ projectId, scopeItems, onClose, onSynced }) {
  const [step, setStep] = useState("loading"); // loading | diff | syncing | done | error
  const [diff, setDiff] = useState(null);
  const [applyNew, setApplyNew] = useState(true);
  const [applyChanged, setApplyChanged] = useState(true);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setStep("loading");
    // Load overrides from DB
    const overridesList = await base44.entities.ScopeTemplateOverride.list("-version");
    const overridesMap = {};
    overridesList.forEach(o => { if (!overridesMap[o.question_id]) overridesMap[o.question_id] = o; });

    const templateMap = buildTemplateMap(overridesMap);
    const computed = computeDiff(templateMap, scopeItems);
    setDiff({ ...computed, templateMap });
    setStep("diff");
  }

  async function applySync() {
    setStep("syncing");
    const user = await base44.auth.me();
    const projectItemMap = {};
    scopeItems.forEach(item => {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      projectItemMap[key] = item;
    });

    let added = 0;
    let updated = 0;
    const errors = [];

    try {
      // Apply new questions
      if (applyNew) {
        for (const { templateQ } of diff.newQuestions) {
          await base44.entities.ScopeItem.create({
            project_id: projectId,
            order_number: templateQ.order_number,
            section: templateQ.section,
            question: templateQ.prompt,
            best_practice: templateQ.description || "",
            answer: "",
            observations: "",
            field_type: templateQ.type || "text",
            is_required: templateQ.is_required || false,
          });
          added++;
        }
      }

      // Apply changed questions (only metadata, NEVER answer/observations)
      if (applyChanged) {
        for (const { templateQ, projectItem } of diff.changedQuestions) {
          await base44.entities.ScopeItem.update(projectItem.id, {
            question: templateQ.prompt,
            best_practice: templateQ.description || "",
            // Explicitly NOT touching: answer, observations
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
            <p className="text-xs text-slate-300 mt-0.5">Sincronização incremental — respostas existentes são preservadas</p>
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
              <p className="text-sm text-slate-500">Comparando com o template mais recente...</p>
            </div>
          )}

          {step === "diff" && diff && (
            <div>
              {!hasAnything ? (
                <div className="flex items-center gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Escopo já está atualizado!</p>
                    <p className="text-xs text-green-600 mt-0.5">Nenhuma diferença detectada entre o projeto e o template atual.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">
                    Revise as diferenças abaixo. Apenas as categorias selecionadas serão sincronizadas.
                    <strong className="text-slate-700"> Respostas existentes nunca são sobrescritas.</strong>
                  </p>

                  {/* New questions */}
                  <DiffSection
                    title="Novas perguntas"
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
                      <DiffItem key={templateQ.id} qId={templateQ.id} label={templateQ.prompt} detail={`Seção: ${templateQ.section}`} />
                    ))}
                  </DiffSection>

                  {/* Changed questions */}
                  <DiffSection
                    title="Perguntas com texto/descrição atualizado"
                    count={diff.changedQuestions.length}
                    icon={Pencil}
                    defaultOpen={true}
                    color={{ border: "border-amber-200", bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-800", badge: "bg-amber-200 text-amber-800", body: "bg-white" }}
                  >
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input type="checkbox" checked={applyChanged} onChange={e => setApplyChanged(e.target.checked)} className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold text-amber-700">Atualizar metadados (texto/descrição) — resposta preservada</span>
                    </label>
                    {diff.changedQuestions.map(({ templateQ, changes }) => (
                      <DiffItem
                        key={templateQ.id}
                        qId={templateQ.id}
                        label={templateQ.prompt}
                        detail={changes.map(c => `${c.field}: alterado`).join(", ")}
                      />
                    ))}
                  </DiffSection>

                  {/* Legacy questions */}
                  <DiffSection
                    title="Perguntas legadas (removidas do template, mantidas no projeto)"
                    count={diff.legacyQuestions.length}
                    icon={AlertTriangle}
                    color={{ border: "border-slate-200", bg: "bg-slate-50", icon: "text-slate-400", text: "text-slate-600", badge: "bg-slate-200 text-slate-600", body: "bg-white" }}
                  >
                    <p className="text-xs text-slate-400 mb-2">Estas perguntas não existem mais no template mas foram preservadas com suas respostas.</p>
                    {diff.legacyQuestions.map(item => {
                      const key = `q${String(item.order_number).padStart(3, "0")}`;
                      return <DiffItem key={item.id} qId={key} label={item.question} detail={item.answer ? `Resposta: ${item.answer.substring(0, 60)}` : "Sem resposta"} />;
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
              <p className="text-xs text-slate-400">Respostas existentes estão sendo preservadas</p>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-5 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">Sincronização concluída com sucesso!</p>
                  <p className="text-xs text-green-600 mt-0.5">Todas as respostas existentes foram preservadas.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.added}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Perguntas adicionadas</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.updated}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Metadados atualizados</p>
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

          {step === "diff" && hasAnything && (
            <button
              onClick={applySync}
              disabled={totalChanges === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 transition-colors"
            >
              <Save className="w-4 h-4" />
              Aplicar {totalChanges} alteração(ões)
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