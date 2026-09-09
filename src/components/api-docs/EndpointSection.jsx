import { Table, KeyRound } from "lucide-react";
import { METHOD_COLORS } from "@/lib/apiDocsConfig";
import CodeBlock from "./CodeBlock";
import ApiTester from "./ApiTester";

export default function EndpointSection({ endpoint }) {
  const colors = METHOD_COLORS[endpoint.method] || METHOD_COLORS.GET;
  const fullUrl = `https://gestao-projetos-pontotel.base44.app${endpoint.path}`;

  const curlExample = `curl -H "x-api-key: <sua-chave>" \\\n  "${fullUrl}"`;

  return (
    <div id={`ep-${endpoint.id}`} className="scroll-mt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${colors.bg} ${colors.text} ${colors.border}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-slate-800 break-all">{endpoint.path}</code>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-1">{endpoint.summary}</h3>
      <p className="text-sm text-slate-500 mb-5 leading-relaxed">{endpoint.description}</p>

      {/* Headers */}
      {endpoint.headers && endpoint.headers.length > 0 && (
        <div className="mb-5">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
            <KeyRound className="w-3.5 h-3.5" /> Headers
          </h4>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Header</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.headers.map(h => (
                  <tr key={h.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono text-slate-700">{h.name}</code>
                      {h.required && <span className="ml-1.5 text-[10px] font-bold text-red-500">obrigatório</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{h.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Parameters */}
      {endpoint.parameters && endpoint.parameters.length > 0 && (
        <div className="mb-5">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
            <Table className="w-3.5 h-3.5" /> Parâmetros
          </h4>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Parâmetro</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Tipo</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map(p => (
                  <tr key={p.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono text-slate-700">{p.name}</code>
                      {p.required
                        ? <span className="ml-1.5 text-[10px] font-bold text-red-500">obrigatório</span>
                        : <span className="ml-1.5 text-[10px] text-slate-400">opcional</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.type}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request example */}
      <div className="mb-5">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Exemplo de requisição</h4>
        <CodeBlock code={curlExample} language="bash" dark />
      </div>

      {/* Response schema */}
      {endpoint.responseSchema && endpoint.responseSchema.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Schema da resposta</h4>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Campo</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Tipo</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.responseSchema.map(f => (
                  <tr key={f.field} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5"><code className="text-xs font-mono text-slate-700">{f.field}</code></td>
                    <td className="px-4 py-2.5"><code className="text-xs font-mono text-purple-600">{f.type}</code></td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Response example */}
      {endpoint.exampleResponse && (
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Exemplo de resposta</h4>
          <CodeBlock code={endpoint.exampleResponse} language="json" />
        </div>
      )}

      {/* Interactive tester */}
      <ApiTester endpoint={endpoint} />
    </div>
  );
}