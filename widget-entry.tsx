/**
 * Entry point для виджета в формате IIFE (без CORS проблем)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MortgageCalculator } from './components/MortgageCalculator';
import { PropertyInfo } from './types';

interface WidgetConfig {
  containerId?: string;
  propertyInfo?: PropertyInfo;
  buttonText?: string;
  buttonClass?: string;
}

class MortgageCalculatorWidget {
  private root: ReactDOM.Root | null = null;
  private propertyInfo: PropertyInfo | undefined;

  init(config: WidgetConfig = {}) {
    const containerId = config.containerId || 'mortgage-calculator-root';
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Контейнер с id="${containerId}" не найден`);
      return;
    }

    this.propertyInfo = config.propertyInfo;
    container.innerHTML = '';
    this.root = ReactDOM.createRoot(container);
    this.root.render(<App propertyInfo={this.propertyInfo} />);
  }

  createTriggerButton(config: WidgetConfig = {}) {
    const targetId = config.containerId || 'mortgage-calculator-trigger';
    const target = document.getElementById(targetId);
    
    if (!target) {
      console.error(`Контейнер с id="${targetId}" не найден`);
      return;
    }

    const button = document.createElement('button');
    button.className = config.buttonClass || 'h-[3.75rem] gap-2 uppercase px-6 flex items-center text-white justify-center font-bold rounded-2xl bg-[#01643C] transition-all duration-200 ease-linear hover:bg-[#1a7450]';
    button.innerHTML = `<span>${config.buttonText || 'Рассчитать ипотеку'}</span>`;
    
    button.onclick = () => {
      this.openModal(config.propertyInfo);
    };
    
    target.appendChild(button);
  }

  openModal(propertyInfo?: PropertyInfo) {
    let modalContainer = document.getElementById('mortgage-calculator-modal');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'mortgage-calculator-modal';
      document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = '';
    const root = ReactDOM.createRoot(modalContainer);
    
    root.render(
      <ModalApp 
        propertyInfo={propertyInfo || this.propertyInfo} 
        onClose={() => {
          root.unmount();
          modalContainer?.remove();
        }} 
      />
    );
  }

  destroy() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

const App: React.FC<{ propertyInfo?: PropertyInfo }> = ({ propertyInfo }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="mortgage-calculator-widget">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="h-[3.75rem] gap-2 uppercase px-6 flex items-center text-white justify-center font-bold rounded-2xl bg-[#01643C] transition-all duration-200 ease-linear hover:bg-[#1a7450]"
        >
          Рассчитать ипотеку
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full h-full z-10 animate-fade-in-up">
            <MortgageCalculator 
              onClose={() => setIsOpen(false)} 
              propertyInfo={propertyInfo}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ModalApp: React.FC<{ propertyInfo?: PropertyInfo; onClose: () => void }> = ({ propertyInfo, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full h-full z-10 animate-fade-in-up">
        <MortgageCalculator onClose={onClose} propertyInfo={propertyInfo} />
      </div>
    </div>
  );
};

// Экспортируем в глобальную область видимости
declare global {
  interface Window {
    MortgageCalculatorWidget: MortgageCalculatorWidget;
  }
}

// Создаем экземпляр и экспортируем
const widgetInstance = new MortgageCalculatorWidget();
window.MortgageCalculatorWidget = widgetInstance;

// Экспортируем для Vite IIFE
export default widgetInstance;

