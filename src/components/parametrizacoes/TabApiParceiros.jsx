import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Plus, Trash2, Copy, CheckCircle, XCircle, KeyRound,
  Eye, EyeOff, Code, Check, Power, AlertTriangle
} from "lucide-react";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

const ENDPOINT = "https://gestao-projetos-pontotel.base44.app/functions/partnerApiProjects";

function generateApiKey() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `ptl_${hex}`;
}

function maskKey(key) {
  if (!key || key.length < 12) return key;
  return `${key.slice(0, 10)}${"•".repeat(12)}${key.slice(-4)}`;
}

function formatDate(iso) {
  if (!iso) return "Nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function TabApiParceiros() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [generatedKey, setGeneratedKey] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PartnerApiKey.list("-created_date");
      setKeys(list || []);
    } catch (e) {
      setKeys([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const apiKey = generateApiKey();
    try {
      await base44.entities.PartnerApiKey.create({
        name: newName.trim(),
        api_key: apiKey,
        active: true,
      });
      setGeneratedKey(apiKey);
      setNewName("");
      await load();
    } catch (e) {
      // erro tratado pelo toast do SDK
    }
    setCreating(false);
  };

  const toggleActive = async (key) => {
    await base44.entities.PartnerApiKey.update(key.id, { active: !key.active });
    await load();
  };

  const copyKey = async (key, fullKey) => {
    const text = fullKey || key.api_key;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const curlExample = `curl -H "x-api-key: <sua-chave>" \\\n  "${ENDPOINT}"`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">
            Gere chaves de API para que parceiros externos consultem projetos (origem ≠ Pontotel).
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setGeneratedKey(null); setNewName(""); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Chave
        </button>
      </div>

      {/* Documentação do endpoint */}
      <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Endpoint da API</span>
        </div>
        <code className="text-xs text-slate-700 font-mono break-all">{ENDPOINT}</code>
        <div className="mt-3 flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-slate-500">Exemplo de uso:</span>
        </div>
        <pre className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto font-mono">{curlExample}</pre>
        <p className="text-xs text-slate-400 mt-2">
          Parâmetros opcionais: <code className="text-slate-500">?id=&lt;projectId&gt;</code> ou <code className="text-slate-500">?cnpj=&lt;cnpj&gt;</code> para consultar um projeto específico.
        </p>
      </div>

      {/* Lista de chaves */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Nenhuma chave de API cadastrada. Clique em "Nova Chave" para gerar a primeira.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <div key={k.id} className={`bg-white rounded-xl border p-4 ${!k.active ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-800">{k.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${k.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {k.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <code className="text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded">
                      {revealed[k.id] ? k.api_key : maskKey(k.api_key)}
                    </code>
                    <button
                      onClick={() => setRevealed(r => ({ ...r, [k.id]: !r[k.id] }))}
                      className="p-1 text-slate-400 hover:text-slate-600"
                      title={revealed[k.id] ? "Ocultar" : "Revelar"}
                    >
                      {revealed[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => copyKey(k)}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Copiar chave"
                    >
                      {copiedId === k.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Criada em {formatDate(k.created_date)}</span>
                    <span>Último uso: {formatDate(k.last_used_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(k)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title={k.active ? "Desativar" : "Ativar"}
                  >
                    <Power className={`w-4 h-4 ${k.active ? "text-green-500" : "text-slate-400"}`} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(k)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                    title="Revogar chave"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nova chave / chave gerada */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {generatedKey ? "Chave criada com sucesso" : "Nova Chave de API"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {!generatedKey ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Nome / Identificação do parceiro *
                    </label>
                    <input
                      className={inputClass}
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Ex: Parceiro XYZ"
                      autoFocus
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      A chave gerada dará acesso a todos os projetos cuja origem não seja "Pontotel".
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newName.trim()}
                      className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                      {creating ? "Gerando..." : "Gerar chave"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Copie esta chave agora. Por segurança, ela não será exibida novamente em formato completo após fechar este modal.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Chave gerada</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        className={`${inputClass} font-mono text-xs`}
                        value={generatedKey}
                        onFocus={e => e.target.select()}
                      />
                      <button
                        onClick={() => copyKey({ id: "new" }, generatedKey)}
                        className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shrink-0"
                      >
                        {copiedId === "new" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => { setShowCreate(false); setGeneratedKey(null); }}
                      className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Concluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-800 mb-2">Revogar chave</h3>
            <p className="text-sm text-slate-500 mb-5">
              A chave "<strong>{deleteConfirm.name}</strong>" será excluída permanentemente. O parceiro perderá o acesso à API imediatamente.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await base44.entities.PartnerApiKey.delete(deleteConfirm.id);
                  setDeleteConfirm(null);
                  await load();
                }}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Revogar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}