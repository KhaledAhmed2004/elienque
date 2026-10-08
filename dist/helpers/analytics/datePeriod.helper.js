"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPeriodDates = void 0;
/**
 * Computes comparative period date ranges (this period vs. previous period).
 */
const getPeriodDates = (period = 'month', referenceDate = new Date()) => {
    const now = new Date(referenceDate);
    let startThis;
    let startLast;
    let endLast;
    switch (period) {
        case 'day': {
            startThis = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            startLast = new Date(startThis);
            startLast.setDate(startThis.getDate() - 1);
            endLast = new Date(startThis);
            endLast.setMilliseconds(-1);
            break;
        }
        case 'week': {
            const day = now.getDay(); // Sunday = 0
            startThis = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
            startLast = new Date(startThis);
            startLast.setDate(startThis.getDate() - 7);
            endLast = new Date(startThis);
            endLast.setMilliseconds(-1);
            break;
        }
        case 'month': {
            startThis = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            endLast = new Date(startThis);
            endLast.setMilliseconds(-1);
            break;
        }
        case 'quarter': {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            startThis = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
            const lastQuarterMonth = (currentQuarter - 1) * 3;
            startLast = new Date(now.getFullYear(), lastQuarterMonth, 1, 0, 0, 0, 0);
            endLast = new Date(startThis);
            endLast.setMilliseconds(-1);
            break;
        }
        case 'year': {
            startThis = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            startLast = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
            endLast = new Date(startThis);
            endLast.setMilliseconds(-1);
            break;
        }
        default:
            throw new Error(`Unsupported period: ${period}`);
    }
    return { startThis, startLast, endLast };
};
exports.getPeriodDates = getPeriodDates;
//# sourceMappingURL=datePeriod.helper.js.map