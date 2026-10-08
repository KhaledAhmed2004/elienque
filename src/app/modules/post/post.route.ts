import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { PostController } from './post.controller';
import { PostValidation } from './post.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  validateRequest(PostValidation.createPostSchema),
  PostController.createPost
);

router.get(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  PostController.getPosts
);

router.delete(
  '/:postId',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  PostController.deletePost
);

router.post(
  '/:postId/like',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  PostController.likePost
);

router.delete(
  '/:postId/like',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  PostController.unlikePost
);

router.post(
  '/:postId/comments',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  validateRequest(PostValidation.createCommentSchema),
  PostController.addComment
);

router.get(
  '/:postId/comments',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  PostController.getComments
);

router.delete(
  '/:postId/comments/:commentId',
  auth(USER_ROLES.ADMIN, USER_ROLES.PROMOTER, USER_ROLES.BUSINESS_OWNER, USER_ROLES.USER),
  PostController.deleteComment
);

export const PostRoutes = router;
