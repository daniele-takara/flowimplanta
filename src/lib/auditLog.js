import { base44 } from "@/api/base44Client";

/**
 * Registra uma alteração no log de auditoria do projeto.
 * @param {Object} params
 * @param {string} params.project_id - ID do projeto
 * @param {string} params.screen - Tela/aba onde ocorreu a edição
 * @param {string} params.field - Campo editado
 * @param {string} [params.old_value] - Valor anterior (truncado em 500 chars)
 * @param {string} [params.new_value] - Valor novo (truncado em 500 chars)
 */
export async function logAudit({ project_id, screen, field, old_value, new_value }) {
  try {
    const user = await base44.auth.me().catch(() => null);
    const user_email = user?.email || "Sistema";

    const truncate = (v) => {
      if (v === undefined || v === null) return null;
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return s.length > 500 ? s.substring(0, 497) + "..." : s;
    };

    await base44.entities.AuditLog.create({
      project_id,
      screen,
      field,
      user_email,
      old_value: truncate(old_value),
      new_value: truncate(new_value),
    });
  } catch (e) {
    // Silencioso — não interrompe o fluxo principal
    console.warn("[AuditLog] Erro ao registrar:", e);
  }
}