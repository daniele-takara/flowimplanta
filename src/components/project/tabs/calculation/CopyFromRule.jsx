
const selectClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export default function CopyFromRule({ rules, currentRule, data, onChange, isInheriting, inheritingFrom }) {
  // isInheriting: boolean - whether this rule is inheriting
  // inheritingFrom: string - name of source rule (empty if not selected yet or not inheriting)
  
  const otherRules = rules.filter(r => r !== currentRule);
  if (otherRules.length === 0) return null;

  const handleToggle = (checked) => {
    if (!checked) {
      // Stop inheriting — keep current data but clear inheritance marker
      const currentData = { ...(data[currentRule] || {}) };
      delete currentData._inheritingFrom;
      onChange({ ...data, [currentRule]: currentData });
    } else {
      // Enable inheriting mode — mark as pending (no source selected yet)
      const currentData = { ...(data[currentRule] || {}), _inheritingFrom: "" };
      onChange({ ...data, [currentRule]: currentData });
    }
  };

  const handleSelect = (e) => {
    const source = e.target.value;
    if (!source) {
      const currentData = { ...(data[currentRule] || {}) };
      delete currentData._inheritingFrom;
      onChange({ ...data, [currentRule]: currentData });
      return;
    }
    const sourceData = data[source];
    // Copy all source data AND mark inheritance
    onChange({ ...data, [currentRule]: { ...(sourceData || {}), _inheritingFrom: source } });
  };

  const pending = isInheriting && !inheritingFrom;

  return (
    <div className="mb-4 bg-slate-50 rounded-lg p-3 border border-slate-200">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
        <input 
          type="checkbox" 
          checked={isInheriting} 
          onChange={e => handleToggle(e.target.checked)} 
          className="w-4 h-4 accent-purple-600"
        />
        Idem regra anterior
      </label>
      
      {pending && (
        <div className="mt-2">
          <select value="" onChange={handleSelect} className={`${selectClass} max-w-xs`}>
            <option value="">Selecione uma regra</option>
            {otherRules.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {isInheriting && !pending && (
        <p className="text-sm text-slate-500 mt-2">
          Esta regra está herdando as configurações de: <strong className="text-slate-700">{inheritingFrom}</strong>
        </p>
      )}
    </div>
  );
}