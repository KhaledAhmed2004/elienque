"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const support_controller_1 = require("./support.controller");
const support_validation_1 = require("./support.validation");
const router = express_1.default.Router();
// Create support ticket (any authenticated user, restricted users allowed)
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, { allowRestricted: true }), (0, validateRequest_1.default)(support_validation_1.SupportValidation.createSupportZodSchema), support_controller_1.SupportController.createSupport);
// Get my tickets (restricted users allowed)
router.get('/my-tickets', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, { allowRestricted: true }), support_controller_1.SupportController.getMyTickets);
// Send message in ticket (restricted users allowed)
router.post('/:id/messages', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, { allowRestricted: true }), (0, validateRequest_1.default)(support_validation_1.SupportValidation.addMessageZodSchema), support_controller_1.SupportController.addMessage);
// Get single ticket (restricted users allowed)
router.get('/:id', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.PROMOTER, user_1.USER_ROLES.BUSINESS_OWNER, { allowRestricted: true }), support_controller_1.SupportController.getSupportById);
// Get all tickets
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), support_controller_1.SupportController.getAllSupports);
// Delete ticket
router.delete('/:id', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), support_controller_1.SupportController.deleteSupport);
exports.SupportRoutes = router;
//# sourceMappingURL=support.route.js.map