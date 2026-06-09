import { jsPDF } from 'jspdf';
// import autoTable from 'jspdf-autotable'; // Removed as per requirement
import { formatCurrency, formatDate } from './calculations';
import { CalculationInput, CalculationResult, MonthlyPayment, PropertyInfo } from '../types';
import { BACKGROUND_IMAGE_BASE64 } from './backgroundImage';

// ==========================================
// НАСТРОЙКИ SVG ИЗОБРАЖЕНИЙ
// ==========================================

// Вставьте SVG код для логотипа (верхний левый угол) внутрь обратных кавычек `...`
// Он заменит стандартный логотип и название компании.
const HEADER_LOGO_SVG = ``;

// Вставьте SVG код для футера (нижняя часть страницы) внутрь обратных кавычек `...`
// Он заменит стандартную синюю полосу и фигуры внизу.
const FOOTER_GRAPHICS_SVG = ``;


// ==========================================

// Помощник для растеризации SVG в PNG Data URL
// rasterizeSvg helper removed

// Помощник для загрузки обычных изображений (JPG/PNG)
const loadImage = (url?: string): Promise<{ data: string, width: number, height: number } | null> => {
    if (!url) return Promise.resolve(null);

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Важно для CORS

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({
                    data: canvas.toDataURL('image/png'),
                    width: img.width,
                    height: img.height
                });
            } else {
                resolve(null);
            }
        };

        img.onerror = (e) => {
            console.error("Failed to load image", url, e);
            resolve(null);
        };

        // Декодируем URL, так как он может прийти с закодированными слешами (%2F)
        try {
            img.src = decodeURIComponent(url);
        } catch (e) {
            console.warn("URL decoding failed, using original", e);
            img.src = url;
        }
    });
};

// Функция для очистки HTML тегов и преобразования их в текст для PDF
const stripHtml = (html: string): string => {
    if (!html) return "";

    let text = html;

    // Замена <br> на перенос строки
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Замена </p> на двойной перенос строки (конец параграфа)
    text = text.replace(/<\/p>/gi, '\n\n');

    // Удаление всех остальных тегов
    text = text.replace(/<[^>]+>/g, '');

    // Декодирование HTML сущностей
    const entities: { [key: string]: string } = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&laquo;': '«',
        '&raquo;': '»',
        '&mdash;': '—',
        '&ndash;': '–'
    };

    text = text.replace(/&[a-z]+;/gi, (match) => entities[match] || match);

    // Удаление лишних пробелов и переносов
    text = text.trim();

    return text;
};

export const generateMortgagePDF = async (
    input: CalculationInput,
    result: CalculationResult,
    propertyInfo?: PropertyInfo
): Promise<void> => {
    const doc = new jsPDF();

    // Параллельная загрузка шрифтов и SVG
    const fontRegularPromise = (async () => {
        try {
            const fontUrl = '/assets/components/mortgage-calculator/fonts/Roboto-Regular.ttf';
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error("Failed to load Regular font");
            const blob = await response.blob();
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Regular font loading error", error);
            return null;
        }
    })();

    const fontBoldPromise = (async () => {
        try {
            // Switch to Roboto-Bold as requested for bolder text
            const fontUrl = '/assets/components/mortgage-calculator/fonts/Roboto-Bold.ttf';
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error("Failed to load Bold font");
            const blob = await response.blob();
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Bold font loading error", error);
            return null;
        }
    })();

    const [fontRegularBase64, fontBoldBase64, headerLogo, footerGraphics, propertyImage, backgroundImage] = await Promise.all([
        fontRegularPromise,
        fontBoldPromise,
        // rasterizeSvg(HEADER_LOGO_SVG), // Removed
        // rasterizeSvg(FOOTER_GRAPHICS_SVG), // Removed
        Promise.resolve(null),
        Promise.resolve(null),
        loadImage(propertyInfo?.imageUrl),
        loadImage('/assets/components/mortgage-calculator/images/bg-full.png')
    ]);

    if (fontRegularBase64) {
        doc.addFileToVFS('Roboto-Regular.ttf', fontRegularBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    }

    if (fontBoldBase64) {
        doc.addFileToVFS('Roboto-Bold.ttf', fontBoldBase64);
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    }

    // Устанавливаем шрифт по умолчанию
    doc.setFont('Roboto', 'normal');

    generatePdfContent(doc, input, result, headerLogo, footerGraphics, propertyInfo, propertyImage, backgroundImage);

    const dateStr = new Date().toLocaleDateString('ru-RU');
    let filename = `Расчет ${dateStr}.pdf`;
    if (propertyInfo) {
        const complex = propertyInfo.complexName || 'ЖК';
        const address = propertyInfo.address || 'Адрес';
        // Формат: "Название_комплекса-Улица.pdf", пробелы -> _
        filename = `${complex}-${address}.pdf`.replace(/\s+/g, '_');
    }
    doc.save(filename);
};

const generatePdfContent = (
    doc: jsPDF,
    input: CalculationInput,
    result: CalculationResult,
    headerLogo: { data: string, width: number, height: number } | null,
    footerGraphics: { data: string, width: number, height: number } | null,
    propertyInfo?: PropertyInfo,
    propertyImage?: { data: string, width: number, height: number } | null,
    backgroundImage?: { data: string, width: number, height: number } | null
) => {
    // Фирменные цвета
    const SPK_GREEN: [number, number, number] = [0, 141, 70]; // #008D46
    const SPK_BLUE: [number, number, number] = [0, 159, 227]; // #009FE3
    const SPK_DARK_CYAN: [number, number, number] = [0, 95, 115]; // #005F73
    const TEXT_DARK: [number, number, number] = [30, 41, 59]; // slate-800
    const TEXT_GRAY: [number, number, number] = [100, 116, 139]; // slate-500
    const BG_LIGHT: [number, number, number] = [248, 250, 252]; // slate-50
    const BG_SOFT_BLUE: [number, number, number] = [225, 240, 255]; // Gentle pastel blue
    const BORDER_LIGHT: [number, number, number] = [226, 232, 240]; // slate-200

    // Помощник для расчета производных данных
    const minIncome = result.monthlyPayment * 2;

    // Группировка графика по календарным годам
    const scheduleByYear: { [year: number]: MonthlyPayment[] } = {};
    result.schedule.forEach(item => {
        const year = item.paymentDate.getFullYear();
        if (!scheduleByYear[year]) scheduleByYear[year] = [];
        scheduleByYear[year].push(item);
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;

    // --- Фон (Самый нижний слой) ---
    // --- Фон (Самый нижний слой) ---
    if (backgroundImage) {
        // Рендерим фоновое изображение на весь лист A4
        try {
            // A4 размеры в мм: 210 x 297. jsPDF по умолчанию использует мм и A4.
            // pageWidth и pageHeight уже соответствуют размерам страницы.
            doc.addImage(backgroundImage.data, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch (e) {
            console.error("Failed to render background image", e);
        }
    }

    // Расчет высоты футера для отступов
    let footerHeight = 15; // значение по умолчанию
    if (footerGraphics) {
        footerHeight = (footerGraphics.height / footerGraphics.width) * pageWidth;
    }

    // Определение нижнего отступа контента (высота футера + отступ)
    const contentBottomMargin = footerHeight + 10;

    // --- Шапка ---
    const drawHeader = (doc: jsPDF) => {
        // Header removed as per request
    };

    // --- Футер ---
    const drawFooter = (doc: jsPDF) => {
        // Плашка и фоны убраны, так как используется единый фон A4

        const footerBarHeight = 20; // Оставляем переменную для расчета позиции текста

        // --- Информация о менеджере ---
        if (propertyInfo) {
            const managerName = propertyInfo.managerName || "Менеджер отдела продаж";
            const managerPhone = propertyInfo.managerPhone || "+7 (342) 217 93 03";
            const managerEmail = propertyInfo.managerEmail || "spk@spk.perm.ru";

            // Настройка шрифта для правильного расчета ширины
            doc.setFontSize(11);
            doc.setFont('Roboto', 'bold');
            doc.setTextColor(255, 255, 255);

            // Позиционирование
            // "подними строчку на пикселей 5-10":
            // Было +4 (примерно центр). Уменьшаем до +1.5 (поднимаем на ~2.5мм ~= 10px)
            const textY = pageHeight - (footerBarHeight / 2) + 1.5;
            let cursorX = 14;

            // 1. Label + Name
            const part1 = `Ваш менеджер:   ${managerName}   `;
            doc.text(part1, cursorX, textY);
            cursorX += doc.getTextWidth(part1);

            // 2. Phone (Clickable)
            const phoneText = `${managerPhone}   `;
            doc.text(phoneText, cursorX, textY);
            const phoneWidth = doc.getTextWidth(phoneText);

            // Ссылка на телефон
            const phoneClean = managerPhone.replace(/[^0-9+]/g, '');
            // Y ссылки: baseline - height. Примерно textY - 3
            doc.link(cursorX, textY - 3, phoneWidth, 4, { url: `tel:${phoneClean}` });

            cursorX += phoneWidth;

            // 3. Email (Clickable)
            doc.text(managerEmail, cursorX, textY);
            const emailWidth = doc.getTextWidth(managerEmail);
            doc.link(cursorX, textY - 3, emailWidth, 4, { url: `mailto:${managerEmail}` });
        }
    };

    // Начальная отрисовка Шапки/Футера
    drawHeader(doc);
    drawFooter(doc);

    // --- Основной контент ---
    let currentY = 15;
    const contentWidth = pageWidth - (margin * 2);

    // --- Карточка объекта недвижимости ---
    if (propertyInfo) {
        const cardHeight = 95; // Уменьшена высота для сокращения отступа (было 115)

        // Фон карточки убран по запросу
        // doc.setFillColor(...BG_LIGHT);
        // doc.setDrawColor(...BORDER_LIGHT);
        // doc.roundedRect(margin, currentY, contentWidth, cardHeight, 3, 3, 'FD');

        const innerMargin = 0; // Отступы убраны
        const startX = margin + innerMargin;
        const startY = currentY + innerMargin;

        // Заголовок "Объект"
        doc.setFontSize(14);
        doc.setTextColor(...SPK_GREEN);
        doc.setFont('Roboto', 'bold');
        doc.text("ОБЪЕКТ НЕДВИЖИМОСТИ", startX, startY + 3); // Чуть выше

        // Жилой комплекс (Удален из заголовка, перенесен в детали)
        const addressY = startY + 10; // Чуть выше

        // Адрес
        doc.setFontSize(11);
        doc.setTextColor(...TEXT_DARK);
        doc.setFont('Roboto', 'normal');
        doc.text(propertyInfo.address, startX, addressY);

        // Изображение планировки
        const imageWidth = 80;
        const imageHeight = 80; // Квадратное изображение (уменьшено с 90)
        const imageX = margin + contentWidth - innerMargin - imageWidth;
        const imageY = startY;

        doc.setDrawColor(...SPK_BLUE);
        doc.setFillColor(255, 255, 255);
        doc.rect(imageX, imageY, imageWidth, imageHeight, 'FD');

        if (propertyImage) {
            try {
                // Используем предварительно загруженное изображение
                doc.addImage(propertyImage.data, 'PNG', imageX + 1, imageY + 1, imageWidth - 2, imageHeight - 2);
            } catch (e) {
                // Фолбек, если изображение недоступно
                console.error("PDF addImage failed", e);
                doc.setFontSize(9);
                doc.setTextColor(148, 163, 184);
                doc.text("Планировка", imageX + (imageWidth / 2), imageY + (imageHeight / 2), { align: 'center' });
            }
        } else {
            // Текст-заполнитель
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text("Планировка", imageX + (imageWidth / 2), imageY + (imageHeight / 2), { align: 'center' });
        }

        // Детали объекта
        const detailsStartY = startY + 20;
        const colWidth = 45;
        const rowGap = 15; // Увеличен отступ между строками (было 10)

        doc.setFontSize(10);

        const drawDetail = (label: string, value: string, x: number, y: number) => {
            doc.setFont('Roboto', 'normal');
            doc.setTextColor(...TEXT_GRAY);
            doc.text(label, x, y);

            doc.setFont('Roboto', 'bold');
            doc.setTextColor(...TEXT_DARK);
            doc.text(value, x, y + 5);
        };

        // Строка 1
        drawDetail("Площадь", propertyInfo.area, startX, detailsStartY);
        drawDetail("Комнат", propertyInfo.rooms, startX + colWidth, detailsStartY);

        // Строка 2
        drawDetail("Отделка", propertyInfo.finish, startX, detailsStartY + rowGap);
        drawDetail("Этаж", propertyInfo.floor, startX + colWidth, detailsStartY + rowGap);

        // Строка 3
        if (propertyInfo.complexName) {
            drawDetail("Жилой комплекс", propertyInfo.complexName, startX, detailsStartY + (rowGap * 2));
        }

        if (propertyInfo.deliveryDeadline) {
            drawDetail("Срок сдачи", propertyInfo.deliveryDeadline, startX + colWidth, detailsStartY + (rowGap * 2));
        }

        if (propertyInfo.status) {
            // Статус под Жилым комплексом (новая строка - Row 4)
            const statusY = propertyInfo.complexName || propertyInfo.deliveryDeadline
                ? detailsStartY + (rowGap * 3)
                : detailsStartY + (rowGap * 2);

            drawDetail("Статус", propertyInfo.status, startX, statusY);
        }

        // Описание ЖК удалено из карточки и перенесено в отдельную секцию

        // --- Секция менеджера удалена из основного потока и перенесена в футер ---

        currentY += cardHeight + 5; // Уменьшен отступ после карточки объекта (было 15)
    } else {
        currentY += 10;
    }

    // --- Секция Описание (между Объектом и Расчетом) ---
    if (propertyInfo && propertyInfo.description) {
        const descTitle = propertyInfo.complexName
            ? `ОПИСАНИЕ ${propertyInfo.complexName.toUpperCase()}`
            : "ОПИСАНИЕ ОБЪЕКТА";

        doc.setFontSize(14);
        doc.setTextColor(...SPK_BLUE);
        doc.setFont('Roboto', 'bold');
        doc.text(descTitle, margin, currentY);

        // Разделитель
        doc.setDrawColor(...SPK_BLUE);
        // Используем margin и currentY, так как startX/startY здесь недоступны
        doc.line(margin, currentY + 4, margin + contentWidth, currentY + 4);

        currentY += 10;

        doc.setFontSize(10);
        doc.setTextColor(...TEXT_DARK);
        doc.setFont('Roboto', 'normal');

        // Текст описания на всю ширину
        // Используем maxWidth для автоматического переноса
        // Очищаем HTML теги перед выводом
        const cleanDescription = stripHtml(propertyInfo.description);

        doc.text(cleanDescription, margin, currentY, {
            maxWidth: contentWidth,
            align: 'left'
        });

        // Вычисляем высоту текста для отступа
        const lines = doc.splitTextToSize(cleanDescription, contentWidth);
        const lineHeight = 1.15 * doc.getFontSize() * 0.3527; // ~4mm для 10pt
        const textHeight = lines.length * 5; // Берем с запасом 5мм на строку
        currentY += textHeight + 5; // Уменьшен отступ после описания (было 15)
    }

    // --- Карточка результатов расчета ---
    const resultsCardHeight = 85;

    // Фон карточки убран по запросу
    // doc.setFillColor(...BG_LIGHT);
    // doc.setDrawColor(...BORDER_LIGHT);
    // doc.roundedRect(margin, currentY, contentWidth, resultsCardHeight, 3, 3, 'FD');

    const innerMargin = 0; // Отступы убраны
    const startX = margin + innerMargin;
    const startY = currentY + innerMargin;

    // Заголовок
    doc.setFontSize(14);
    doc.setTextColor(...SPK_BLUE);
    doc.setFont('Roboto', 'bold');
    doc.text("РАСЧЕТ ИПОТЕКИ", startX, startY + 4);

    // Разделитель
    doc.setDrawColor(...SPK_BLUE);
    doc.line(startX, startY + 8, margin + contentWidth - innerMargin, startY + 8);

    const col1X = startX;
    const col2X = startX + (contentWidth / 2);
    const rowStart = startY + 18;
    const rowGap = 12;

    // Функция для отрисовки строки "Метка - Значение"
    const drawResultRow = (label: string, value: string, x: number, y: number, isLarge: boolean = false) => {
        doc.setFontSize(isLarge ? 11 : 10);
        doc.setFont('Roboto', 'normal');
        doc.setTextColor(...TEXT_GRAY);
        doc.text(label, x, y);

        doc.setFontSize(isLarge ? 12 : 11);
        doc.setFont('Roboto', 'bold');
        doc.setTextColor(...TEXT_DARK);
        doc.text(value, x, y + 5);
    };

    // Левая колонка (Параметры)
    drawResultRow("Стоимость недвижимости", formatCurrency(input.propertyValue), col1X, rowStart);
    drawResultRow("Первоначальный взнос", formatCurrency(input.downPayment), col1X, rowStart + rowGap);
    drawResultRow("Сумма кредита", formatCurrency(result.loanAmount), col1X, rowStart + (rowGap * 2));

    // Правая колонка (Итоги)
    // Выделяем ежемесячный платеж
    doc.setFillColor(...BG_SOFT_BLUE);
    doc.roundedRect(col2X - 4, rowStart - 4, (contentWidth / 2) - innerMargin + 4, 16, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(...SPK_BLUE); // Синий текст метки
    doc.text("Ежемесячный платеж", col2X, rowStart);

    doc.setFontSize(14);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(...TEXT_DARK); // Темный текст значения
    doc.text(formatCurrency(result.monthlyPayment), col2X, rowStart + 6);

    // Остальные итоги
    drawResultRow("Срок кредита", `${input.years} лет`, col2X, rowStart + rowGap + 4);
    drawResultRow("Процентная ставка", `${input.interestRate}%`, col2X, rowStart + (rowGap * 2) + 4);
    //drawResultRow("Начисленные проценты", formatCurrency(result.totalInterest), col2X, rowStart + rowGap + 4);
    //drawResultRow("Общая сумма выплат", formatCurrency(result.totalPayment), col2X, rowStart + (rowGap * 2) + 4);
    //drawResultRow("Необходимый доход", formatCurrency(minIncome), col2X, rowStart + (rowGap * 3) + 4);

    // Примечание внизу
    doc.setFontSize(8);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    const noteY = pageHeight - 25; // Над футером (20px высота футера + 5px отступ)
    doc.text("* Расчет является предварительным и не является публичной офертой.", margin, noteY);
};
