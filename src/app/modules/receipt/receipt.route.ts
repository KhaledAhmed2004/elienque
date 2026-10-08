import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ReceiptController } from './receipt.controller';
import { ReceiptValidation } from './receipt.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.PROMOTER),
  validateRequest(ReceiptValidation.createReceiptZodSchema),
  ReceiptController.uploadReceipt,
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER),
  ReceiptController.getReceipts,
);

router.patch(
  '/:id/approve',
  auth(USER_ROLES.ADMIN, USER_ROLES.BUSINESS_OWNER),
  validateRequest(ReceiptValidation.approveReceiptZodSchema),
  ReceiptController.approveReceipt,
);

router.patch(
  '/:id/reject',
  auth(USER_ROLES.ADMIN, USER_ROLES.BUSINESS_OWNER),
  validateRequest(ReceiptValidation.rejectReceiptZodSchema),
  ReceiptController.rejectReceipt,
);

export const ReceiptRoutes = router;
