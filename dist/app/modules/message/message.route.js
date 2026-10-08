"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const fileHandler_1 = require("../../middlewares/fileHandler");
const message_controller_1 = require("./message.controller");
const message_validation_1 = require("./message.validation");
const router = express_1.default.Router();
router.get('/:chatId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, { allowRestricted: true }), (0, validateRequest_1.default)(message_validation_1.MessageValidation.getMessagesZodSchema), message_controller_1.MessageController.getMessages);
router.post('/:chatId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, { allowRestricted: true }), (0, fileHandler_1.fileHandler)([
    { name: 'attachments', maxCount: 10 },
    { name: 'file', maxCount: 10 },
    { name: 'image', maxCount: 10 },
    { name: 'files', maxCount: 10 },
]), (0, validateRequest_1.default)(message_validation_1.MessageValidation.sendMessageZodSchema), message_controller_1.MessageController.sendMessage);
exports.MessageRoutes = router;
//# sourceMappingURL=message.route.js.map