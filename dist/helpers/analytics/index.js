"use strict";
/**
 * Analytics & Dashboard Metrics Helpers
 *
 * Dedicated domain helper for computing growth statistics, time trends,
 * revenue breakdown, and performer metrics.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPeriodDates = exports.calculateGrowthDynamic = exports.AnalyticsHelper = void 0;
var analytics_helper_1 = require("./analytics.helper");
Object.defineProperty(exports, "AnalyticsHelper", { enumerable: true, get: function () { return __importDefault(analytics_helper_1).default; } });
Object.defineProperty(exports, "calculateGrowthDynamic", { enumerable: true, get: function () { return analytics_helper_1.calculateGrowthDynamic; } });
var datePeriod_helper_1 = require("./datePeriod.helper");
Object.defineProperty(exports, "getPeriodDates", { enumerable: true, get: function () { return datePeriod_helper_1.getPeriodDates; } });
__exportStar(require("./analytics.types"), exports);
//# sourceMappingURL=index.js.map