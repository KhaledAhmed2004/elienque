import bcrypt from 'bcrypt';
import { model, Schema } from 'mongoose';
import config from '../../../config';
import {
  ACCOUNT_STATE,
  APP_STATE,
  CARD_PAYMENT_STATUS,
  USER_ROLES,
} from '../../../enums/user';
import { IUser, UserModal } from './user.interface';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.PROMOTER,
    },
    businessName: {
      type: String,
      required: function (this: IUser) {
        return this.role === USER_ROLES.BUSINESS_OWNER;
      },
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    needsPasswordChange: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      required: function (this: IUser) {
        return this.role !== USER_ROLES.ADMIN;
      },
      trim: true,
      unique: true,
      sparse: true,
    },
    profilePicture: {
      type: String,
      default: 'https://i.ibb.co/z5YHLV9/profile.png',
    },
    accountState: {
      type: String,
      enum: Object.values(ACCOUNT_STATE),
      default: ACCOUNT_STATE.UNVERIFIED,
    },
    deviceTokens: {
      type: [String],
      default: [],
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    blockReason: {
      type: String,
      default: null,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reactivatedAt: {
      type: Date,
      default: null,
    },
    reactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rewardBalance: {
      type: Number,
      default: 0,
    },
    authentication: {
      type: {
        hashedOtp: {
          type: String,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
        attempts: {
          type: Number,
          default: 0,
        },
        resendTimestamps: {
          type: [Date],
          default: [],
        },
        purpose: {
          type: String,
          default: null,
        },
      },
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        delete (ret as any).password;
        delete (ret as any).authentication;
        delete (ret as any).deviceTokens;
        delete (ret as any).loginAttempts;
        delete (ret as any).lockUntil;
        delete (ret as any).uploadedHeadshot;
        (ret as any).id = ret._id;
        delete (ret as any)._id;
      },
    },
  },
);

//exist user check
userSchema.statics.isExistUserById = async (id: string) => {
  const isExist = await User.findById(id);
  return isExist;
};

userSchema.statics.isExistUserByEmail = async (email: string) => {
  const isExist = await User.findOne({ email }).select('+password');
  return isExist;
};

//is match password
userSchema.statics.isMatchPassword = async (
  password: string,
  hashPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashPassword);
};

//check user
userSchema.pre('save', async function (next) {

  if (this.isModified('password') && this.get('password')) {
    const hash = await bcrypt.hash(
      this.get('password') as string,
      Number(config.bcrypt_salt_rounds)
    );
    this.set('password', hash);
  }
  next();
});

// add device token
userSchema.statics.addDeviceToken = async (userId: string, token: string) => {
  return await User.findByIdAndUpdate(
    userId,
    { $addToSet: { deviceTokens: token } },
    { new: true }
  );
};

// remove device token
userSchema.statics.removeDeviceToken = async (
  userId: string,
  token: string
) => {
  return await User.findByIdAndUpdate(
    userId,
    { $pull: { deviceTokens: token } },
    { new: true }
  );
};

// Create indexes
userSchema.index({ role: 1, accountState: 1, _id: -1 });
userSchema.index({ accountState: 1 });
userSchema.index({ lockUntil: 1 });
userSchema.index({ name: 'text', nickname: 'text', phone: 'text' });

export const User = model<IUser, UserModal>('User', userSchema);
