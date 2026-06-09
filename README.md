
# Ипотечный Калькулятор Pro (Mortgage Calculator Widget)

Профессиональный виджет ипотечного калькулятора, разработанный на React 19 и TypeScript. Предназначен для встраивания на сайты агентств недвижимости и застройщиков. Поддерживает интеграцию с CMS (например, MODX) в формате IIFE без проблем с CORS.

## 🚀 Основные возможности

*   **Расчет аннуитетных платежей**: Точный финансовый расчет ежемесячного платежа, переплаты и общей стоимости кредита.
*   **Интерактивные графики**:
    *   Круговая диаграмма (структура выплат).
    *   График погашения (изменение остатка долга по годам).
    *   Столбчатая диаграмма (соотношение тела долга и процентов в ежемесячном платеже).
*   **Детальный график платежей**: Таблица с разбивкой по месяцам и годам.
*   **Адаптивность**: Полная поддержка мобильных устройств, планшетов и десктопов. Специальный UI для мобильных с табами.
*   **Экспорт в PDF**: Генерация брендированного PDF-отчета с планировкой квартиры, контактами менеджера и графиком платежей.
*   **Удобный ввод**: Слайдеры, пресеты (быстрый выбор %) и валидация ввода.

## 🛠 Технологический стек

*   **Core**: React 19, TypeScript.
*   **Сборка**: Vite 6.
*   **Стилизация**: Tailwind CSS (используется для быстрой верстки и анимаций).
*   **Визуализация**: `recharts` (для построения графиков).
*   **Иконки**: `lucide-react`.
*   **PDF Генерация**: `jspdf` и `jspdf-autotable`.
*   **Формат виджета**: IIFE (Immediately Invoked Function Expression) для встраивания без CORS проблем.

## 📂 Структура проекта

```text
/
├── components/
│   ├── InputGroup.tsx        # Компонент поля ввода с ползунком и пресетами
│   └── MortgageCalculator.tsx # Основной компонент калькулятора (UI, стейт, логика отображения)
├── utils/
│   ├── calculations.ts       # Математическая логика расчета ипотеки
│   └── pdfGenerator.ts       # Логика генерации PDF файла (SVG в Canvas, таблицы)
├── App.tsx                   # Точка входа, управляет модальным окном и кнопкой вызова
├── types.ts                  # TypeScript интерфейсы и типы данных
├── index.tsx                 # Рендеринг React в DOM
└── metadata.json             # Метаданные виджета
```

## 🧠 Логика работы

### 1. Расчет ипотеки (`utils/calculations.ts`)
Используется классическая формула аннуитетного платежа:

$$A = S \cdot \frac{i \cdot (1+i)^n}{(1+i)^n - 1}$$

Где:
*   $A$ — ежемесячный аннуитетный платеж.
*   $S$ — сумма кредита (Стоимость - Первоначальный взнос).
*   $i$ — месячная процентная ставка (Годовая ставка / 12 / 100).
*   $n$ — срок кредита в месяцах.

Скрипт генерирует массив `schedule`, рассчитывая для каждого месяца:
1.  Процентную часть платежа (Остаток долга * Ставка).
2.  Часть погашения основного долга (Платеж - Проценты).
3.  Новый остаток долга.

### 2. Генерация PDF (`utils/pdfGenerator.ts`)
Процесс создания PDF включает:
1.  **Загрузка шрифтов**: Асинхронная загрузка шрифта Roboto (для поддержки кириллицы).
2.  **Растеризация SVG**: Логотип и футер хранятся как SVG-строки. Перед добавлением в PDF они конвертируются в PNG через HTML5 Canvas для корректного отображения.
3.  **Отрисовка карточки объекта**: Если переданы данные квартиры (адрес, планировка, менеджер), рисуется красивая карточка.
4.  **Таблица**: Используется `jspdf-autotable` для генерации многостраничной таблицы графика платежей.

### 3. UI/UX Решения (`MortgageCalculator.tsx`)
*   **Модальное окно**: Калькулятор открывается поверх основного контента (`App.tsx`).
*   **Мобильная навигация**: На экранах < 1024px экран делится на табы "Параметры" и "Результаты".
*   **Sticky Header**: В мобильной версии заголовки годов в графике платежей "прилипают" к верху (`sticky`), учитывая высоту навигационных табов (top-49px).

## 📝 Документация по типам (`types.ts`)

### `CalculationInput`
Входные данные для расчета:
```typescript
interface CalculationInput {
  propertyValue: number; // Стоимость недвижимости
  downPayment: number;   // Первоначальный взнос
  interestRate: number;  // Годовая ставка (%)
  years: number;         // Срок (лет)
  startDate: string;     // Дата начала (YYYY-MM-DD)
}
```

### `PropertyInfo`
Данные для отображения в PDF и инициализации калькулятора (опционально):
```typescript
interface PropertyInfo {
  address: string;
  imageUrl?: string;     // URL или Base64 изображения планировки
  area: string;          // Площадь (например, "54.77 м²")
  rooms: string;         // Кол-во комнат
  finish: string;        // Отделка
  floor: string;         // Этаж (например, "9 из 15")
  managerName?: string;  // Имя менеджера
  managerPhone?: string; // Телефон менеджера
  price?: string;        // Цена объекта (например, "8 113 602") - используется для автоматической инициализации калькулятора
}
```

## 🚀 Быстрый старт

### Разработка

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера на порту 3000
npm run dev

# Сборка основного приложения
npm run build

# Предпросмотр production сборки
npm run preview
```

### Сборка виджета для встраивания

```bash
# Сборка виджета в формате IIFE для MODX и других CMS
npm run build:widget
```

После сборки в папке `dist` будет создан файл `widget.iife.js` (~1.4 MB, ~445 KB gzip) - готовый виджет для встраивания.

## 🔌 Интеграция

### Использование как виджет (IIFE)

Виджет доступен как глобальный объект `window.MortgageCalculatorWidget` и может быть встроен на любую страницу:

```html
<!-- Подключение Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Подключение виджета -->
<script src="/path/to/widget.iife.js"></script>

<!-- Контейнер для кнопки -->
<div id="mortgage-calculator-trigger"></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    if (window.MortgageCalculatorWidget) {
        // Создание кнопки-триггера
        window.MortgageCalculatorWidget.createTriggerButton({
            containerId: 'mortgage-calculator-trigger',
            buttonText: 'Рассчитать ипотеку',
            propertyInfo: {
                address: "Н.М. Яблокова, 2, кв. 52",
                area: "54.77 м²",
                rooms: "2",
                finish: "Полная отделка",
                floor: "9 из 15",
                imageUrl: "/path/to/image.jpg",
                managerName: "Иванов Иван Иванович",
                managerPhone: "+7 (999) 999-99-99",
                price: "8 113 602" // Цена объекта (пробелы будут автоматически удалены)
            }
        });
    }
});
</script>
```

### API виджета

#### `createTriggerButton(config)`
Создает кнопку-триггер для открытия калькулятора в модальном окне.

**Параметры:**
- `containerId` (string, опционально) - ID контейнера для кнопки (по умолчанию: `'mortgage-calculator-trigger'`)
- `buttonText` (string, опционально) - Текст кнопки (по умолчанию: `'Рассчитать ипотеку'`)
- `buttonClass` (string, опционально) - CSS классы для кнопки
- `propertyInfo` (object, опционально) - Данные объекта недвижимости

#### `init(config)`
Инициализирует виджет в указанном контейнере (без модального окна).

**Параметры:**
- `containerId` (string, опционально) - ID контейнера для виджета (по умолчанию: `'mortgage-calculator-root'`)
- `propertyInfo` (object, опционально) - Данные объекта недвижимости

#### `openModal(propertyInfo)`
Открывает модальное окно с калькулятором.

**Параметры:**
- `propertyInfo` (object, опционально) - Данные объекта недвижимости

#### `destroy()`
Уничтожает виджет и освобождает ресурсы.

### Интеграция с MODX

Подробная документация по интеграции с MODX доступна в файлах:
- **[MODX_QUICK_START.md](./MODX_QUICK_START.md)** - Быстрый старт для MODX
- **[MODX_INTEGRATION.md](./MODX_INTEGRATION.md)** - Полная документация по интеграции

**Краткий пример для MODX:**

```html
<!-- Чанк mortgageCalculatorWidget -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="/assets/components/mortgage-calculator/widget.iife.js"></script>
<div id="mortgage-calculator-trigger"></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    if (window.MortgageCalculatorWidget) {
        var price = '[[*apartment_price_2:notempty=`[[*apartment_price_2:round:price_format]]`:or:empty=`[[*apartment_price:round:price_format]]`]]';
        
        window.MortgageCalculatorWidget.createTriggerButton({
            containerId: 'mortgage-calculator-trigger',
            buttonText: 'Рассчитать ипотеку',
            propertyInfo: {
                address: "[[*address]]",
                area: "[[*apartment_square]] м²",
                rooms: "[[*rooms]]",
                finish: "[[*finish]]",
                floor: "[[*floor]]",
                imageUrl: "[[*planning_image]]",
                managerName: "[[*manager_name]]",
                managerPhone: "[[*manager_phone]]",
                price: price
            }
        });
    }
});
</script>
```

### Особенности

- **Автоматическая инициализация цены**: Если передано поле `price` в `propertyInfo`, калькулятор автоматически установит стоимость недвижимости из этого параметра
- **Формат IIFE**: Виджет собирается в формате IIFE, что исключает проблемы с CORS при встраивании
- **Все зависимости включены**: Виджет содержит все необходимые зависимости в одном файле
- **Tailwind CSS**: Требуется подключение Tailwind CSS через CDN или локально

## 🎨 Кастомизация брендинга

1.  **Цвета**: Основные цвета заданы классами Tailwind: `emerald-600` (зеленый) и `slate-800` (темный).
2.  **Стиль кнопки**: По умолчанию используется стиль `h-[3.75rem] uppercase px-6 flex items-center text-white justify-center font-bold rounded-2xl bg-[#01643C] transition-all duration-200 ease-linear hover:bg-[#1a7450]`. Можно переопределить через параметр `buttonClass`.
3.  **PDF Логотипы**: Измените константы `HEADER_LOGO_SVG` и `FOOTER_GRAPHICS_SVG` в файле `utils/pdfGenerator.ts` на свои SVG строки.

## 📦 Структура сборки

После выполнения `npm run build:widget`:

```
dist/
└── widget.iife.js  # Готовый виджет для встраивания (~1.4 MB)
```

Виджет содержит:
- React и ReactDOM
- Все компоненты приложения
- Библиотеки для графиков (recharts)
- PDF генератор (jspdf, jspdf-autotable)
- Все стили (встроены в JS)

## 🔧 Конфигурация

### Vite конфигурация для виджета

Файл `vite.widget.config.ts` содержит настройки для сборки виджета:
- Формат вывода: IIFE
- Имя глобальной переменной: `MortgageCalculatorWidget`
- Все зависимости включены в один файл
- CSS включен в JS

### Переменные окружения

Виджет не требует переменных окружения. Все настройки задаются через параметры API.

## 📚 Дополнительная документация

- **[MODX_QUICK_START.md](./MODX_QUICK_START.md)** - Быстрый старт для MODX
- **[MODX_INTEGRATION.md](./MODX_INTEGRATION.md)** - Полная документация по интеграции с MODX
- **[BUILD_FOR_MODX.md](./BUILD_FOR_MODX.md)** - Инструкция по сборке для MODX

## 🐛 Отладка

Для локального тестирования виджета используйте файл `widget-test.html`:

```bash
# Откройте widget-test.html в браузере после сборки
npm run build:widget
# Затем откройте widget-test.html в браузере
```

## 📝 Лицензия

*Разработано для использования в современных веб-приложениях.*
