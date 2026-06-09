
import React, { useState } from 'react';
import { MortgageCalculator } from './components/MortgageCalculator';
import { Calculator } from 'lucide-react';

const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans p-4">
      {/* 
        Это кнопка-триггер, которая будет размещена на сайте MODX. 
        Она открывает модальное окно.
      */}
      {!isOpen && (
        <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Сайт Агентства Недвижимости</h1>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
                Здесь расположен контент вашего сайта. Нажмите кнопку ниже, чтобы открыть калькулятор.
            </p>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg hover:bg-emerald-700 hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
                <Calculator />
                Рассчитать ипотеку
            </button>
        </div>
      )}

      {/* Модальное перекрытие (Overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          {/* Фон (Backdrop) */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Контент модального окна - На весь экран */}
          <div className="relative w-full h-full z-10 animate-fade-in-up">
            <MortgageCalculator onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
