"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        default: user_1.USER_ROLES.PROMOTER,
    },
    businessName: {
        type: String,
        required: function () {
            return this.role === user_1.USER_ROLES.BUSINESS_OWNER;
        },
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    phone: {
        type: String,
        required: function () {
            return this.role !== user_1.USER_ROLES.ADMIN;
        },
        trim: true,
        unique: true,
        sparse: true,
    },
    profilePicture: {
        type: String,
        default: 'https://i.ibb.co/z5YHLV9/profile.png',
    },
    accountState: {
        type: String,
        enum: Object.values(user_1.ACCOUNT_STATE),
        default: user_1.ACCOUNT_STATE.UNVERIFIED,
    },
    deviceTokens: {
        type: [String],
        default: [],
    },
    totalReviews: {
        type: Number,
        default: 0,
    },
    loginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
    approvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    blockReason: {
        type: String,
        default: null,
    },
    suspendedAt: {
        type: Date,
        default: null,
    },
    suspendedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    rejectionReason: {
        type: String,
        default: null,
    },
    rejectedAt: {
        type: Date,
        default: null,
    },
    rejectedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    reactivatedAt: {
        type: Date,
        default: null,
    },
    reactivatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    authentication: {
        type: {
            hashedOtp: {
                type: String,
                default: null,
            },
            expireAt: {
                type: Date,
                default: null,
            },
            attempts: {
                type: Number,
                default: 0,
            },
            resendTimestamps: {
                type: [Date],
                default: [],
            },
            purpose: {
                type: String,
                default: null,
            },
        },
        select: false,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            delete ret.password;
            delete ret.authentication;
            delete ret.deviceTokens;
            delete ret.loginAttempts;
            delete ret.lockUntil;
            delete ret.uploadedHeadshot;
            ret.id = ret._id;
            delete ret._id;
        },
    },
});
//exist user check
userSchema.statics.isExistUserById = async (id) => {
    const isExist = await exports.User.findById(id);
    return isExist;
};
userSchema.statics.isExistUserByEmail = async (email) => {
    const isExist = await exports.User.findOne({ email }).select('+password');
    return isExist;
};
//is match password
userSchema.statics.isMatchPassword = async (password, hashPassword) => {
    return await bcrypt_1.default.compare(password, hashPassword);
};
//check user
userSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.get('password')) {
        const hash = await bcrypt_1.default.hash(this.get('password'), Number(config_1.default.bcrypt_salt_rounds));
        this.set('password', hash);
    }
    next();
});
// add device token
userSchema.statics.addDeviceToken = async (userId, token) => {
    return await exports.User.findByIdAndUpdate(userId, { $addToSet: { deviceTokens: token } }, { new: true });
};
// remove device token
userSchema.statics.removeDeviceToken = async (userId, token) => {
    return await exports.User.findByIdAndUpdate(userId, { $pull: { deviceTokens: token } }, { new: true });
};
// Create indexes
userSchema.index({ role: 1, accountState: 1, _id: -1 });
userSchema.index({ accountState: 1 });
userSchema.index({ lockUntil: 1 });
userSchema.index({ name: 'text', nickname: 'text', phone: 'text' });
exports.User = (0, mongoose_1.model)('User', userSchema);
//# sourceMappingURL=user.model.js.map