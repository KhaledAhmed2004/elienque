"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const mongoose_1 = require("mongoose");
const user_1 = require("../../../enums/user");
const sessionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    familyId: { type: String, required: true, unique: true },
    hashedRefreshToken: { type: String, required: true },
    previousHashedToken: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    status: {
        type: String,
        enum: Object.values(user_1.SESSION_STATUS),
        default: user_1.SESSION_STATUS.ACTIVE,
    },
    absoluteExpiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Indexes
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
exports.Session = (0, mongoose_1.model)('Session', sessionSchema);
//# sourceMappingURL=session.model.js.map