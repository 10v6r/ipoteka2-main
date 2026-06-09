
import React from 'react';

export interface Preset {
  label: string;
  value: number;
}

interface InputGroupProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  isCurrency?: boolean;
  presets?: Preset[];
  secondaryLabel?: string;
}

export const InputGroup: React.FC<InputGroupProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  isCurrency = false,
  presets,
  secondaryLabel
}) => {
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onChange(val);
    } else if (e.target.value === '') {
        // Разрешить временную очистку ввода
        onChange(0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value === 0 ? '' : value}
          onChange={handleInputChange}
          className={`w-full pl-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900 font-bold shadow-sm hover:border-slate-300 placeholder-slate-400 ${suffix || secondaryLabel ? 'pr-24' : 'pr-4'}`}
          min={min}
          max={max}
        />
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
            {secondaryLabel && (
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
                    {secondaryLabel}
                </span>
            )}
            {suffix && (
              <span className="text-slate-400 text-sm font-medium">
                {suffix}
              </span>
            )}
        </div>
      </div>
      
      {presets && presets.length > 0 && (
        <div className="flex gap-2 mt-1 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange(preset.value)}
              className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
