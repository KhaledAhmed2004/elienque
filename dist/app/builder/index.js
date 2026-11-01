"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = exports.getPeriodDates = exports.PrismaAggregationBuilder = exports.PrismaAnalyticsBuilder = exports.PrismaQueryBuilder = void 0;
var PrismaQueryBuilder_1 = require("./PrismaQueryBuilder");
Object.defineProperty(exports, "PrismaQueryBuilder", { enumerable: true, get: function () { return __importDefault(PrismaQueryBuilder_1).default; } });
var PrismaAnalyticsBuilder_1 = require("./PrismaAnalyticsBuilder");
Object.defineProperty(exports, "PrismaAnalyticsBuilder", { enumerable: true, get: function () { return __importDefault(PrismaAnalyticsBuilder_1).default; } });
Object.defineProperty(exports, "PrismaAggregationBuilder", { enumerable: true, get: function () { return PrismaAnalyticsBuilder_1.PrismaAggregationBuilder; } });
Object.defineProperty(exports, "getPeriodDates", { enumerable: true, get: function () { return PrismaAnalyticsBuilder_1.getPeriodDates; } });
var PrismaQueryBuilder_2 = require("./PrismaQueryBuilder");
Object.defineProperty(exports, "DEFAULT_PAGE", { enumerable: true, get: function () { return PrismaQueryBuilder_2.DEFAULT_PAGE; } });
Object.defineProperty(exports, "DEFAULT_LIMIT", { enumerable: true, get: function () { return PrismaQueryBuilder_2.DEFAULT_LIMIT; } });
Object.defineProperty(exports, "MAX_LIMIT", { enumerable: true, get: function () { return PrismaQueryBuilder_2.MAX_LIMIT; } });
//# sourceMappingURL=index.js.map