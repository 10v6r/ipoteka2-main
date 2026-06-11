
import React from 'react';

export interface Preset {
  label: string;
  value: number;
}

interface InputGroupProps {
  label: React.ReactNode;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  isCurrency?: boolean;
  presets?: Preset[];
  secondaryLabel?: string;
  error?: string;
  onBlur?: () => void;
  readOnly?: boolean;
  allowDecimals?: boolean;
  discountedValue?: number;
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
  secondaryLabel,
  error,
  onBlur,
  readOnly = false,
  allowDecimals = false,
  discountedValue
}) => {

  const formatNumber = (num: number): string => {
    if (isNaN(num)) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Инициализируем локальное состояние значением из пропсов
  const [inputValue, setInputValue] = React.useState(value === 0 ? '' : formatNumber(value));

  const parseNumber = (str: string): number => {
    // Заменяем запятую на точку для парсинга
    return parseFloat(str.replace(/\s/g, '').replace(',', '.'));
  };

  // Синхронизация локального состояния с внешним value
  React.useEffect(() => {
    const formatted = value === 0 ? '' : formatNumber(value);

    if (!allowDecimals) {
      // Для обычных полей (без дробей) всегда форматируем (добавляем пробелы)
      setInputValue(formatted);
    } else {
      // Для полей с дробями обновляем только если значение реально изменилось извне
      // Это позволяет сохранить "12," или "12.0" при вводе, не сбрасывая форматирование
      const currentParsed = parseNumber(inputValue);
      if (currentParsed !== value) {
        setInputValue(formatted);
      }
    }
  }, [value, allowDecimals]); // inputValue не добавляем, чтобы не зациклить

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;

    let rawValue = e.target.value;

    // Фильтрация ввода
    if (allowDecimals) {
      // Разрешаем цифры, пробелы, точку и запятую
      rawValue = rawValue.replace(/[^\d\s.,]/g, '');
    } else {
      // Только цифры и пробелы
      rawValue = rawValue.replace(/[^\d\s]/g, '');
    }

    // Сразу обновляем локальное состояние, чтобы отобразить ввод пользователя (включая запятые)
    setInputValue(rawValue);

    let val = parseNumber(rawValue);

    // Ограничение по максимальному значению при вводе
    if (!isNaN(val) && max !== undefined && val > max) {
      val = max;
      // Если превысили макс, обновляем и локальное состояние тоже
      setInputValue(formatNumber(val));
    }

    if (!isNaN(val)) {
      onChange(val);
    } else if (rawValue.trim() === '') {
      onChange(0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode={allowDecimals ? "decimal" : "numeric"}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={onBlur}
          readOnly={readOnly}
          className={`w-full h-[46px] pl-4 border rounded-xl outline-none transition-all font-bold shadow-sm ${readOnly
            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
            : `bg-white text-slate-900 ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 hover:border-slate-300'}`
            } ${suffix || secondaryLabel ? 'pr-24' : 'pr-4'} ${discountedValue !== undefined && discountedValue < value ? '!text-transparent select-none' : ''}`}
        // min/max attributes don't work the same on type="text", validation should be handled in onChange or parent if strict
        />

        {discountedValue !== undefined && discountedValue < value && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
            <span className="line-through text-slate-400 font-semibold">{formatNumber(value)}</span>
            <span className="text-emerald-600 font-bold">{formatNumber(discountedValue)}</span>
          </div>
        )}

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

      {error && (
        <p className="text-[10px] text-rose-500 font-medium leading-tight">{error}</p>
      )}

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
