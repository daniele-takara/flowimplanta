import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function formatCurrency(value) {
  if (!value && value !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function calcDaysLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const today = new Date();
  const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function statusColor(status) {
  const map = {
    "Em andamento": "bg-blue-100 text-blue-700",
    "Concluído": "bg-green-100 text-green-700",
    "Atrasado": "bg-red-100 text-red-700",
    "Em risco": "bg-orange-100 text-orange-700",
    "Planejamento": "bg-slate-100 text-slate-600",
    "Cancelado": "bg-slate-100 text-slate-500",
    "Não iniciado": "bg-slate-100 text-slate-500",
    "Bloqueado": "bg-purple-100 text-purple-700",
    "No prazo": "bg-green-100 text-green-700"
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

export function phaseColor(phase) {
  const map = {
    "Abertura de projeto": "bg-indigo-100 text-indigo-700",
    "Parametrização": "bg-blue-100 text-blue-700",
    "Homologação": "bg-yellow-100 text-yellow-700",
    "Rollout": "bg-orange-100 text-orange-700",
    "Go-live": "bg-green-100 text-green-700",
    "Concluído": "bg-emerald-100 text-emerald-700"
  };
  return map[phase] || "bg-slate-100 text-slate-600";
}

export function impactColor(impact) {
  const map = { "Alto": "text-red-600", "Médio": "text-orange-500", "Baixo": "text-green-600" };
  return map[impact] || "text-slate-600";
}