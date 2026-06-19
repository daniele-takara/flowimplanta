import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Lock, Info } from "lucide-react";
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
import { appParams } from "@/lib/app-params";

// ── Client-side data layer (uses backend functions, no auth) ────────────────
function useClientWizardState(token) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");

  const load = useCallback(async () => {
    try {
      const headers = { "Content-Type": "application/json", "X-App-Id": appParams.appId };
      const res = await fetch(`/api/functions/getClientCalcRule`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.error) {
        setRecord(null);
      } else {
        setRecord(data);
        // Fetch project name
        try {
          const headers = { "Content-Type": "application/json", "X-App-Id": appParams.appId };
          const pRes = await fetch(`/api/functions/getClientCalcRule`, {
            method: "POST",
            headers,
            body: JSON.stringify({ token, action: "projectName" }),
          });
          const pData = await pRes.json();
          if (pData.client_name) setProjectName(pData.client_name);
        } catch {}
      }
    } catch (e) {
      console.error(e);
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
      const headers = { "Content-Type": "application/json", "X-App-Id": appParams.appId };
      await fetch(`/api/functions/saveClientCalcRule`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }, [token]);

  const getData = useCallback((key) => {
    if (!record) return null;
    const raw = record[key];
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, [record]);

  return { record, loading, saving, save, getData, reload: load, projectName };
}

export default function ClientCalcWizard() {
  const { token } = useParams();
  const { record, loading, saving, save, getData, projectName } = useClientWizardState(token);

  const dbCompanyData = getData("company_data") || {};
  const [currentStep, setCurrentStep] = useState(record?.current_step || 1);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { if (record?.current_step) setCurrentStep(record.current_step); }, [record?.current_step]);

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
          <h1 className="text-xl font-bold text-slate-700 mb-2">Link inválido ou expirado</h1>
          <p className="text-sm text-slate-500">Este link não é mais válido. Entre em contato com o time de implantação para receber um novo link.</p>
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
          </div>
          <p className="text-sm text-slate-400 mb-6">Passo {currentStepIdx + 1} de {visibleSteps.length}</p>

          {step?.key === "company_data" && (
            <DadosEmpresaForm data={stepData.company_data} onChange={(data) => scheduleSave("company_data", data)} project={{ client_name: projectName }} readOnly={false} />
          )}
          {step?.key === "rule_configurations" && (
            <RegrasForm companyData={stepData.company_data} data={stepData.rule_configurations} onChange={(data) => scheduleSave("rule_configurations", data)} />
          )}
          {step?.key === "overtime_rules" && (
            <HorasExtrasForm companyData={stepData.company_data} data={stepData.overtime_rules} onChange={(data) => scheduleSave("overtime_rules", data)} />
          )}
          {step?.key === "break_time_rules" && (
            <IntervalosForm companyData={stepData.company_data} data={stepData.break_time_rules} onChange={(data) => scheduleSave("break_time_rules", data)} ruleConfigurations={stepData.rule_configurations} />
          )}
          {step?.key === "night_shift_rules" && (
            <AdicionalNoturnoForm companyData={stepData.company_data} data={stepData.night_shift_rules} onChange={(data) => scheduleSave("night_shift_rules", data)} />
          )}
          {step?.key === "shift_12x36_rules" && (
            <Jornada12x36Form companyData={stepData.company_data} data={stepData.shift_12x36_rules} onChange={(data) => scheduleSave("shift_12x36_rules", data)} />
          )}
          {step?.key === "sobreaviso_rules" && (
            <SobreavisoForm companyData={stepData.company_data} data={stepData.sobreaviso_rules} onChange={(data) => scheduleSave("sobreaviso_rules", data)} />
          )}
          {step?.key === "bank_hours_rules" && (
            <BancoHorasForm companyData={stepData.company_data} data={stepData.bank_hours_rules} onChange={(data) => scheduleSave("bank_hours_rules", data)} />
          )}
          {step?.key === "dsr_rules" && (
            <DSRForm companyData={stepData.company_data} data={stepData.dsr_rules} onChange={(data) => scheduleSave("dsr_rules", data)} />
          )}
          {step?.key === "other_verbs_rules" && (
            <OutrasVerbasForm companyData={stepData.company_data} data={stepData.other_verbs_rules} onChange={(data) => scheduleSave("other_verbs_rules", data)} />
          )}
          {step?.id === 11 && <RevisaoFinal companyData={stepData.company_data} allData={stepData} project={{ client_name: projectName }} />}
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

          {currentStepIdx < visibleSteps.length - 1 ? (
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
                alert("Regras de cálculo enviadas com sucesso! O time de implantação revisará as informações.");
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-green-600 bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" /> Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}