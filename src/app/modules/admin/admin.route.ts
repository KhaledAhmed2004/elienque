import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import { AdminController } from './admin.controller';
import { AdminValidation } from './admin.validation';

const router = express.Router();

router.get('/stats', auth(USER_ROLES.ADMIN), AdminController.getDashboardStats);

router.get(
  '/monthly-trends',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.monthlyTrendsQuerySchema),
  AdminController.getMonthlyTrends,
);

router.get(
  '/recent-activities',
  auth(USER_ROLES.ADMIN),
  validateRequest(AdminValidation.recentActivitiesQuerySchema),
  AdminController.getRecentActivities,
);

export const AdminRoutes = router;
