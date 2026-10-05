import bcrypt from 'bcrypt';
import { model, Schema } from 'mongoose';
import config from '../../../config';
import {
  ACCOUNT_STATE,
  APP_STATE,
  CARD_PAYMENT_STATUS,
  COMPANY_ROLE,
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
    nickname: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
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
    phone: {
      type: String,
      required: function (this: IUser) {
        return this.role !== USER_ROLES.ADMIN;
      },
      trim: true,
      unique: true,
      sparse: true,
    },
    serviceAreaId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceArea',
    },
    serviceArea: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    companyRole: {
      type: String,
      enum: Object.values(COMPANY_ROLE),
      required: function (this: IUser) {
        return this.role !== USER_ROLES.ADMIN;
      },
    },
    profilePicture: {
      type: String,
      default: 'https://i.ibb.co/z5YHLV9/profile.png',
    },
    drivingLicense: {
      image: { type: String },
      expiryDate: { type: Date },
    },
    hackLicense: {
      image: { type: String },
      expiryDate: { type: Date },
    },
    localPermit: {
      image: { type: String },
      expiryDate: { type: Date },
    },
    accountState: {
      type: String,
      enum: Object.values(ACCOUNT_STATE),
      default: ACCOUNT_STATE.UNVERIFIED,
    },
    appState: {
      type: String,
      enum: Object.values(APP_STATE),
      default: null,
    },
    isOnboard: {
      type: Boolean,
      default: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    suspensionOrigin: {
      type: String,
      enum: Object.values(ACCOUNT_STATE),
      default: null,
    },
    deviceTokens: {
      type: [String],
      default: [],
    },
    selectedVehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    favoriteChauffeurs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    badges: {
      type: [String],
      default: [],
    },
    paymentMethods: {
      type: {
        zelle: {
          email: { type: String, trim: true },
        },
        venmo: {
          username: { type: String, trim: true },
        },
        cashApp: {
          cashtag: { type: String, trim: true },
        },
        cardPayment: {
          status: {
            type: String,
            enum: Object.values(CARD_PAYMENT_STATUS),
            default: CARD_PAYMENT_STATUS.NOT_ACCEPTED,
          },
        },
      },
      _id: false,
      default: {},
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

  //password hash
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds)
    );
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
userSchema.index({ accountState: 1, appState: 1 });
userSchema.index({ lockUntil: 1 });
userSchema.index({ serviceAreaId: 1 });
userSchema.index({ name: 'text', nickname: 'text', phone: 'text' });

export const User = model<IUser, UserModal>('User', userSchema);
