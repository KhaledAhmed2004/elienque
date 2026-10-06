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

export const LeadRoutes = router;
