"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const legal_controller_1 = require("./legal.controller");
const legal_validation_1 = require("./legal.validation");
const router = express_1.default.Router();
router.get('/', legal_controller_1.LegalController.getAll);
router.get('/:legalId', (0, validateRequest_1.default)(legal_validation_1.LegalValidation.getLegalPage), legal_controller_1.LegalController.getById);
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(legal_validation_1.LegalValidation.createLegalPage), legal_controller_1.LegalController.createLegalPage);
router.patch('/:legalId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(legal_validation_1.LegalValidation.updateLegalPage), legal_controller_1.LegalController.updateById);
router.delete('/:legalId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(legal_validation_1.LegalValidation.deleteLegalPage), legal_controller_1.LegalController.deleteById);
exports.LegalRoutes = router;
//# sourceMappingURL=legal.route.js.map