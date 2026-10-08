"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const corsLogger_1 = require("./app/logging/corsLogger");
const seedAdmin_1 = require("./DB/seedAdmin");
const socketHelper_1 = require("./helpers/socketHelper");
const logger_1 = require("./shared/logger");
const CacheHelper_1 = require("./app/shared/CacheHelper");
const startupSummary_1 = require("./shared/startupSummary");
const spinnerHelper_1 = require("./shared/spinnerHelper");
const outboxWorker_1 = require("./app/modules/emailOutbox/outboxWorker");
let server;
setupGlobalErrorHandlers();
async function main() {
    try {
        const startupStatus = getInitialStartupStatus();
        await connectToDatabase(startupStatus);
        await seedSystemData();
        initializeCache(startupStatus);
        await validatePerformanceThresholds();
        const { port, host } = getServerConfig();
        startServer(port, host, startupStatus);
    }
    catch (error) {
        handleStartupError(error);
    }
}
main();
function setupGlobalErrorHandlers() {
    process.on('uncaughtException', error => {
        logger_1.errorLogger.error('UncaughtException Detected', error);
        gracefulShutdown(1);
    });
    process.on('unhandledRejection', error => {
        if (server) {
            logger_1.errorLogger.error('❌ UnhandledRejection Detected');
            (0, logger_1.notifyCritical)('Unhandled Rejection', error?.message || 'Unknown error');
            gracefulShutdown(1);
        }
        else {
            logger_1.errorLogger.error('❌ UnhandledRejection Detected before server start', error);
            process.exit(1);
        }
    });
    process.on('SIGTERM', () => {
        logger_1.logger.info('SIGTERM RECEIVED');
        gracefulShutdown(0);
    });
}
function gracefulShutdown(code) {
    if (server && typeof server.close === 'function') {
        try {
            server.close(() => setTimeout(() => process.exit(code), 500));
        }
        catch (e) {
            setTimeout(() => process.exit(code), 500);
        }
    }
    else {
        process.exit(code);
    }
}
function getInitialStartupStatus() {
    return {
        environment: config_1.default.node_env || 'unknown',
        debugMode: config_1.default.node_env === 'development',
        rateLimit: true,
        socketIO: false,
        database: { status: 'disconnected' },
        cache: { status: 'disabled' },
    };
}
async function connectToDatabase(startupStatus) {
    const dbSpinner = (0, spinnerHelper_1.createSpinner)({
        text: 'Connecting to MongoDB...',
        color: 'cyan',
    });
    try {
        await mongoose_1.default.connect(config_1.default.database_url);
        dbSpinner.succeed('MongoDB connected successfully');
        startupStatus.database = {
            status: 'connected',
            message: 'MongoDB connected successfully',
        };
    }
    catch (dbError) {
        dbSpinner.fail('MongoDB connection failed');
        throw dbError;
    }
}
async function seedSystemData() {
    const seedSpinner = (0, spinnerHelper_1.createSpinner)({
        text: 'Verifying super admin account & system seeds...',
        color: 'cyan',
    });
    await (0, seedAdmin_1.seedSuperAdmin)();
    seedSpinner.succeed('Super admin & system seeds ready');
}
function initializeCache(startupStatus) {
    const cacheSpinner = (0, spinnerHelper_1.createSpinner)({
        text: 'Initializing cache system...',
        color: 'cyan',
    });
    CacheHelper_1.CacheHelper.getInstance();
    cacheSpinner.succeed('In-memory cache initialized');
    startupStatus.cache = {
        status: 'initialized',
        message: 'In-memory cache ready',
    };
}
async function validatePerformanceThresholds() {
    if (!config_1.default.tracing?.performance?.enabled)
        return;
    const thresholdSpinner = (0, spinnerHelper_1.createSpinner)({
        text: 'Validating performance thresholds...',
        color: 'cyan',
    });
    try {
        const { validateAndWarnThresholds } = await Promise.resolve().then(() => __importStar(require('./app/logging/thresholdValidator')));
        validateAndWarnThresholds(config_1.default.tracing.performance.thresholds);
        thresholdSpinner.succeed('Performance config validated');
    }
    catch (err) {
        thresholdSpinner.warn('Threshold validation skipped');
        logger_1.errorLogger.error('Threshold validation failed:', err);
    }
}
function getServerConfig() {
    const port = Number(config_1.default.port) || 5001;
    const host = config_1.default.node_env === 'development'
        ? '0.0.0.0'
        : (config_1.default.ip_address && String(config_1.default.ip_address).trim()) || '0.0.0.0';
    return { port, host };
}
function startServer(port, host, startupStatus) {
    const serverSpinner = (0, spinnerHelper_1.createSpinner)({
        text: `Starting HTTP server on ${host}:${port}...`,
        color: 'cyan',
    });
    server = app_1.default.listen(port, host, () => {
        const url = `http://${host}:${port}/`;
        serverSpinner.succeed(`Server is listening at ${url}`);
        startupStatus.server = { url, host, port };
        setupSocketIO(startupStatus);
        (0, outboxWorker_1.startOutboxWorker)(5000);
        printStartupSummary(startupStatus);
    });
    setupPortRetryLogic(port, host);
}
function setupSocketIO(startupStatus) {
    const socketSpinner = (0, spinnerHelper_1.createSpinner)({
        text: 'Initializing Socket.IO server...',
        color: 'cyan',
    });
    const io = new socket_io_1.Server(server, {
        pingTimeout: 60000,
        cors: {
            origin: corsLogger_1.allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST'],
        },
    });
    socketHelper_1.socketHelper.socket(io);
    global.io = io;
    socketSpinner.succeed('Socket.IO ready for real-time connections');
    startupStatus.socketIO = true;
}
function printStartupSummary(startupStatus) {
    startupStatus.timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
    const summary = (0, startupSummary_1.generateStartupSummary)(startupStatus, {
        style: 'compact',
        borderStyle: 'double',
        width: 63,
        colors: true,
    });
    console.log('\n' + summary + '\n');
}
function setupPortRetryLogic(port, host) {
    let portRetries = 0;
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            portRetries++;
            if (portRetries > 5) {
                logger_1.errorLogger.error(`❌ Port ${host}:${port} permanently blocked after 5 retries. Exiting.`);
                process.exit(1);
            }
            logger_1.errorLogger.error(`⚠️ Port in use ${host}:${port} (EADDRINUSE) - Retry ${portRetries}/5`);
            try {
                server.close(() => {
                    setTimeout(() => {
                        server = app_1.default.listen(port, host, () => {
                            logger_1.logger.info(`♻️ Re-listened on ${host}:${port} after EADDRINUSE`);
                        });
                    }, 1000);
                });
            }
            catch (closeErr) {
                logger_1.errorLogger.error('Failed to close server after EADDRINUSE', closeErr);
            }
        }
    });
}
function handleStartupError(error) {
    logger_1.errorLogger.error('❌ Database connection failed');
    (0, logger_1.notifyCritical)('Database Connection Failed', error?.message || 'Unknown error');
}
//# sourceMappingURL=server.js.map