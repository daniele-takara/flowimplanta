import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

const ACCENT_CLASSES = {
  blue: "border-blue-300 bg-blue-50 text-blue-700",
  indigo: "border-indigo-300 bg-indigo-50 text-indigo-700",
  purple: "border-purple-300 bg-purple-50 text-purple-700",
};

export default function MultiSelectFilter({ label, icon: Icon, options, selected, onChange, single = false, emptyValue = "", accentColor = "blue" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSelected = (value) => (single ? selected === value : selected.includes(value));
  const isEmpty = single ? selected === emptyValue : selected.length === 0;
  const count = single ? (isEmpty ? 0 : 1) : selected.length;

  const toggle = (value) => {
    if (single) {
      onChange(value);
      setOpen(false);
    } else {
      onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
    }
  };

  const filteredOptions = options.filter(o =>
    (o.label || "").toLowerCase().includes(search.toLowerCase())
  );

  const displayLabel = isEmpty
    ? label
    : single
      ? options.find(o => o.value === selected)?.label || label
      : `${label} (${count})`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border font-medium transition-colors whitespace-nowrap ${
          !isEmpty ? ACCENT_CLASSES[accentColor] : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{displayLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {options.length > 6 && (
            <div className="p-2 border-b border-slate-100 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Nenhum resultado</div>
            ) : (
              filteredOptions.map(o => (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-50 transition-colors"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected(o.value) ? "bg-blue-600 border-blue-600" : "border-slate-300"
                  }`}>
                    {isSelected(o.value) && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate text-slate-700">{o.label}</span>
                </button>
              ))
            )}
          </div>
          {!single && selected.length > 0 && (
            <div className="border-t border-slate-100 p-1">
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-red-500 py-1"
              >
                <X className="w-3 h-3" /> Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}