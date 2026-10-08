"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const lead_controller_1 = require("./lead.controller");
const lead_validation_1 = require("./lead.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.PROMOTER), (0, validateRequest_1.default)(lead_validation_1.LeadValidation.createLeadZodSchema), lead_controller_1.LeadController.submitLead);
exports.LeadRoutes = router;
//# sourceMappingURL=lead.route.js.map