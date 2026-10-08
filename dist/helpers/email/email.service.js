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
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = __importDefault(require("../../config"));
const templates = __importStar(require("./templates"));
const transporter = nodemailer_1.default.createTransport({
    host: config_1.default.email.host,
    port: Number(config_1.default.email.port),
    secure: false,
    auth: {
        user: config_1.default.email.user,
        pass: config_1.default.email.pass,
    },
});
exports.EmailService = {
    /**
     * Raw send email method via nodemailer transporter
     */
    sendEmail: async (options) => {
        try {
            await transporter.sendMail({
                from: `"Moeb26" <${config_1.default.email.from}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });
        }
        catch (error) {
            console.error('Failed to send email to:', options.to, error);
        }
    },
    /**
     * Send Account Verification OTP Email
     */
    sendCreateAccountOtp: async (data) => {
        const emailData = templates.createAccountOtpTemplate(data);
        await exports.EmailService.sendEmail(emailData);
    },
    /**
     * Send Password Reset OTP Email
     */
    sendResetPasswordOtp: async (data) => {
        const emailData = templates.resetPasswordOtpTemplate(data);
        await exports.EmailService.sendEmail(emailData);
    },
    /**
     * Send Driver Application Approved Email
     */
    sendAccountApproved: async (data) => {
        const emailData = templates.accountApprovedTemplate(data);
        await exports.EmailService.sendEmail(emailData);
    },
    /**
     * Send Subscription Invitation Email
     */
    sendSubscriptionInvitation: async (data) => {
        const emailData = templates.subscriptionInvitationTemplate(data);
        await exports.EmailService.sendEmail(emailData);
    },
    /**
     * Send Invoice / Trip Receipt Email
     */
    sendInvoice: async (data) => {
        const emailData = templates.invoiceTemplate(data);
        await exports.EmailService.sendEmail(emailData);
    },
    /**
     * Send Generic Notification Email
     */
    sendNotification: async (data) => {
        const emailData = templates.notificationTemplate(data);
        await exports.EmailService.sendEmail(emailData);
    },
};
//# sourceMappingURL=email.service.js.map