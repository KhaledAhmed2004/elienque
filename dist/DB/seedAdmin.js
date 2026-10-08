"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSuperAdmin = void 0;
const user_model_1 = require("../app/modules/user/user.model");
const config_1 = __importDefault(require("../config"));
const user_1 = require("../enums/user");
const logger_1 = require("../shared/logger");
const payload = {
    name: 'Administrator',
    email: config_1.default.super_admin.email,
    role: user_1.USER_ROLES.ADMIN,
    password: config_1.default.super_admin.password,
    accountState: user_1.ACCOUNT_STATE.VERIFIED,
};
const seedSuperAdmin = async () => {
    const isExistSuperAdmin = await user_model_1.User.findOne({
        email: config_1.default.super_admin.email,
        role: user_1.USER_ROLES.ADMIN,
    });
    if (!isExistSuperAdmin) {
        await user_model_1.User.create(payload);
        logger_1.logger.info('✨ Super Admin account has been successfully created!');
    }
};
exports.seedSuperAdmin = seedSuperAdmin;
//# sourceMappingURL=seedAdmin.js.map