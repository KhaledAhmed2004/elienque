"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTemplate = void 0;
const templates_1 = require("../helpers/email/templates");
exports.emailTemplate = {
    createAccount: (values) => (0, templates_1.createAccountOtpTemplate)({
        name: values.name,
        email: values.email,
        otp: values.otp,
    }),
    resetPassword: (values) => (0, templates_1.resetPasswordOtpTemplate)({
        email: values.email,
        otp: values.otp,
        name: values.name,
    }),
    subscriptionInvitation: (values) => (0, templates_1.subscriptionInvitationTemplate)({
        name: values.name,
        email: values.email,
        paymentUrl: values.subscriptionUrl,
        planName: values.planName,
        amount: values.amount,
    }),
    accountApproved: (values) => (0, templates_1.accountApprovedTemplate)({
        name: values.name,
        email: values.email,
        loginUrl: values.loginUrl,
    }),
    invoice: templates_1.invoiceTemplate,
    notification: templates_1.notificationTemplate,
};
exports.default = exports.emailTemplate;
//# sourceMappingURL=emailTemplate.js.map