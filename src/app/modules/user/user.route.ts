import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';
import { fileHandler } from '../../middlewares/fileHandler';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';
import express from 'express';

const router = express.Router();

router.get(
  '/profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.getUserProfile,
);

router.patch(
  '/profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  fileHandler([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'drivingLicenseImage', maxCount: 1 },
    { name: 'hackLicenseImage', maxCount: 1 },
    { name: 'localPermitImage', maxCount: 1 },
  ]),
  validateRequest(UserValidation.updateUserZodSchema),
  UserController.updateProfile,
);

router.delete(
  '/delete-account',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  validateRequest(UserValidation.deleteUserZodSchema),
  UserController.deleteAccount,
);

router.get('/my-reviews', auth(USER_ROLES.USER), UserController.getMyReviews);

router.get(
  '/favorites',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.getFavoriteChauffeurs,
);

router.post(
  '/favorites/:chauffeurId',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.addFavoriteChauffeur,
);

router.delete(
  '/favorites/:chauffeurId',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.removeFavoriteChauffeur,
);

router.get(
  '/chauffeurs',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.searchChauffeurs,
);

router.get(
  '/stats',
  auth(USER_ROLES.ADMIN),
  UserController.getUserStats,
);

router.get('/', auth(USER_ROLES.ADMIN), UserController.getAllUserRoles);

router.patch(
  '/:userId/approve',
  auth(USER_ROLES.ADMIN),
  UserController.approveUser,
);

router.patch(
  '/:userId/reject',
  auth(USER_ROLES.ADMIN),
  validateRequest(UserValidation.rejectUserZodSchema),
  UserController.rejectUser,
);

router.patch(
  '/:userId/suspend',
  auth(USER_ROLES.ADMIN),
  validateRequest(UserValidation.suspendUserZodSchema),
  UserController.suspendUser,
);

router.patch(
  '/:userId/reactivate',
  auth(USER_ROLES.ADMIN),
  UserController.reactivateUser,
);

// Backward compatibility aliases
router.patch(
  '/:userId/block',
  auth(USER_ROLES.ADMIN),
  validateRequest(UserValidation.blockUserZodSchema),
  UserController.blockUser,
);

router.patch(
  '/:userId/unblock',
  auth(USER_ROLES.ADMIN),
  UserController.unblockUser,
);

router.get(
  '/:userId/reviews',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-reviews',
  }),
  UserController.getUserReviews,
);

router.get(
  '/:userId',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-details',
  }),
  UserController.getUserDetailsById,
);

router.delete(
  '/:userId',
  auth(USER_ROLES.ADMIN),
  UserController.deleteUserByAdmin,
);

export const UserRoutes = router;
