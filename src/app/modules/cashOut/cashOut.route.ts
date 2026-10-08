import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { CashOutController } from './cashOut.controller';
import { CashOutValidation } from './cashOut.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.PROMOTER),
  validateRequest(CashOutValidation.requestCashOutZodSchema),
  CashOutController.requestCashOut,
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER),
  CashOutController.getCashOuts,
);

router.patch(
  '/:id/approve',
  auth(USER_ROLES.ADMIN),
  validateRequest(CashOutValidation.approveCashOutZodSchema),
  CashOutController.approveCashOut,
);

router.patch(
  '/:id/reject',
  auth(USER_ROLES.ADMIN),
  validateRequest(CashOutValidation.rejectCashOutZodSchema),
  CashOutController.rejectCashOut,
);

export const CashOutRoutes = router;
