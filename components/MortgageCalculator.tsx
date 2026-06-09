
import React, { useState, useMemo, useRef } from 'react';
import { calculateMortgage, formatCurrency, formatDate } from '../utils/calculations';
import { generateMortgagePDF } from '../utils/pdfGenerator';
import { CalculationInput, ViewMode, MonthlyPayment, PropertyInfo } from '../types';
import { InputGroup } from './InputGroup';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from 'recharts';
import { Download, Table, PieChart as PieIcon, X, Calendar, HelpCircle, Loader2, ChevronRight, LayoutDashboard, Settings2 } from 'lucide-react';

interface MortgageCalculatorProps {
  onClose: () => void;
  propertyInfo?: PropertyInfo;
}

// Функция для парсинга цены из строки (убирает пробелы и преобразует в число)
const parsePrice = (priceString?: string): number => {
  if (!priceString) return 5000000; // Значение по умолчанию
  // Убираем все пробелы и преобразуем в число
  const cleaned = priceString.replace(/\s+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 5000000 : parsed;
};

export const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({ onClose, propertyInfo: externalPropertyInfo }) => {
  // Используем цену из propertyInfo, если она передана
  const initialPropertyValue = externalPropertyInfo?.price 
    ? parsePrice(externalPropertyInfo.price)
    : 5000000;

  const [input, setInput] = useState<CalculationInput>({
    propertyValue: initialPropertyValue,
    downPayment: Math.round(initialPropertyValue * 0.2), // 20% от стоимости по умолчанию
    interestRate: 12.5,
    years: 20,
    startDate: new Date().toISOString().split('T')[0]
  });

  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Summary);
  const [mobileTab, setMobileTab] = useState<'inputs' | 'results'>('inputs'); // Состояние для мобильных вкладок
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => calculateMortgage(input), [input]);

  // Расчет процента первоначального взноса
  const downPaymentPercentage = useMemo(() => {
    if (input.propertyValue === 0) return 0;
    return (input.downPayment / input.propertyValue) * 100;
  }, [input.downPayment, input.propertyValue]);

  const chartData = [
    { name: 'Основной долг', value: result.loanAmount, color: '#10b981' }, // изумрудный-500
    { name: 'Переплата %', value: result.totalInterest, color: '#f59e0b' }, // янтарный-500
  ];

  // Расчет процента переплаты от суммы кредита
  const interestPercentage = result.loanAmount > 0 
    ? (result.totalInterest / result.loanAmount) * 100 
    : 0;
  
  const interestPercentageStr = interestPercentage.toLocaleString('ru-RU', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });

  // Дополнительные метрики
  const termMonths = Math.round(input.years * 12);
  const minIncome = result.monthlyPayment * 2;
  const firstPaymentDate = result.schedule.length > 0 ? result.schedule[0].paymentDate : null;
  const lastPaymentDate = result.schedule.length > 0 ? result.schedule[result.schedule.length - 1].paymentDate : null;


  // Подготовка данных для диаграммы с областями (Остаток во времени)
  // Теперь отображаются годовые точки
  const areaChartData = useMemo(() => {
    // Фильтр для получения 12-го месяца каждого года, плюс самый последний платеж, если он не кратен 12
    return result.schedule
        .filter((item) => item.monthIndex % 12 === 0 || item.monthIndex === result.schedule.length)
        .map(item => {
            const principalPaid = result.loanAmount - item.remainingBalance;
            const interestPaid = item.totalPaidToDate - principalPaid;
            
            // Расчет ОСТАВШИХСЯ процентов, подлежащих выплате с этого момента
            const remainingInterest = Math.max(0, result.totalInterest - interestPaid);
            
            // Общий остаток, включая будущие проценты
            // Это гарантирует, что "Остаток долга" во всплывающей подсказке представляет собой полную сумму долга,
            // а "Остаток тела" (remainingPrincipal) + "Остаток %" (remainingInterest) = totalBalance.
            const totalBalance = item.remainingBalance + remainingInterest;

            return {
                year: item.paymentDate.getFullYear(),
                date: formatDate(item.paymentDate),
                balance: totalBalance,
                remainingPrincipal: item.remainingBalance, // Баланс — это и есть остаток основного долга
                remainingInterest: remainingInterest
            };
        });
  }, [result]);

  // Группировка графика по календарным годам
  const scheduleByYear = useMemo(() => {
    const groups: { [year: number]: MonthlyPayment[] } = {};
    result.schedule.forEach(item => {
        const year = item.paymentDate.getFullYear();
        if (!groups[year]) groups[year] = [];
        groups[year].push(item);
    });
    return groups;
  }, [result]);

  // Подготовка данных для столбчатой диаграммы (Ежемесячные платежи)
  const monthlyChartData = useMemo(() => {
    return result.schedule.map(item => ({
        ...item,
        dateStr: formatDate(item.paymentDate),
        displayDate: item.paymentDate.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
    }));
  }, [result.schedule]);

  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);

    // Используем externalPropertyInfo, если оно передано, иначе тестовые данные
    const propertyInfoToUse: PropertyInfo = externalPropertyInfo || {
        address: "Н.М. Яблокова, 2, кв. 52",
        area: "54.77 м²",
        rooms: "2",
        finish: "Полная отделка",
        floor: "9 из 15",
        imageUrl: "",
        managerName: "Иванов Иван Иванович",
        managerPhone: "+7 (999) 999-99-99"
    };

    await generateMortgagePDF(input, result, propertyInfoToUse);
    setIsGeneratingPdf(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Определение контекста графика: Area Chart имеет 'remainingInterest', Bar Chart имеет 'interestPart'
      const isBalanceChart = data.remainingInterest !== undefined;

      const headerText = isBalanceChart 
        ? `${data.year} год` 
        : `${data.dateStr} (№${data.monthIndex})`;
      
      const mainLabel = isBalanceChart ? 'Остаток долга:' : 'Сумма платежа:';
      
      // Для AreaChart 'balance' - это общая оставшаяся сумма.
      // Для BarChart 'payment' - это ежемесячный платеж.
      const mainValue = isBalanceChart ? (data.balance ?? 0) : (data.payment ?? 0);

      return (
        <div className="bg-white p-4 border border-slate-100 shadow-xl rounded-xl text-sm">
          <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">{headerText}</p>
          
          <div className="space-y-1">
             <div className="flex justify-between gap-4">
                <span className="text-slate-500">{mainLabel}</span>
                <span className="font-bold text-slate-800">{formatCurrency(mainValue)}</span>
             </div>
             <div className="pt-2 mt-1 border-t border-slate-50">
                 <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">
                    {isBalanceChart ? 'Структура остатка:' : 'В платеже:'}
                 </p>
                 <div className="flex justify-between gap-4">
                    <span className="text-emerald-600">{isBalanceChart ? 'Остаток тела:' : 'Осн. долг:'}</span>
                    <span className="font-medium text-emerald-700">
                        {formatCurrency(isBalanceChart ? (data.remainingPrincipal ?? 0) : (data.principalPart ?? 0))}
                    </span>
                 </div>
                 <div className="flex justify-between gap-4">
                    <span className="text-amber-500">{isBalanceChart ? 'Остаток %:' : 'Проценты:'}</span>
                    <span className="font-medium text-amber-600">
                        {formatCurrency(isBalanceChart ? (data.remainingInterest ?? 0) : (data.interestPart ?? 0))}
                    </span>
                 </div>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const openDatePicker = () => {
    try {
        if (dateInputRef.current) {
            (dateInputRef.current as any).showPicker();
        }
    } catch (e) {
        console.error("Browser doesn't support showPicker", e);
    }
  };

  return (
    <div className="bg-white w-full h-full flex flex-col lg:flex-row overflow-hidden lg:rounded-2xl shadow-2xl relative">
        
        {/* Мобильный/Планшетный заголовок / Вкладки навигации */}
        {/* Видимо на мобильных и планшетах (< 1024px) */}
        <div className="lg:hidden shrink-0 bg-slate-50 border-b border-slate-200 p-3 flex items-center gap-3 z-20">
             {/* Сегментированный переключатель */}
             <div className="flex-1 flex bg-slate-200/60 p-1 rounded-xl">
                 <button 
                    onClick={() => setMobileTab('inputs')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'inputs' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                 >
                    <Settings2 size={16} />
                    Параметры
                 </button>
                 <button 
                    onClick={() => setMobileTab('results')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'results' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                 >
                    <LayoutDashboard size={16} />
                    Результаты
                 </button>
             </div>
             {/* Кнопка закрытия */}
             <button 
                onClick={onClose} 
                className="p-2.5 bg-slate-200/60 active:bg-slate-300 rounded-xl text-slate-600 transition-colors"
            >
                <X size={20} />
            </button>
        </div>


      {/* Левая панель: Ввод данных */}
      {/* Видимо на десктопе (lg) ИЛИ если вкладка 'inputs' (мобильные/планшеты) */}
      <div className={`w-full lg:w-[400px] bg-slate-50 p-4 lg:p-6 overflow-y-auto border-r border-slate-200 shrink-0 ${mobileTab === 'inputs' ? 'block' : 'hidden lg:block'}`}>
        {/* Заголовок скрыт во вкладках, так как вкладки выполняют роль заголовка */}
        <h2 className="hidden lg:block text-xl font-bold text-slate-800 mb-6">Параметры</h2>
        
        <div className="space-y-6">
          <InputGroup
            label="Стоимость недвижимости"
            value={input.propertyValue}
            onChange={(v) => setInput({ ...input, propertyValue: v })}
            min={500000}
            max={100000000}
            step={100000}
            suffix="₽"
          />

          <InputGroup
            label="Первоначальный взнос"
            value={input.downPayment}
            onChange={(v) => setInput({ ...input, downPayment: v })}
            min={0}
            max={input.propertyValue - 100000}
            step={50000}
            suffix="₽"
            secondaryLabel={`${downPaymentPercentage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`}
            presets={[
                { label: '15%', value: Math.round(input.propertyValue * 0.15) },
                { label: '20%', value: Math.round(input.propertyValue * 0.20) },
                { label: '25%', value: Math.round(input.propertyValue * 0.25) },
                { label: '30%', value: Math.round(input.propertyValue * 0.30) },
                { label: '50%', value: Math.round(input.propertyValue * 0.50) },
            ]}
          />

          <InputGroup
            label="Процентная ставка"
            value={input.interestRate}
            onChange={(v) => setInput({ ...input, interestRate: v })}
            min={0.01}
            max={30}
            step={0.01}
            suffix="%"
          />
          
          <InputGroup
            label="Срок кредита (лет)"
            value={input.years}
            onChange={(v) => setInput({ ...input, years: v })}
            min={0.1}
            max={30}
            step={0.1}
            suffix="лет"
            presets={[
                { label: '10 лет', value: 10 },
                { label: '15 лет', value: 15 },
                { label: '20 лет', value: 20 },
                { label: '25 лет', value: 25 },
                { label: '30 лет', value: 30 },
            ]}
          />
          
           <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Дата выдачи</label>
            <div 
                className="relative cursor-pointer"
                onClick={openDatePicker}
            >
                <input
                    ref={dateInputRef}
                    type="date"
                    value={input.startDate}
                    onChange={(e) => setInput({ ...input, startDate: e.target.value })}
                    onClick={openDatePicker}
                    onFocus={openDatePicker}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900 font-bold shadow-sm hover:border-slate-300 placeholder-slate-400 cursor-pointer"
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
           </div>

        </div>

        {/* Кнопка навигации для мобильных/планшетов (Внизу ввода) */}
        <div className="lg:hidden mt-8 pt-4 border-t border-slate-200">
             <button
              onClick={() => setMobileTab('results')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Рассчитать
              <ChevronRight size={20} />
            </button>
        </div>

        {/* Кнопка PDF - Видима на планшете/десктопе для доступности во вкладке ввода */}
        <div className="mt-8 pt-6 border-t border-slate-200">
             <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium shadow-sm transition-colors ${isGeneratingPdf ? 'bg-slate-400 cursor-not-allowed text-slate-100' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
              {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isGeneratingPdf ? 'Генерация...' : 'Скачать PDF'}
            </button>
        </div>
      </div>

      {/* Правая панель: Результаты */}
      {/* 
        Стратегия верстки:
        - Мобильные/Планшеты (< lg): Вкладки. Родитель обрабатывает скролл страницы (overflow-y-auto).
        - Десктоп (>= lg): Разделенный вид. Родитель имеет фиксированную высоту (overflow-hidden), внутренние контейнеры скроллятся.
      */}
      <div className={`flex-1 h-full bg-white relative min-w-0 
        ${mobileTab === 'results' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}
        overflow-y-auto md:overflow-hidden
      `}>
         {/* Кнопка закрытия только для десктопа */}
         <button 
            onClick={onClose} 
            className="hidden lg:block absolute top-4 right-4 z-20 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
        >
            <X size={24} />
        </button>

        {/* Верхние карточки сводки */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4">Результаты расчета</h2>
            
            {/* Основные ключевые метрики - Адаптивная сетка */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                {/* Ежемесячный платеж */}
                <div className="p-4 md:p-5 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-200/50">
                    <div className="text-emerald-100 text-xs md:text-sm font-medium mb-1">Ежемесячный платеж</div>
                    <div className="text-2xl md:text-3xl font-bold tracking-tight">{formatCurrency(result.monthlyPayment)}</div>
                </div>

                {/* Сумма кредита */}
                <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                     <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Сумма кредита</div>
                     <div className="text-lg md:text-2xl font-bold text-slate-800">{formatCurrency(result.loanAmount)}</div>
                     <div className="text-[10px] md:text-xs text-slate-400 mt-1">основной долг</div>
                </div>

                {/* Общая переплата */}
                <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Начисленные проценты</div>
                    <div className="text-lg md:text-2xl font-bold text-amber-600 tracking-tight">{formatCurrency(result.totalInterest)}</div>
                    <div className="text-[10px] md:text-xs text-slate-400 mt-1">{interestPercentageStr}% от кредита</div>
                </div>

                 {/* Общая сумма выплат */}
                 <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                     <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Общая сумма выплат</div>
                     <div className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(result.totalPayment)}</div>
                     <div className="text-[10px] md:text-xs text-slate-400 mt-1">тело + проценты</div>
                </div>
            </div>

            {/* Сетка детальных метрик - Остальные элементы */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-y-4 gap-x-2 md:gap-4">
                {/* Процентная ставка */}
                <div className="p-2 md:p-0">
                    <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Ставка</div>
                    <div className="font-semibold text-slate-700 text-sm md:text-base">{input.interestRate}%</div>
                </div>

                {/* Срок */}
                <div className="p-2 md:p-0">
                    <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Срок</div>
                    <div className="font-semibold text-slate-700 text-sm md:text-base">{termMonths} мес. <span className="text-slate-400 font-normal">({input.years} лет)</span></div>
                </div>

                {/* Минимальный доход */}
                <div className="p-2 md:p-0">
                    <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                        Необх. доход
                        <div className="relative group/tooltip hidden md:block">
                            <HelpCircle size={14} className="cursor-help text-slate-400 hover:text-slate-600 transition-colors"/>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 text-center pointer-events-none shadow-xl normal-case font-normal">
                                Ежемесячный платеж по кредитам не может превышать 50% от среднего дохода заемщика за последние 6 месяцев
                                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    </div>
                    <div className="font-semibold text-slate-700 text-sm md:text-base">{formatCurrency(minIncome)}</div>
                </div>

                {/* Дата первого платежа */}
                <div className="p-2 md:p-0">
                    <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Дата 1-го платежа</div>
                    <div className="font-semibold text-slate-700 text-sm md:text-base">{firstPaymentDate ? formatDate(firstPaymentDate) : '-'}</div>
                </div>

                {/* Дата последнего платежа */}
                <div className="p-2 md:p-0">
                     <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Дата посл. платежа</div>
                     <div className="font-semibold text-slate-700 text-sm md:text-base">{lastPaymentDate ? formatDate(lastPaymentDate) : '-'}</div>
                </div>
            </div>
            
            {/* Мобильная кнопка PDF внутри результатов (Только если Левая панель скрыта) */}
            <div className="lg:hidden mt-6 pt-4 border-t border-slate-200">
                 <button
                  onClick={handleExportPDF}
                  disabled={isGeneratingPdf}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium shadow-sm transition-colors ${isGeneratingPdf ? 'bg-slate-400 cursor-not-allowed text-slate-100' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                >
                  {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  {isGeneratingPdf ? 'Генерация...' : 'Скачать PDF'}
                </button>
            </div>
        </div>

        {/* Переключатель вида - Закреплен на мобильных */}
        <div className="flex px-4 md:px-6 py-2 md:py-4 gap-2 border-b border-slate-50 overflow-x-auto shrink-0 sticky md:static top-0 z-30 bg-white">
            <button
                onClick={() => setViewMode(ViewMode.Summary)}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                    viewMode === ViewMode.Summary 
                    ? 'bg-emerald-100 text-emerald-800 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
                <PieIcon size={16} className="md:w-[18px] md:h-[18px]" />
                Графики
            </button>
            <button
                onClick={() => setViewMode(ViewMode.Schedule)}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                    viewMode === ViewMode.Schedule
                    ? 'bg-emerald-100 text-emerald-800 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
                <Table size={16} className="md:w-[18px] md:h-[18px]" />
                График платежей
            </button>
        </div>

        {/* Динамический контент */}
        {/* Удален отступ p-3 md:p-6 из этого контейнера, чтобы разрешить липкие заголовки во всю ширину в списочном виде */}
        <div className={`bg-slate-50/30 md:flex-1 md:flex md:flex-col md:min-h-0 ${
            viewMode === ViewMode.Summary 
                ? 'md:overflow-y-auto' 
                : 'md:overflow-y-auto lg:overflow-hidden'
        }`}>
            {viewMode === ViewMode.Summary ? (
                /* Здесь добавлен отступ для вида сводки */
                <div className="flex flex-col gap-4 p-3 md:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 min-h-[280px]">
                        
                        {/* Круговая диаграмма */}
                        <div className="lg:col-span-3 bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                            <h3 className="text-base md:text-lg font-bold text-slate-700 mb-3">Структура выплат</h3>
                            <div className="flex-1 min-h-[200px] md:min-h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip 
                                            formatter={(value: number) => formatCurrency(value)}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={36} 
                                            iconType="circle"
                                            wrapperStyle={{ paddingTop: '10px' }}
                                            formatter={(value, entry: any) => <span className="text-slate-600 font-medium ml-2 text-xs md:text-sm">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Диаграмма с областями */}
                        <div className="lg:col-span-7 bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                            <h3 className="text-base md:text-lg font-bold text-slate-700 mb-3">График погашения</h3>
                            <div className="flex-1 min-h-[200px] md:min-h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis 
                                            dataKey="year" 
                                            fontSize={10} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tick={{fill: '#94a3b8'}}
                                        />
                                        <YAxis 
                                            fontSize={10}
                                            tickFormatter={(val) => (val/1000000).toFixed(1) + 'м'}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{fill: '#94a3b8'}}
                                            domain={[0, 'auto']} 
                                        />
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Area 
                                            type="monotone" 
                                            dataKey="balance" 
                                            stroke="#10b981" 
                                            strokeWidth={3}
                                            fillOpacity={1} 
                                            fill="url(#colorBalance)" 
                                            dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Столбчатая диаграмма */}
                    <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        <h3 className="text-base md:text-lg font-bold text-slate-700 mb-1">График платежей (структура)</h3>
                        <div className="h-[200px] md:h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyChartData} margin={{ top: 0, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="displayDate" minTickGap={30} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                    <YAxis hide />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                                    {/* Основной долг снизу */}
                                    <Bar dataKey="principalPart" name="Основной долг" stackId="a" fill="#10b981" />
                                    {/* Проценты сверху */}
                                    <Bar dataKey="interestPart" name="Проценты" stackId="a" fill="#f59e0b" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                {/* Табличный вид для десктопа (Visible on lg+) */}
                {/* Здесь добавлен отступ для обертки таблицы десктопа для сохранения визуальной целостности */}
                <div className="hidden lg:flex flex-col h-full p-6">
                    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm lg:text-base text-left relative min-w-[600px]">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="pl-6 pr-2 py-4 w-16">№</th>
                                        <th className="px-6 py-4">Дата</th>
                                        <th className="px-6 py-4">Платеж</th>
                                        <th className="px-6 py-4">Осн. долг</th>
                                        <th className="px-6 py-4">Проценты</th>
                                        <th className="px-6 py-4">Остаток</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Object.keys(scheduleByYear).sort().map(yearStr => {
                                        const year = Number(yearStr);
                                        const payments = scheduleByYear[year];
                                        
                                        const totalPaymentYear = payments.reduce((sum, p) => sum + p.payment, 0);
                                        const totalPrincipalYear = payments.reduce((sum, p) => sum + p.principalPart, 0);
                                        const totalInterestYear = payments.reduce((sum, p) => sum + p.interestPart, 0);

                                        return (
                                            <React.Fragment key={year}>
                                                <tr className="bg-slate-100/80">
                                                    <td colSpan={6} className="px-6 py-3">
                                                        <div className="flex items-center justify-between font-bold text-slate-700 gap-1">
                                                            <span>{year} год</span>
                                                            <div className="flex items-center gap-1 text-base font-normal text-slate-600 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                                                <span>Выплачено: <span className="font-medium text-slate-800">{formatCurrency(totalPaymentYear)}</span></span>
                                                                <span className="text-slate-400">|</span>
                                                                <span className="text-slate-500">(Долг: {formatCurrency(totalPrincipalYear)}, %: {formatCurrency(totalInterestYear)})</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {payments.map((row) => {
                                                    const isWeekend = row.paymentDate.getDay() === 0 || row.paymentDate.getDay() === 6;
                                                    const dayName = row.paymentDate.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase();
                                                    const dateDisplay = `${formatDate(row.paymentDate)} (${dayName})`;

                                                    return (
                                                    <tr key={row.monthIndex} className="hover:bg-slate-50 transition-colors group text-base">
                                                        <td className="pl-6 pr-2 py-3 text-slate-400 font-medium">{row.monthIndex}</td>
                                                        <td className={`px-6 py-3 font-medium transition-colors ${isWeekend ? 'text-rose-500' : 'text-slate-600 group-hover:text-emerald-700'}`}>
                                                            {dateDisplay}
                                                        </td>
                                                        <td className="px-6 py-3 font-medium text-slate-800">{formatCurrency(row.payment)}</td>
                                                        <td className="px-6 py-3 text-emerald-600">{formatCurrency(row.principalPart)}</td>
                                                        <td className="px-6 py-3 text-amber-600">{formatCurrency(row.interestPart)}</td>
                                                        <td className="px-6 py-3 text-slate-400 font-mono">{formatCurrency(row.remainingBalance)}</td>
                                                    </tr>
                                                )})}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Компактный список для мобильных (< lg) */}
                <div className="lg:hidden">
                    {Object.keys(scheduleByYear).sort().map(yearStr => {
                        const year = Number(yearStr);
                        const payments = scheduleByYear[year];
                        const totalPaymentYear = payments.reduce((sum, p) => sum + p.payment, 0);
                        const totalPrincipalYear = payments.reduce((sum, p) => sum + p.principalPart, 0);
                        const totalInterestYear = payments.reduce((sum, p) => sum + p.interestPart, 0);

                        return (
                            <div key={year} className="relative">
                                {/* Закрепленный заголовок года */}
                                <div className="sticky top-[49px] md:top-0 z-10 bg-slate-50 border-y border-slate-200 py-2 px-3 shadow-sm flex flex-col justify-center min-h-[50px]">
                                    <div className="flex justify-between items-baseline w-full">
                                         <span className="font-bold text-slate-800 text-sm">{year} год</span>
                                         <span className="font-bold text-slate-800 text-xs">{formatCurrency(totalPaymentYear)}</span>
                                    </div>
                                    <div className="flex justify-between items-center w-full mt-1 text-[10px] text-slate-500">
                                         <div className="flex gap-2">
                                            <span>Долг: <span className="text-emerald-700">{formatCurrency(totalPrincipalYear)}</span></span>
                                            <span>%: <span className="text-amber-700">{formatCurrency(totalInterestYear)}</span></span>
                                         </div>
                                    </div>
                                </div>

                                <div className="bg-white divide-y divide-slate-100 border-b border-slate-200">
                                    {payments.map((row) => {
                                        const isWeekend = row.paymentDate.getDay() === 0 || row.paymentDate.getDay() === 6;
                                        const dateStr = row.paymentDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                        const weekDay = row.paymentDate.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase();
                                        
                                        return (
                                            <div key={row.monthIndex} className="px-3 py-2.5">
                                                 {/* Строка 1: Номер, Дата, Сумма */}
                                                 <div className="flex justify-between items-center mb-1.5">
                                                     <div className="flex items-center gap-3">
                                                         <span className="text-[10px] text-slate-400 font-medium w-5">#{row.monthIndex}</span>
                                                         <div className={`text-sm font-semibold ${isWeekend ? 'text-rose-500' : 'text-slate-700'}`}>
                                                             {dateStr} <span className="text-[10px] font-normal opacity-60 ml-0.5">{weekDay}</span>
                                                         </div>
                                                     </div>
                                                     <div className="text-sm font-bold text-slate-900">{formatCurrency(row.payment)}</div>
                                                 </div>
                                        
                                                 {/* Строка 2: Детализация и Остаток */}
                                                 <div className="flex justify-between items-center text-[10px] pl-8">
                                                     <div className="flex items-center gap-2">
                                                         <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">{formatCurrency(row.principalPart)}</span>
                                                         <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50">{formatCurrency(row.interestPart)}</span>
                                                     </div>
                                                     <div className="text-slate-400 font-mono">Ост: {formatCurrency(row.remainingBalance)}</div>
                                                 </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};
