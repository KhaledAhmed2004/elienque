"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = exports.emailHelper = void 0;
const email_1 = require("./email");
Object.defineProperty(exports, "EmailService", { enumerable: true, get: function () { return email_1.EmailService; } });
exports.emailHelper = {
    sendEmail: email_1.EmailService.sendEmail,
};
exports.default = exports.emailHelper;
//# sourceMappingURL=emailHelper.js.map