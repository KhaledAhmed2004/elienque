"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushNotificationHelper = void 0;
const logger_1 = require("../../../shared/logger");
const config_1 = __importDefault(require("../../../config"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
let isFirebaseInitialized = false;
const initFirebase = () => {
    if (isFirebaseInitialized || firebase_admin_1.default.apps.length > 0) {
        isFirebaseInitialized = true;
        return true;
    }
    if (!config_1.default.firebase_api_key_base64) {
        logger_1.logger.warn('Firebase Admin SDK skipped: FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is not configured.');
        return false;
    }
    try {
        const serviceAccountJson = Buffer.from(config_1.default.firebase_api_key_base64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
        });
        isFirebaseInitialized = true;
        logger_1.logger.info('Firebase Admin SDK initialized successfully.');
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Firebase Admin SDK:', error);
        return false;
    }
};
const sendPushNotifications = async (values) => {
    if (!initFirebase()) {
        logger_1.logger.warn('Push notification skipped: Firebase not initialized.');
        return;
    }
    try {
        const res = await firebase_admin_1.default.messaging().sendEachForMulticast(values);
        logger_1.logger.info('Notifications sent successfully', res);
        return res;
    }
    catch (error) {
        logger_1.logger.error('Failed to send multicast push notifications:', error);
        throw error;
    }
};
const sendPushNotification = async (values) => {
    if (!initFirebase()) {
        logger_1.logger.warn('Push notification skipped: Firebase not initialized.');
        return;
    }
    try {
        const res = await firebase_admin_1.default.messaging().send(values);
        logger_1.logger.info('Notification sent successfully', res);
        return res;
    }
    catch (error) {
        logger_1.logger.error('Failed to send single push notification:', error);
        throw error;
    }
};
exports.pushNotificationHelper = {
    sendPushNotifications,
    sendPushNotification,
};
//# sourceMappingURL=pushNotificationHelper.js.map