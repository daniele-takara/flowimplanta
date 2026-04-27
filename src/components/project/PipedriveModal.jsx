import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Search, RefreshCw, CheckCircle2, AlertCircle, Download, Building2, User, TrendingUp } from "lucide-react";

const STATUS_LABELS = {
  open: { label: "Aberto", color: "bg-green-50 text-green-700 border-green-200" },
  won: { label: "Ganho", color: "bg-blue-50 text-blue-700 border-blue-200" },
  lost: { label: "Perdido", color: "bg-red-50 text-red-700 border-red-200" },
};

export default function PipedriveModal({ onClose, onImported, existingDealIds = [] }) {
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPipeline, setFilterPipeline] = useState("all");
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const fetchDeals = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setImportSuccess(null);
    try {
      const res = await base44.functions.invoke("getPipedriveDeals", {});
      const data = res.data;
      if (data.error) {
        setError(data.error + (data.details ? `: ${JSON.stringify(data.details)}` : ""));
      } else {
        setDeals(data.deals || []);
        setPipelines(data.pipelines || []);
        if (data.message) setError(data.message);
      }
    } catch (e) {
      setError(e.message || "Erro ao buscar deals");
    }
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  const filtered = deals.filter(d => {
    const matchSearch = !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.org_name.toLowerCase().includes(search.toLowerCase()) ||
      d.owner_name.toLowerCase().includes(search.toLowerCase());
    const matchPipeline = filterPipeline === "all" || String(d.pipeline_id) === filterPipeline;
    return matchSearch && matchPipeline;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const isDuplicate = (deal) => existingDealIds.includes(deal.id);

  const handleImport = async () => {
    if (!selected) return;
    setImporting(true);
    try {
      const project = await base44.entities.Project.create({
        name: selected.title,
        client_name: selected.org_name || selected.title,
        pontotel_manager_name: selected.owner_name || "",
        status: "Planejamento",
        current_phase: "Abertura de projeto",
        pipedrive_deal_id: selected.id,
        pipedrive_pipeline_name: selected.pipeline_name || "",
      });
      setImportSuccess(project);
      onImported(project);
    } catch (e) {
      setError("Erro ao criar projeto: " + e.message);
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Integrar com Pipedrive</h2>
              <p className="text-xs text-slate-400">Importar deals dos pipelines configurados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchDeals} title="Atualizar" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Success State */}
        {importSuccess && (
          <div className="px-6 py-4 bg-green-50 border-b border-green-100 flex items-start gap-3 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Projeto importado com sucesso!</p>
              <p className="text-xs text-green-600 mt-0.5">
                "{importSuccess.name}" foi criado. Acesse o projeto para completar as informações.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">{error}</p>
          </div>
        )}

        {/* Pipelines info */}
        {!loading && pipelines.length > 0 && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400">Pipelines ativos:</span>
            {pipelines.map(p => (
              <span key={p.id} className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full font-medium">
                {p.name}
              </span>
            ))}
            <span className="text-xs text-slate-400 ml-auto">{deals.length} deals encontrados</span>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, cliente ou responsável..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          {pipelines.length > 1 && (
            <select
              value={filterPipeline}
              onChange={e => { setFilterPipeline(e.target.value); setPage(0); }}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="all">Todos os pipelines</option>
              {pipelines.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Buscando deals do Pipedrive...</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <TrendingUp className="w-10 h-10 opacity-20 mb-2" />
              <p className="text-sm font-medium">Nenhum deal encontrado</p>
              <p className="text-xs mt-1">Tente ajustar a busca ou o filtro de pipeline</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {paginated.map(deal => {
                const isSelected = selected?.id === deal.id;
                const isDup = isDuplicate(deal);
                const statusInfo = STATUS_LABELS[deal.status] || { label: deal.status, color: "bg-slate-100 text-slate-500 border-slate-200" };
                return (
                  <div
                    key={deal.id}
                    onClick={() => !isDup && setSelected(isSelected ? null : deal)}
                    className={`px-6 py-3.5 flex items-start gap-4 transition-colors cursor-pointer
                      ${isDup ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}
                      ${isSelected ? "bg-orange-50 border-l-2 border-l-orange-500" : "hover:bg-slate-50"}
                    `}
                  >
                    {/* Radio */}
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                      {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{deal.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {deal.org_name && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Building2 className="w-3 h-3" />{deal.org_name}
                              </span>
                            )}
                            {deal.owner_name && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <User className="w-3 h-3" />{deal.owner_name}
                              </span>
                            )}
                            {deal.stage_name && (
                              <span className="text-xs text-slate-400">Etapa: {deal.stage_name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-slate-300 font-mono">#{deal.id}</span>
                        </div>
                      </div>
                      {deal.pipeline_name && (
                        <span className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5 mt-1.5 inline-block">
                          {deal.pipeline_name}
                        </span>
                      )}
                      {isDup && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 ml-2 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Já importado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-2 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
              ← Anterior
            </button>
            <span className="text-xs text-slate-400">Página {page + 1} de {totalPages} · {filtered.length} deals</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
              Próxima →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="text-xs text-slate-400">
            {selected ? (
              <span className="text-orange-600 font-medium">Deal selecionado: {selected.title}</span>
            ) : (
              "Selecione um deal para importar"
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              Fechar
            </button>
            <button
              onClick={handleImport}
              disabled={!selected || importing || isDuplicate(selected)}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-40"
            >
              {importing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Importando...</>
              ) : (
                <><Download className="w-4 h-4" />Importar Projeto</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}