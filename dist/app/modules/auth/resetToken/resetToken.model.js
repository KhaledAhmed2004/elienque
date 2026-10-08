"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetToken = void 0;
const mongoose_1 = require("mongoose");
const resetTokenSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    token: {
        type: String,
        required: true,
    },
    expireAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true });
// TTL index to automatically purge expired tokens from MongoDB
resetTokenSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
// token check
resetTokenSchema.statics.isExistToken = async function (token) {
    return await this.findOne({ token });
};
// token validity check
resetTokenSchema.statics.isExpireToken = async function (token) {
    const currentDate = new Date();
    const resetToken = await this.findOne({
        token,
        expireAt: { $gt: currentDate },
    });
    return !!resetToken;
};
exports.ResetToken = (0, mongoose_1.model)('Token', resetTokenSchema);
//# sourceMappingURL=resetToken.model.js.map