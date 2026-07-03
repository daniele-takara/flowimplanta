import { useState } from "react";
import { Database, FileText, Calendar, BarChart2, CheckSquare, ClipboardCheck, Zap, Edit3, ArrowRight, ChevronDown, ChevronUp, Info } from "lucide-react";

const FLOW_NODES = [
  {
    id: "dados_iniciais",
    label: "Dados Iniciais",
    type: "processo",
    icon: Database,
    color: "bg-blue-50 border-blue-300 text-blue-700",
    headerColor: "bg-blue-600",
    description: "Configuração base do projeto com informações do cliente, equipe, módulos e datas.",
    inputs: ["Contrato do cliente", "Informações da empresa", "Módulos e serviços contratados"],
    outputs: ["client_name", "empresa_id", "contracted_employees", "contracted_modules", "contracted_services", "datas do projeto", "equipe Pontotel e cliente"],
    rules: ["empresa_id é chave de vínculo com planilha de usabilidade", "MRR e origem para métricas de dashboard", "Módulos definem visibilidade no Escopo e TAP"],
    dependencies: [],
  },
  {
    id: "escopo",
    label: "Escopo Técnico",
    type: "processo",
    icon: Edit3,
    color: "bg-indigo-50 border-indigo-300 text-indigo-700",
    headerColor: "bg-indigo-600",
    description: "Mapeamento detalhado de regras de cálculo, registro de ponto, integrações e parametrizações.",
    inputs: ["Dados Iniciais (módulos e serviços contratados)", "Respostas do cliente"],
    outputs: ["answersMap (q001–q100+)", "Módulos visíveis no cronograma", "Entregas da TAP", "Regras de cálculo e configurações"],
    rules: ["Questões condicionais: visibilidade depende de respostas anteriores", "Módulos contratados controlam quais seções aparecem", "Respostas alimentam TAP, Cronograma e Termo de Encerramento"],
    dependencies: ["Dados Iniciais"],
  },
  {
    id: "cronograma",
    label: "Cronograma",
    type: "processo",
    icon: Calendar,
    color: "bg-cyan-50 border-cyan-300 text-cyan-700",
    headerColor: "bg-cyan-600",
    description: "Cronograma detalhado com tarefas calculadas automaticamente a partir das datas âncora e do Escopo.",
    inputs: ["Datas âncora (definidas pelo usuário)", "answersMap do Escopo", "Módulos contratados"],
    outputs: ["Datas planejadas por tarefa", "Datas executadas (atualizadas manualmente)", "Status por tarefa", "Snapshot para TAP e Status Report"],
    rules: ["Tarefas calculadas por fórmulas de workday offset", "Datas âncora disparam recálculo de dependências", "Visibilidade condicional igual ao Escopo", "Dados salvos no localStorage (overrides) + banco (execução)"],
    dependencies: ["Dados Iniciais", "Escopo Técnico"],
  },
  {
    id: "tap",
    label: "TAP",
    type: "saída",
    icon: FileText,
    color: "bg-amber-50 border-amber-300 text-amber-700",
    headerColor: "bg-amber-600",
    description: "Termo de Abertura do Projeto gerado automaticamente com controle de versão.",
    inputs: ["Dados Iniciais", "Escopo Técnico (answersMap)", "Cronograma (snapshot v1)", "Campos editáveis (objetivo, conclusão, expansão)"],
    outputs: ["TAP em PDF", "Versão salva (Rascunho → Finalizada → Enviada ao cliente)", "Snapshot de cronograma macro para seção 5"],
    rules: ["Versão enviada ao cliente é bloqueada", "Edição gera nova versão automaticamente", "Cronograma da seção 5 capturado apenas na v1 e se não enviada"],
    dependencies: ["Dados Iniciais", "Escopo Técnico", "Cronograma"],
  },
  {
    id: "status_report",
    label: "Status Report",
    type: "processo",
    icon: BarChart2,
    color: "bg-purple-50 border-purple-300 text-purple-700",
    headerColor: "bg-purple-600",
    description: "Relatório executivo semanal com dados automáticos e campos editáveis.",
    inputs: ["Cronograma (overrides + atividades executadas)", "Planilha de usabilidade Bezzon (via empresa_id)", "Dados Iniciais (contracted_employees)"],
    outputs: ["Cronograma macro com progresso e status", "Aderência ao registro de ponto (%)", "KPIs executivos", "Snapshot salvo no banco", "Imagem PNG exportável"],
    rules: ["Atualização automática agrega tarefas por fase macro", "Campos manuais (pendências, riscos) são preservados", "% do projeto = média das fases macro", "usabilidade buscada por empresa_id ou fuzzy por nome"],
    dependencies: ["Dados Iniciais", "Cronograma"],
  },
  {
    id: "plano_acao",
    label: "Plano de Ação",
    type: "processo",
    icon: CheckSquare,
    color: "bg-orange-50 border-orange-300 text-orange-700",
    headerColor: "bg-orange-600",
    description: "Rastreamento de issues, pendências e riscos do projeto com responsáveis e prazos.",
    inputs: ["Identificação manual de issues pelo analista"],
    outputs: ["Lista de ações abertas e fechadas", "Histórico de resolução", "Referência para pendências no Termo de Encerramento"],
    rules: ["Tipos: Erro, Melhoria, Dúvida, Pendência, Risco", "Impactos: Alto, Médio, Baixo", "Status cliente e Pontotel são independentes"],
    dependencies: ["Dados Iniciais"],
  },
  {
    id: "termo_encerramento",
    label: "Termo de Encerramento",
    type: "saída",
    icon: ClipboardCheck,
    color: "bg-green-50 border-green-300 text-green-700",
    headerColor: "bg-green-600",
    description: "Documento formal de encerramento consolidando todos os módulos do projeto.",
    inputs: ["Dados Iniciais", "Escopo Técnico", "Cronograma (macro)", "Status Report (indicadores)", "Plano de Ação (pendências)", "Adendos selecionados"],
    outputs: ["Termo em PDF", "Versão com controle (Rascunho → Enviado → Assinado)", "Estrutura para D4Sign (futura integração)"],
    rules: ["Dados automáticos bloqueados para edição", "Edição gera nova versão", "Adendos inseridos em ordem de seleção", "Pendências: lista ou 'Não há pendências'"],
    dependencies: ["Dados Iniciais", "Escopo Técnico", "Cronograma", "Status Report", "Plano de Ação"],
  },
  {
    id: "d4sign",
    label: "D4Sign (Futuro)",
    type: "decisão",
    icon: Zap,
    color: "bg-slate-50 border-slate-300 text-slate-500",
    headerColor: "bg-slate-500",
    description: "Integração futura para assinatura eletrônica automática via API REST.",
    inputs: ["Termo de Encerramento (PDF gerado)", "Dados dos signatários"],
    outputs: ["Documento enviado para assinatura", "Status: rascunho → enviado → assinado", "Link de acesso ao documento"],
    rules: ["d4sign_document_id, status_assinatura, data_envio_assinatura, data_assinatura, link_assinatura já existem na entidade", "Integração não ativa — botão exibe mensagem informativa"],
    dependencies: ["Termo de Encerramento"],
    future: true,
  },
];

const TYPE_BADGE = {
  processo: { label: "Processo", class: "bg-blue-100 text-blue-700" },
  saída: { label: "Saída/Documento", class: "bg-green-100 text-green-700" },
  decisão: { label: "Futuro", class: "bg-slate-100 text-slate-500" },
};

function FlowNode({ node, isLast, index, onSelect, isSelected }) {
  const nextNode = FLOW_NODES[index + 1];
  const Icon = node.icon;
  return (
    <div className="flex flex-col items-center">
      <div
        onClick={() => onSelect(node)}
        className={`w-full max-w-[180px] rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${node.color} ${isSelected ? "ring-2 ring-offset-2 ring-blue-500 scale-105" : "hover:scale-102"} ${node.future ? "opacity-60" : ""}`}
      >
        <div className={`${node.headerColor} text-white rounded-t-lg px-3 py-2 flex items-center gap-2`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-bold leading-tight">{node.label}</span>
        </div>
        <div className="px-3 py-2">
          <p className="text-xs leading-snug line-clamp-2">{node.description}</p>
        </div>
      </div>
      {!isLast && (
        <div className="flex flex-col items-center my-1.5" aria-hidden="true">
          <div
            className="w-0.5 h-5 border-l-2 border-dashed border-slate-400"
            title={`${node.label} → ${nextNode?.label}`}
          />
          <ArrowRight className="w-4 h-4 text-slate-400 rotate-90 -mt-1" />
        </div>
      )}
    </div>
  );
}

export default function FluxoProjeto() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Fluxo do Projeto</h1>
        <p className="text-sm text-slate-400 mt-0.5">Visualização ponta a ponta do sistema de implantação Pontotel</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Fluxograma */}
        <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fluxograma</p>
          </div>

          <div className="flex flex-col items-center">
            {FLOW_NODES.map((node, i) => (
              <FlowNode
                key={node.id}
                node={node}
                index={i}
                isLast={i === FLOW_NODES.length - 1}
                onSelect={setSelected}
                isSelected={selected?.id === node.id}
              />
            ))}
          </div>

          {/* Legenda */}
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Legenda</p>
            {Object.entries(TYPE_BADGE).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${v.class}`}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes do bloco selecionado */}
        <div className="xl:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 text-slate-400">
              <Info className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">Clique em um bloco do fluxograma para ver os detalhes</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`${selected.headerColor} px-6 py-5 text-white`}>
                <div className="flex items-center gap-3 mb-1">
                  {(() => { const Icon = selected.icon; return <Icon className="w-5 h-5" />; })()}
                  <h2 className="text-lg font-bold">{selected.label}</h2>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-white/20`}>
                    {TYPE_BADGE[selected.type]?.label}
                  </span>
                  {selected.future && <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">Futuro</span>}
                </div>
                <p className="text-sm opacity-80">{selected.description}</p>
              </div>

              <div className="p-6 space-y-5">
                <DetailSection title="Dados de Entrada" items={selected.inputs} dotColor="bg-slate-400" />
                <DetailSection title="Dados de Saída" items={selected.outputs} dotColor="bg-green-500" />
                <DetailSection title="Regras Aplicadas" items={selected.rules} dotColor="bg-amber-500" numbered />
                {selected.dependencies.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Dependências</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.dependencies.map(dep => (
                        <button
                          key={dep}
                          onClick={() => setSelected(FLOW_NODES.find(n => n.label === dep))}
                          className="px-3 py-1 text-xs font-medium rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          {dep} →
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Impacto nos módulos */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Impacto nos Módulos</p>
                  <div className="flex flex-wrap gap-2">
                    {FLOW_NODES.filter(n => n.id !== selected.id && n.dependencies.includes(selected.label)).map(n => {
                      const NIcon = n.icon;
                      return (
                        <button
                          key={n.id}
                          onClick={() => setSelected(n)}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${n.color}`}
                        >
                          <NIcon className="w-3 h-3" /> {n.label}
                        </button>
                      );
                    })}
                    {FLOW_NODES.filter(n => n.id !== selected.id && n.dependencies.includes(selected.label)).length === 0 && (
                      <span className="text-xs text-slate-400">Nenhum módulo depende diretamente deste</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cards resumo de todos os módulos */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {FLOW_NODES.map(node => {
              const Icon = node.icon;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelected(node)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${node.color} ${selected?.id === node.id ? "ring-2 ring-offset-1 ring-blue-500" : "hover:shadow-sm"} ${node.future ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-bold leading-tight">{node.label}</span>
                  </div>
                  <p className="text-xs opacity-70 line-clamp-2">{node.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, items, dotColor, numbered }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full mb-2 text-left">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">{title}</p>
        {open ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>
      {open && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              {numbered ? (
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0 mt-1.5`} />
              )}
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}