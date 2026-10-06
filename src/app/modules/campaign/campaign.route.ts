import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { CampaignController } from './campaign.controller';
import { CampaignValidation } from './campaign.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.BUSINESS_OWNER),
  validateRequest(CampaignValidation.createCampaignZodSchema),
  CampaignController.createCampaign,
);

router.get(
  '/',
  auth(USER_ROLES.PROMOTER),
  CampaignController.getActiveCampaigns,
);

router.put(
  '/:id',
  auth(USER_ROLES.ADMIN, USER_ROLES.BUSINESS_OWNER),
  validateRequest(CampaignValidation.updateCampaignZodSchema),
  CampaignController.updateCampaign,
);

router.post(
  '/:id/activate',
  auth(USER_ROLES.ADMIN, USER_ROLES.BUSINESS_OWNER),
  CampaignController.activateCampaign,
);

router.post(
  '/:id/join',
  auth(USER_ROLES.PROMOTER),
  CampaignController.joinCampaign,
);

export const CampaignRoutes = router;
