"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUserTokens = exports.computeUserAccessState = void 0;
const config_1 = __importDefault(require("../../../config"));
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const computeUserAccessState = (user) => ({
    isApproved: user?.accountState === 'VERIFIED' || user?.isEmailVerified === true,
    isOnboard: true,
});
exports.computeUserAccessState = computeUserAccessState;
const generateUserTokens = (user) => {
    const userId = String(user.id || user._id);
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        id: userId,
        sub: userId,
        email: user.email,
        role: user.role,
        accountState: user.accountState,
        sessionId: user.sessionId,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in || '15m');
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        id: userId,
        sub: userId,
        email: user.email,
        role: user.role,
        sessionId: user.sessionId,
    }, config_1.default.jwt.jwt_refresh_secret, config_1.default.jwt.jwt_refresh_expire_in || '7d');
    return { accessToken, refreshToken };
};
exports.generateUserTokens = generateUserTokens;
//# sourceMappingURL=auth.helper.js.map