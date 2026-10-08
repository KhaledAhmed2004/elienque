import { Schema, model } from 'mongoose';
import { IPostLike } from './post.interface';

const PostLikeSchema = new Schema<IPostLike>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only like a post once
PostLikeSchema.index({ post: 1, user: 1 }, { unique: true });

export const PostLike = model<IPostLike>('PostLike', PostLikeSchema);
