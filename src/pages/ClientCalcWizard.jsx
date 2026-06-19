import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Lock, Info, FileDown } from "lucide-react";
import { generateCalcRulesPDF } from "@/lib/calcRulesPdfExport";
import DadosEmpresaForm from "@/components/project/tabs/calculation/DadosEmpresaForm";
import RegrasForm from "@/components/project/tabs/calculation/RegrasForm";
import HorasExtrasForm from "@/components/project/tabs/calculation/HorasExtrasForm";
import IntervalosForm from "@/components/project/tabs/calculation/IntervalosForm";
import AdicionalNoturnoForm from "@/components/project/tabs/calculation/AdicionalNoturnoForm";
import Jornada12x36Form from "@/components/project/tabs/calculation/Jornada12x36Form";
import SobreavisoForm from "@/components/project/tabs/calculation/SobreavisoForm";
import BancoHorasForm from "@/components/project/tabs/calculation/BancoHorasForm";
import DSRForm from "@/components/project/tabs/calculation/DSRForm";
import OutrasVerbasForm from "@/components/project/tabs/calculation/OutrasVerbasForm";
import RevisaoFinal from "@/components/project/tabs/calculation/RevisaoFinal";
import { STEPS } from "@/lib/calcRulesShared";
import { base44 } from "@/api/base44Client";
import CalculationModelsInfoModal from "@/components/project/tabs/calculation/CalculationModelsInfoModal";
import HorasExtrasInfoModal from "@/components/project/tabs/calculation/HorasExtrasInfoModal";
import CategorizacaoHEInfoModal from "@/components/project/tabs/calculation/CategorizacaoHEInfoModal";
import CategorizacaoHEMensalInfoModal from "@/components/project/tabs/calculation/CategorizacaoHEMensalInfoModal";
import ToleranciasIntervaloInfoModal from "@/components/project/tabs/calculation/ToleranciasIntervaloInfoModal";
import PausaHoraExtraInfoModal from "@/components/project/tabs/calculation/PausaHoraExtraInfoModal";
import AdicionalNoturnoInfoModal from "@/components/project/tabs/calculation/AdicionalNoturnoInfoModal";
import ProrrogacaoAdicionalNoturnoInfoModal from "@/components/project/tabs/calculation/ProrrogacaoAdicionalNoturnoInfoModal";
import ReducaoHoraNoturnaInfoModal from "@/components/project/tabs/calculation/ReducaoHoraNoturnaInfoModal";
import AdicionalIncluiPausaInfoModal from "@/components/project/tabs/calculation/AdicionalIncluiPausaInfoModal";
import Jornada12x36FeriadoInfoModal from "@/components/project/tabs/calculation/Jornada12x36FeriadoInfoModal";
import SobreavisoInfoModal from "@/components/project/tabs/calculation/SobreavisoInfoModal";
import BancoHorasInfoModal from "@/components/project/tabs/calculation/BancoHorasInfoModal";
import BancoHorasAcumuloInfoModal from "@/components/project/tabs/calculation/BancoHorasAcumuloInfoModal";
import DSRFeriasHEInfoModal from "@/components/project/tabs/calculation/DSRFeriasHEInfoModal";
import DSRMesDescontoInfoModal from "@/components/project/tabs/calculation/DSRMesDescontoInfoModal";

// ── Client-side data layer (uses backend functions, no auth) ────────────────
function useClientWizardState(token) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [errorType, setErrorType] = useState(null); // 'expired' | 'invalid' | null

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getClientCalcRule', { token });
      const data = res.data;
      if (data.error) {
        if (data.error === 'Link expirado') {
          setErrorType('expired');
        }
        setRecord(null);
      } else {
        setRecord(data);
        setProjectName(data.client_name || "");
      }
    } catch (e) {
      setRecord(null);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data) => {
    setSaving(true);
    const payload = { token };
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) payload[k] = typeof v === "object" ? v : v;
    });
    try {
      await base44.functions.invoke('saveClientCalcRule', payload);
    } catch (e) {
      // silent
    }
    setSaving(false);
  }, [token]);

  const getData = useCallback((key) => {
    if (!record) return null;
    const raw = record[key];
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, [record]);

  const getStatus = useCallback(() => record?.status, [record]);

  return { record, loading, saving, save, getData, reload: load, projectName, getStatus, errorType };
}

export default function ClientCalcWizard() {
  const { token } = useParams();
  const { record, loading, saving, save, getData, projectName, errorType } = useClientWizardState(token);

  const dbCompanyData = getData("company_data") || {};
  const [currentStep, setCurrentStep] = useState(record?.current_step || 1);
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showCalcModelsModal, setShowCalcModelsModal] = useState(false);
  const [showHorasExtrasModal, setShowHorasExtrasModal] = useState(false);
  const [showCategorizacaoHEModal, setShowCategorizacaoHEModal] = useState(false);
  const [showCategorizacaoHEMensalModal, setShowCategorizacaoHEMensalModal] = useState(false);
  const [showToleranciasIntervaloModal, setShowToleranciasIntervaloModal] = useState(false);
  const [showPausaHoraExtraModal, setShowPausaHoraExtraModal] = useState(false);
  const [showAdicionalNoturnoModal, setShowAdicionalNoturnoModal] = useState(false);
  const [showProrrogacaoNoturnoModal, setShowProrrogacaoNoturnoModal] = useState(false);
  const [showReducaoHoraNoturnaModal, setShowReducaoHoraNoturnaModal] = useState(false);
  const [showAdicionalIncluiPausaModal, setShowAdicionalIncluiPausaModal] = useState(false);
  const [showJornada12x36FeriadoModal, setShowJornada12x36FeriadoModal] = useState(false);
  const [showSobreavisoModal, setShowSobreavisoModal] = useState(false);
  const [showBancoHorasModal, setShowBancoHorasModal] = useState(false);
  const [showBancoHorasAcumuloModal, setShowBancoHorasAcumuloModal] = useState(false);
  const [showDSRFeriasHEModal, setShowDSRFeriasHEModal] = useState(false);
  const [showDSRMesDescontoModal, setShowDSRMesDescontoModal] = useState(false);

  useEffect(() => { if (record?.current_step) setCurrentStep(record.current_step); }, [record?.current_step]);

  // Detect if rule was already finalized
  useEffect(() => {
    if (record?.status === 'finalizado') {
      setSubmitted(true);
    }
  }, [record?.status]);

  const dbStepData = {
    company_data: dbCompanyData,
    rule_configurations: getData("rule_configurations") || {},
    overtime_rules: getData("overtime_rules") || {},
    break_time_rules: getData("break_time_rules") || {},
    night_shift_rules: getData("night_shift_rules") || {},
    shift_12x36_rules: getData("shift_12x36_rules") || {},
    sobreaviso_rules: getData("sobreaviso_rules") || {},
    bank_hours_rules: getData("bank_hours_rules") || {},
    dsr_rules: getData("dsr_rules") || {},
    other_verbs_rules: getData("other_verbs_rules") || {},
  };

  const [stepData, setStepData] = useState(dbStepData);

  useEffect(() => {
    setStepData(dbStepData);
  }, [record]);

  const visibleSteps = STEPS.filter(step => {
    const cd = stepData.company_data;
    if (!cd?.rulesNames?.length && step.id > 1) return false;
    if (step.key === "night_shift_rules" && cd?.hasNightShift === false) return false;
    if (step.key === "shift_12x36_rules" && cd?.has12x36Shift === false) return false;
    if (step.key === "sobreaviso_rules" && cd?.hasOnCallWorkers === false) return false;
    if (step.key === "bank_hours_rules" && cd?.hasTimeBank === false) return false;
    return true;
  });

  const currentStepIdx = visibleSteps.findIndex(s => s.id === currentStep);
  const step = visibleSteps[currentStepIdx];

  const pendingSaveRef = useRef(null);
  const pendingDataRef = useRef({});

  const flushPending = async () => {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    const keys = Object.keys(pendingDataRef.current);
    if (keys.length > 0) {
      const payload = { ...pendingDataRef.current, current_step: currentStep };
      pendingDataRef.current = {};
      await save(payload);
    }
  };

  const scheduleSave = (key, data) => {
    setStepData(prev => ({ ...prev, [key]: data }));
    pendingDataRef.current[key] = data;
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null;
      const payload = { ...pendingDataRef.current, current_step: currentStep };
      pendingDataRef.current = {};
      save(payload);
    }, 800);
  };

  const goToStep = async (newStep) => {
    setCurrentStep(newStep);
    await flushPending();
    await save({ current_step: newStep });
  };

  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    try {
      const pdfBytes = await generateCalcRulesPDF({
        project: { client_name: projectName },
        companyData: stepData.company_data,
        allStepData: stepData,
      });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Regras_Calculo_${(projectName || "empresa").replace(/\s+/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erro ao gerar PDF. Tente novamente.");
    }
    setGeneratingPDF(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-4">
          <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-700 mb-2">
            {errorType === 'expired' ? 'Link expirado' : 'Link inválido ou expirado'}
          </h1>
          <p className="text-sm text-slate-500">
            {errorType === 'expired'
              ? 'Este link expirou após 30 dias. Solicite um novo link ao time de implantação.'
              : 'Este link não é mais válido. Entre em contato com o time de implantação para receber um novo link.'}
          </p>
        </div>
      </div>
    );
  }

  // Confirmation screen — shown before the wizard becomes interactive
  if (!confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-purple-50 flex items-center justify-center">
            <Lock className="w-7 h-7 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Confirmação de empresa</h2>
          <p className="text-sm text-slate-500 mb-1">Você é da empresa</p>
          <p className="text-xl font-bold text-slate-800 mb-6">{projectName || "Empresa"}</p>
          <button
            onClick={() => setConfirmed(true)}
            className="w-full px-6 py-3 text-sm font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            Sim, esta é a minha empresa
          </button>
          <button
            onClick={() => window.close()}
            className="w-full mt-3 px-6 py-3 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Não, sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8">
        <div className="py-4">
          <h1 className="text-xl font-bold text-slate-800">Regras de Cálculo</h1>
          <p className="text-sm text-slate-400 mt-0.5">{projectName || "Empresa"}</p>
          <div className="h-px bg-slate-200 mt-3"></div>
        </div>
        <div className="flex items-center gap-2 pb-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 font-medium border border-purple-200">
            Versão Cliente
          </span>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Step indicators */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {visibleSteps.map((s, idx) => {
            const isActive = s.id === currentStep;
            const isPast = s.id < currentStep;
            return (
              <button
                key={s.id}
                onClick={() => goToStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isActive ? "bg-blue-600 text-white border-blue-600" :
                  isPast ? "bg-green-50 text-green-700 border-green-200" :
                  "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {isPast && <CheckCircle className="w-3 h-3 text-green-500" />}
                <span className="font-mono text-xs opacity-60">{s.id}</span>
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5 min-h-[300px]">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-slate-800">{step?.title}</h3>
            {step?.id === 2 && (
              <button onClick={() => setShowCalcModelsModal(true)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda os modelos de cálculo">
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
            {step?.id === 3 && (
              <button onClick={() => setShowHorasExtrasModal(true)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o funcionamento das horas extras">
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
            {step?.id === 7 && (
              <button onClick={() => setShowSobreavisoModal(true)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda o funcionamento do sobreaviso">
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
            {step?.id === 9 && (
              <button onClick={() => setShowBancoHorasModal(true)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors" title="Entenda os modelos de banco de horas">
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-6">Passo {currentStepIdx + 1} de {visibleSteps.length}</p>

          {step?.key === "company_data" && (
            <DadosEmpresaForm data={stepData.company_data} onChange={(data) => scheduleSave("company_data", data)} project={{ client_name: projectName }} readOnly={false} />
          )}
          {step?.key === "rule_configurations" && (
            <RegrasForm companyData={stepData.company_data} data={stepData.rule_configurations} onChange={(data) => scheduleSave("rule_configurations", data)} />
          )}
          {step?.key === "overtime_rules" && (
            <HorasExtrasForm companyData={stepData.company_data} data={stepData.overtime_rules} onChange={(data) => scheduleSave("overtime_rules", data)} onInfoDiariaClick={() => setShowCategorizacaoHEModal(true)} onInfoMensalClick={() => setShowCategorizacaoHEMensalModal(true)} />
          )}
          {step?.key === "break_time_rules" && (
            <IntervalosForm companyData={stepData.company_data} data={stepData.break_time_rules} onChange={(data) => scheduleSave("break_time_rules", data)} ruleConfigurations={stepData.rule_configurations} onInfoToleranciasClick={() => setShowToleranciasIntervaloModal(true)} onInfoPausaHoraExtraClick={() => setShowPausaHoraExtraModal(true)} />
          )}
          {step?.key === "night_shift_rules" && (
            <AdicionalNoturnoForm companyData={stepData.company_data} data={stepData.night_shift_rules} onChange={(data) => scheduleSave("night_shift_rules", data)} onInfoReducaoClick={() => setShowAdicionalNoturnoModal(true)} onInfoProrrogacaoClick={() => setShowProrrogacaoNoturnoModal(true)} onInfoReducaoAmbosClick={() => setShowReducaoHoraNoturnaModal(true)} onInfoAdicionalPausaClick={() => setShowAdicionalIncluiPausaModal(true)} />
          )}
          {step?.key === "shift_12x36_rules" && (
            <Jornada12x36Form companyData={stepData.company_data} data={stepData.shift_12x36_rules} onChange={(data) => scheduleSave("shift_12x36_rules", data)} onInfoFeriadoClick={() => setShowJornada12x36FeriadoModal(true)} />
          )}
          {step?.key === "sobreaviso_rules" && (
            <SobreavisoForm companyData={stepData.company_data} data={stepData.sobreaviso_rules} onChange={(data) => scheduleSave("sobreaviso_rules", data)} />
          )}
          {step?.key === "bank_hours_rules" && (
            <BancoHorasForm companyData={stepData.company_data} data={stepData.bank_hours_rules} onChange={(data) => scheduleSave("bank_hours_rules", data)} onInfoAcumuloClick={() => setShowBancoHorasAcumuloModal(true)} />
          )}
          {step?.key === "dsr_rules" && (
            <DSRForm companyData={stepData.company_data} data={stepData.dsr_rules} onChange={(data) => scheduleSave("dsr_rules", data)} onInfoHEFeriadoClick={() => setShowDSRFeriasHEModal(true)} onInfoMesDescontoClick={() => setShowDSRMesDescontoModal(true)} />
          )}
          {step?.key === "other_verbs_rules" && (
            <OutrasVerbasForm companyData={stepData.company_data} data={stepData.other_verbs_rules} onChange={(data) => scheduleSave("other_verbs_rules", data)} />
          )}
          {step?.id === 11 && !submitted && <RevisaoFinal companyData={stepData.company_data} allData={stepData} project={{ client_name: projectName }} />}
          {step?.id === 11 && submitted && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Regras enviadas com sucesso!</h3>
              <p className="text-sm text-slate-500 mb-5">
                Suas configurações foram recebidas pelo time de implantação.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-left max-w-md mx-auto">
                <p className="text-sm font-semibold text-amber-800 mb-2">Próximo passo</p>
                <p className="text-sm text-amber-700 mb-2">
                  Gere o PDF das regras de cálculo e envie para o e-mail:
                </p>
                <p className="text-base font-bold text-amber-800 mb-1">implantacao@pontotel.com.br</p>
                <p className="text-xs text-amber-600">Isso é importante para mantermos o histórico documentado.</p>
              </div>

              <button
                onClick={handleGeneratePDF}
                disabled={generatingPDF}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
              >
                {generatingPDF ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...</>
                ) : (
                  <><FileDown className="w-4 h-4" /> Gerar PDF das Regras</>
                )}
              </button>
              <p className="text-xs text-slate-400 mt-3">Você pode voltar aos passos anteriores para revisar suas configurações.</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => currentStepIdx > 0 && goToStep(visibleSteps[currentStepIdx - 1].id)}
            disabled={currentStepIdx === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          <span className="text-xs text-slate-400">{currentStepIdx + 1} / {visibleSteps.length}</span>

          {submitted && currentStepIdx === visibleSteps.length - 1 ? (
            <button
              onClick={() => setSubmitted(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300"
            >
              Editar novamente
            </button>
          ) : currentStepIdx < visibleSteps.length - 1 ? (
            <button
              onClick={() => goToStep(visibleSteps[currentStepIdx + 1].id)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={async () => {
                await flushPending();
                await save({ status: "finalizado" });
                setSubmitted(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-green-600 bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" /> Enviar
            </button>
          )}
        </div>
      </div>

      {/* Info Modals */}
      {showCalcModelsModal && <CalculationModelsInfoModal onClose={() => setShowCalcModelsModal(false)} />}
      {showHorasExtrasModal && <HorasExtrasInfoModal onClose={() => setShowHorasExtrasModal(false)} />}
      {showCategorizacaoHEModal && <CategorizacaoHEInfoModal onClose={() => setShowCategorizacaoHEModal(false)} />}
      {showCategorizacaoHEMensalModal && <CategorizacaoHEMensalInfoModal onClose={() => setShowCategorizacaoHEMensalModal(false)} />}
      {showToleranciasIntervaloModal && <ToleranciasIntervaloInfoModal onClose={() => setShowToleranciasIntervaloModal(false)} />}
      {showPausaHoraExtraModal && <PausaHoraExtraInfoModal onClose={() => setShowPausaHoraExtraModal(false)} />}
      {showAdicionalNoturnoModal && <AdicionalNoturnoInfoModal onClose={() => setShowAdicionalNoturnoModal(false)} />}
      {showProrrogacaoNoturnoModal && <ProrrogacaoAdicionalNoturnoInfoModal onClose={() => setShowProrrogacaoNoturnoModal(false)} />}
      {showReducaoHoraNoturnaModal && <ReducaoHoraNoturnaInfoModal onClose={() => setShowReducaoHoraNoturnaModal(false)} />}
      {showAdicionalIncluiPausaModal && <AdicionalIncluiPausaInfoModal onClose={() => setShowAdicionalIncluiPausaModal(false)} />}
      {showJornada12x36FeriadoModal && <Jornada12x36FeriadoInfoModal onClose={() => setShowJornada12x36FeriadoModal(false)} />}
      {showSobreavisoModal && <SobreavisoInfoModal onClose={() => setShowSobreavisoModal(false)} />}
      {showBancoHorasModal && <BancoHorasInfoModal onClose={() => setShowBancoHorasModal(false)} />}
      {showBancoHorasAcumuloModal && <BancoHorasAcumuloInfoModal onClose={() => setShowBancoHorasAcumuloModal(false)} />}
      {showDSRFeriasHEModal && <DSRFeriasHEInfoModal onClose={() => setShowDSRFeriasHEModal(false)} />}
      {showDSRMesDescontoModal && <DSRMesDescontoInfoModal onClose={() => setShowDSRMesDescontoModal(false)} />}
    </div>
  );
}