import { model, Schema } from 'mongoose';
import { IResetToken, ResetTokenModel } from './resetToken.interface';

const resetTokenSchema = new Schema<IResetToken, ResetTokenModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    token: {
      type: String,
      required: true,
    },
    expireAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index to automatically purge expired tokens from MongoDB
resetTokenSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// token check
resetTokenSchema.statics.isExistToken = async function (
  this: ResetTokenModel,
  token: string
): Promise<IResetToken | null> {
  return await this.findOne({ token });
};

// token validity check
resetTokenSchema.statics.isExpireToken = async function (
  this: ResetTokenModel,
  token: string
): Promise<boolean> {
  const currentDate = new Date();
  const resetToken = await this.findOne({
    token,
    expireAt: { $gt: currentDate },
  });
  return !!resetToken;
};

export const ResetToken = model<IResetToken, ResetTokenModel>('Token', resetTokenSchema);
