import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { PostService } from './post.service';

const createPost = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.createPost(req.user.id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Post created successfully',
    data: result,
  });
});

const getPosts = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.getPosts(req.user.id, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Posts retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const deletePost = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.deletePost(req.user.id, req.params.postId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Post deleted successfully',
    data: result,
  });
});

const likePost = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.likePost(req.user.id, req.params.postId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Post liked successfully',
    data: result,
  });
});

const unlikePost = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.unlikePost(req.user.id, req.params.postId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Post unliked successfully',
    data: result,
  });
});

const addComment = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.addComment(req.user.id, req.params.postId, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Comment added successfully',
    data: result,
  });
});

const getComments = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.getComments(req.params.postId, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Comments retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const result = await PostService.deleteComment(req.user.id, req.params.postId, req.params.commentId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Comment deleted successfully',
    data: result,
  });
});

export const PostController = {
  createPost,
  getPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  getComments,
  deleteComment,
};
