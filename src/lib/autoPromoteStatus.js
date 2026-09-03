import { base44 } from "@/api/base44Client";

/**
 * Promove um projeto de "Em aberto" para "Em andamento" quando ele recebe
 * a primeira edição real em TAP, Cronograma ou Escopo Técnico.
 *
 * Regra:
 * - Só age se o status atual for exatamente "Em aberto".
 * - Nunca toca em "Pausado", "Concluído", "Perdido" ou projetos já "Em andamento".
 *
 * @param {string} projectId
 * @param {string} currentStatus — status atual do projeto (project?.status)
 * @returns {Promise<string>} o status resultante (novo se promoveu, ou o mesmo se não agiu)
 */
export async function autoPromoteToInProgress(projectId, currentStatus) {
  if (!projectId || currentStatus !== "Em aberto") return currentStatus;
  try {
    await base44.entities.Project.update(projectId, { status: "Em andamento" });
    return "Em andamento";
  } catch (e) {
    console.error("[autoPromoteToInProgress] Falha ao promover status:", e);
    return currentStatus;
  }
}