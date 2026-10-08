import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { BusinessLead } from './lead.model';
import { IBusinessLead, LeadStatus } from './lead.interface';
import QueryBuilder from '../../builder/QueryBuilder';
import { User } from '../user/user.model';
import { ACCOUNT_STATE, USER_ROLES } from '../../../enums/user';
import { emailHelper } from '../../../helpers/emailHelper';
import mongoose from 'mongoose';

const submitLead = async (
  promoterId: string,
  payload: Partial<IBusinessLead>,
) => {
  // Check if a User already exists with this phone or email
  const existingUser = await User.findOne({
    $or: [{ phone: payload.phone }, { email: payload.email }],
  });

  if (existingUser) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'A user with this phone or email is already registered on the platform.',
    );
  }

  // Check if a PENDING, IN_PROGRESS, or APPROVED lead exists
  const existingLead = await BusinessLead.findOne({
    $or: [{ phone: payload.phone }, { email: payload.email }],
    status: {
      $in: [LeadStatus.PENDING, LeadStatus.IN_PROGRESS, LeadStatus.APPROVED],
    },
  });

  if (existingLead) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'An active lead with this phone or email already exists.',
    );
  }

  // Create lead (AC-1, AC-4)
  const result = await BusinessLead.create({
    ...payload,
    promoterId,
  });

  return result;
};

const getAllLeads = async (query: Record<string, unknown>) => {
  const leadQuery = new QueryBuilder(
    BusinessLead.find().populate('promoterId', 'name email phone'),
    query,
  )
    .search(['businessName', 'ownerName', 'email', 'phone'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const { data, pagination } = await leadQuery.execute();

  return { meta: pagination, result: data };
};

const getMyLeads = async (
  promoterId: string,
  query: Record<string, unknown>,
) => {
  const leadQuery = new QueryBuilder(BusinessLead.find({ promoterId }), query)
    .search(['businessName', 'ownerName', 'email', 'phone'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const { data, pagination } = await leadQuery.execute();

  return { meta: pagination, result: data };
};

const getSingleLead = async (id: string, userRole: string, userId: string) => {
  const lead = await BusinessLead.findById(id).populate(
    'promoterId',
    'name email phone',
  );

  if (!lead) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Lead not found');
  }

  // If user is a promoter, they can only view their own leads
  if (userRole === 'PROMOTER' && lead.promoterId._id.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not authorized to view this lead',
    );
  }

  return lead;
};

const updateLeadStatus = async (
  id: string,
  payload: Partial<IBusinessLead>,
) => {
  const session = await mongoose.startSession();
  let result;

  try {
    session.startTransaction();

    const lead = await BusinessLead.findById(id)
      .populate('promoterId', 'name email')
      .session(session);

    if (!lead) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Lead not found');
    }

    if (lead.status === payload.status) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Lead is already ${payload.status}`,
      );
    }

    result = await BusinessLead.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
      session,
    });

    if (payload.status === LeadStatus.APPROVED) {
      // Create user account for the business owner
      const isExistUser = await User.findOne({ email: lead.email }).session(
        session,
      );

      if (!isExistUser) {
        const tempPassword = Math.random().toString(36).slice(-8);

        const createdUsers = await User.create(
          [
            {
              name: lead.ownerName,
              businessName: lead.businessName,
              email: lead.email,
              phone: lead.phone,
              role: USER_ROLES.BUSINESS_OWNER,
              accountState: ACCOUNT_STATE.VERIFIED,
              password: tempPassword,
              needsPasswordChange: true,
            },
          ],
          { session },
        );

        if (result && createdUsers.length > 0) {
          result.userId = createdUsers[0]._id;
          await result.save({ session });
        }

        // Email to business owner
        await emailHelper.sendEmail({
          to: lead.email,
          subject: 'Welcome to Elineuque - Account Created',
          html: `Hello ${lead.ownerName},<br><br>Your business account has been approved. Your temporary password is: <b>${tempPassword}</b><br>Please log in and change your password.`,
        });
      } else if (result) {
        result.userId = isExistUser._id;
        await result.save({ session });
      }

      // Notification to promoter
      await emailHelper.sendEmail({
        to: (lead.promoterId as any).email,
        subject: 'Lead Approved!',
        html: `Great news! Your lead for ${lead.businessName} has been approved.`,
      });
    } else if (payload.status === LeadStatus.REJECTED) {
      // Notification to promoter
      await emailHelper.sendEmail({
        to: (lead.promoterId as any).email,
        subject: 'Lead Update',
        html: `Your lead for ${lead.businessName} was rejected. Reason: ${payload.rejectReason || 'N/A'}`,
      });
    }

    await session.commitTransaction();
    await session.endSession();
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }

  return result;
};

export const LeadService = {
  submitLead,
  getAllLeads,
  getMyLeads,
  getSingleLead,
  updateLeadStatus,
};
