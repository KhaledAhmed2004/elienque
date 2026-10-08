import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Post } from './post.model';
import { PostLike } from './postLike.model';
import { Comment } from './comment.model';
import { IPost, IComment } from './post.interface';

const createPost = async (userId: string, payload: Partial<IPost>) => {
  const post = await Post.create({
    author: userId,
    ...payload,
  });

  return post;
};

const getPosts = async (userId: string, query: Record<string, unknown>) => {
  const postQuery = new QueryBuilder(
    Post.find().populate('author', 'name email profile image'),
    query
  )
    .sort()
    .paginate();

  const posts = await postQuery.modelQuery;
  const meta = await postQuery.countTotal();

  // Find which posts the user liked
  const postIds = posts.map((post) => post._id);
  const userLikes = await PostLike.find({
    user: userId,
    post: { $in: postIds },
  });

  const likedPostIds = new Set(userLikes.map((like) => like.post.toString()));

  const postsWithLikeStatus = posts.map((post) => {
    const postObj = post.toObject();
    return {
      ...postObj,
      isLiked: likedPostIds.has(post._id.toString()),
    };
  });

  return { meta, data: postsWithLikeStatus };
};

const deletePost = async (userId: string, postId: string) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
  }

  // Only author can delete for now. Admins could be handled via role checks in controller.
  // Assuming basic auth check here
  if (post.author.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not authorized to delete this post');
  }

  await Post.findByIdAndDelete(postId);
  await PostLike.deleteMany({ post: postId });
  await Comment.deleteMany({ post: postId });

  return post;
};

const likePost = async (userId: string, postId: string) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
  }

  const existingLike = await PostLike.findOne({ user: userId, post: postId });
  if (existingLike) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You already liked this post');
  }

  const like = await PostLike.create({ user: userId, post: postId });
  
  await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });

  return like;
};

const unlikePost = async (userId: string, postId: string) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
  }

  const existingLike = await PostLike.findOneAndDelete({ user: userId, post: postId });
  if (!existingLike) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You have not liked this post');
  }

  await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });

  return null;
};

const addComment = async (userId: string, postId: string, payload: Partial<IComment>) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
  }

  const comment = await Comment.create({
    post: postId,
    author: userId,
    content: payload.content,
  });

  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

  return comment;
};

const getComments = async (postId: string, query: Record<string, unknown>) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Post not found');
  }

  const commentQuery = new QueryBuilder(
    Comment.find({ post: postId }).populate('author', 'name email profile image'),
    query
  )
    .sort()
    .paginate();

  const comments = await commentQuery.modelQuery;
  const meta = await commentQuery.countTotal();

  return { meta, data: comments };
};

const deleteComment = async (userId: string, postId: string, commentId: string) => {
  const comment = await Comment.findOne({ _id: commentId, post: postId });
  if (!comment) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found');
  }

  if (comment.author.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not authorized to delete this comment');
  }

  await Comment.findByIdAndDelete(commentId);
  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });

  return comment;
};

export const PostService = {
  createPost,
  getPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  getComments,
  deleteComment,
};
