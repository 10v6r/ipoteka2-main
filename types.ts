
export interface CalculationInput {
  propertyValue: number;
  downPayment: number;
  interestRate: number;
  years: number;
  startDate: string; // Строка формата ISO YYYY-MM-DD
}

export interface MonthlyPayment {
  monthIndex: number; // Начинается с 1
  payment: number;
  interestPart: number;
  principalPart: number;
  remainingBalance: number;
  totalPaidToDate: number;
  paymentDate: Date;
}

export interface CalculationResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  loanAmount: number;
  schedule: MonthlyPayment[];
}

export interface PropertyInfo {
  address: string;
  imageUrl?: string; // Base64 или URL
  area: string;
  rooms: string;
  finish: string;
  floor: string;
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
  price?: string; // Цена объекта в формате строки (например, "8 113 602")
  complexName?: string;
  apartmentName?: string;
  layoutImage?: string;
  status?: string; // Статус объекта (сдан, строится и т.д.)
  deliveryDeadline?: string; // Срок сдачи
  description?: string; // Описание ЖК
}

export enum ViewMode {
  Summary = 'summary',
  Schedule = 'schedule',
  Object = 'object',
}
