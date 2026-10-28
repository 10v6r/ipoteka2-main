
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { Download, Table, PieChart as PieIcon, X, Calendar, HelpCircle, Loader2, ChevronRight, LayoutDashboard, Settings2, Building2, Wallet, CalendarDays, Percent, Info, PartyPopper, Check, ArrowRight, Search, Sparkles } from 'lucide-react';

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
    selectedOfferId?: string; // ID явно выбранного оффера
}

// Функция для парсинга цены из строки (убирает пробелы и преобразует в число)
const parsePrice = (priceString?: string): number => {
    if (!priceString) return 5000000; // Значение по умолчанию
    // Убираем все пробелы и преобразуем в число
    const cleaned = priceString.replace(/\s+/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 5000000 : parsed;
};

export interface DetailedOffer {
    id: string;
    rate: string;
    rateNum: number;
    comment: string;
    bankName: string;
    bankOfferName?: string;
    price?: number;
    offerprice?: number;
    relativePriceChange?: number;
    frommonths?: number;
    tomonths?: number;
    subsidy: boolean;
    offerUid?: string;
    offerName?: string;
    offertermUid?: string;
    offertermName?: string;
    program: 'base' | 'family';
    minDownPayment?: number;
    exactDownPayment?: number;
}

const formatOfferTerm = (frommonths?: number, tomonths?: number): string => {
    if (frommonths !== undefined && tomonths !== undefined) {
        if (frommonths === tomonths) {
            return `${frommonths / 12} лет (${frommonths} мес.)`;
        }
        return `от ${Math.round(frommonths / 12)} до ${Math.round(tomonths / 12)} лет (${frommonths}–${tomonths} мес.)`;
    }
    if (tomonths !== undefined) {
        return `до ${Math.round(tomonths / 12)} лет (до ${tomonths} мес.)`;
    }
    if (frommonths !== undefined) {
        return `от ${Math.round(frommonths / 12)} лет (от ${frommonths} мес.)`;
    }
    return 'до 30 лет';
};

const formatOfferDownPayment = (offer: DetailedOffer): string => {
    if (offer.exactDownPayment !== undefined) {
        return `ПВ ${offer.exactDownPayment}%`;
    }
    if (offer.minDownPayment !== undefined) {
        return `ПВ от ${offer.minDownPayment}%`;
    }
    return 'ПВ от 20.1%';
};

type OfferTermRule = {
    program?: 'base' | 'family';
    exactDownPayment?: number;
    minDownPayment?: number;
    subsidy?: boolean;
};

const OFFER_TERM_RULES: Record<string, OfferTermRule> = {
    // Базовая ставка (ПВЗ без субсидии)
    "76a26a63-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'base', exactDownPayment: 0, subsidy: false },
    // Базовая ставка (ПВЗ с субсидией)
    "9c14a052-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'base', exactDownPayment: 0, subsidy: true },
    // Базовая ставка (Свой ПВ без субсидии)
    "69b35f2a-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'base', minDownPayment: 20.1, subsidy: false },
    // Базовая ставка (Свой ПВ с субсидией)
    "82d0cbec-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'base', minDownPayment: 20.1, subsidy: true },
    // Базовая ставка (ЧПВЗ без субсидии)
    "6fdd2010-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'base', exactDownPayment: 10.5, subsidy: false },
    // Базовая ставка (ЧПВЗ с субсидией)
    "8ee78bf8-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'base', exactDownPayment: 10.5, subsidy: true },

    // Полная оплата - минимальная цена
    "3850ff27-4ea9-11f1-8278-ac1f6bd9ba5d": { exactDownPayment: 100 },

    // Семейная ипотека (ПВЗ без субсидии)
    "d687b5df-4eaf-11f1-8278-ac1f6bd9ba5d": { program: 'family', exactDownPayment: 0, subsidy: false },
    // Семейная ипотека (ПВЗ с субсидией)
    "3d04aeba-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'family', exactDownPayment: 0, subsidy: true },
    // Семейная ипотека (Свой ПВ без субсидии)
    "d080f77c-4eaf-11f1-8278-ac1f6bd9ba5d": { program: 'family', minDownPayment: 20.1, subsidy: false },
    // Семейная ипотека (Свой ПВ с субсидией)
    "25c30229-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'family', minDownPayment: 20.1, subsidy: true },
    // Семейная ипотека (ЧПВЗ без субсидии)
    "d687b5cc-4eaf-11f1-8278-ac1f6bd9ba5d": { program: 'family', exactDownPayment: 10.5, subsidy: false },
    // Семейная ипотека (ЧПВЗ с субсидией)
    "2d8fbede-4eb0-11f1-8278-ac1f6bd9ba5d": { program: 'family', exactDownPayment: 10.5, subsidy: true },
};

const formatPeriod = (years: number) => {
    const totalMonths = Math.round(years * 12);
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    let res = `(${totalMonths} мес) `;
    if (y > 0) res += `${y} г. `;
    if (m > 0) res += `${m} мес.`;
    return res.trim();
};

const formatYearsAndMonths = (years: number) => {
    const totalMonths = Math.round(years * 12);
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    let res = "";
    if (y > 0) res += `${y} г. `;
    if (m > 0) res += `${m} мес.`;
    return res.trim();
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

    // Очистка предыдущих расчетов при открытии калькулятора
    useEffect(() => {
        localStorage.removeItem(storageKey);
    }, [storageKey]);

    // При открытии всегда начинаем с чистого состояния — предыдущие расчеты не загружаем
    const savedData = null;

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
                interestRate: 0,
                years: 20,
                startDate: new Date().toISOString().split('T')[0]
            },
            mortgageType: 'base',
            hasSubsidy: false,
            rateInputValue: ''
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
                interestRate: 0,
                years: 20,
                startDate: new Date().toISOString().split('T')[0]
            },
            mortgageType: 'base',
            hasSubsidy: false,
            rateInputValue: ''
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

    // Обновление типа ипотеки с проверкой лимитов и сбросом значений до умолчания
    const handleMortgageTypeChange = (type: 'base' | 'family') => {
        updateActiveCalc(c => {
            let defaultDownPayment = Math.round(c.input.propertyValue * 0.201);

            return {
                ...c,
                mortgageType: type,
                hasSubsidy: false,
                rateInputValue: '',
                input: {
                    ...c.input,
                    downPayment: defaultDownPayment,
                    years: 20,
                    interestRate: 0
                }
            };
        });
    };

    // Обновление стоимости недвижимости с проверкой лимитов
    const handlePropertyValueChange = (val: number) => {
        let newDownPayment = input.downPayment;

        // Проверяем, чтобы ПВ не был больше стоимости (стандартная логика)
        if (newDownPayment > val) {
            newDownPayment = val;
        }

        setInput({ ...input, propertyValue: val, downPayment: newDownPayment });
    };

    // Обновление первоначального взноса с проверкой лимитов
    const handleDownPaymentChange = (val: number) => {
        let newDownPayment = val;

        if (mortgageType === 'family' && effectivePrice > 0) {
            const minDown = Math.max(0, effectivePrice - 6000000);
            const requiredInputDownPayment = Math.ceil(minDown * (input.propertyValue / effectivePrice));
            if (newDownPayment < requiredInputDownPayment) {
                newDownPayment = requiredInputDownPayment;
            }
        }

        setInput({ ...input, downPayment: newDownPayment });
    };



    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Object);
    const [mobileTab, setMobileTab] = useState<'inputs' | 'results'>('inputs'); // Состояние для мобильных вкладок
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isRateInfoOpen, setIsRateInfoOpen] = useState(false);
    const [rateModalTab, setRateModalTab] = useState<'matching' | 'all'>('matching');
    const [rateModalProgramFilter, setRateModalProgramFilter] = useState<'all' | 'base' | 'family'>('all');
    const [rateModalSearch, setRateModalSearch] = useState('');
    const [tooltipHeight, setTooltipHeight] = useState(520); // Высота тултипа для позиционирования
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

    const availableDownPayments = useMemo(() => {
        let has0 = false;
        let has10_5 = false;
        
        if (propertyInfoToUse?.extraData && Array.isArray(propertyInfoToUse.extraData)) {
            propertyInfoToUse.extraData.forEach((group: any) => {
                if (group.items && Array.isArray(group.items)) {
                    group.items.forEach((item: any) => {
                        if (item.offerterms && Array.isArray(item.offerterms)) {
                            item.offerterms.forEach((term: any) => {
                                const rule = OFFER_TERM_RULES[term.uid];
                                if (rule && rule.program === mortgageType) {
                                    if (rule.exactDownPayment === 0) has0 = true;
                                    if (rule.exactDownPayment === 10.5) has10_5 = true;
                                }
                            });
                        }
                    });
                }
            });
        }
        return { has0, has10_5 };
    }, [propertyInfoToUse?.extraData, mortgageType]);

    // Расчет процента первоначального взноса
    const downPaymentPercentage = useMemo(() => {
        if (input.propertyValue === 0) return 0;
        return (input.downPayment / input.propertyValue) * 100;
    }, [input.downPayment, input.propertyValue]);

    // Полный реестр всех предложений по объекту (без фильтрации по полям калькулятора)
    const allRawOffers = useMemo<DetailedOffer[]>(() => {
        const list: DetailedOffer[] = [];
        if (!propertyInfoToUse?.extraData || !Array.isArray(propertyInfoToUse.extraData)) {
            return list;
        }

        propertyInfoToUse.extraData.forEach((group: any) => {
            if (!group.items || !Array.isArray(group.items)) return;

            group.items.forEach((item: any) => {
                const processOffer = (rateObj?: any) => {
                    const rawRate = rateObj?.rate;
                    const rateNum = typeof rawRate === 'number'
                        ? rawRate
                        : (rawRate ? parseFloat(String(rawRate).replace(',', '.')) : 0);

                    const baseOffer = {
                        rate: rateObj ? `${rateObj.rate}%` : '0%',
                        rateNum,
                        comment: rateObj?.comment || '',
                        bankName: item.bank?.name || '',
                        bankOfferName: item.bankoffer?.name || '',
                        price: item.price,
                        offerprice: item.offerprice,
                        relativePriceChange: item.relatevepricechange ?? item.relativePriceChange,
                        frommonths: rateObj?.frommonths,
                        tomonths: rateObj?.tomonths,
                        subsidy: item.subsidy === true,
                    };

                    const handleTerm = (term?: any) => {
                        let program: 'base' | 'family' = 'base';
                        let minDownPayment: number | undefined = undefined;
                        let exactDownPayment: number | undefined = undefined;

                        const isFamilyProgram = (text?: string) => {
                            if (!text) return false;
                            return /(?:^|[\s\(\),.-])(семейн\w*|си)(?:[\s\(\),.-]|$)/i.test(text);
                        };

                        if (term?.uid && OFFER_TERM_RULES[term.uid]) {
                            const rule = OFFER_TERM_RULES[term.uid];
                            if (rule.program) program = rule.program;
                            minDownPayment = rule.minDownPayment;
                            exactDownPayment = rule.exactDownPayment;
                        } else if (
                            isFamilyProgram(term?.name) ||
                            isFamilyProgram(item.offer?.name) ||
                            isFamilyProgram(item.bankoffer?.name)
                        ) {
                            program = 'family';
                            minDownPayment = 20.1;
                        }

                        const uniqueId = `${item.offer?.uid || 'off'}_${term?.uid || 't'}_${rateNum}_${rateObj?.frommonths || 0}_${rateObj?.tomonths || 0}_${list.length}`;

                        list.push({
                            ...baseOffer,
                            id: uniqueId,
                            offerUid: item.offer?.uid,
                            offerName: item.offer?.name,
                            offertermUid: term?.uid,
                            offertermName: term?.name || item.offer?.name,
                            program,
                            minDownPayment,
                            exactDownPayment
                        });
                    };

                    if (item.offerterms && Array.isArray(item.offerterms) && item.offerterms.length > 0) {
                        item.offerterms.forEach((term: any) => handleTerm(term));
                    } else {
                        handleTerm(undefined);
                    }
                };

                if (item.rates && Array.isArray(item.rates) && item.rates.length > 0) {
                    item.rates.forEach((rateObj: any) => processOffer(rateObj));
                } else {
                    processOffer();
                }
            });
        });

        return list.sort((a, b) => a.rateNum - b.rateNum);
    }, [propertyInfoToUse?.extraData]);

    // Предложения, подходящие под текущие фильтры калькулятора
    const apiOffers = useMemo<DetailedOffer[]>(() => {
        if (!propertyInfoToUse?.extraData || allRawOffers.length === 0) {
            return [
                {
                    id: 'default_standard',
                    rate: '12.5%',
                    rateNum: 12.5,
                    comment: 'Стандартная ставка без дополнительных условий',
                    bankName: '',
                    subsidy: false,
                    program: 'base'
                }
            ];
        }

        const currentMonths = input.years * 12;
        const currentDownpayment = input.propertyValue > 0 ? (input.downPayment / input.propertyValue) * 100 : 0;

        const filtered = allRawOffers.filter(o => {
            const fromMonthsMatch = typeof o.frommonths === 'number' ? currentMonths >= o.frommonths : true;
            const toMonthsMatch = typeof o.tomonths === 'number' ? currentMonths <= o.tomonths : true;
            if (!fromMonthsMatch || !toMonthsMatch) return false;

            if (o.offertermUid && OFFER_TERM_RULES[o.offertermUid]) {
                const rule = OFFER_TERM_RULES[o.offertermUid];

                if (Math.abs(currentDownpayment - 100) <= 0.1) {
                    return rule.exactDownPayment === 100;
                }

                if (rule.program && rule.program !== mortgageType) return false;

                const offerSubsidy = typeof o.subsidy === 'boolean' ? o.subsidy : rule.subsidy;
                if (offerSubsidy !== undefined) {
                    const matchesCheckbox = hasSubsidy ? offerSubsidy === true : offerSubsidy === false;
                    if (!matchesCheckbox) return false;
                }

                if (rule.exactDownPayment !== undefined) {
                    if (Math.abs(currentDownpayment - rule.exactDownPayment) > 0.1) return false;
                }
                if (rule.minDownPayment !== undefined) {
                    if (currentDownpayment < rule.minDownPayment - 0.1) return false;
                }

                return true;
            }

            if (Math.abs(currentDownpayment - 100) <= 0.1) {
                return false;
            }

            if (o.program && o.program !== mortgageType) return false;

            const subsidyMatch = hasSubsidy ? o.subsidy === true : !o.subsidy;
            return subsidyMatch;
        });

        return filtered.sort((a, b) => b.rateNum - a.rateNum);
    }, [allRawOffers, propertyInfoToUse?.extraData, hasSubsidy, input.years, mortgageType, input.downPayment, input.propertyValue]);

    // Отфильтрованные предложения для вкладки "Все условия" (фильтр по программе и поисковой строке)
    const allOffersFiltered = useMemo<DetailedOffer[]>(() => {
        return allRawOffers.filter(offer => {
            if (rateModalProgramFilter !== 'all' && offer.program !== rateModalProgramFilter) {
                return false;
            }
            if (rateModalSearch.trim()) {
                const query = rateModalSearch.toLowerCase();
                const matchBank = (offer.bankName || '').toLowerCase().includes(query);
                const matchComment = (offer.comment || '').toLowerCase().includes(query);
                const matchTerm = (offer.offertermName || '').toLowerCase().includes(query);
                const matchOffer = (offer.bankOfferName || '').toLowerCase().includes(query);
                const matchRate = offer.rate.toLowerCase().includes(query);
                if (!matchBank && !matchComment && !matchTerm && !matchOffer && !matchRate) {
                    return false;
                }
            }
            return true;
        });
    }, [allRawOffers, rateModalProgramFilter, rateModalSearch]);

    // Находим измененную цену из текущих предложений (с минимальной ценой, если их несколько)
    const minOfferPrice = useMemo(() => {
        if (!apiOffers || apiOffers.length === 0) return undefined;
        let selectedPrice: number | undefined = undefined;
        for (const offer of apiOffers) {
            if (offer.offerprice !== undefined) {
                if (selectedPrice === undefined || offer.offerprice < selectedPrice) {
                    selectedPrice = offer.offerprice;
                }
            }
        }
        return selectedPrice;
    }, [apiOffers]);

    // Применение выбранного оффера в 1 клик
    const handleApplyOffer = (offer: DetailedOffer) => {
        const targetProgram = offer.program || 'base';
        const targetSubsidy = offer.subsidy === true;

        // Корректировка срока
        let targetYears = input.years;
        const currentMonths = Math.round(input.years * 12);
        if (typeof offer.tomonths === 'number' && currentMonths > offer.tomonths) {
            targetYears = offer.tomonths / 12;
        } else if (typeof offer.frommonths === 'number' && currentMonths < offer.frommonths) {
            targetYears = offer.frommonths / 12;
        }

        // Корректировка первоначального взноса
        const currentDownPaymentPercent = input.propertyValue > 0
            ? (input.downPayment / input.propertyValue) * 100
            : 20.1;
        let targetDownPaymentPercent = currentDownPaymentPercent;
        if (offer.exactDownPayment !== undefined) {
            targetDownPaymentPercent = offer.exactDownPayment;
        } else if (offer.minDownPayment !== undefined && targetDownPaymentPercent < offer.minDownPayment) {
            targetDownPaymentPercent = offer.minDownPayment;
        }

        const basePrice = offer.price || input.propertyValue;
        const targetDownPayment = Math.round(basePrice * (targetDownPaymentPercent / 100));
        const targetRate = offer.rateNum;

        updateActiveCalc(c => ({
            ...c,
            mortgageType: targetProgram,
            hasSubsidy: targetSubsidy,
            rateInputValue: targetRate > 0 ? String(targetRate) : '',
            selectedOfferId: offer.id,
            input: {
                ...c.input,
                propertyValue: basePrice,
                interestRate: targetRate,
                years: targetYears,
                downPayment: targetDownPayment
            }
        }));

        setIsRateInfoOpen(false);
    };

    // Оффер, который в данный момент выбран / активен
    const activeOffer = useMemo(() => {
        // 1. Если был явно выбран оффер через окно "Узнать"
        if (activeCalc.selectedOfferId) {
            const found = allRawOffers.find(o => o.id === activeCalc.selectedOfferId);
            if (found && Math.abs(found.rateNum - input.interestRate) < 0.01 && found.subsidy === hasSubsidy) {
                return found;
            }
        }
        // 2. Иначе ищем первое совпадение среди подходящих по ставке, программе и субсидии
        if (input.interestRate > 0) {
            const found = apiOffers.find(o =>
                Math.abs(o.rateNum - input.interestRate) < 0.01 &&
                (o.program ? o.program === mortgageType : true) &&
                o.subsidy === hasSubsidy
            );
            if (found) return found;
        }
        return undefined;
    }, [activeCalc.selectedOfferId, allRawOffers, apiOffers, input.interestRate, mortgageType, hasSubsidy]);

    // Итоговая цена оффера:
    // Если есть конкретный выбранный/активный оффер с ценой offerprice — берем строго её!
    // Иначе берем минимальную цену из подходящих офферов (minOfferPrice)
    const currentOfferPrice = useMemo(() => {
        if (activeOffer && activeOffer.offerprice !== undefined) {
            return activeOffer.offerprice;
        }
        return minOfferPrice;
    }, [activeOffer, minOfferPrice]);

    const effectivePrice = useMemo(() => {
        return (currentOfferPrice !== undefined && currentOfferPrice !== input.propertyValue)
            ? currentOfferPrice
            : input.propertyValue;
    }, [currentOfferPrice, input.propertyValue]);

    const [priceAlert, setPriceAlert] = useState(false);
    const prevPriceRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (prevPriceRef.current !== undefined && prevPriceRef.current !== effectivePrice) {
            setPriceAlert(true);
            const timer = setTimeout(() => setPriceAlert(false), 2500);
            prevPriceRef.current = effectivePrice;
            return () => clearTimeout(timer);
        }
        prevPriceRef.current = effectivePrice;
    }, [effectivePrice]);

    // Эффективный первоначальный взнос с учётом скидки на квартиру
    const effectiveDownPayment = useMemo(() => {
        return (effectivePrice * downPaymentPercentage) / 100;
    }, [effectivePrice, downPaymentPercentage]);

    useEffect(() => {
        if (mortgageType === 'family' && effectivePrice > 0) {
            const minDown = Math.max(0, effectivePrice - 6000000);
            if (effectiveDownPayment < minDown) {
                const requiredInputDownPayment = Math.ceil(minDown * (input.propertyValue / effectivePrice));
                if (input.downPayment < requiredInputDownPayment) {
                    setInput(prev => ({ ...prev, downPayment: requiredInputDownPayment }));
                }
            }
        }
    }, [mortgageType, effectivePrice, input.propertyValue, input.downPayment, effectiveDownPayment]);

    const result = useMemo(() => {
        return calculateMortgage({
            ...input,
            propertyValue: effectivePrice,
            downPayment: effectiveDownPayment
        });
    }, [input, effectivePrice, effectiveDownPayment]);

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

    const renderOfferCard = (item: DetailedOffer, isCatalogMode: boolean = false) => {
        const isActive = activeCalc.selectedOfferId
            ? item.id === activeCalc.selectedOfferId
            : (
                Math.abs(item.rateNum - input.interestRate) < 0.01 &&
                (item.program ? item.program === mortgageType : true) &&
                item.subsidy === hasSubsidy
            );

        return (
            <div
                key={item.id}
                onClick={() => handleApplyOffer(item)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                className={`p-3.5 rounded-2xl border transition-all !cursor-pointer select-none [&_*]:!cursor-pointer rate-modal-interactive group relative ${
                    isActive
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400 shadow-sm'
                        : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-md hover:bg-slate-50/50'
                }`}
            >
                {/* Верхняя строка: Банк и Бейджи */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex flex-col min-w-0 pr-1">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1">
                            {item.bankName || 'Банк'}
                        </span>
                        {item.bankOfferName && item.bankOfferName !== item.bankName && (
                            <span className="text-[11px] text-slate-500 line-clamp-1">
                                {item.bankOfferName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            item.program === 'family'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                            {item.program === 'family' ? 'Семейная' : 'Базовая'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            item.subsidy
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                            {item.subsidy ? 'С субсидией' : 'Без субсидии'}
                        </span>
                    </div>
                </div>

                {/* Средняя строка: Ставка и Расчетная цена квартиры */}
                <div className="flex items-baseline justify-between gap-2 my-1.5">
                    <div className="flex items-baseline gap-1.5">
                        <span className={`text-xl font-extrabold ${isActive ? 'text-emerald-700' : 'text-slate-900 group-hover:text-emerald-700'}`}>
                            {item.rate}
                        </span>
                        {isActive && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                <Check size={10} /> Активен
                            </span>
                        )}
                    </div>
                    {(item.offerprice !== undefined || item.price !== undefined) && (
                        <div className="flex items-center gap-1.5 text-right">
                            <span className="text-xs font-bold text-slate-800">
                                {formatCurrency(item.offerprice ?? item.price ?? 0, true)}
                            </span>
                            {typeof item.relativePriceChange === 'number' && item.relativePriceChange !== 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    item.relativePriceChange > 0
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                    {item.relativePriceChange > 0 ? `+${item.relativePriceChange}%` : `${item.relativePriceChange}%`}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Условия: Срок и ПВ */}
                <div className="flex flex-wrap items-center gap-1.5 my-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Calendar size={12} className="text-slate-400" />
                        {formatOfferTerm(item.frommonths, item.tomonths)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Wallet size={12} className="text-slate-400" />
                        {formatOfferDownPayment(item)}
                    </span>
                </div>

                {/* Комментарий / условия по детям / категориям */}
                {item.comment && (
                    <p className="text-[11px] text-slate-500 leading-snug my-1 line-clamp-2">
                        {item.comment}
                    </p>
                )}

                {/* Кнопка действия / подсказка о применении в 1 клик */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                        {isActive ? 'Условия уже применены' : (isCatalogMode ? 'Применить оффер' : 'Выбрать предложение')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:text-emerald-800 group-hover:underline">
                        {isActive ? 'Выбрано' : 'В 1 клик'}
                        {!isActive && <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />}
                    </span>
                </div>

                {showDebug && (
                    <div className="mt-1.5 p-2 bg-slate-800 text-emerald-400 text-[10px] rounded leading-tight font-mono break-all">
                        price: {item.price}<br />
                        offerprice: {item.offerprice}<br />
                        frommonths: {item.frommonths}<br />
                        tomonths: {item.tomonths}<br />
                        subsidy: {item.subsidy ? 'true' : 'false'}<br />
                        offerUid: {item.offerUid || '—'}<br />
                        termUid: {item.offertermUid || '— (в offerterms пусто)'}<br />
                        name: {item.offertermName || item.offerName}
                    </div>
                )}
            </div>
        );
    };

    const renderRateModalContent = () => (
        <>
            <style>{`
                .rate-modal-interactive,
                .rate-modal-interactive *,
                .rate-modal-interactive button,
                .rate-modal-interactive span,
                .rate-modal-interactive p,
                .rate-modal-interactive svg {
                    cursor: pointer !important;
                    user-select: none !important;
                    -webkit-user-select: none !important;
                }
            `}</style>
            {/* Вкладочная навигация */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center p-1 bg-slate-100/90 rounded-xl gap-1 rate-modal-interactive" style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <button
                        type="button"
                        onClick={() => setRateModalTab('matching')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all !cursor-pointer select-none [&_*]:!cursor-pointer ${
                            rateModalTab === 'matching'
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span style={{ cursor: 'pointer', userSelect: 'none' }} className="!cursor-pointer select-none">Подходящие</span>
                        <span style={{ cursor: 'pointer', userSelect: 'none' }} className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold !cursor-pointer select-none ${
                            rateModalTab === 'matching' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                            {apiOffers.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setRateModalTab('all')}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all !cursor-pointer select-none [&_*]:!cursor-pointer ${
                            rateModalTab === 'all'
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Sparkles size={13} style={{ cursor: 'pointer' }} className={`!cursor-pointer select-none ${rateModalTab === 'all' ? 'text-amber-500' : 'text-slate-400'}`} />
                        <span style={{ cursor: 'pointer', userSelect: 'none' }} className="!cursor-pointer select-none">Все условия</span>
                        <span style={{ cursor: 'pointer', userSelect: 'none' }} className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold !cursor-pointer select-none ${
                            rateModalTab === 'all' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                            {allRawOffers.length}
                        </span>
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => setIsRateInfoOpen(false)}
                    style={{ cursor: 'pointer' }}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors !cursor-pointer select-none [&_*]:!cursor-pointer"
                    title="Закрыть"
                >
                    <X size={18} style={{ cursor: 'pointer' }} />
                </button>
            </div>

            {/* Тулбар фильтров и поиска (только для вкладки "Все условия") */}
            {rateModalTab === 'all' && (
                <div className="mb-3 space-y-2 shrink-0">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs rate-modal-interactive">
                        <button
                            type="button"
                            onClick={() => setRateModalProgramFilter('all')}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap !cursor-pointer select-none [&_*]:!cursor-pointer ${
                                rateModalProgramFilter === 'all'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Все ({allRawOffers.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRateModalProgramFilter('base')}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap !cursor-pointer select-none [&_*]:!cursor-pointer ${
                                rateModalProgramFilter === 'base'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                        >
                            Базовая ({allRawOffers.filter(o => o.program === 'base').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRateModalProgramFilter('family')}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap !cursor-pointer select-none [&_*]:!cursor-pointer ${
                                rateModalProgramFilter === 'family'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                            }`}
                        >
                            Семейная ({allRawOffers.filter(o => o.program === 'family').length})
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={rateModalSearch}
                            onChange={(e) => setRateModalSearch(e.target.value)}
                            placeholder="Поиск по банку или условиям..."
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        />
                        {rateModalSearch && (
                            <button
                                type="button"
                                onClick={() => setRateModalSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Список карточек */}
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 overscroll-contain">
                {rateModalTab === 'matching' ? (
                    apiOffers.length > 0 ? (
                        apiOffers.map(item => renderOfferCard(item, false))
                    ) : (
                        <div className="py-8 text-center px-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                                <Info size={22} />
                            </div>
                            <h5 className="text-sm font-bold text-slate-800 mb-1">Нет точных совпадений</h5>
                            <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto leading-relaxed">
                                Под текущие параметры (срок, взнос, субсидия) не найдено предложений. Посмотрите полный каталог всех программ банков.
                            </p>
                            <button
                                type="button"
                                onClick={() => setRateModalTab('all')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-200 transition-all cursor-pointer"
                            >
                                <Sparkles size={14} />
                                Все условия ({allRawOffers.length})
                            </button>
                        </div>
                    )
                ) : (
                    allOffersFiltered.length > 0 ? (
                        allOffersFiltered.map(item => renderOfferCard(item, true))
                    ) : (
                        <div className="py-8 text-center px-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                <Search size={22} />
                            </div>
                            <h5 className="text-sm font-bold text-slate-800 mb-1">Ничего не найдено</h5>
                            <p className="text-xs text-slate-500 mb-3 max-w-xs mx-auto">
                                Попробуйте изменить поисковый запрос или фильтр по программе.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setRateModalSearch('');
                                    setRateModalProgramFilter('all');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer"
                            >
                                Сбросить фильтры
                            </button>
                        </div>
                    )
                )}
            </div>
        </>
    );

    return (
        <div className="bg-white w-full h-full max-h-[100dvh] flex flex-col lg:flex-row overflow-hidden lg:rounded-2xl shadow-2xl relative">

            {/* Тост с уведомлением об изменении цены */}
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg z-50 transition-all duration-500 ease-out flex items-center gap-2 ${priceAlert ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
                }`}>
                <Info size={18} className="text-emerald-100" />
                Стоимость изменилась
            </div>

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
            {/* На мобильных (< lg) при mobileTab === 'inputs' занимает всю оставшуюся высоту (flex-1 min-h-0) и скроллится.
                На десктопе (lg) фиксированная ширина 400px, высота во весь экран (lg:h-full) и свой скролл. */}
            <div className={`w-full bg-slate-50 p-4 lg:p-6 border-r border-slate-200 overflow-y-auto overscroll-contain pb-16 lg:pb-6 ${
                mobileTab === 'inputs' 
                    ? 'flex-1 min-h-0 block' 
                    : 'hidden lg:block'
            } lg:flex-none lg:w-[400px] lg:h-full lg:shrink-0`}>
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
                                {/* Индикатор изменения стоимости — показываем при наличии измененной цены */}
                                {currentOfferPrice !== undefined && currentOfferPrice !== input.propertyValue && (
                                    <span className="relative group/discount inline-flex">
                                        <span className={`flex items-center justify-center w-5 h-5 rounded-full cursor-help transition-colors ${currentOfferPrice < input.propertyValue
                                            ? 'bg-emerald-100 text-emerald-600 group-hover/discount:bg-emerald-200'
                                            : 'bg-amber-100 text-amber-700 group-hover/discount:bg-amber-200'
                                            }`}>
                                            <Percent size={11} strokeWidth={2.5} />
                                        </span>
                                        {/* Тултип при наведении */}
                                        <span className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bottom-full mb-2 w-64 max-w-[280px] p-2.5 bg-slate-800 text-white text-[11px] font-normal leading-snug rounded-xl shadow-xl opacity-0 pointer-events-none group-hover/discount:opacity-100 transition-opacity duration-200 z-50 text-center sm:text-left">
                                            {currentOfferPrice < input.propertyValue
                                                ? 'Стоимость снижена согласно выбранным условиям'
                                                : 'Стоимость увеличена согласно выбранным условиям (субсидия)'}
                                            <span className="absolute left-1/2 -translate-x-1/2 sm:left-2.5 sm:translate-x-0 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-800"></span>
                                        </span>
                                    </span>
                                )}
                            </span>
                        }
                        value={input.propertyValue}
                        discountedValue={currentOfferPrice}
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
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Есть субсидия</span>
                            <span className="text-[11px] text-slate-400 font-medium mt-0.5 leading-tight">Позаботились и снизили ставку для вас</span>
                        </div>
                    </label>

                    {/* Первоначальный взнос — слайдер */}
                    <div className="mb-2">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2 mt-1">
                                <Wallet size={16} className="text-slate-400" />
                                Первоначальный взнос
                            </span>
                            <div className="text-right">
                                <div className="text-lg font-bold text-slate-900 leading-none mb-1">{formatCurrency(effectiveDownPayment)}</div>
                                <div className="text-sm text-slate-500 font-medium leading-none">{downPaymentPercentage.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</div>
                            </div>
                        </div>
                        <div className="relative pb-8 pt-6 select-none group">
                            <div className="relative">
                                <div className="absolute inset-0 left-[8px] right-[8px] pointer-events-none z-20">
                                    {/* Метка 10.5% сверху */}
                                    {availableDownPayments.has10_5 && (
                                        <>
                                            <div className="absolute bottom-full mb-1 flex flex-col items-center" style={{ left: '10.5%', transform: 'translateX(-50%)' }}>
                                                <span className={`transition-all ${Math.abs(downPaymentPercentage - 10.5) < 0.5 ? 'text-emerald-600 font-bold text-[12px]' : 'text-slate-500 text-[11px]'}`}>10.5%</span>
                                                <div className="w-px h-2 rounded-full bg-slate-200 mt-0.5"></div>
                                            </div>
                                            {/* Точка 10.5% */}
                                            <div
                                                className={`absolute top-1/2 -mt-[3px] w-1.5 h-1.5 rounded-full transition-colors duration-300 shadow-sm ${downPaymentPercentage >= 10.5 ? 'bg-white' : 'bg-slate-400'}`}
                                                style={{ left: '10.5%', transform: 'translateX(-50%)' }}
                                            ></div>
                                        </>
                                    )}

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
                                        if (v < 20.1 && (availableDownPayments.has0 ? v !== 0 : true)) {
                                            const marks = [20.1];
                                            if (availableDownPayments.has10_5) marks.push(10.5);
                                            if (availableDownPayments.has0) marks.push(0);
                                            
                                            v = marks.reduce((prev, curr) => Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev);
                                        }
                                        const newDownPayment = Math.round(input.propertyValue * (v / 100));
                                        handleDownPaymentChange(newDownPayment);
                                    }}
                                    className="w-full h-2 bg-slate-200 hover:bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-600 flex relative z-10 transition-colors focus:outline-none"
                                />
                            </div>

                            {/* Крайние метки 0% и 100% */}
                            <div className="absolute left-0 right-0 top-6 text-[10px] font-medium pointer-events-none">
                                {availableDownPayments.has0 && (
                                    <span className={`absolute left-0 top-[10px] transition-all ${downPaymentPercentage === 0 ? 'text-emerald-600 font-bold text-[12px]' : 'text-slate-400 text-[11px]'}`}>0%</span>
                                )}
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
                            <span className="text-lg font-bold text-slate-900">{formatPeriod(input.years)}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="360"
                            step="1"
                            value={Math.round(input.years * 12)}
                            onChange={(e) => setInput({ ...input, years: parseInt(e.target.value) / 12 })}
                            className="w-full h-2 bg-slate-200 hover:bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-colors focus:outline-none"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-0">
                            <span>1 мес.</span>
                            <span>360 мес.</span>
                        </div>
                        {/* Кнопки быстрого выбора срока */}
                        <div className="flex gap-2 mt-3">
                            {[10, 15, 20, 25, 30].map((years) => (
                                <button
                                    key={years}
                                    onClick={() => setInput({ ...input, years })}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${Math.round(input.years * 12) === years * 12
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
                                        if (raw === '') {
                                            setInput(prev => ({ ...prev, interestRate: 0 }));
                                        } else {
                                            const val = parseFloat(raw.replace(',', '.'));
                                            if (!isNaN(val) && val >= 0 && val <= 50) {
                                                setInput(prev => ({ ...prev, interestRate: val }));
                                            }
                                        }
                                    }}
                                    onBlur={() => {
                                        // При потере фокуса форматируем обратно
                                        setRateInputValue(input.interestRate === 0 ? '' : String(input.interestRate));
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
                                                className="absolute w-[480px] max-w-[90vw] transition-all duration-200 rate-tooltip-container"
                                                style={{
                                                    left: rect.right + 16,
                                                    top: tooltipTop,
                                                }}
                                            >
                                                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 relative flex flex-col overscroll-contain" style={{ maxHeight: 'calc(100vh - 40px)' }}>
                                                    {/* Стрелка влево — привязана к позиции кнопки */}
                                                    <div className="absolute right-full -translate-y-1/2" style={{ top: arrowTop }}>
                                                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-white drop-shadow-sm"></div>
                                                    </div>
                                                    {renderRateModalContent()}
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
                            <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8 shadow-2xl animate-fade-in-up z-10 max-h-[85vh] flex flex-col">
                                {/* Индикатор свайпа */}
                                <div className="flex justify-center mb-3 shrink-0">
                                    <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
                                </div>
                                {renderRateModalContent()}
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

                {/* Кнопка PDF - Видима на планшете/десктопе для доступности во вкладке ввода. Скрыта при 100% и при 0% первоначальном взносе */}
                {downPaymentPercentage > 0 && Math.abs(downPaymentPercentage - 100) > 0.1 && input.interestRate > 0 && (
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
                )}
            </div>

            {/* Правая панель: Результаты */}
            {/* 
        Стратегия верстки:
        - Мобильные/Планшеты (< lg): Вкладки. Родитель обрабатывает скролл страницы (overflow-y-auto).
        - Десктоп (>= lg): Разделенный вид. Родитель имеет фиксированную высоту (overflow-hidden), внутренние контейнеры скроллятся.
      */}
            <div className={`flex-1 min-h-0 bg-white relative min-w-0 
        ${mobileTab === 'results' ? 'flex flex-col overflow-y-auto overscroll-contain pb-16 lg:pb-0' : 'hidden lg:flex lg:flex-col'}
        lg:h-full md:overflow-hidden
      `}>
                {/* Кнопка закрытия только для десктопа */}
                <button
                    onClick={() => setIsConfirmCloseOpen(true)}
                    className="hidden lg:block absolute top-4 right-4 z-20 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={24} />
                </button>

                {Math.abs(downPaymentPercentage - 100) <= 0.1 ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 md:p-12 text-center animate-in fade-in zoom-in duration-500 bg-slate-50/30">
                        <div className="w-32 h-32 mb-8 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner relative overflow-hidden">
                            <div className="absolute inset-0 bg-emerald-500/20 animate-pulse"></div>
                            <PartyPopper size={64} className="text-emerald-600 relative z-10 animate-bounce" />
                        </div>
                        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 tracking-tight uppercase">
                            Полная оплата
                        </h2>
                        <div className="text-emerald-600 font-bold text-5xl md:text-6xl mb-6 drop-shadow-md">
                            {formatCurrency(effectivePrice)}
                        </div>
                        <p className="text-slate-500 max-w-md text-base md:text-lg font-medium leading-relaxed">
                            Вы выбрали 100% первоначальный взнос. Ипотека не требуется, вы приобретаете недвижимость за полную стоимость.
                        </p>

                    </div>
                ) : (
                    <>
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

                            <div className="relative">
                                <div className={input.interestRate === 0 ? "blur-md pointer-events-none select-none transition-all duration-300 opacity-60" : "transition-all duration-300"}>
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
                                            <div className="font-semibold text-slate-700 text-sm md:text-base">{termMonths} мес. <span className="text-slate-400 font-normal">({formatYearsAndMonths(input.years)})</span></div>
                                        </div>

                                        {/* Дата первого платежа */}
                                        <div className="p-2 md:p-0">
                                            <div className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Дата 1-го платежа</div>
                                            <div className="font-semibold text-slate-700 text-sm md:text-base">{firstPaymentDate ? formatDate(firstPaymentDate) : '-'}</div>
                                        </div>
                                    </div>
                                </div>

                                {input.interestRate === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <div className="bg-white/90 backdrop-blur-[2px] px-6 py-4 rounded-2xl shadow-xl border border-slate-100 text-center mx-4">
                                            <p className="text-slate-800 font-bold text-base md:text-lg">Для просмотра результатов расчета — выберете/укажите % ставку</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Мобильная кнопка PDF внутри результатов (Только если Левая панель скрыта). Скрыта при 0% первоначальном взносе */}
                            {downPaymentPercentage > 0 && input.interestRate > 0 && (
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
                            )}
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
                    </>
                )}
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
