"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
require("./app/logging/mongooseMetrics");
require("./app/logging/autoLabelBootstrap");
require("./app/logging/opentelemetry");
require("./app/logging/patchBcrypt");
require("./app/logging/patchJWT");
require("./app/logging/patchStripe");
const routes_1 = __importDefault(require("./routes"));
const morgen_1 = require("./shared/morgen");
const http_status_codes_1 = require("http-status-codes");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const requestContext_1 = require("./app/logging/requestContext");
const clientInfo_1 = require("./app/logging/clientInfo");
const requestLogger_1 = require("./app/logging/requestLogger");
const otelExpress_1 = require("./app/logging/otelExpress");
const corsLogger_1 = require("./app/logging/corsLogger");
const app = (0, express_1.default)();
app.use(morgen_1.Morgan.successHandler);
app.use(morgen_1.Morgan.errorHandler);
app.use((req, res, next) => {
    res.setHeader('Accept-CH', [
        'Sec-CH-UA',
        'Sec-CH-UA-Platform',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
        'Sec-CH-UA-Arch',
        'Sec-CH-UA-Bitness',
    ].join(', '));
    const varyHeaders = [
        'User-Agent',
        'Sec-CH-UA',
        'Sec-CH-UA-Platform',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
        'Sec-CH-UA-Arch',
        'Sec-CH-UA-Bitness',
    ].join(', ');
    const existingVary = res.getHeader('Vary');
    res.setHeader('Vary', existingVary ? String(existingVary) + ', ' + varyHeaders : varyHeaders);
    res.setHeader('Critical-CH', [
        'Sec-CH-UA-Platform',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
    ].join(', '));
    next();
});
app.use(otelExpress_1.otelExpressMiddleware);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin) {
            (0, corsLogger_1.maybeLogCors)(origin, true);
            return callback(null, true);
        }
        if (corsLogger_1.allowedOrigins.includes(origin)) {
            (0, corsLogger_1.maybeLogCors)(origin, true);
            callback(null, true);
        }
        else {
            (0, corsLogger_1.maybeLogCors)(origin, false);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
}));
app.options('*', (0, cors_1.default)({
    origin: corsLogger_1.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
}));
app.use('/api/v1/payments/webhook', express_1.default.raw({ type: 'application/json' }));
app.use((req, res, next) => {
    if (req.path.includes('/webhook')) {
        return next();
    }
    express_1.default.json({ limit: '10mb' })(req, res, next);
});
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use(requestContext_1.requestContextInit);
app.use(clientInfo_1.clientInfo);
app.use(requestLogger_1.requestLogger);
app.use('/uploads', express_1.default.static('uploads'));
app.use('/api/v1', routes_1.default);
app.get('/', (req, res) => res.sendFile(path_1.default.join(__dirname, '../public/live-response.html')));
app.use(globalErrorHandler_1.default);
app.use((req, res) => {
    res.status(http_status_codes_1.StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Not found',
        errorMessages: [
            {
                path: req.originalUrl,
                message: "API DOESN'T EXIST",
            },
        ],
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map