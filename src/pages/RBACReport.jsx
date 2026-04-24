import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PERMISSION_MODULES } from "@/lib/permissions";
import { Shield, Users, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6 shadow-sm">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PermBadge({ allowed }) {
  return allowed
    ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"><CheckCircle className="w-3 h-3" />Sim</span>
    : <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5"><XCircle className="w-3 h-3" />Não</span>;
}

export default function RBACReport() {
  const [profiles, setProfiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.PermissionProfile.list("name"),
      base44.entities.User.list(),
    ]).then(([p, u]) => {
      setProfiles(p);
      setUsers(u);
      setLoading(false);
    });
  }, []);

  const getUsersForProfile = (profileId) => users.filter(u => u.permission_profile_id === profileId);
  const usersWithoutProfile = users.filter(u => !u.permission_profile_id);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Shield className="w-4 h-4" />
            <span>Parametrizações → Relatório RBAC</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Relatório de Permissões (RBAC)</h1>
          <p className="text-slate-400 text-sm mt-1">Gerado em {new Date().toLocaleString("pt-BR")}</p>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          <Download className="w-4 h-4" /> Exportar / Imprimir
        </button>
      </div>

      {/* 1. Resumo executivo */}
      <Section title="1. Resumo Executivo">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
            <p className="text-3xl font-bold text-blue-700">{profiles.length}</p>
            <p className="text-sm text-blue-600 mt-1">Perfis de Permissão</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
            <p className="text-3xl font-bold text-slate-700">{users.length}</p>
            <p className="text-sm text-slate-500 mt-1">Usuários no sistema</p>
          </div>
          <div className={`rounded-lg p-4 text-center border ${usersWithoutProfile.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
            <p className={`text-3xl font-bold ${usersWithoutProfile.length > 0 ? "text-amber-700" : "text-green-700"}`}>{usersWithoutProfile.length}</p>
            <p className={`text-sm mt-1 ${usersWithoutProfile.length > 0 ? "text-amber-600" : "text-green-600"}`}>Sem perfil atribuído</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 leading-relaxed">
          <strong>Modelo:</strong> RBAC (Role-Based Access Control). Usuários não possuem permissões diretas — herdam permissões exclusivamente do Perfil de Permissão atribuído.
          Alterar o perfil de um usuário muda seu acesso <strong>imediatamente</strong>.
        </div>
      </Section>

      {/* 2. Estrutura de perfis */}
      <Section title="2. Perfis de Permissão Configurados">
        {profiles.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Nenhum perfil criado. Acesse Parametrizações → Perfis de Permissão para criar.
          </div>
        ) : (
          <div className="space-y-5">
            {profiles.map(profile => {
              const linkedUsers = getUsersForProfile(profile.id);
              const perms = profile.permissions || {};
              return (
                <div key={profile.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-slate-800">{profile.name}</span>
                      {profile.description && <span className="text-xs text-slate-400">— {profile.description}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      {linkedUsers.length} usuário(s)
                    </div>
                  </div>
                  <div className="p-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-semibold text-slate-500 pb-2 w-48">Módulo</th>
                          {PERMISSION_MODULES[0].permissions.map(() => null)}
                          <th className="text-left text-xs font-semibold text-slate-500 pb-2">Permissões</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_MODULES.map(mod => {
                          const activePerms = mod.permissions.filter(p => perms[p.key]);
                          const hasAny = activePerms.length > 0;
                          return (
                            <tr key={mod.key} className="border-t border-slate-50">
                              <td className={`py-2 pr-4 font-medium text-xs ${hasAny ? "text-slate-700" : "text-slate-300"}`}>{mod.label}</td>
                              <td className="py-2">
                                {hasAny ? (
                                  <div className="flex flex-wrap gap-1">
                                    {activePerms.map(p => (
                                      <span key={p.key} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full">{p.label}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300 italic">Sem acesso</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 3. Relação usuário → perfil */}
      <Section title="3. Relação Usuário → Perfil">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">Usuário</th>
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">E-mail</th>
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">Perfil Atribuído</th>
              <th className="text-left text-xs font-semibold text-slate-500 pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const profile = profiles.find(p => p.id === u.permission_profile_id);
              return (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-medium text-slate-800">{u.full_name || "—"}</td>
                  <td className="py-2.5 text-slate-500">{u.email}</td>
                  <td className="py-2.5">
                    {profile
                      ? <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">{profile.name}</span>
                      : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" />Sem perfil</span>}
                  </td>
                  <td className="py-2.5">
                    {u.is_active !== false
                      ? <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Ativo</span>
                      : <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Inativo</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {usersWithoutProfile.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{usersWithoutProfile.length} usuário(s) sem perfil atribuído.</strong> Esses usuários têm acesso mínimo (somente leitura).
              Atribua um perfil em Parametrizações → Usuários.
            </div>
          </div>
        )}
      </Section>

      {/* 4. Comportamento e Segurança */}
      <Section title="4. Comportamento das Permissões e Segurança">
        <div className="space-y-3">
          {[
            { ok: true, text: "Permissões definidas exclusivamente pelo Perfil — usuários não têm permissões diretas" },
            { ok: true, text: "Alterar o perfil muda o acesso imediatamente (sem necessidade de logout)" },
            { ok: true, text: "Menus e botões visíveis apenas se permitido pelo perfil" },
            { ok: true, text: "Acesso via URL bloqueado pelo componente ProtectedRoute" },
            { ok: true, text: "Usuário inativo continua cadastrado mas sem acesso efetivo" },
            { ok: true, text: "Fallback: usuários com role=admin no sistema têm acesso total (sem depender de perfil)" },
            { ok: profiles.length > 0, text: profiles.length === 0 ? "⚠ Nenhum perfil criado — criar perfis em Parametrizações → Perfis de Permissão" : "Perfis RBAC configurados e ativos" },
            { ok: usersWithoutProfile.length === 0, text: usersWithoutProfile.length > 0 ? `⚠ ${usersWithoutProfile.length} usuário(s) sem perfil — atribuir perfil em Parametrizações → Usuários` : "Todos os usuários possuem perfil atribuído" },
          ].map((item, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${item.ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
              {item.ok
                ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              <p className={`text-sm ${item.ok ? "text-green-800" : "text-amber-800"}`}>{item.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. Recomendações */}
      <Section title="5. Recomendações">
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">→</span>Criar os perfis padrão (Admin, Gestor de Projetos, Implantação, Viewer) em Parametrizações → Perfis de Permissão.</li>
          <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">→</span>Atribuir um perfil a todos os usuários cadastrados antes de disponibilizar o sistema.</li>
          <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">→</span>Revisar periodicamente se os perfis ainda refletem as responsabilidades de cada equipe.</li>
          <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">→</span>Perfis com permissão de "Editar Parametrizações" devem ser restritos a Admin ou responsáveis de sistema.</li>
          <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">→</span>Desativar usuários que saíram da equipe para manter o histórico sem conceder acesso.</li>
        </ul>
      </Section>
    </div>
  );
}