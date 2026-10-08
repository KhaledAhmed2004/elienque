"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationValidation = exports.markReadSchema = exports.paramIdSchema = exports.markAllReadSchema = exports.listNotificationsSchema = void 0;
const zod_1 = require("zod");
const objectIdValidator = zod_1.z
    .string({ error: 'Notification ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format');
exports.listNotificationsSchema = zod_1.z.object({
    query: zod_1.z
        .object({
        limit: zod_1.z.string().optional(),
        page: zod_1.z.string().optional(),
        cursor: zod_1.z
            .string()
            .refine(val => val === '' || /^[0-9a-fA-F]{24}$/.test(val), {
            message: 'Invalid cursor format',
        })
            .optional(),
    })
        .optional(),
});
exports.markAllReadSchema = zod_1.z.object({});
exports.paramIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        notificationId: objectIdValidator,
    }),
});
exports.markReadSchema = zod_1.z.object({
    params: zod_1.z.object({
        notificationId: objectIdValidator,
    }),
    body: zod_1.z
        .object({
        read: zod_1.z.boolean().optional(),
    })
        .optional(),
});
exports.NotificationValidation = {
    listNotificationsSchema: exports.listNotificationsSchema,
    markAllReadSchema: exports.markAllReadSchema,
    paramIdSchema: exports.paramIdSchema,
    markReadSchema: exports.markReadSchema,
};
//# sourceMappingURL=notification.validation.js.map