import { useState } from "react";

const selectClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

export default function CopyFromRule({ rules, currentRule, data, onChange }) {
  const [selected, setSelected] = useState("");

  const otherRules = rules.filter(r => r !== currentRule);

  if (otherRules.length === 0) return null;

  const handleCopy = (e) => {
    const source = e.target.value;
    if (!source) return;
    setSelected(source);
    const sourceData = data[source];
    if (sourceData) {
      onChange({ ...data, [currentRule]: { ...sourceData } });
    }
  };

  return (
    <div className="mb-4">
      <label className={labelClass}>Copiar de:</label>
      <select value={selected} onChange={handleCopy} className={`${selectClass} max-w-xs`}>
        <option value="">Selecione uma regra</option>
        {otherRules.map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </div>
  );
}