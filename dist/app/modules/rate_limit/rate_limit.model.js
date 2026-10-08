"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimit = void 0;
const mongoose_1 = require("mongoose");
const rateLimitSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    points: { type: Number, required: true },
    expireAt: { type: Date, required: true },
}, { timestamps: true });
// TTL Index for automatic cleanup
rateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
exports.RateLimit = (0, mongoose_1.model)('RateLimit', rateLimitSchema);
//# sourceMappingURL=rate_limit.model.js.map