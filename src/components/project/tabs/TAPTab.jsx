import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/utils";
import {
  Download, RefreshCw, CheckCircle2, XCircle, Clock, Lock,
  History, Send, ChevronDown, ChevronUp, AlertCircle, Info
} from "lucide-react";
import {
  buildParticipants, buildDatas, buildEntregas, FASES_MACRO, getAnswer
} from "@/lib/tapTemplate";
import { CONTRACTED_MODULES_OPTIONS } from "@/lib/scopeTemplate";
import { buildProjectScheduleView } from "@/lib/buildProjectScheduleView.js";
import { logAudit } from "@/lib/auditLog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAnswersMap(scopeItems) {
  const map = {};
  (scopeItems || []).forEach(item => {
    if (item.question_id) map[item.question_id] = item.answer || "";
    if (item.order_number) {
      const key = `q${String(item.order_number).padStart(3, "0")}`;
      if (!map[key]) map[key] = item.answer || "";
    }
  });
  return map;
}

/**
 * Constrói o snapshot do cronograma para a seção 5 da TAP usando a fonte oficial.
 * Carrega overrides de fases e fases locais do banco para refletir o cronograma real.
 * Retorna array de { label, plannedStart, plannedEnd }.
 */
async function buildScheduleSnapshotFromDB(projectId, answersMap, project) {
  console.log("[TAPTab] buildScheduleSnapshotFromDB INÍCIO — project_id:", projectId);
  try {
    // Recarrega projeto do banco para garantir schedule_overrides mais recentes
    const freshProjectList = await base44.entities.Project.filter({ id: projectId });
    const freshProject = freshProjectList[0] || project;

    const [phaseOverrideList, localPhaseList, savedActivities] = await Promise.all([
      base44.entities.SchedulePhaseOverride.filter({ project_id: projectId }),
      base44.entities.LocalSchedulePhase.filter({ project_id: projectId }),
      base44.entities.ScheduleActivity.filter({ project_id: projectId }),
    ]);

    // Carregar overrides manuais do banco (fonte de verdade compartilhada entre usuários)
    // Usa freshProject (recém carregado do banco) para garantir dados atualizados
    let dbOverrides = {};
    try {
      const raw = freshProject?.schedule_overrides;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        dbOverrides = raw;
      }
    } catch {}
    
    // Fallback: localStorage (para dados ainda não migrados de usuários antigos)
    let localOverrides = { ...dbOverrides };
    try {
      const ls = JSON.parse(localStorage.getItem(`schedule_overrides_${projectId}`) || "{}");
      // localStorage sobrepõe DB — prioridade para o usuário atual
      Object.entries(ls).forEach(([k, v]) => { if (v && typeof v === "object") localOverrides[k] = { ...(localOverrides[k] || {}), ...v }; });
    } catch {}

    console.log("[TAPTab] buildScheduleSnapshotFromDB — Dados carregados:", {
      phaseOverrideList: phaseOverrideList?.length || 0,
      localPhaseList: localPhaseList?.length || 0,
      savedActivities: savedActivities?.length || 0,
      localStorageOverrideKeys: Object.keys(localOverrides).length,
    });

    const phaseOverridesMap = {};
    (phaseOverrideList || []).forEach(o => { phaseOverridesMap[o.phase_name] = o; });
    const localPhases = (localPhaseList || []).filter(p => p.is_active !== false);

    console.log("[TAPTab] buildScheduleSnapshotFromDB — phaseOverridesMap:", Object.keys(phaseOverridesMap));
    console.log("[TAPTab] buildScheduleSnapshotFromDB — localPhases:", localPhases.map(p => p.phase_name));

    const scheduleView = buildProjectScheduleView({
      project: freshProject,
      answersMap,
      savedActivities: savedActivities || [],
      phaseOverridesMap,
      localPhases,
      manualOverrides: localOverrides,
      includeInactive: false,
    });

    console.log("[TAPTab] buildScheduleSnapshotFromDB — scheduleView RETORNO:", {
      total: scheduleView?.length || 0,
      fases: scheduleView?.map(f => ({ nome: f.phase_name, is_local: f.is_local, is_active: f.is_active, start: f.planned_start, end: f.planned_end })),
    });

    const result = scheduleView
      .map(ph => ({
        label: ph.phase_name,
        plannedStart: ph.planned_start || null,
        plannedEnd: ph.planned_end || null,
        isLocal: ph.is_local,
      }));

    console.log("[TAPTab] buildScheduleSnapshotFromDB — scheduleSnapshot final:", {
      total: result.length,
      fases: result.map(f => f.label),
    });

    return result;
  } catch (err) {
    console.error("[TAPTab] buildScheduleSnapshotFromDB ERRO:", err?.message, err);
    return [];
  }
}

function fmtTapDate(d) {
  if (!d) return "—";
  const [y,m,day] = d.substring(0,10).split("-");
  return `${day}/${m}/${y}`;
}

const ALL_SERVICES = [
  "Parametrização e cálculo (1 vez na implantação)",
  "Treinamentos das pessoas chave (Implantação)",
  "Arquivo txt de exportação para FOPAG",
  "Integração Sankhya",
  "Integrações (disponibilização de API)",
  "Importação de arquivo AFD em nuvem",
  "Compliance e Cibersegurança",
  "Parametrizações e Cálculos Mensal",
  "Atendimento e Suporte dedicado"
];

function buildModulosServicos(project) {
  const contractedMods = project?.contracted_modules || [];
  const contractedSvcs = project?.contracted_services || [];
  return {
    modules: CONTRACTED_MODULES_OPTIONS.map(m => ({ nome: m, contratado: contractedMods.includes(m) })),
    services: ALL_SERVICES.map(s => ({ nome: s, contratado: contractedSvcs.includes(s) })
    )
  };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

function SectionTitle({ number, children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{number}</span>
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{children}</h2>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function SubSectionTitle({ children }) {
  return <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{children}</p>;
}

// Chip showing data origin — não editável
function AutoBadge({ source }) {
  const labels = {
    "dados_iniciais": "Dados Iniciais",
    "escopo": "Escopo Técnico",
    "cronograma": "Cronograma",
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
      <Lock className="w-2.5 h-2.5" />
      {labels[source] || source}
    </span>
  );
}

// Linha de dado automático (somente leitura)
function AutoRow({ label, value, source }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-slate-50 last:border-0 group">
      <div className="col-span-2 flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setShowTip(t => !t)}
        >
          <Info className="w-3 h-3 text-amber-400" />
        </button>
      </div>
      <div className="col-span-3">
        <span className="text-sm text-slate-800">{value || "—"}</span>
        {showTip && (
          <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded border border-amber-100">
            Preenchido automaticamente. Para alterar, edite a fonte: <strong>{source === "dados_iniciais" ? "Dados Iniciais" : source === "escopo" ? "Escopo Técnico" : source}</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

// Campo de texto editável da TAP
function EditableField({ label, value, onChange, onBlur, rows = 3, placeholder, locked }) {
  const [showLockMsg, setShowLockMsg] = useState(false);
  if (locked) {
    return (
      <div>
        {label && <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>}
        <div
          className="bg-slate-50 rounded-lg p-3 border border-slate-100 cursor-not-allowed"
          onClick={() => setShowLockMsg(true)}
        >
          <p className="text-sm text-slate-500 whitespace-pre-wrap">{value || "—"}</p>
        </div>
        {showLockMsg && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Versão enviada ao cliente está bloqueada para edição.
          </p>
        )}
      </div>
    );
  }
  return (
    <div>
      {label && <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
      />
    </div>
  );
}

function SaveStatus({ status }) {
  if (!status) return null;
  if (status === "saving") return <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 animate-spin" />Salvando...</span>;
  if (status === "saved") return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Salvo</span>;
  if (status === "error") return <span className="text-xs text-red-500 flex items-center gap-1"><XCircle className="w-3 h-3" />Erro ao salvar</span>;
  return null;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function generatePDF({ project, form, answersMap, participants, datas, modulosServicos, entregas, version, scheduleSnapshot }) {
  const nome = project?.name || "Projeto";
  const versionLabel = version ? `v${version.version_number} · ${version.status}` : "";

  // Group entregas
  const grouped = {};
  entregas.forEach(e => {
    if (!grouped[e.grupo]) grouped[e.grupo] = [];
    grouped[e.grupo].push(e.label);
  });

  // Blocks from JSON
  const BLOCKS_JSON = [
    { id: "registro_ponto", title: "Registro de ponto", content: "Registro de ponto: realizar o registro de ponto conforme as definições mapeadas no escopo técnico.", show: (p, a) => (p.contracted_modules || []).includes("Registro de Ponto") },
    { id: "importacao_afd", title: "Importação de AFD", content: "Importação de AFD: realizar a importação de arquivo AFD através da ferramenta de importação disponível para fechamento de ponto piloto.", show: (p, a) => getAnswer(a, "q015").includes("AFD importação") },
    { id: "app_gestao", title: "APP Gestão", content: "APP Gestão: realizar acesso ao APP Gestão por funcionários para acompanhamento da folha de ponto, solicitações e/ou registro de ponto.", show: (p, a) => getAnswer(a, "q015").includes("App Gestão") },
    { id: "notificacoes_ponto", title: "Notificações de ponto", content: "Notificações de ponto: funcionários ou gestores receberão notificações no App Gestão ou Gestão Web conforme as configurações disponíveis no sistema referentes ao registro de ponto.", show: (p, a) => getAnswer(a, "q019") === "Sim" },
    { id: "calculos_tratamento", title: "Parametrização de regras de cálculo", content: "Parametrização de regra de cálculo: deverá calcular as horas conforme parâmetros mapeados e configurações disponíveis no sistema.", show: (p, a) => (p.contracted_modules || []).includes("Cálculos e Tratamento") },
    { id: "banco_horas", title: "Parametrização de banco de horas", content: "Parametrização de banco de horas: deverá calcular as horas para banco de horas conforme parâmetros mapeados e configurações disponíveis no sistema.", show: (p, a) => getAnswer(a, "q037") === "Sim" },
    { id: "arquivo_verbas", title: "Parametrização de arquivo de verbas", content: "Parametrização de arquivo de verbas: será possível importar para a folha de pagamento, através de arquivo de exportação, as verbas oriundas da folha de ponto.", show: (p, a) => (p.contracted_services || []).includes("Arquivo txt de exportação para FOPAG") || (p.contracted_services || []).includes("Integração Sankhya") || p.origin === "Sankhya" },
    { id: "sobreaviso", title: "Parametrização de sobreaviso", content: "Parametrização de Sobreaviso: o sistema deve permitir o planejamento de jornadas de sobreaviso e calcular automaticamente os apontamentos correspondentes.", show: (p, a) => getAnswer(a, "q038") === "Sim" },
    { id: "nr17", title: "Parametrização de NR17", content: "Parametrização de NR17: permitir a criação e gestão de jornadas aderentes à Norma Regulamentadora 17, incluindo pausas obrigatórias e configurações específicas.", show: (p, a) => getAnswer(a, "q039") === "Sim" },
    { id: "gestao_participativa_regras_solicitacao", title: "Parametrização das regras de solicitação", content: "Parametrização das Regras de Solicitação: usuários com permissão poderão realizar solicitações como correção de ponto, lançamento de atestado e outros fluxos.", show: (p, a) => getAnswer(a, "q040") === "Descentralizada" },
    { id: "assinatura_espelho", title: "Assinatura de espelho de ponto", content: "Assinatura de espelho de ponto dentro do sistema: colaborador e/ou outro perfil definido fará a confirmação do espelho de ponto.", show: (p, a) => getAnswer(a, "q049") === "Sim" },
    { id: "permissao_usuario", title: "Configuração de permissão de usuário", content: "Configuração de permissão de usuário: permissões devem ser parametrizadas conforme alinhamento realizado com o cliente.", show: (p, a) => (p.contracted_modules || []).includes("Gestão de Ponto Participativa") },
    { id: "notificacao_hora_extra", title: "Notificação de hora extra", content: "Notificação de hora extra: funcionários ou gestores receberão notificações no App Gestão ou Gestão Web.", show: (p, a) => getAnswer(a, "q062") === "Sim" },
    { id: "gestao_horas_extras", title: "Solicitação, justificativa e aprovação de horas extras", content: "Solicitação, justificativa e aprovação de horas extras: usuários poderão solicitar ou justificar horas extras realizadas, com aprovação ou reprovação por perfis autorizados.", show: (p, a) => getAnswer(a, "q052") === "Sim" },
    { id: "gestao_ferias", title: "Gestão de férias", content: "Gestão de férias: será possível realizar solicitação de férias por funcionário e/ou outro perfil cadastrado.", show: (p, a) => (p.contracted_modules || []).includes("Gestão de Férias e Ausências") },
    { id: "timesheet_aloque", title: "Timesheet (Aloque)", content: "Timesheet: será possível realizar apontamento de atividades, permitindo que colaboradores registrem horas trabalhadas em projetos, tarefas ou centros de custo.", show: (p, a) => (p.contracted_modules || []).includes("Timesheet") },
    { id: "integracao_sankhya", title: "Integração Sankhya", content: "Integração Sankhya: integração ativa entre Sankhya e Pontotel conforme critérios do documento inicial de integração.", show: (p, a) => (p.contracted_services || []).includes("Integração Sankhya") },
    { id: "api_documentacao", title: "Usuário de API + Documentação", content: "Usuário de API + Documentação: cadastro de usuário de API e liberação da documentação correspondente.", show: (p, a) => (p.contracted_services || []).includes("Integrações (disponibilização de API)") },
    { id: "sftp_afd", title: "Integração do arquivo AFD por meio da pasta sFTP", content: "Integração do arquivo AFD por meio da pasta sFTP: configuração para disponibilização e processamento dos arquivos AFD por meio de pasta sFTP/FTP.", show: (p, a) => (p.contracted_services || []).includes("Importação de arquivo AFD em nuvem") },
  ];

  const visibleBlocks = BLOCKS_JSON.filter(b => b.show(project, answersMap));

  const dataConc = project?.aligned_end_date || project?.planned_end_date;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>TAP – ${esc(nome)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 28px 32px; line-height: 1.45; }
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { font-size: 18px; color: #1e40af; font-weight: bold; }
  .header .meta { font-size: 10px; color: #64748b; margin-top: 3px; }
  .version-badge { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; }
  .section { margin-bottom: 14px; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
  .section-num { width: 18px; height: 18px; background: #1e40af; color: white; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; flex-shrink: 0; }
  .sub-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.3px; margin: 8px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  td { padding: 3px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10.5px; }
  td.lbl { color: #64748b; width: 40%; font-weight: 600; font-size: 10px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 7px 10px; margin-bottom: 6px; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: bold; margin: 1px 2px; }
  .tag-ok { background: #dcfce7; color: #166534; }
  .tag-no { background: #f1f5f9; color: #94a3b8; }
  .participant-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .participant-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px 8px; }
  .participant-role { font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #3b82f6; }
  .participant-name { font-size: 10.5px; font-weight: 600; color: #1e293b; }
  .participant-contact { font-size: 9.5px; color: #94a3b8; }
  .entrega-item { padding: 4px 7px; background: white; border: 1px solid #e2e8f0; border-radius: 3px; margin-bottom: 3px; font-size: 10.5px; display: flex; align-items: flex-start; gap: 5px; }
  .entrega-dot { width: 5px; height: 5px; background: #3b82f6; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
  .fase-row { display: flex; gap: 8px; align-items: center; padding: 3px 0; border-bottom: 1px solid #f1f5f9; }
  .fase-badge { background: #dbeafe; color: #1e40af; padding: 1px 7px; border-radius: 8px; font-size: 9px; font-weight: bold; white-space: nowrap; }
  .text-block { background: #f8fafc; border-left: 3px solid #3b82f6; padding: 7px 11px; border-radius: 0 5px 5px 0; font-size: 10.5px; line-height: 1.5; color: #334155; }
  .conclusao { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 8px 11px; font-size: 10.5px; color: #1e3a5f; border-radius: 0 5px 5px 0; line-height: 1.5; }
  .sig { display: flex; gap: 32px; margin-top: 14px; }
  .sig-box { flex: 1; text-align: center; border: 1px solid #cbd5e1; border-radius: 5px; padding: 14px 10px; }
  .sig-box .line { border-top: 1px solid #334155; margin: 18px auto 5px; width: 80%; }
  @media print {
    body { padding: 12px 18px; }
    .section { page-break-inside: avoid; }
    .entrega-item { page-break-inside: avoid; }
    .participant-grid { page-break-inside: avoid; }
  }
</style></head><body>
<div class="header">
  <div>
    <h1>Termo de Abertura do Projeto (TAP)</h1>
    <div class="meta">${esc(project?.client_name)} · ${esc(project?.implantation_type)} · Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;">
    ${versionLabel ? `<div class="version-badge">${esc(versionLabel)}</div>` : ""}
    <img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/1a9549a83_LogoPontotel_AmarelaePreta.png" style="height:40px" alt="Pontotel" />
  </div>
</div>

<div class="section">
  <div class="section-title"><span class="section-num">1</span> OBJETIVO</div>
  <div class="text-block">${esc(form.objetivo)}</div>
</div>

<div class="section">
  <div class="section-title"><span class="section-num">2</span> PARTICIPANTES</div>
  <div class="participant-grid">
    ${participants.map(p => `
      <div class="participant-card">
        <div class="participant-role">${esc(p.role)}</div>
        <div class="participant-name">${esc(p.name)}</div>
        ${p.contact ? `<div class="participant-contact">${esc(p.contact)}</div>` : ""}
      </div>
    `).join("")}
  </div>
</div>

<div class="section">
  <div class="section-title"><span class="section-num">3</span> CONDIÇÕES GERAIS</div>

  <div class="sub-title">3.1 Dimensão do Projeto</div>
  <table>
    <tr><td class="lbl">Nº funcionários contratados</td><td>${esc(project?.contracted_employees || getAnswer(answersMap, "q001"))}</td></tr>
    <tr><td class="lbl">Nº de operações existentes</td><td>${esc(getAnswer(answersMap, "q002"))}</td></tr>
    <tr><td class="lbl">Tipo de tratativa de ponto</td><td>${esc(getAnswer(answersMap, "q040"))}</td></tr>
    <tr><td class="lbl">Quantidade de sindicatos</td><td>${esc(getAnswer(answersMap, "q024"))}</td></tr>
    <tr><td class="lbl">Sistema de folha de pagamento</td><td>${esc(getAnswer(answersMap, "q028"))}</td></tr>
  </table>

  <div class="sub-title">3.2 Datas Importantes</div>
  <table>
    <tr><td class="lbl">Período de apuração do ponto</td><td>${esc(datas.periodo_apuracao)}</td></tr>
    <tr><td class="lbl">Período de apuração da folha</td><td>${esc(datas.periodo_folha)}</td></tr>
    <tr><td class="lbl">Período de fechamento da folha</td><td>${esc(datas.periodo_fechamento)}</td></tr>
    <tr><td class="lbl">Prazo envio para contabilidade</td><td>${datas.prazo_contabilidade ? `Dia ${esc(datas.prazo_contabilidade)}` : "—"}</td></tr>
    <tr><td class="lbl">Data de pagamento</td><td>${datas.data_pagamento ? `Dia ${esc(datas.data_pagamento)}` : "—"}</td></tr>
  </table>

  ${(form.formato_expansao || form.expectativa_inicio_expansao) ? `
  <div class="sub-title">3.3 Expansão do Registro de Ponto</div>
  <table>
    ${form.formato_expansao ? `<tr><td class="lbl">Formato da expansão</td><td>${esc(form.formato_expansao)}</td></tr>` : ""}
    ${form.expectativa_inicio_expansao ? `<tr><td class="lbl">Expectativa para iniciar a expansão</td><td>${esc(form.expectativa_inicio_expansao)}</td></tr>` : ""}
  </table>
  ` : ""}

  <div class="sub-title">3.4 Módulos e Serviços</div>
  <div class="card">
    <div style="margin-bottom:6px"><strong style="font-size:10px">Módulos:</strong><br>
      ${modulosServicos.modules.map(m => `<span class="tag ${m.contratado ? "tag-ok" : "tag-no"}">${esc(m.nome)}</span>`).join("")}
    </div>
    <div><strong style="font-size:10px">Serviços:</strong><br>
      ${modulosServicos.services.filter(s => s.contratado).map(s => `<span class="tag tag-ok">${esc(s.nome)}</span>`).join("")}
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title"><span class="section-num">4</span> ENTREGAS PREVISTAS</div>
  ${visibleBlocks.map(b => `
    <div class="entrega-item">
      <div class="entrega-dot"></div>
      <div><strong>${esc(b.title)}</strong><br><span style="color:#64748b">${esc(b.content)}</span></div>
    </div>
  `).join("")}
</div>

<div class="section">
  <div class="section-title"><span class="section-num">5</span> CRONOGRAMA</div>
  ${scheduleSnapshot && scheduleSnapshot.length > 0 ? `
    <table>
      <tr style="background:#f8fafc">
        <td class="lbl" style="font-weight:bold">Fase</td>
        <td class="lbl" style="font-weight:bold">Início Planejado</td>
        <td class="lbl" style="font-weight:bold">Fim Planejado</td>
      </tr>
      ${scheduleSnapshot.map(f => {
        const fmt = d => { if(!d) return "—"; const [y,m,day]=d.substring(0,10).split("-"); return `${day}/${m}/${y}`; };
        return `<tr><td>${esc(f.label)}</td><td>${fmt(f.plannedStart)}</td><td>${fmt(f.plannedEnd)}</td></tr>`;
      }).join("")}
    </table>
  ` : FASES_MACRO.map(f => `
    <div class="fase-row">
      <span class="fase-badge">${esc(f.fase)}</span>
      <span>${esc(f.descricao)}</span>
    </div>
  `).join("")}
  ${dataConc ? `
  <div class="sub-title" style="margin-top:10px">5.1 Data esperada de conclusão</div>
  <div class="text-block">
    A data esperada para a conclusão deste projeto é: <strong>${esc(formatDate(dataConc))}</strong>, definida em comum acordo com o(a) líder do projeto da ${esc(project?.client_name)}. Essa data será considerada como referência para o encerramento formal das atividades de implantação.
  </div>
  ` : ""}
</div>

<div class="section">
  <div class="section-title"><span class="section-num">6</span> CONCLUSÃO</div>
  <div class="conclusao">${esc(form.conclusao)}</div>
</div>
</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 700);
}

// ── Status badge de versão ─────────────────────────────────────────────────

const STATUS_COLORS = {
  "Rascunho": "bg-slate-100 text-slate-600 border-slate-200",
  "Finalizada": "bg-blue-50 text-blue-700 border-blue-200",
  "Enviada ao cliente": "bg-green-50 text-green-700 border-green-200",
};

function VersionBadge({ status }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[status] || STATUS_COLORS["Rascunho"]}`}>
      {status}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const DEBOUNCE_MS = 1500;

export default function TAPTab({ project, scopeItems, documents, projectId, onRefresh, readOnly = false, canGeneratePDF = true }) {
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const debounceRef = useRef(null);
  const savedTimerRef = useRef(null);

  // Campos editáveis da TAP
  const [form, setForm] = useState({
    objetivo: "",
    formato_expansao: "",
    expectativa_inicio_expansao: "",
    conclusao: "",
  });

  // Snapshot do cronograma para seção 5 (somente leitura na TAP)
  const [scheduleSnapshot, setScheduleSnapshot] = useState([]);

  // Dados automáticos (recalculados a partir das props)
  const answersMap = useMemo(() => buildAnswersMap(scopeItems), [scopeItems]);
  const participants = useMemo(() => buildParticipants(project || {}), [project]);
  const datas = useMemo(() => buildDatas(project || {}, answersMap), [project, answersMap]);
  const modulosServicos = useMemo(() => buildModulosServicos(project), [project]);
  const entregas = useMemo(() => buildEntregas(answersMap, project || {}), [answersMap, project]);

  // Default texts (gerados uma vez baseado no projeto)
  const defaultObjetivo = `Este Termo de Abertura define as diretrizes e premissas para a configuração do sistema Pontotel no projeto da ${project?.client_name || ""}. Todas as definições aqui contidas serão consideradas como base para o processo de implantação. Caso haja necessidade de alterações, será realizado novo mapeamento e validação com as partes envolvidas.`;
  const defaultConclusao = `Este Termo formaliza as diretrizes do projeto de implantação da Pontotel para ${project?.client_name || ""}.\n\nPara qualquer dúvida ou necessidade de ajuste no escopo, entre em contato com nosso time pelo e-mail implantacao@pontotel.com.br.\n\nA evolução e o sucesso do projeto dependem da colaboração contínua entre as partes envolvidas.`;

  // Carrega versões
  const loadVersions = useCallback(async () => {
    console.log("[TAPTab] loadVersions — INÍCIO, project_id:", projectId);
    setLoadingVersions(true);
    try {
      const vs = await base44.entities.TAPVersion.filter({ project_id: projectId }, "-version_number");
      console.log("[TAPTab] loadVersions — versões carregadas:", vs.length);
      setVersions(vs);
      const current = vs.find(v => v.is_current) || vs[0] || null;
      console.log("[TAPTab] loadVersions — versão current:", current?.version_number, "id:", current?.id);
      if (current) {
        setCurrentVersion(current);
        setForm({
          objetivo: current.objetivo || defaultObjetivo,
          formato_expansao: current.formato_expansao || "",
          expectativa_inicio_expansao: current.expectativa_inicio_expansao || "",
          conclusao: current.conclusao || defaultConclusao,
        });
        // Restaurar snapshot do cronograma salvo
        if (current.schedule_snapshot) {
          try {
            const parsed = JSON.parse(current.schedule_snapshot);
            console.log("[TAPTab] loadVersions — schedule_snapshot RESTAURADO:", parsed.length, "fases:", parsed.map(f => f.label));
            setScheduleSnapshot(parsed);
          } catch (e) {
            console.error("[TAPTab] loadVersions — ERRO ao parsear schedule_snapshot:", e);
          }
        } else {
          console.log("[TAPTab] loadVersions — schedule_snapshot VAZIO na versão salva");
        }
      } else {
        console.log("[TAPTab] loadVersions — SEM versões, inicializando com defaults");
        setForm({ objetivo: defaultObjetivo, formato_expansao: "", expectativa_inicio_expansao: "", conclusao: defaultConclusao });
      }
    } catch (e) {
      console.error("[TAPTab] loadVersions — ERRO:", e);
      setForm({ objetivo: defaultObjetivo, formato_expansao: "", expectativa_inicio_expansao: "", conclusao: defaultConclusao });
    }
    setLoadingVersions(false);
    console.log("[TAPTab] loadVersions — FIM");
  }, [projectId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const isLocked = currentVersion?.status === "Enviada ao cliente";
  const lastUpdate = currentVersion?.last_auto_update
    ? new Date(currentVersion.last_auto_update).toLocaleString("pt-BR")
    : null;

  // Cria ou atualiza versão atual
  const saveVersion = useCallback(async (formData, opts = {}) => {
    console.log("[TAPTab] saveVersion — INÍCIO", {
      currentVersionId: currentVersion?.id,
      isLocked,
      scheduleSnapshotSize: opts.scheduleSnapshot?.length,
      scheduleSnapshotFases: opts.scheduleSnapshot?.map(f => f.label),
    });
    setSaveStatus("saving");
    const autoSnapshot = JSON.stringify({ answersMap, participants, datas });
    const payload = {
      project_id: projectId,
      objetivo: formData.objetivo,
      formato_expansao: formData.formato_expansao,
      expectativa_inicio_expansao: formData.expectativa_inicio_expansao,
      conclusao: formData.conclusao,
      auto_data_snapshot: autoSnapshot,
      is_current: true,
      ...(opts.updateAutoTime ? { last_auto_update: new Date().toISOString() } : {}),
      ...(opts.scheduleSnapshot ? { schedule_snapshot: JSON.stringify(opts.scheduleSnapshot) } : {}),
    };

    try {
      if (currentVersion && !isLocked) {
        await base44.entities.TAPVersion.update(currentVersion.id, payload);
        console.log("[TAPTab] saveVersion — versão ATUALIZADA no banco");
        // Auditoria em campos alterados
        ["objetivo", "formato_expansao", "expectativa_inicio_expansao", "conclusao"].forEach(field => {
          const oldVal = currentVersion?.[field] || "";
          const newVal = formData[field] || "";
          if (String(oldVal).substring(0, 200) !== String(newVal).substring(0, 200)) {
            logAudit({ project_id: projectId, screen: "TAP", field, old_value: oldVal, new_value: newVal });
          }
        });
        setCurrentVersion(cv => ({ ...cv, ...payload }));
      } else if (!currentVersion) {
        const user = await base44.auth.me();
        const newV = await base44.entities.TAPVersion.create({
          ...payload,
          version_number: 1,
          status: "Rascunho",
          created_by_name: user?.full_name || user?.email || "",
          last_auto_update: new Date().toISOString(),
        });
        console.log("[TAPTab] saveVersion — versão CRIADA no banco", newV.id);
        setCurrentVersion(newV);
        setVersions([newV]);
      }
      setSaveStatus("saved");
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus(null), 2500);
      console.log("[TAPTab] saveVersion — FIM");
    } catch (e) {
      console.error("[TAPTab] saveVersion — ERRO:", e);
      setSaveStatus("error");
    }
  }, [currentVersion, isLocked, projectId, answersMap, participants, datas]);

  // Ao editar após versão enviada: cria nova versão
  const createNewVersionIfNeeded = useCallback(async (formData) => {
    if (!isLocked) return false;
    const user = await base44.auth.me();
    const nextNum = (versions[0]?.version_number || 0) + 1;
    // Marcar versão anterior como não-current
    if (currentVersion) {
      await base44.entities.TAPVersion.update(currentVersion.id, { is_current: false });
    }
    const newV = await base44.entities.TAPVersion.create({
      project_id: projectId,
      version_number: nextNum,
      status: "Rascunho",
      created_by_name: user?.full_name || user?.email || "",
      objetivo: formData.objetivo,
      formato_expansao: formData.formato_expansao,
      expectativa_inicio_expansao: formData.expectativa_inicio_expansao,
      conclusao: formData.conclusao,
      auto_data_snapshot: JSON.stringify({ answersMap, participants, datas }),
      last_auto_update: new Date().toISOString(),
      is_current: true,
    });
    setCurrentVersion(newV);
    setVersions(vs => [newV, ...vs]);
    return true;
  }, [isLocked, currentVersion, versions, projectId, answersMap, participants, datas]);

  const setField = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (isLocked) {
        await createNewVersionIfNeeded(next);
      } else {
        saveVersion(next);
      }
    }, DEBOUNCE_MS);
  };

  const handleBlur = () => {
    clearTimeout(debounceRef.current);
    if (!isLocked) saveVersion(form);
  };

  // Botão "Atualizar dados automáticos"
  const handleRefreshAuto = async () => {
    console.log("[TAPTab] handleRefreshAuto — INÍCIO");
    console.log("[TAPTab] handleRefreshAuto — project_id:", projectId);
    console.log("[TAPTab] handleRefreshAuto — currentVersion:", currentVersion?.version_number, "status:", currentVersion?.status);
    console.log("[TAPTab] handleRefreshAuto — scheduleSnapshot atual:", scheduleSnapshot.length, "fases:", scheduleSnapshot.map(f => f.label));
    
    setRefreshing(true);
    await onRefresh(); // busca dados mais recentes do projeto/escopo
    
    // Sempre atualiza o snapshot do cronograma com a fonte oficial do banco
    const isSent = currentVersion?.status === "Enviada ao cliente";
    console.log("[TAPTab] handleRefreshAuto — isSent:", isSent);
    
    let snap = scheduleSnapshot;
    if (!isSent) {
      console.log("[TAPTab] handleRefreshAuto — CHAMANDO buildScheduleSnapshotFromDB");
      snap = await buildScheduleSnapshotFromDB(projectId, answersMap, project);
      console.log("[TAPTab] handleRefreshAuto — snap RETORNADO:", snap.length, "fases:", snap.map(f => f.label));
      setScheduleSnapshot(snap);
    } else {
      console.log("[TAPTab] handleRefreshAuto — PULANDO atualização (versão enviada ao cliente)");
    }
    
    console.log("[TAPTab] handleRefreshAuto — SALVANDO versão com scheduleSnapshot:", snap.length, "fases:", snap.map(f => f.label));
    await saveVersion(form, { updateAutoTime: true, scheduleSnapshot: snap });
    console.log("[TAPTab] handleRefreshAuto — FIM");
    setRefreshing(false);
  };

  // Finalizar versão
  const handleFinalize = async () => {
    if (!currentVersion) return;
    await base44.entities.TAPVersion.update(currentVersion.id, { status: "Finalizada" });
    setCurrentVersion(cv => ({ ...cv, status: "Finalizada" }));
    setVersions(vs => vs.map(v => v.id === currentVersion.id ? { ...v, status: "Finalizada" } : v));
  };

  // Marcar como enviada ao cliente
  const handleMarkSent = async () => {
    if (!currentVersion) return;
    // Gera PDF e trava versão
    generatePDF({ project, form, answersMap, participants, datas, modulosServicos, entregas, version: currentVersion });
    await base44.entities.TAPVersion.update(currentVersion.id, { status: "Enviada ao cliente" });
    setCurrentVersion(cv => ({ ...cv, status: "Enviada ao cliente" }));
    setVersions(vs => vs.map(v => v.id === currentVersion.id ? { ...v, status: "Enviada ao cliente" } : v));
  };

  // Visualizar versão histórica
  const viewHistoricVersion = (v) => {
    toast({ title: `Visualização de versão histórica v${v.version_number} (${v.status}) — em desenvolvimento. Para export, use o PDF da versão atual.` });
  };

  // Blocos de entregas conforme JSON
  const ENTREGA_BLOCKS = [
    { id: "registro_ponto", title: "Registro de ponto", content: "Registro de ponto: realizar o registro de ponto conforme as definições mapeadas no escopo técnico.", show: () => (project?.contracted_modules || []).includes("Registro de Ponto"), dynamicFields: [{ label: "Método de registro", qid: "q013" }, { label: "Formato de autenticação", qid: "q021" }, { label: "Aplicação de cerca virtual", qid: "q020" }, { label: "Pausa pré-assinalada", qid: "q018" }] },
    { id: "importacao_afd", title: "Importação de AFD", content: "Importação de AFD: realizar a importação de arquivo AFD através da ferramenta de importação disponível para fechamento de ponto piloto.", show: () => getAnswer(answersMap, "q015").includes("AFD importação") },
    { id: "app_gestao", title: "APP Gestão", content: "APP Gestão: realizar acesso ao APP Gestão por funcionários para acompanhamento da folha de ponto, solicitações e/ou registro de ponto.", show: () => getAnswer(answersMap, "q015").includes("App Gestão") },
    { id: "notificacoes_ponto", title: "Notificações de ponto", content: "Notificações de ponto: funcionários ou gestores receberão notificações no App Gestão ou Gestão Web conforme as configurações disponíveis no sistema referentes ao registro de ponto.", show: () => getAnswer(answersMap, "q019") === "Sim" },
    { id: "calculos_tratamento", title: "Parametrização de regras de cálculo", content: "Parametrização de regra de cálculo: deverá calcular as horas conforme parâmetros mapeados e configurações disponíveis no sistema.", show: () => (project?.contracted_modules || []).includes("Cálculos e Tratamento") },
    { id: "banco_horas", title: "Parametrização de banco de horas", content: "Parametrização de banco de horas: deverá calcular as horas para banco de horas conforme parâmetros mapeados e configurações disponíveis no sistema.", show: () => getAnswer(answersMap, "q037") === "Sim" },
    { id: "arquivo_verbas", title: "Parametrização de arquivo de verbas", content: "Parametrização de arquivo de verbas: será possível importar para a folha de pagamento, através de arquivo de exportação, as verbas oriundas da folha de ponto.", show: () => (project?.contracted_services || []).includes("Arquivo txt de exportação para FOPAG") || (project?.contracted_services || []).includes("Integração Sankhya") || project?.origin === "Sankhya" },
    { id: "sobreaviso", title: "Parametrização de sobreaviso", content: "Parametrização de Sobreaviso: o sistema deve permitir o planejamento de jornadas de sobreaviso e calcular automaticamente os apontamentos correspondentes.", show: () => getAnswer(answersMap, "q038") === "Sim" },
    { id: "nr17", title: "Parametrização de NR17", content: "Parametrização de NR17: permitir a criação e gestão de jornadas aderentes à Norma Regulamentadora 17, incluindo pausas obrigatórias e configurações específicas.", show: () => getAnswer(answersMap, "q039") === "Sim" },
    { id: "gestao_participativa_regras_solicitacao", title: "Parametrização das regras de solicitação", content: "Parametrização das Regras de Solicitação: usuários com permissão poderão realizar solicitações como correção de ponto, lançamento de atestado e outros fluxos, com posterior aprovação conforme definição do escopo.", show: () => getAnswer(answersMap, "q040") === "Descentralizada" },
    { id: "assinatura_espelho", title: "Assinatura de espelho de ponto", content: "Assinatura de espelho de ponto dentro do sistema: colaborador e/ou outro perfil definido fará a confirmação do espelho de ponto, formalizando o ciclo de travamento.", show: () => getAnswer(answersMap, "q049") === "Sim" },
    { id: "permissao_usuario", title: "Configuração de permissão de usuário", content: "Configuração de permissão de usuário: permissões devem ser parametrizadas conforme alinhamento realizado com o cliente sobre acessos e configurações disponíveis no sistema.", show: () => (project?.contracted_modules || []).includes("Gestão de Ponto Participativa") },
    { id: "notificacao_hora_extra", title: "Notificação de hora extra", content: "Notificação de hora extra: funcionários ou gestores receberão notificações no App Gestão ou Gestão Web conforme configurações disponíveis no sistema.", show: () => getAnswer(answersMap, "q062") === "Sim" },
    { id: "gestao_horas_extras", title: "Solicitação, justificativa e aprovação de horas extras", content: "Solicitação, justificativa e aprovação de horas extras: usuários poderão solicitar ou justificar horas extras realizadas, com aprovação ou reprovação por perfis autorizados.", show: () => getAnswer(answersMap, "q052") === "Sim" },
    { id: "gestao_ferias", title: "Gestão de férias", content: "Gestão de férias: será possível realizar solicitação de férias por funcionário e/ou outro perfil cadastrado, com posterior aprovação e lançamento em folha de ponto.", show: () => (project?.contracted_modules || []).includes("Gestão de Férias e Ausências") },
    { id: "timesheet_aloque", title: "Timesheet (Aloque)", content: "Timesheet: será possível realizar apontamento de atividades, permitindo que colaboradores registrem horas trabalhadas em projetos, tarefas ou centros de custo.", show: () => (project?.contracted_modules || []).includes("Timesheet") },
    { id: "integracao_sankhya", title: "Integração Sankhya", content: "Integração Sankhya: integração ativa entre Sankhya e Pontotel conforme critérios do documento inicial de integração.", show: () => (project?.contracted_services || []).includes("Integração Sankhya") },
    { id: "api_documentacao", title: "Usuário de API + Documentação", content: "Usuário de API + Documentação: cadastro de usuário de API e liberação da documentação correspondente.", show: () => (project?.contracted_services || []).includes("Integrações (disponibilização de API)") },
    { id: "sftp_afd", title: "Integração do arquivo AFD por meio da pasta sFTP", content: "Integração do arquivo AFD por meio da pasta sFTP: configuração para disponibilização e processamento dos arquivos AFD por meio de pasta sFTP/FTP.", show: () => (project?.contracted_services || []).includes("Importação de arquivo AFD em nuvem") },
  ];

  const visibleBlocks = ENTREGA_BLOCKS.filter(b => b.show());
  const dataConc = project?.aligned_end_date || project?.planned_end_date;

  if (loadingVersions) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── Toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Termo de Abertura do Projeto (TAP)</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {currentVersion ? (
                  <>
                    <span className="text-xs text-slate-400">v{currentVersion.version_number}</span>
                    <VersionBadge status={currentVersion.status} />
                    {lastUpdate && <span className="text-xs text-slate-400">· Dados atualizados em {lastUpdate}</span>}
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Nenhuma versão salva</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SaveStatus status={saveStatus} />

            {/* Atualizar dados automáticos */}
            {!readOnly && <button
              onClick={handleRefreshAuto}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar dados automáticos
            </button>}

            {/* Finalizar */}
            {!readOnly && currentVersion && currentVersion.status === "Rascunho" && (
              <button onClick={handleFinalize} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />Finalizar versão
              </button>
            )}

            {/* Marcar como enviada */}
            {!readOnly && currentVersion && currentVersion.status === "Finalizada" && (
              <button onClick={handleMarkSent} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                <Send className="w-3.5 h-3.5" />Marcar como enviada ao cliente
              </button>
            )}

            {/* Histórico */}
            {versions.length > 1 && (
              <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                <History className="w-3.5 h-3.5" />Histórico ({versions.length})
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {/* PDF */}
            {canGeneratePDF && (
              <button
                onClick={() => generatePDF({ project, form, answersMap, participants, datas, modulosServicos, entregas, version: currentVersion, scheduleSnapshot })}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />Gerar TAP em PDF
              </button>
            )}
          </div>
        </div>

        {/* Alerta de versão enviada */}
        {isLocked && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Esta versão foi enviada ao cliente e está bloqueada. Ao editar, uma nova versão será criada automaticamente.
          </div>
        )}
      </div>

      {/* ── Histórico de versões ── */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Histórico de Versões</p>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border ${v.is_current ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">v{v.version_number}</span>
                  <VersionBadge status={v.status} />
                  <span className="text-xs text-slate-400">{v.created_by_name && `por ${v.created_by_name} · `}{v.created_date ? new Date(v.created_date).toLocaleDateString("pt-BR") : ""}</span>
                  {v.is_current && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">atual</span>}
                </div>
                {v.status === "Enviada ao cliente" && (
                  <button onClick={() => viewHistoricVersion(v)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Download className="w-3 h-3" />PDF
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Documento TAP ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">

        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-8 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1"><img src="https://media.base44.com/images/public/69e295c073bbccc7f63f6156/1a9549a83_LogoPontotel_AmarelaePreta.png" style={{height:18,verticalAlign:'middle'}} alt="Pontotel" /> · Implantação</p>
          <h1 className="text-xl font-bold">Termo de Abertura do Projeto</h1>
          <p className="text-sm text-blue-200 mt-1">{project?.client_name} · {project?.implantation_type}</p>
        </div>

        <div className="p-8 space-y-10">

          {/* ── SEÇÃO 1: OBJETIVO ── */}
          <section>
            <SectionTitle number="1">OBJETIVO</SectionTitle>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✎ Campo editável</span>
              <span className="text-xs text-slate-400">Texto institucional do projeto — pode ser personalizado</span>
            </div>
            <EditableField
              value={form.objetivo}
              onChange={v => setField("objetivo", v)}
              onBlur={handleBlur}
              rows={4}
              locked={false}
              placeholder="Descreva o objetivo da implantação..."
            />
          </section>

          {/* ── SEÇÃO 2: PARTICIPANTES ── */}
          <section>
            <SectionTitle number="2">PARTICIPANTES</SectionTitle>
            <div className="flex items-center gap-2 mb-3">
              <AutoBadge source="dados_iniciais" />
              <span className="text-xs text-slate-400">Para alterar, edite os Dados Iniciais do projeto</span>
            </div>
            {participants.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Nenhum participante cadastrado. Acesse a aba Resumo e preencha os campos de contatos do projeto.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {participants.map((p, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">{p.role}</p>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    {p.contact && <p className="text-xs text-slate-400 mt-0.5">{p.contact}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── SEÇÃO 3: CONDIÇÕES GERAIS ── */}
          <section>
            <SectionTitle number="3">CONDIÇÕES GERAIS</SectionTitle>

            {/* 3.1 Dimensão do Projeto */}
            <div className="mb-6">
              <SubSectionTitle>3.1 Dimensão do Projeto</SubSectionTitle>
              <div className="flex items-center gap-2 mb-2">
                <AutoBadge source="escopo" />
                <span className="text-xs text-slate-400">Dados do Escopo Técnico</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <AutoRow label="Nº de funcionários contratados" value={project?.contracted_employees || getAnswer(answersMap, "q001")} source="escopo" />
                <AutoRow label="Nº de operações existentes" value={getAnswer(answersMap, "q002")} source="escopo" />
                <AutoRow label="Tipo de tratativa de ponto" value={getAnswer(answersMap, "q040")} source="escopo" />
                <AutoRow label="Quantidade de sindicatos" value={getAnswer(answersMap, "q024")} source="escopo" />
                <AutoRow label="Sistema de folha de pagamento" value={getAnswer(answersMap, "q028")} source="escopo" />
              </div>
            </div>

            {/* 3.2 Datas Importantes */}
            <div className="mb-6">
              <SubSectionTitle>3.2 Datas Importantes</SubSectionTitle>
              <div className="flex items-center gap-2 mb-2">
                <AutoBadge source="escopo" />
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <AutoRow label="Período de apuração do ponto" value={datas.periodo_apuracao} source="escopo" />
                <AutoRow label="Período de apuração da folha de pagamento" value={datas.periodo_folha} source="escopo" />
                <AutoRow label="Período de fechamento da folha de ponto" value={datas.periodo_fechamento} source="escopo" />
                <AutoRow label="Prazo para envio para contabilidade" value={datas.prazo_contabilidade ? `Dia ${datas.prazo_contabilidade}` : null} source="escopo" />
                <AutoRow label="Data de pagamento dos funcionários" value={datas.data_pagamento ? `Dia ${datas.data_pagamento}` : null} source="escopo" />
              </div>
            </div>

            {/* 3.3 Expansão do Registro de Ponto */}
            <div className="mb-6">
              <SubSectionTitle>3.3 Expansão do Registro de Ponto</SubSectionTitle>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✎ Campo editável</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <EditableField
                  label="Formato da expansão"
                  value={form.formato_expansao}
                  onChange={v => setField("formato_expansao", v)}
                  onBlur={handleBlur}
                  rows={2}
                  locked={false}
                  placeholder="Ex: Expansão gradual por filial, rollout por departamento..."
                />
                <EditableField
                  label="Expectativa para iniciar a expansão"
                  value={form.expectativa_inicio_expansao}
                  onChange={v => setField("expectativa_inicio_expansao", v)}
                  onBlur={handleBlur}
                  rows={2}
                  locked={false}
                  placeholder="Ex: 30 dias após go-live do piloto..."
                />
              </div>
            </div>

            {/* 3.4 Módulos e Serviços */}
            <div>
              <SubSectionTitle>3.4 Módulos e Serviços</SubSectionTitle>
              <div className="flex items-center gap-2 mb-3">
                <AutoBadge source="dados_iniciais" />
                <span className="text-xs text-slate-400">Para alterar, edite os Dados Iniciais do projeto</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Módulos</p>
                  <div className="flex flex-wrap gap-2">
                    {modulosServicos.modules.map((m, i) => (
                      <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${m.contratado ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                        {m.contratado ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {m.nome}
                        <span className="text-xs opacity-70">· {m.contratado ? "Contratado" : "Não contratado"}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Serviços</p>
                  <div className="flex flex-wrap gap-2">
                    {modulosServicos.services.map((s, i) => (
                      <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${s.contratado ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                        {s.contratado ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {s.nome}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── SEÇÃO 4: ENTREGAS PREVISTAS ── */}
          <section>
            <SectionTitle number="4">ENTREGAS PREVISTAS</SectionTitle>
            <div className="flex items-center gap-2 mb-3">
              <AutoBadge source="escopo" />
              <span className="text-xs text-slate-400">{visibleBlocks.length} entrega(s) gerada(s) com base no escopo e módulos contratados</span>
            </div>
            {visibleBlocks.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Nenhuma entrega gerada. Preencha o Escopo Técnico e certifique-se que os módulos contratados estão configurados.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleBlocks.map((b, i) => (
                  <div key={b.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">{b.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{b.content}</p>
                      {b.dynamicFields && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {b.dynamicFields.map((df, di) => {
                            const val = getAnswer(answersMap, df.qid);
                            if (!val) return null;
                            return (
                              <div key={di} className="text-xs text-slate-500">
                                <span className="font-medium text-slate-600">{df.label}:</span> {val}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── SEÇÃO 5: CRONOGRAMA ── */}
          <section>
            <SectionTitle number="5">CRONOGRAMA</SectionTitle>
            <div className="flex items-center gap-2 mb-3">
              <AutoBadge source="cronograma" />
              <span className="text-xs text-slate-400">
                {scheduleSnapshot.length > 0
                  ? "Gerado a partir do Cronograma Detalhado v1 — somente leitura"
                  : "Clique em \"Atualizar dados automáticos\" para carregar o Cronograma Detalhado"}
              </span>
            </div>

            {scheduleSnapshot.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 mb-5">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Fase</th>
                      <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Início Planejado</th>
                      <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Fim Planejado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleSnapshot.map((fase, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                            <span className="text-sm font-medium text-slate-700">{fase.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-500">{fmtTapDate(fase.plannedStart)}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-500">{fmtTapDate(fase.plannedEnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg mb-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800 mb-1">Cronograma real não disponível</p>
                    <p className="text-xs text-red-700">
                      Não foi possível carregar as fases do Cronograma Detalhado. Clique em <strong>"Atualizar dados automáticos"</strong> para tentar novamente.
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Se o problema persistir, verifique se o projeto possui fases e atividades no Cronograma Detalhado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5.1 Data esperada de conclusão */}
            {dataConc && (
              <div>
                <SubSectionTitle>5.1 Data esperada de conclusão do projeto</SubSectionTitle>
                <div className="flex items-center gap-2 mb-2">
                  <AutoBadge source="dados_iniciais" />
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    A data esperada para a conclusão deste projeto é: <strong>{formatDate(dataConc)}</strong>, definida em comum acordo com o(a) líder do projeto da {project?.client_name}. Essa data será considerada como referência para o encerramento formal das atividades de implantação.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── SEÇÃO 6: CONCLUSÃO ── */}
          <section>
            <SectionTitle number="6">CONCLUSÃO</SectionTitle>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">✎ Campo editável</span>
            </div>
            <EditableField
              value={form.conclusao}
              onChange={v => setField("conclusao", v)}
              onBlur={handleBlur}
              rows={4}
              locked={false}
              placeholder="Texto de conclusão do termo..."
            />
          </section>

        </div>
      </div>
    </div>
  );
}