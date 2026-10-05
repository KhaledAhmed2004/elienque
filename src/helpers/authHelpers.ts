import { StatusCodes } from 'http-status-codes';
import { User } from '../app/modules/user/user.model';
import ApiError from '../errors/ApiError';
import generateOTP from '../util/generateOTP';
import { emailHelper } from './emailHelper';
import { emailTemplate } from '../shared/emailTemplate';

import { ACCOUNT_STATE } from '../enums/user';

const OTP_EXPIRY_MINUTES = 3;

/**
 * Generates OTP, saves to user record, and sends verification email
 * @param email - User's email address
 * @returns Object containing the generated OTP (for logging/debugging)
 * @throws ApiError if user doesn't exist or is already verified
 */
export const sendVerificationOTP = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (user.accountState === ACCOUNT_STATE.VERIFIED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'User is already verified!');
  }

  const otp = generateOTP();
  const authentication = {
    hashedOtp: String(otp),
    expireAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000),
    attempts: 0,
    resendTimestamps: [new Date()],
  };

  await User.findOneAndUpdate({ email }, { $set: { authentication } });

  const emailData = emailTemplate.createAccount({
    name: user.name,
    email: user.email,
    otp,
  });
  await emailHelper.sendEmail(emailData);

  return { otp };
};
