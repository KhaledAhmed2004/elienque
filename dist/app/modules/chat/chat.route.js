"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importStar(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const chat_controller_1 = require("./chat.controller");
const chat_validation_1 = require("./chat.validation");
const router = express_1.default.Router();
// Read Policy: ADMIN and USER permitted, including suspended accounts (to read existing history & support)
const chatReadAuth = (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, auth_1.AUTH_POLICIES.ALLOW_RESTRICTED);
// Mutation Policy: Active ADMIN and USER only (suspended users cannot initiate new chats or delete records)
const chatMutationAuth = (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER);
router.get('/', chatReadAuth, (0, validateRequest_1.default)(chat_validation_1.ChatValidation.getMyChatsQueryZodSchema), chat_controller_1.ChatController.getMyChats);
// Create or get existing chat (Active accounts only)
router.post('/', chatMutationAuth, (0, validateRequest_1.default)(chat_validation_1.ChatValidation.createChatZodSchema), chat_controller_1.ChatController.getOrCreate);
router.get('/:chatId', chatReadAuth, (0, validateRequest_1.default)(chat_validation_1.ChatValidation.getChatByIdZodSchema), chat_controller_1.ChatController.getChatById);
// Delete chat & cascade purge (Active accounts only)
router.delete('/:chatId', chatMutationAuth, (0, validateRequest_1.default)(chat_validation_1.ChatValidation.deleteChatZodSchema), chat_controller_1.ChatController.deleteChat);
exports.ChatRoutes = router;
//# sourceMappingURL=chat.route.js.map