import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { DraftController } from './draft.controller';
import { DraftValidation } from './draft.validation';

const ownerRoutes = express.Router();

ownerRoutes.get('/', auth(USER_ROLES.BUSINESS_OWNER), DraftController.getMyDrafts);
ownerRoutes.patch('/:id/approve', auth(USER_ROLES.BUSINESS_OWNER), DraftController.approveDraft);
ownerRoutes.patch('/:id/reject', auth(USER_ROLES.BUSINESS_OWNER), validateRequest(DraftValidation.rejectDraftZodSchema), DraftController.rejectDraft);

const adminRoutes = express.Router();

adminRoutes.post('/', auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), validateRequest(DraftValidation.createDraftZodSchema), DraftController.createDraft);
adminRoutes.patch('/:id', auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), validateRequest(DraftValidation.updateDraftZodSchema), DraftController.updateDraft);
adminRoutes.delete('/:id', auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), DraftController.withdrawDraft);

export const DraftRoutes = {
  ownerRoutes,
  adminRoutes,
};
