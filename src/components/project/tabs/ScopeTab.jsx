import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronRight, Save, HelpCircle } from "lucide-react";

const SECTIONS = [
  "Informações Gerais do Projeto",
  "Integração Folha Sankhya",
  "Parametrização Cálculos e Permissões",
  "Controle de Custos",
  "Módulo de Escala",
  "Módulo Banco de Horas",
  "Módulo App",
  "Dispositivos de Ponto",
  "Integrações Externas",
  "Outros"
];

function ScopeItemRow({ item, onSave }) {
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState(item.answer || "");
  const [obs, setObs] = useState(item.observations || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(item, { answer, observations: obs });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="border border-slate-100 rounded-lg mb-2 overflow-hidden">
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setEditing(e => !e)}
      >
        <div className="flex items-center gap-2 mt-0.5">
          {editing ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-xs text-slate-400 font-mono w-5">{item.order_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">{item.question}</p>
          {item.answer && !editing && (
            <p className="text-sm text-slate-500 mt-0.5 truncate">→ {item.answer}</p>
          )}
        </div>
        <div className="shrink-0">
          {item.answer
            ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Respondido</span>
            : <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Pendente</span>
          }
        </div>
      </div>

      {editing && (
        <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
          {item.best_practice && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mt-3 mb-3">
              <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">{item.best_practice}</p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Resposta</label>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="Descreva a resposta..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
              <input
                value={obs}
                onChange={e => setObs(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observações adicionais..."
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScopeTab({ scopeItems, projectId, onRefresh }) {
  const [openSections, setOpenSections] = useState(
    Object.fromEntries(SECTIONS.map(s => [s, true]))
  );

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async (item, updates) => {
    if (item.id && !item.id.startsWith("s")) {
      await base44.entities.ScopeItem.update(item.id, updates);
    }
    if (onRefresh) onRefresh();
  };

  const bySection = scopeItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const totalItems = scopeItems.length;
  const answeredItems = scopeItems.filter(i => i.answer).length;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-6 p-4 bg-white rounded-xl border border-slate-200">
        <div>
          <p className="text-sm font-medium text-slate-600">Progresso do Escopo</p>
          <p className="text-xs text-slate-400 mt-0.5">{answeredItems} de {totalItems} itens respondidos</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-800">{totalItems > 0 ? Math.round(answeredItems / totalItems * 100) : 0}%</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map(section => {
          const items = bySection[section];
          if (!items || items.length === 0) return null;
          const answered = items.filter(i => i.answer).length;
          const open = openSections[section];

          return (
            <div key={section} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleSection(section)}
              >
                <div className="flex items-center gap-3">
                  {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <h3 className="text-sm font-semibold text-slate-800">{section}</h3>
                  <span className="text-xs text-slate-400">({items.length} itens)</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${answered === items.length ? "bg-green-100 text-green-700" : answered > 0 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                  {answered}/{items.length}
                </span>
              </div>
              {open && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <div className="mt-3">
                    {items.sort((a, b) => (a.order_number || 0) - (b.order_number || 0)).map(item => (
                      <ScopeItemRow key={item.id || item.question} item={item} onSave={handleSave} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}