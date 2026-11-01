"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = void 0;
const config_1 = __importDefault(require("../config"));
const client_1 = require("@prisma/client");
const logger_1 = require("../shared/logger");
const prisma_1 = require("../shared/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
const seedAdmin = async () => {
    if (!config_1.default.admin.email || !config_1.default.admin.password)
        return;
    const isExistAdmin = await prisma_1.prisma.user.findFirst({
        where: {
            email: config_1.default.admin.email.toLowerCase().trim(),
            role: client_1.Role.ADMIN,
        },
    });
    if (!isExistAdmin) {
        const hashedPassword = await bcrypt_1.default.hash(config_1.default.admin.password, Number(config_1.default.bcrypt_salt_rounds));
        await prisma_1.prisma.user.create({
            data: {
                name: 'Administrator',
                email: config_1.default.admin.email.toLowerCase().trim(),
                role: client_1.Role.ADMIN,
                passwordHash: hashedPassword,
                status: client_1.AccountStatus.ACTIVE,
                isEmailVerified: true,
                isRootAdmin: true,
            },
        });
        logger_1.logger.info('✨ Admin account has been successfully created!');
    }
};
exports.seedAdmin = seedAdmin;
//# sourceMappingURL=seedAdmin.js.map