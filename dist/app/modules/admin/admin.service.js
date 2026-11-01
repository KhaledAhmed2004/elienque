"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const prisma_1 = require("../../../shared/prisma");
const getOrCreatePlatformSettings = async () => {
    const existing = await prisma_1.prisma.platformSetting.findFirst();
    if (existing) {
        return existing;
    }
    return prisma_1.prisma.platformSetting.create({
        data: {
            platformName: 'FerryGo',
            supportEmail: 'support@ferrygo.com',
            commissionRate: 10.0,
            payoutSchedule: 'WEEKLY',
        },
    });
};
const getPlatformSettings = async () => {
    const settings = await getOrCreatePlatformSettings();
    return {
        id: settings.id,
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        commissionRate: settings.commissionRate,
        payoutSchedule: settings.payoutSchedule,
        updatedAt: settings.updatedAt,
    };
};
const updateCommissionSettings = async (payload) => {
    const current = await getOrCreatePlatformSettings();
    return prisma_1.prisma.platformSetting.update({
        where: { id: current.id },
        data: {
            commissionRate: payload.rate !== undefined ? payload.rate : current.commissionRate,
            payoutSchedule: payload.schedule || current.payoutSchedule,
        },
    });
};
const updatePlatformInfo = async (payload) => {
    const current = await getOrCreatePlatformSettings();
    return prisma_1.prisma.platformSetting.update({
        where: { id: current.id },
        data: {
            platformName: payload.name || current.platformName,
            supportEmail: payload.email || current.supportEmail,
        },
    });
};
exports.AdminService = {
    getPlatformSettings,
    updateCommissionSettings,
    updatePlatformInfo,
};
//# sourceMappingURL=admin.service.js.map