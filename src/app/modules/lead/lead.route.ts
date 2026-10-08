import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { LeadController } from './lead.controller';
import { LeadValidation } from './lead.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.PROMOTER),
  validateRequest(LeadValidation.createLeadZodSchema),
  LeadController.submitLead,
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN),
  LeadController.getAllLeads,
);

router.get(
  '/my-leads',
  auth(USER_ROLES.PROMOTER),
  LeadController.getMyLeads,
);

router.get(
  '/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER),
  LeadController.getSingleLead,
);

router.patch(
  '/:id/status',
  auth(USER_ROLES.ADMIN),
  validateRequest(LeadValidation.updateLeadStatusZodSchema),
  LeadController.updateLeadStatus,
);

export const LeadRoutes = router;
