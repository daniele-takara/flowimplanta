import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Plus, Pencil, Trash2, Users, X, ChevronRight } from "lucide-react";
import { PERMISSION_MODULES, DEFAULT_PROFILES } from "@/lib/permissions";

const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function PermissionCheckbox({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function ProfileForm({ profile, userCount, onSave, onClose }) {
  const [name, setName] = useState(profile?.name || "");
  const [description, setDescription] = useState(profile?.description || "");
  const [perms, setPerms] = useState(profile?.permissions || {});
  const [saving, setSaving] = useState(false);

  const toggle = (key, value) => setPerms(p => ({ ...p, [key]: value }));

  // Quando "Visualizar" é desmarcado, desmarca tudo do módulo
  // Quando "Editar" é marcado, marca "Visualizar" automaticamente
  // projetos_excluir só é permitido para perfil "Admin"
  const isAdminProfile = name.trim().toLowerCase() === "admin";

  const handleToggle = (modulePerms, key, value) => {
    // Bloquear projetos_excluir em perfis não-Admin
    if (key === "projetos_excluir" && !isAdminProfile) return;

    const isViewKey = key.endsWith("_ver") || key.endsWith("_acessar");
    const isEditKey = !isViewKey;
    const newPerms = { ...perms, [key]: value };

    if (!value && isViewKey) {
      // Desmarcando visualizar → desmarca todas do módulo
      modulePerms.forEach(p => { newPerms[p.key] = false; });
    }
    if (value && isEditKey) {
      // Marcando editar → garante visualizar
      const viewKey = modulePerms.find(p => p.key.endsWith("_ver") || p.key.endsWith("_acessar"));
      if (viewKey) newPerms[viewKey.key] = true;
    }
    setPerms(newPerms);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description, permissions: perms });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">{profile ? "Editar Perfil" : "Novo Perfil de Permissão"}</h2>
            {userCount > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">{userCount} usuário(s) vinculado(s) a este perfil</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Nome e descrição */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome do perfil *</label>
                <input className={inputClass} value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Gestor, Viewer, Financeiro..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
                <input className={inputClass} value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do perfil" />
              </div>
            </div>

            {/* Permissões por módulo */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Permissões por Módulo</p>
              <div className="space-y-3">
                {PERMISSION_MODULES.map(mod => {
                  const viewPerm = mod.permissions.find(p => p.key.endsWith("_ver") || p.key.endsWith("_acessar"));
                  const hasView = viewPerm ? !!perms[viewPerm.key] : true;
                  return (
                    <div key={mod.key} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{mod.label}</span>
                        {viewPerm && (
                          <PermissionCheckbox
                            label="Acessar módulo"
                            checked={hasView}
                            onChange={v => handleToggle(mod.permissions, viewPerm.key, v)}
                          />
                        )}
                      </div>
                      <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
                        {mod.permissions
                          .filter(p => p.key !== viewPerm?.key)
                          .map(p => {
                            const isExcluirLocked = p.key === "projetos_excluir" && !isAdminProfile;
                            return (
                              <div key={p.key} className={isExcluirLocked ? "relative" : ""}>
                                <PermissionCheckbox
                                  label={isExcluirLocked ? `${p.label} (somente Admin)` : p.label}
                                  checked={isExcluirLocked ? false : !!perms[p.key]}
                                  onChange={v => handleToggle(mod.permissions, p.key, v)}
                                  disabled={!hasView || isExcluirLocked}
                                />
                              </div>
                            );
                          })}
                        {mod.permissions.filter(p => p.key !== viewPerm?.key).length === 0 && (
                          <span className="text-xs text-slate-400 italic">Apenas acesso (sem sub-permissões)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0 bg-white">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving || !name.trim()} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar Perfil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ count, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-base font-bold text-slate-800 mb-2">Confirmar exclusão</h3>
        {count > 0
          ? <p className="text-sm text-red-600 mb-1 font-medium">⚠️ {count} usuário(s) vinculados perderão o perfil!</p>
          : null}
        <p className="text-sm text-slate-500 mb-5">Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Excluir</button>
        </div>
      </div>
    </div>
  );
}

export default function TabPerfis() {
  const [profiles, setProfiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, u] = await Promise.all([
      base44.entities.PermissionProfile.list("name"),
      base44.entities.User.list(),
    ]);
    setProfiles(p);
    setUsers(u);
    if (!selected && p.length > 0) setSelected(p[0].id);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const getUserCount = (profileId) => users.filter(u => u.permission_profile_id === profileId).length;

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.PermissionProfile.update(editing.id, data);
    } else {
      const created = await base44.entities.PermissionProfile.create(data);
      setSelected(created.id);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    await base44.entities.PermissionProfile.delete(deleteId);
    setDeleteId(null);
    setSelected(null);
    load();
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    for (const p of DEFAULT_PROFILES) {
      const exists = profiles.find(pr => pr.name === p.name);
      if (!exists) {
        await base44.entities.PermissionProfile.create(p);
      }
    }
    setSeeding(false);
    load();
  };

  const selectedProfile = profiles.find(p => p.id === selected);
  const deleteProfile = profiles.find(p => p.id === deleteId);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">
          Perfis definem <strong>todas as permissões</strong>. Usuários herdam as permissões do perfil atribuído.
        </p>
        <div className="flex items-center gap-2">
          {profiles.length === 0 && (
            <button onClick={handleSeedDefaults} disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-50">
              {seeding ? "Criando..." : "Criar perfis padrão"}
            </button>
          )}
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Novo Perfil
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium mb-1">Nenhum perfil cadastrado</p>
          <p className="text-slate-400 text-sm mb-4">Crie perfis personalizados ou importe os padrões do sistema.</p>
          <button onClick={handleSeedDefaults} disabled={seeding}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            {seeding ? "Criando..." : "Criar perfis padrão"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {/* Lista de perfis */}
          <div className="col-span-1 space-y-2">
            {profiles.map(p => {
              const count = getUserCount(p.id);
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${selected === p.id ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className={`w-4 h-4 ${selected === p.id ? "text-blue-500" : "text-slate-400"}`} />
                      <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${selected === p.id ? "text-blue-400" : "text-slate-300"}`} />
                  </div>
                  {p.description && <p className="text-xs text-slate-400 mt-1 ml-6 truncate">{p.description}</p>}
                  <div className="flex items-center gap-1 ml-6 mt-1.5">
                    <Users className="w-3 h-3 text-slate-300" />
                    <span className="text-xs text-slate-400">{count} usuário(s)</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalhe do perfil selecionado */}
          {selectedProfile && (
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-800">{selectedProfile.name}</h3>
                  </div>
                  {selectedProfile.description && <p className="text-xs text-slate-400 mt-0.5 ml-6">{selectedProfile.description}</p>}
                  <p className="text-xs text-slate-400 mt-1 ml-6 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {getUserCount(selectedProfile.id)} usuário(s) vinculado(s)
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setEditing(selectedProfile); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => setDeleteId(selectedProfile.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {PERMISSION_MODULES.map(mod => {
                  const modPerms = selectedProfile.permissions || {};
                  const activePerms = mod.permissions.filter(p => modPerms[p.key]);
                  const hasAny = activePerms.length > 0;
                  return (
                    <div key={mod.key} className={`rounded-lg border px-4 py-3 ${hasAny ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{mod.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${hasAny ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                          {hasAny ? "Acesso permitido" : "Sem acesso"}
                        </span>
                      </div>
                      {hasAny && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {activePerms.map(p => (
                            <span key={p.key} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">{p.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ProfileForm
          profile={editing}
          userCount={editing ? getUserCount(editing.id) : 0}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
      {deleteId && (
        <DeleteConfirm
          count={getUserCount(deleteId)}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}