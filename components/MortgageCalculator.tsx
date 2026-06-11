
import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { calculateMortgage, formatCurrency, formatDate } from '../utils/calculations';
import { generateMortgagePDF } from '../utils/pdfGenerator';
import { CalculationInput, ViewMode, MonthlyPayment, PropertyInfo } from '../types';
import { InputGroup } from './InputGroup';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    BarChart, Bar
} from 'recharts';
import { Download, Table, PieChart as PieIcon, X, Calendar, HelpCircle, Loader2, ChevronRight, LayoutDashboard, Settings2, Building2, Wallet, CalendarDays, Percent, Info } from 'lucide-react';

interface MortgageCalculatorProps {
    onClose: () => void;
    propertyInfo?: PropertyInfo;
}

interface TabCalculation {
    id: string; // Уникальный идентификатор вкладки
    name: string; // Имя вкладки (например, "Расчет 1")
    input: CalculationInput; // Входные параметры
    mortgageType: 'base' | 'family'; // Тип ипотеки
    hasSubsidy: boolean; // Есть ли субсидия
    rateInputValue: string; // Введенное строковое значение ставки
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

    // Используем externalPropertyInfo, если оно передано, иначе тестовые данные
    const propertyInfoToUse: PropertyInfo = externalPropertyInfo || {
        address: "Н.М. Яблокова, 2, кв. 52",
        area: "54.77 м²",
        rooms: "2",
        finish: "Полная отделка",
        floor: "9 из 15",
        imageUrl: "https://cdn.pixabay.com/photo/2014/07/10/17/17/bedroom-389254_1280.jpg",
        managerName: "Иванов Иван Иванович",
        managerPhone: "+7 (999) 999-99-99",
        complexName: "ЖК «Северная Долина»",
        status: "Квартира свободна",
        deliveryDeadline: "2026 год 3 квартал",
        apartmentName: "2-к квартира, 54.77 м²",
        layoutImage: "https://cdn.pixabay.com/photo/2014/07/10/17/17/bedroom-389254_1280.jpg", // Placeholder image
        description: `<p>Это самый масштабный проект комплексной застройки в Пермском крае. На площади 27 гектаров
предусмотрено абсолютно всё для комфортного проживания, насыщенного досуга и приятного отдыха
современной молодой семьи.&nbsp;</p>
<p>Просторные дворы с затейливыми и при этом безопасными малыми игровыми формами для детей
разных возрастов. Оборудованные под ключ футбольные и баскетбольные площадки с возможностью
заливки льдом в зимний период. Грамотная инфраструктурная планировка &mdash; детские сады, школы,
магазины, аптеки, остановки &mdash; всё в шаговой доступности. &nbsp;</p>
<p>Жилой массив полностью оправдывает концепцию &laquo;город в городе&raquo;. Здесь каждый оценит
благотворное влияние мягкой экологии, удобство и комфорт придомовых территорий, душевный уют
благоприятного социального климата.<br />&nbsp;<br />&laquo;Медовый&raquo; &mdash; территория
сладкой жизни!</p>`
    };

    // Генерируем уникальный ключ для localStorage на основе адреса квартиры
    const storageKey = useMemo(() => {
        const id = propertyInfoToUse?.address || propertyInfoToUse?.apartmentName || 'default';
        return `mortgage_calc_tabs_${encodeURIComponent(id)}`;
    }, [propertyInfoToUse]);

    // Загрузка сохраненных расчетов из localStorage
    const savedData = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Ошибка парсинга localStorage:", e);
            }
        }
        return null;
    }, [storageKey]);

    const initialCalculations = useMemo<TabCalculation[]>(() => {
        if (savedData?.calculations && Array.isArray(savedData.calculations) && savedData.calculations.length > 0) {
            return savedData.calculations;
        }
        return [{
            id: '1',
            name: 'Расчет 1',
            input: {
                propertyValue: initialPropertyValue,
                downPayment: Math.round(initialPropertyValue * 0.201),
                interestRate: 12.5,
                years: 20,
                startDate: new Date().toISOString().split('T')[0]
            },
            mortgageType: 'base',
            hasSubsidy: false,
            rateInputValue: '12.5'
        }];
    }, [savedData, initialPropertyValue]);

    const [calculations, setCalculations] = useState<TabCalculation[]>(initialCalculations);

    const [activeTabId, setActiveTabId] = useState<string>(() => {
        if (savedData?.activeTabId) {
            const exists = initialCalculations.some(c => c.id === savedData.activeTabId);
            if (exists) return savedData.activeTabId;
        }
        return initialCalculations[0].id;
    });

    const activeCalc = useMemo(() => {
        return calculations.find(c => c.id === activeTabId) || calculations[0];
    }, [calculations, activeTabId]);

    // Производные переменные состояния для обратной совместимости во всем файле
    const input = activeCalc.input;
    const mortgageType = activeCalc.mortgageType;
    const hasSubsidy = activeCalc.hasSubsidy;
    const rateInputValue = activeCalc.rateInputValue;

    // Вспомогательная функция обновления активного расчета и синхронизации с localStorage
    const updateActiveCalc = (fields: Partial<TabCalculation> | ((prev: TabCalculation) => TabCalculation)) => {
        setCalculations(prev => {
            const next = prev.map(c => {
                if (c.id === activeCalc.id) {
                    return typeof fields === 'function' ? fields(c) : { ...c, ...fields };
                }
                return c;
            });
            localStorage.setItem(storageKey, JSON.stringify({ calculations: next, activeTabId: activeCalc.id }));
            return next;
        });
    };

    // Обертки над функциями обновления состояния для совместимости с существующим кодом
    const setInput = (newInput: CalculationInput | ((prev: CalculationInput) => CalculationInput)) => {
        updateActiveCalc(c => ({
            ...c,
            input: typeof newInput === 'function' ? newInput(c.input) : newInput
        }));
    };

    const setMortgageType = (newType: 'base' | 'family') => {
        updateActiveCalc({ mortgageType: newType });
    };

    const setHasSubsidy = (newVal: boolean) => {
        updateActiveCalc({ hasSubsidy: newVal });
    };

    const setRateInputValue = (newVal: string) => {
        updateActiveCalc({ rateInputValue: newVal });
    };

    const changeActiveTab = (id: string) => {
        setActiveTabId(id);
        localStorage.setItem(storageKey, JSON.stringify({ calculations, activeTabId: id }));
    };

    const addTab = () => {
        const nextId = String(Date.now());
        let maxNumber = 0;
        calculations.forEach(calc => {
            const match = calc.name.match(/Расчет (\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) {
                    maxNumber = num;
                }
            }
        });
        const newTabNumber = maxNumber > 0 ? maxNumber + 1 : calculations.length + 1;
        const newTab: TabCalculation = {
            id: nextId,
            name: `Расчет ${newTabNumber}`,
            input: {
                propertyValue: initialPropertyValue,
                downPayment: Math.round(initialPropertyValue * 0.201),
                interestRate: 12.5,
                years: 20,
                startDate: new Date().toISOString().split('T')[0]
            },
            mortgageType: 'base',
            hasSubsidy: false,
            rateInputValue: '12.5'
        };
        const nextCalculations = [...calculations, newTab];
        setCalculations(nextCalculations);
        setActiveTabId(nextId);
        localStorage.setItem(storageKey, JSON.stringify({ calculations: nextCalculations, activeTabId: nextId }));
    };

    const deleteTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (calculations.length <= 1) return;

        const nextCalculations = calculations.filter(c => c.id !== id);
        let nextActiveId = activeTabId;
        if (activeTabId === id) {
            const idx = calculations.findIndex(c => c.id === id);
            const fallbackIdx = idx === 0 ? 1 : idx - 1;
            nextActiveId = calculations[fallbackIdx].id;
        }
        setCalculations(nextCalculations);
        setActiveTabId(nextActiveId);
        localStorage.setItem(storageKey, JSON.stringify({ calculations: nextCalculations, activeTabId: nextActiveId }));
    };

    // Логика для семейной ипотеки: Макс кредит 6 млн
    const maxLoanAmount = mortgageType === 'family' ? 6000000 : Infinity;

    // Минимальный первоначальный взнос с учетом лимита кредита
    const minDownPaymentByLimit = Math.max(0, input.propertyValue - maxLoanAmount);

    // Обновление типа ипотеки с проверкой лимитов
    const handleMortgageTypeChange = (type: 'base' | 'family') => {
        setMortgageType(type);
        if (type === 'family') {
            const currentLoan = input.propertyValue - input.downPayment;
            if (currentLoan > 6000000) {
                setInput(prev => ({
                    ...prev,
                    downPayment: prev.propertyValue - 6000000
                }));
            }
        }
    };

    // Обновление стоимости недвижимости с проверкой лимитов
    const handlePropertyValueChange = (val: number) => {
        let newDownPayment = input.downPayment;

        // Если семейная ипотека, проверяем, чтобы кредит не превышал 6 млн
        if (mortgageType === 'family') {
            const maxLoan = 6000000;
            const minDown = Math.max(0, val - maxLoan);
            if (newDownPayment < minDown) {
                newDownPayment = minDown;
            }
        }

        // Также проверяем, чтобы ПВ не был больше стоимости (стандартная логика)
        if (newDownPayment > val) {
            newDownPayment = val;
        }

        setInput({ ...input, propertyValue: val, downPayment: newDownPayment });
    };

    // Обновление первоначального взноса с проверкой лимитов
    const handleDownPaymentChange = (val: number) => {
        let newDownPayment = val;

        setInput({ ...input, downPayment: newDownPayment });
    };

    const handleDownPaymentBlur = () => {
        if (mortgageType === 'family') {
            const minDown = Math.max(0, input.propertyValue - 6000000);
            if (input.downPayment < minDown) {
                setInput({ ...input, downPayment: minDown });
            }
        }
    };

    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Object);
    const [mobileTab, setMobileTab] = useState<'inputs' | 'results'>('inputs'); // Состояние для мобильных вкладок
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isRateInfoOpen, setIsRateInfoOpen] = useState(false);
    const [tooltipHeight, setTooltipHeight] = useState(480); // Высота тултипа для позиционирования
    const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false); // Подтверждение закрытия
    const [tabToDelete, setTabToDelete] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);

    React.useEffect(() => {
        const pressed = new Set<string>();
        const handleKeyDown = (e: KeyboardEvent) => {
            pressed.add(e.key.toLowerCase());
            if (pressed.has('k') && pressed.has('l')) {
                setShowDebug(prev => !prev);
                pressed.delete('k');
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            pressed.delete(e.key.toLowerCase());
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const dateInputRef = useRef<HTMLInputElement>(null);
    const rateButtonRef = useRef<HTMLButtonElement>(null);

    const confirmClose = () => {
        localStorage.removeItem(storageKey);
        onClose();
    };

    React.useEffect(() => {
        const handleRequestClose = () => setIsConfirmCloseOpen(true);
        document.addEventListener('request-mortgage-close', handleRequestClose);
        return () => document.removeEventListener('request-mortgage-close', handleRequestClose);
    }, []);

    // Закрываем тултип при скролле или изменении размеров, чтобы избежать отрыва от кнопки
    React.useEffect(() => {
        if (!isRateInfoOpen) return;
        const handleScroll = (e: Event) => {
            if (window.innerWidth < 1024) return;
            const target = e.target as HTMLElement;
            // Не закрываем тултип, если скролл происходит внутри него самого
            if (target && typeof target.closest === 'function' && target.closest('.rate-tooltip-container')) {
                return;
            }
            setIsRateInfoOpen(false);
        };
        const handleResize = () => {
            if (window.innerWidth < 1024) return;
            setIsRateInfoOpen(false);
        };

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isRateInfoOpen]);

    const result = useMemo(() => calculateMortgage(input), [input]);

    const apiOffers = useMemo(() => {
        const offers: Array<{
            rate: string;
            comment: string;
            bankName?: string;
            price?: number;
            offerprice?: number;
            frommonths?: number;
            tomonths?: number;
            subsidy?: boolean;
            offertermUid?: string;
            offertermName?: string;
        }> = [];

        if (propertyInfoToUse?.extraData && Array.isArray(propertyInfoToUse.extraData)) {
            propertyInfoToUse.extraData.forEach((group: any) => {
                if (group.items && Array.isArray(group.items)) {
                    group.items.forEach((item: any) => {
                        if (item.rates && Array.isArray(item.rates)) {
                            item.rates.forEach((rateObj: any) => {
                                const baseOffer = {
                                    rate: rateObj.rate + '%',
                                    comment: rateObj.comment || '',
                                    bankName: item.bank?.name || '',
                                    price: item.price,
                                    offerprice: item.offerprice,
                                    frommonths: rateObj.frommonths,
                                    tomonths: rateObj.tomonths,
                                    subsidy: item.subsidy,
                                };

                                if (item.offerterms && Array.isArray(item.offerterms) && item.offerterms.length > 0) {
                                    item.offerterms.forEach((term: any) => {
                                        offers.push({
                                            ...baseOffer,
                                            offertermUid: term.uid,
                                            offertermName: term.name,
                                        });
                                    });
                                } else {
                                    offers.push({
                                        ...baseOffer,
                                        offertermUid: undefined,
                                        offertermName: undefined,
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
        let finalOffers = offers;
        if (propertyInfoToUse?.extraData) {
            finalOffers = offers.filter(o => hasSubsidy ? o.subsidy === true : !o.subsidy);
        }

        if (finalOffers.length === 0) {
            return [
                { rate: '12.5%', comment: 'Стандартная ставка без дополнительных условий' },
            ];
        }

        return finalOffers;
    }, [propertyInfoToUse?.extraData, hasSubsidy]);

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
        try {
            await generateMortgagePDF(input, result, propertyInfoToUse);
        } catch (error) {
            console.error("PDF Generation failed:", error);
            // Можно добавить уведомление пользователю здесь
            alert("Не удалось сгенерировать PDF. Проверьте соединение с интернетом (для загрузки шрифтов/картинок).");
        } finally {
            setIsGeneratingPdf(false);
        }
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
                    onClick={() => setIsConfirmCloseOpen(true)}
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
                    {/* Вкладки расчетов */}
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3 -mt-2 mb-2 overflow-x-auto select-none no-scrollbar">
                        <div className="flex gap-1.5 items-center">
                            {calculations.map((calc) => {
                                const isActive = calc.id === activeTabId;
                                return (
                                    <div
                                        key={calc.id}
                                        onClick={() => {
                                            if (tabToDelete !== calc.id) changeActiveTab(calc.id);
                                        }}
                                        className={`flex items-center gap-1 pl-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${calculations.length > 1 ? 'pr-1.5' : 'pr-3'
                                            } ${tabToDelete === calc.id
                                                ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
                                                : isActive
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        {tabToDelete === calc.id ? (
                                            <>
                                                <span className="pl-1">Удалить?</span>
                                                <div className="flex gap-1 ml-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteTab(calc.id, e); setTabToDelete(null); }}
                                                        className="px-2 py-1 bg-rose-200 hover:bg-rose-300 text-rose-800 rounded text-[10px] uppercase tracking-wide transition-colors"
                                                    >
                                                        Да
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setTabToDelete(null); }}
                                                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] uppercase tracking-wide transition-colors"
                                                    >
                                                        Нет
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span>{calc.name}</span>
                                                {calculations.length > 1 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setTabToDelete(calc.id); }}
                                                        className={`p-1 rounded-md transition-colors ${isActive ? 'text-emerald-600 hover:bg-emerald-200/50 hover:text-emerald-800' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            onClick={addTab}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200 shrink-0"
                            title="Добавить новый расчет"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    </div>

                    {/* Переключатель типа ипотеки */}
                    <div className="flex bg-slate-200 p-1 rounded-xl mb-4">
                        <button
                            onClick={() => handleMortgageTypeChange('base')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mortgageType === 'base' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Базовые условия
                        </button>
                        <button
                            onClick={() => handleMortgageTypeChange('family')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mortgageType === 'family' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Семейная ипотека
                        </button>
                    </div>

                    <InputGroup
                        label={
                            <span className="flex items-center gap-2">
                                <Building2 size={16} className="text-slate-400" />
                                Стоимость недвижимости
                            </span>
                        }
                        value={input.propertyValue}
                        onChange={handlePropertyValueChange}
                        min={500000}
                        max={100000000}
                        step={100000}
                        suffix="₽"
                        readOnly={true}
                    />

                    {/* Чекбокс «Есть субсидия» */}
                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={hasSubsidy}
                                onChange={(e) => setHasSubsidy(e.target.checked)}
                                className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${hasSubsidy
                                ? 'bg-emerald-600 border-emerald-600 group-hover:bg-emerald-700 group-hover:border-emerald-700'
                                : 'border-slate-300 bg-white group-hover:border-slate-400'
                                }`}>
                                <svg
                                    className={`w-3 h-3 text-white transition-opacity duration-200 ${hasSubsidy ? 'opacity-100' : 'opacity-0'}`}
                                    viewBox="0 0 12 10"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M1 5.5L4 8.5L11 1.5" />
                                </svg>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Есть субсидия</span>
                    </label>

                    {/* Первоначальный взнос — слайдер */}
                    <div className="mb-2">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2 mt-1">
                                <Wallet size={16} className="text-slate-400" />
                                Первоначальный взнос
                            </span>
                            <div className="text-right">
                                <div className="text-lg font-bold text-slate-900 leading-none mb-1">{formatCurrency(input.downPayment)}</div>
                                <div className="text-sm text-slate-500 font-medium leading-none">{downPaymentPercentage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</div>
                            </div>
                        </div>
                        <div className="relative pb-8 pt-6 select-none group">
                            <div className="relative">
                                <div className="absolute inset-0 left-[8px] right-[8px] pointer-events-none z-20">
                                    {/* Метка 10.5% сверху */}
                                    <div className="absolute bottom-full mb-1 flex flex-col items-center" style={{ left: '10.5%', transform: 'translateX(-50%)' }}>
                                        <span className={`transition-all ${Math.abs(downPaymentPercentage - 10.5) < 0.5 ? 'text-emerald-600 font-bold text-[12px]' : 'text-slate-500 text-[11px]'}`}>10.5%</span>
                                        <div className="w-px h-2 rounded-full bg-slate-200 mt-0.5"></div>
                                    </div>
                                    {/* Точка 10.5% */}
                                    <div
                                        className={`absolute top-1/2 -mt-[3px] w-1.5 h-1.5 rounded-full transition-colors duration-300 shadow-sm ${downPaymentPercentage >= 10.5 ? 'bg-white' : 'bg-slate-400'}`}
                                        style={{ left: '10.5%', transform: 'translateX(-50%)' }}
                                    ></div>

                                    {/* Точка 20.1% */}
                                    <div
                                        className={`absolute top-1/2 -mt-[3px] w-1.5 h-1.5 rounded-full transition-colors duration-300 shadow-sm ${downPaymentPercentage >= 20.1 ? 'bg-white' : 'bg-slate-400'}`}
                                        style={{ left: '20.1%', transform: 'translateX(-50%)' }}
                                    ></div>
                                    {/* Метка 20.1% снизу */}
                                    <div className="absolute top-full mt-1 flex flex-col items-center" style={{ left: '20.1%', transform: 'translateX(-50%)' }}>
                                        <div className="w-px h-2 rounded-full bg-slate-200 mb-0.5"></div>
                                        <span className={`transition-all ${Math.abs(downPaymentPercentage - 20.1) < 0.5 ? 'text-emerald-600 font-bold text-[12px]' : 'text-slate-500 text-[11px]'}`}>20.1%</span>
                                    </div>
                                </div>

                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={downPaymentPercentage}
                                    onChange={(e) => {
                                        let v = parseFloat(e.target.value);
                                        // Притягивание к ключевым отметкам при свободном перемещении
                                        if (v < 20.1 && v !== 0) {
                                            const marks = [0, 10.5, 20.1];
                                            v = marks.reduce((prev, curr) => Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev);
                                        }
                                        const newDownPayment = Math.round(input.propertyValue * (v / 100));
                                        // Ограничение: кредит не может быть меньше 100 000 ₽
                                        const maxDown = input.propertyValue - 100000;
                                        handleDownPaymentChange(Math.min(newDownPayment, maxDown));
                                    }}
                                    onMouseUp={handleDownPaymentBlur}
                                    onTouchEnd={handleDownPaymentBlur}
                                    className="w-full h-2 bg-slate-200 hover:bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-600 flex relative z-10 transition-colors focus:outline-none"
                                />
                            </div>

                            {/* Крайние метки 0% и 100% */}
                            <div className="absolute left-0 right-0 top-6 text-[10px] font-medium pointer-events-none">
                                <span className={`absolute left-0 top-[10px] transition-all ${downPaymentPercentage === 0 ? 'text-emerald-600 font-bold text-[12px]' : 'text-slate-400 text-[11px]'}`}>0%</span>
                                <span className={`absolute right-0 top-[10px] transition-all ${downPaymentPercentage >= 99.9 ? 'text-emerald-600 font-bold text-[12px]' : 'text-slate-400 text-[11px]'}`}>100%</span>
                            </div>
                        </div>
                    </div>
                    {mortgageType === 'family' && (
                        <div className="flex items-start gap-2 -mt-2 mb-2 p-3 bg-orange-50 text-orange-700 rounded-xl text-xs font-medium border border-orange-100">
                            <HelpCircle size={16} className="shrink-0 mt-0.5" />
                            <span>Минимальный первоначальный взнос ограничен условиями кредитования - сумма кредита <b>не более 6 000 000 ₽</b></span>
                        </div>
                    )}

                    {/* Срок кредита — слайдер */}
                    <div className="mb-2">
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <CalendarDays size={16} className="text-slate-400" />
                                Срок кредита
                            </span>
                            <span className="text-lg font-bold text-slate-900">{input.years} лет</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            step="1"
                            value={input.years}
                            onChange={(e) => setInput({ ...input, years: parseInt(e.target.value) })}
                            className="w-full h-2 bg-slate-200 hover:bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-colors focus:outline-none"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-0">
                            <span>1 год</span>
                            <span>30 лет</span>
                        </div>
                        {/* Кнопки быстрого выбора срока */}
                        <div className="flex gap-2 mt-3">
                            {[10, 15, 20, 25, 30].map((years) => (
                                <button
                                    key={years}
                                    onClick={() => setInput({ ...input, years })}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${input.years === years
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                        }`}
                                >
                                    {years} лет
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Процентная ставка — разделённое поле */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Percent size={16} className="text-slate-400" />
                            Процентная ставка
                        </label>
                        <div className="flex gap-2 items-stretch">
                            {/* Левая часть — редактируемое значение ставки */}
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={rateInputValue}
                                    onChange={(e) => {
                                        // Разрешаем цифры, точку и запятую
                                        const raw = e.target.value.replace(/[^\d.,]/g, '');
                                        setRateInputValue(raw);
                                        // Парсим число для расчётов
                                        const val = parseFloat(raw.replace(',', '.'));
                                        if (!isNaN(val) && val >= 0 && val <= 50) {
                                            setInput(prev => ({ ...prev, interestRate: val }));
                                        }
                                    }}
                                    onBlur={() => {
                                        // При потере фокуса форматируем обратно
                                        setRateInputValue(String(input.interestRate));
                                    }}
                                    className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl outline-none transition-all text-lg font-bold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 hover:border-slate-300"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">%</span>
                            </div>
                            {/* Правая часть — кнопка "Узнать" */}
                            <div className="relative">
                                <button
                                    ref={rateButtonRef}
                                    onClick={() => setIsRateInfoOpen(!isRateInfoOpen)}
                                    className={`h-full flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${isRateInfoOpen
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:shadow-md'
                                        }`}
                                >
                                    <Info size={16} />
                                    Узнать
                                </button>

                                {/* Десктопный тултип — fixed позиционирование поверх всего */}
                                {isRateInfoOpen && (() => {
                                    const rect = rateButtonRef.current?.getBoundingClientRect();
                                    if (!rect) return null;
                                    const tooltipTop = Math.max(16, Math.min(rect.top + rect.height / 2 - tooltipHeight / 2, window.innerHeight - tooltipHeight - 16));
                                    const arrowTop = Math.max(24, Math.min(rect.top + rect.height / 2 - tooltipTop, tooltipHeight - 24));
                                    return createPortal(
                                        <div className="hidden lg:block fixed inset-0 z-[9999]">
                                            {/* Невидимый оверлей для закрытия по клику снаружи */}
                                            <div className="absolute inset-0" onClick={() => setIsRateInfoOpen(false)} />
                                            <div
                                                ref={(el) => {
                                                    if (el) {
                                                        const h = el.getBoundingClientRect().height;
                                                        if (h !== tooltipHeight) {
                                                            setTooltipHeight(h);
                                                        }
                                                    }
                                                }}
                                                className="absolute w-96 transition-all duration-200 rate-tooltip-container"
                                                style={{
                                                    left: rect.right + 16,
                                                    top: tooltipTop,
                                                }}
                                            >
                                                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 relative overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(100vh - 40px)' }}>
                                                    {/* Стрелка влево — привязана к позиции кнопки */}
                                                    <div className="absolute right-full -translate-y-1/2" style={{ top: arrowTop }}>
                                                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-white drop-shadow-sm"></div>
                                                    </div>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-base font-bold text-slate-800">Условия кредитования</h4>
                                                        <button
                                                            onClick={() => setIsRateInfoOpen(false)}
                                                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        {apiOffers.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${item.rate === input.interestRate + '%'
                                                                    ? 'bg-emerald-50 border-emerald-200'
                                                                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                                                    }`}
                                                            >
                                                                <div className="w-[4.5rem] shrink-0 text-left">
                                                                    <span className={`text-lg font-bold whitespace-nowrap ${item.rate === input.interestRate + '%' ? 'text-emerald-700' : 'text-slate-800'
                                                                        }`}>{item.rate}</span>
                                                                </div>
                                                                <div className="flex flex-col gap-0.5 pt-0.5">
                                                                    {item.bankName && <span className="text-xs font-bold text-slate-700">{item.bankName}</span>}
                                                                    {item.offertermName && <span className="text-xs font-semibold text-slate-600">{item.offertermName}</span>}
                                                                    <p className="text-xs text-slate-500 leading-relaxed">{item.comment}</p>
                                                                    {showDebug && (
                                                                        <div className="mt-1.5 p-2 bg-slate-800 text-emerald-400 text-[10px] rounded leading-tight font-mono break-all">
                                                                            price: {item.price}<br/>
                                                                            offerprice: {item.offerprice}<br/>
                                                                            frommonths: {item.frommonths}<br/>
                                                                            tomonths: {item.tomonths}<br/>
                                                                            subsidy: {item.subsidy ? 'true' : 'false'}<br/>
                                                                            uid: {item.offertermUid}<br/>
                                                                            name: {item.offertermName}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>,
                                        document.body
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Мобильная модалка информации о ставке */}
                    {isRateInfoOpen && (
                        <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
                            {/* Оверлей */}
                            <div
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                                onClick={() => setIsRateInfoOpen(false)}
                            />
                            {/* Контент модалки */}
                            <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-6 pb-8 shadow-2xl animate-fade-in-up z-10 max-h-[75vh] flex flex-col">
                                {/* Индикатор свайпа */}
                                <div className="flex justify-center mb-4 shrink-0">
                                    <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
                                </div>
                                <div className="flex items-center justify-between mb-5 shrink-0">
                                    <h4 className="text-lg font-bold text-slate-800">Информация о ставке</h4>
                                    <button
                                        onClick={() => setIsRateInfoOpen(false)}
                                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                                    {apiOffers.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-colors cursor-pointer ${item.rate === input.interestRate + '%'
                                                ? 'bg-emerald-50 border-emerald-200'
                                                : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="w-[5rem] shrink-0 text-left">
                                                <span className={`text-xl font-bold whitespace-nowrap ${item.rate === input.interestRate + '%' ? 'text-emerald-700' : 'text-slate-800'
                                                    }`}>{item.rate}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5 pt-0.5">
                                                {item.bankName && <span className="text-sm font-bold text-slate-700">{item.bankName}</span>}
                                                {item.offertermName && <span className="text-sm font-semibold text-slate-600">{item.offertermName}</span>}
                                                <p className="text-sm text-slate-500 leading-relaxed">{item.comment}</p>
                                                {showDebug && (
                                                    <div className="mt-1.5 p-2 bg-slate-800 text-emerald-400 text-[10px] rounded leading-tight font-mono break-all">
                                                        price: {item.price}<br/>
                                                        offerprice: {item.offerprice}<br/>
                                                        frommonths: {item.frommonths}<br/>
                                                        tomonths: {item.tomonths}<br/>
                                                        subsidy: {item.subsidy ? 'true' : 'false'}<br/>
                                                        uid: {item.offertermUid}<br/>
                                                        name: {item.offertermName}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

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
                    onClick={() => setIsConfirmCloseOpen(true)}
                    className="hidden lg:block absolute top-4 right-4 z-20 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={24} />
                </button>

                {/* Верхние карточки сводки */}
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4">
                        Результаты расчета
                    </h2>

                    {showDebug && propertyInfoToUse.extraData && (
                        <div className="mb-4 p-4 bg-slate-800 text-emerald-400 text-xs rounded-xl overflow-auto max-h-64 font-mono shadow-inner">
                            <pre>{JSON.stringify(propertyInfoToUse.extraData, null, 2)}</pre>
                        </div>
                    )}

                    {/* Основные ключевые метрики - Адаптивная сетка */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
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

                        {/* Процентная ставка */}
                        <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <div className="text-slate-500 text-xs md:text-sm font-medium mb-1">Процентная ставка</div>
                            <div className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">{input.interestRate}%</div>
                        </div>
                    </div>

                    {/* Сетка детальных метрик - Остальные элементы */}
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 md:gap-4">
                        {/* Срок */}
                        <div className="p-2 md:p-0">
                            <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Срок</div>
                            <div className="font-semibold text-slate-700 text-sm md:text-base">{termMonths} мес. <span className="text-slate-400 font-normal">({input.years} лет)</span></div>
                        </div>

                        {/* Дата первого платежа */}
                        <div className="p-2 md:p-0">
                            <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Дата 1-го платежа</div>
                            <div className="font-semibold text-slate-700 text-sm md:text-base">{firstPaymentDate ? formatDate(firstPaymentDate) : '-'}</div>
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
                        onClick={() => setViewMode(ViewMode.Object)}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${viewMode === ViewMode.Object
                            ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <Building2 size={16} className="md:w-[18px] md:h-[18px]" />
                        Объект
                    </button>
                    {/*
                    <button
                        onClick={() => setViewMode(ViewMode.Summary)}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${viewMode === ViewMode.Summary
                            ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <PieIcon size={16} className="md:w-[18px] md:h-[18px]" />
                        Графики
                    </button>
                    <button
                        onClick={() => setViewMode(ViewMode.Schedule)}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${viewMode === ViewMode.Schedule
                            ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <Table size={16} className="md:w-[18px] md:h-[18px]" />
                        График платежей
                    </button>
                    */}
                </div>

                {/* Динамический контент */}
                {/* Удален отступ p-3 md:p-6 из этого контейнера, чтобы разрешить липкие заголовки во всю ширину в списочном виде */}
                <div className={`bg-slate-50/30 md:flex-1 md:flex md:flex-col md:min-h-0 ${viewMode === ViewMode.Summary
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
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="year"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: '#94a3b8' }}
                                                />
                                                <YAxis
                                                    fontSize={10}
                                                    tickFormatter={(val) => (val / 1000000).toFixed(1) + 'м'}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: '#94a3b8' }}
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
                                            <XAxis dataKey="displayDate" minTickGap={30} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                            <YAxis hide />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                            {/* Основной долг снизу */}
                                            <Bar dataKey="principalPart" name="Основной долг" stackId="a" fill="#10b981" />
                                            {/* Проценты сверху */}
                                            <Bar dataKey="interestPart" name="Проценты" stackId="a" fill="#f59e0b" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    ) : viewMode === ViewMode.Object ? (
                        <div className="flex flex-col h-full p-3 md:p-6 overflow-y-auto">
                            {/* Карточка объекта */}
                            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                                <h3 className="text-base md:text-lg font-bold text-slate-700 mb-4">Объект</h3>
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Планировка */}
                                    <div className="w-full md:w-1/3 lg:w-1/4 shrink-0">
                                        <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative group">
                                            {propertyInfoToUse.layoutImage || propertyInfoToUse.imageUrl ? (
                                                <img
                                                    src={propertyInfoToUse.layoutImage || propertyInfoToUse.imageUrl}
                                                    alt="Планировка"
                                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                    <LayoutDashboard size={48} className="opacity-20" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Информация */}
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 content-start">
                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Название</div>
                                            <div className="text-base md:text-lg font-bold text-slate-800">
                                                {propertyInfoToUse.apartmentName || `${propertyInfoToUse.rooms}-к квартира`}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Адрес</div>
                                            <div className="text-base font-medium text-slate-700">
                                                {propertyInfoToUse.address}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Жилой комплекс</div>
                                            <div className="text-base font-medium text-emerald-700">
                                                {propertyInfoToUse.complexName || "—"}
                                            </div>
                                        </div>

                                        {propertyInfoToUse.deliveryDeadline && (
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Срок сдачи</div>
                                                <div className="text-base font-bold text-slate-800">
                                                    {propertyInfoToUse.deliveryDeadline}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Площадь</div>
                                                <div className="text-base font-bold text-slate-800">
                                                    {propertyInfoToUse.area}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Этаж</div>
                                                <div className="text-base font-bold text-slate-800">
                                                    {propertyInfoToUse.floor}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Комнат</div>
                                                <div className="text-base font-bold text-slate-800">
                                                    {propertyInfoToUse.rooms}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Отделка</div>
                                                <div className="text-base font-bold text-slate-800">
                                                    {propertyInfoToUse.finish}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Информация о менеджере и Результаты расчета ипотеки скрыты по запросу */}
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
                                                                )
                                                            })}
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
            {/* Модальное окно подтверждения закрытия */}
            {isConfirmCloseOpen && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10000] select-none">
                    <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-fade-in-up">
                        {/* Декоративная иллюстрация с папкой и улетающими вкладками расчетов */}
                        <div className="relative w-48 h-36 mb-4 flex items-center justify-center">

                            <svg className="w-full h-full relative z-10" viewBox="0 -10 180 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                                    @keyframes levitate {
                                        0% { transform: translateY(0px); }
                                        50% { transform: translateY(-6px); }
                                        100% { transform: translateY(0px); }
                                    }
                                    @keyframes float-symbol-1 {
                                        0% { transform: translateY(0px) rotate(0deg); opacity: 0.5; }
                                        50% { transform: translateY(-10px) rotate(15deg); opacity: 1; }
                                        100% { transform: translateY(0px) rotate(0deg); opacity: 0.5; }
                                    }
                                    @keyframes float-symbol-2 {
                                        0% { transform: translateY(0px) rotate(0deg); opacity: 0.5; }
                                        50% { transform: translateY(-8px) rotate(-15deg); opacity: 1; }
                                        100% { transform: translateY(0px) rotate(0deg); opacity: 0.5; }
                                    }
                                    .calc-float { animation: levitate 5s ease-in-out infinite; transform-origin: center; }
                                    .symbol-1 { animation: float-symbol-1 4s ease-in-out infinite; }
                                    .symbol-2 { animation: float-symbol-2 5s ease-in-out infinite; }
                                ` }} />
                                <defs>
                                    <radialGradient id="bgGlowRose" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#ffe4e6" stopOpacity="0.8" />
                                        <stop offset="100%" stopColor="#ffe4e6" stopOpacity="0" />
                                    </radialGradient>
                                    <radialGradient id="bgGlowEmerald" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#ecfdf5" stopOpacity="0.8" />
                                        <stop offset="100%" stopColor="#ecfdf5" stopOpacity="0" />
                                    </radialGradient>

                                    <linearGradient id="calcBodyGrad" x1="50" y1="20" x2="130" y2="120" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#ffffff" />
                                        <stop offset="100%" stopColor="#f1f5f9" />
                                    </linearGradient>
                                    <linearGradient id="calcBorderGrad" x1="50" y1="20" x2="130" y2="120" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.6" />
                                        <stop offset="100%" stopColor="#e2e8f0" stopOpacity="1" />
                                    </linearGradient>
                                    <linearGradient id="calcDisplayGrad" x1="60" y1="30" x2="120" y2="50" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
                                    </linearGradient>
                                    <linearGradient id="accentBtnGrad" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#f43f5e" />
                                        <stop offset="100%" stopColor="#e11d48" />
                                    </linearGradient>
                                    <linearGradient id="equalBtnGrad" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#10b981" />
                                        <stop offset="100%" stopColor="#059669" />
                                    </linearGradient>
                                    <filter id="calcShadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.15" />
                                    </filter>
                                    <filter id="symbolShadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10b981" floodOpacity="0.2" />
                                    </filter>
                                </defs>

                                {/* Фоновое свечение */}
                                <circle cx="90" cy="70" r="50" fill="url(#bgGlowEmerald)" />
                                <circle cx="120" cy="40" r="40" fill="url(#bgGlowRose)" />

                                {/* Плавающие математические символы */}
                                <g className="symbol-1" style={{ transformOrigin: '35px 45px' }} filter="url(#symbolShadow)">
                                    <rect x="25" y="35" width="20" height="20" rx="6" fill="#ffffff" stroke="#f43f5e" strokeWidth="1.5" />
                                    <path d="M30 45 L40 45 M35 40 L35 50" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                                </g>
                                <g className="symbol-2" style={{ transformOrigin: '145px 85px' }} filter="url(#symbolShadow)">
                                    <rect x="135" y="75" width="20" height="20" rx="6" fill="#ffffff" stroke="#10b981" strokeWidth="1.5" />
                                    <path d="M140 83 L150 83 M140 87 L150 87" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                                </g>
                                <g className="symbol-1" style={{ transformOrigin: '140px 30px' }} filter="url(#symbolShadow)">
                                    <rect x="130" y="20" width="20" height="20" rx="6" fill="#ffffff" stroke="#f59e0b" strokeWidth="1.5" />
                                    <path d="M136 26 L144 34 M144 26 L136 34" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                                </g>
                                <g className="symbol-2" style={{ transformOrigin: '30px 90px' }} filter="url(#symbolShadow)">
                                    <circle cx="35" cy="85" r="12" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                                    <path d="M31 85 L39 85" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                                </g>

                                {/* Основной калькулятор */}
                                <g className="calc-float" filter="url(#calcShadow)">
                                    <rect x="55" y="15" width="70" height="110" rx="14" fill="url(#calcBodyGrad)" stroke="url(#calcBorderGrad)" strokeWidth="1.5" />

                                    {/* Дисплей */}
                                    <rect x="65" y="25" width="50" height="22" rx="6" fill="url(#calcDisplayGrad)" stroke="#10b981" strokeOpacity="0.2" strokeWidth="1" />
                                    <path d="M 105 38 L 105 38.1" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M 98 38 L 98 38.1" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M 91 38 L 91 38.1" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M 75 38 L 82 38" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />

                                    {/* Кнопки */}
                                    <rect x="65" y="55" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                    <rect x="84" y="55" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                    <rect x="103" y="55" width="12" height="12" rx="4" fill="url(#accentBtnGrad)" />

                                    <rect x="65" y="73" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                    <rect x="84" y="73" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                    <rect x="103" y="73" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />

                                    <rect x="65" y="91" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                    <rect x="84" y="91" width="12" height="12" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                    <rect x="103" y="91" width="12" height="28" rx="4" fill="url(#equalBtnGrad)" />

                                    <rect x="65" y="109" width="31" height="10" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                                </g>
                            </svg>
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-800 mb-2">Очистить расчеты?</h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6 px-2">
                            После закрытия калькулятора все ваши расчеты очистятся. При необходимости скачайте их в PDF перед закрытием.
                        </p>

                        <div className="w-full">
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setIsConfirmCloseOpen(false)}
                                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                                >
                                    Вернуться
                                </button>
                                <button
                                    onClick={confirmClose}
                                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200/50 active:scale-95 transition-all"
                                >
                                    Закрыть калькулятор
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
