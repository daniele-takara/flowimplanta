import { useState, useEffect } from "react";
import { BookOpen, KeyRound, AlertCircle, Server, Menu, X } from "lucide-react";
import { endpoints, ERROR_CODES, API_BASE_URL } from "@/lib/apiDocsConfig";
import DocsSidebar from "@/components/api-docs/DocsSidebar";
import EndpointSection from "@/components/api-docs/EndpointSection";
import CodeBlock from "@/components/api-docs/CodeBlock";

export default function ApiDocs() {
  const [activeId, setActiveId] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Scroll spy — destaca a seção visível na sidebar
  useEffect(() => {
    const ids = ["overview", "auth", "endpoints", "errors", ...endpoints.map(e => `ep-${e.id}`)];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 0.1, 0.5] }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleSelect = (id) => {
    setActiveId(id);
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(o => !o)}
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Server className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 leading-tight">API de Parceiros</h1>
                <p className="text-[11px] text-slate-400 leading-tight">Pontotel · Gestão de Implantação</p>
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 hidden sm:block">v1</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-8">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:block w-64 shrink-0 py-6 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <DocsSidebar activeId={activeId} onSelect={handleSelect} />
        </aside>

        {/* Sidebar — mobile drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileNavOpen(false)}>
            <div className="absolute left-0 top-14 bottom-0 w-72 bg-white border-r border-slate-200 p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <DocsSidebar activeId={activeId} onSelect={handleSelect} />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 py-6 max-w-4xl">

          {/* Overview */}
          <section id="overview" className="scroll-mt-20 mb-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Visão geral</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              A API de Parceiros da Pontotel permite que parceiros externos consultem projetos de implantação
              de forma segura via HTTP. Todas as requisições exigem uma chave de API válida enviada no header
              <code className="mx-1 text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">x-api-key</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">URL base</p>
                <code className="text-xs font-mono text-slate-700 break-all">{API_BASE_URL}</code>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Autenticação</p>
                <p className="text-xs text-slate-600">Header <code className="font-mono text-blue-600">x-api-key</code> em toda requisição</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Formato</p>
                <p className="text-xs text-slate-600">JSON (application/json)</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Versão</p>
                <p className="text-xs text-slate-600">v1 — {endpoints.length} endpoint(s)</p>
              </div>
            </div>
          </section>

          {/* Auth */}
          <section id="auth" className="scroll-mt-20 mb-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800 mb-3">
              <KeyRound className="w-6 h-6 text-blue-600" /> Autenticação
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Todas as requisições devem incluir o header <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">x-api-key</code> com
              a chave fornecida pelo administrador da Pontotel. A chave é gerada na aba "API Parceiros" dentro do sistema.
              Sem a chave, ou com uma chave inválida/desativada, a API retorna erro <code className="text-xs font-mono text-red-600">401</code>.
            </p>
            <CodeBlock code={`x-api-key: ptl_sua_chave_aqui`} language="header" dark />
            <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Mantenha sua chave em sigilo. Ela dá acesso a todos os projetos cuja origem não seja "Pontotel".
                Se a chave for comprometida, solicite a revogação ao administrador.
              </p>
            </div>
          </section>

          {/* Endpoints */}
          <section id="endpoints" className="scroll-mt-20 mb-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800 mb-6">
              <Server className="w-6 h-6 text-blue-600" /> Endpoints
            </h2>
            <div className="space-y-10">
              {endpoints.map(ep => (
                <div key={ep.id} className="pb-8 border-b border-slate-100 last:border-0">
                  <EndpointSection endpoint={ep} />
                </div>
              ))}
            </div>
          </section>

          {/* Errors */}
          <section id="errors" className="scroll-mt-20 mb-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800 mb-4">
              <AlertCircle className="w-6 h-6 text-blue-600" /> Códigos de erro
            </h2>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Código</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Título</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map(e => (
                    <tr key={e.code} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                          e.code === 401 ? "bg-red-50 text-red-600" : e.code === 404 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                        }`}>{e.code}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">{e.title}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="border-t border-slate-100 pt-6 pb-10 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} Pontotel · API de Parceiros v1</p>
          </footer>
        </main>
      </div>
    </div>
  );
}