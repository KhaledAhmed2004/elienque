"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const campaign_controller_1 = require("./campaign.controller");
const campaign_validation_1 = require("./campaign.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(campaign_validation_1.CampaignValidation.createCampaignZodSchema), campaign_controller_1.CampaignController.createCampaign);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.PROMOTER), campaign_controller_1.CampaignController.getActiveCampaigns);
router.put('/:id', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.BUSINESS_OWNER), (0, validateRequest_1.default)(campaign_validation_1.CampaignValidation.updateCampaignZodSchema), campaign_controller_1.CampaignController.updateCampaign);
router.post('/:id/activate', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.BUSINESS_OWNER), campaign_controller_1.CampaignController.activateCampaign);
router.post('/:id/join', (0, auth_1.default)(user_1.USER_ROLES.PROMOTER), campaign_controller_1.CampaignController.joinCampaign);
exports.CampaignRoutes = router;
//# sourceMappingURL=campaign.route.js.map