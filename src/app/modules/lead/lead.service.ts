import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { BusinessLead } from './lead.model';
import { IBusinessLead } from './lead.interface';

const submitLead = async (
  promoterId: string,
  payload: Partial<IBusinessLead>,
) => {
  // Enforce unique phone and email (AC-2)
  const existingLead = await BusinessLead.findOne({
    $or: [{ phone: payload.phone }, { email: payload.email }],
  });

  if (existingLead) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'A lead with this phone or email already exists.',
    );
  }

  // Create lead (AC-1, AC-4)
  const result = await BusinessLead.create({
    ...payload,
    promoterId,
  });

  return result;
};

export const LeadService = {
  submitLead,
};
