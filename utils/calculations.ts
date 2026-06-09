
import { CalculationInput, CalculationResult, MonthlyPayment } from '../types';

export const calculateMortgage = (input: CalculationInput): CalculationResult => {
  const { propertyValue, downPayment, interestRate, years, startDate } = input;
  
  const loanAmount = propertyValue - downPayment;
  
  // Обработка граничных случаев: нулевой кредит или некорректные данные
  if (loanAmount <= 0 || interestRate < 0 || years <= 0) {
    return {
      monthlyPayment: 0,
      totalPayment: 0,
      totalInterest: 0,
      loanAmount: Math.max(0, loanAmount),
      schedule: [],
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = Math.round(years * 12);
  
  const startObj = new Date(startDate);

  let monthlyPayment = 0;

  // Формула аннуитета: P = S * (i / (1 - (1 + i)^-n))
  if (monthlyRate === 0) {
    monthlyPayment = loanAmount / totalMonths;
  } else {
    monthlyPayment =
      loanAmount *
      (monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths)));
  }

  // Расчет итогов строго на основе срока аннуитета
  // Это гарантирует, что сводка точно соответствует "Ежемесячный платеж * Годы", что является банковским стандартом для итогов.
  const totalPayment = monthlyPayment * totalMonths;
  const totalInterest = totalPayment - loanAmount;

  const schedule: MonthlyPayment[] = [];
  let currentBalance = loanAmount;
  let totalPaid = 0;
  let prevDate = new Date(startObj);

  for (let i = 1; i <= totalMonths; i++) {
    const payDate = new Date(startObj);
    payDate.setMonth(startObj.getMonth() + i);

    let interestPart = currentBalance * monthlyRate;
    let principalPart = monthlyPayment - interestPart;
    let paymentForMonth = monthlyPayment;

    // Корректировка последнего месяца для полного закрытия кредита
    if (i === totalMonths || principalPart > currentBalance) {
        principalPart = currentBalance;
        paymentForMonth = principalPart + interestPart;
        // Примечание: Последний платеж в графике может незначительно отличаться от аннуитетного из-за округления,
        // но для карточки сводки мы придерживаемся строгого аннуитетного итога.
    } 

    currentBalance -= principalPart;
    if (currentBalance < 0) currentBalance = 0;
    
    totalPaid += paymentForMonth;

    schedule.push({
      monthIndex: i,
      payment: paymentForMonth,
      interestPart,
      principalPart,
      remainingBalance: currentBalance,
      totalPaidToDate: totalPaid,
      paymentDate: payDate
    });

    prevDate = payDate;
  }

  return {
    monthlyPayment,
    totalPayment,
    totalInterest,
    loanAmount,
    schedule,
  };
};

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2, 
  }).format(val);
};

export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};
