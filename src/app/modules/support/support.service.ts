import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Support } from './support.model';
import { ISupport } from './support.interface';
import QueryBuilder from '../../builder/QueryBuilder';

export const SupportService = {
  createSupport: async (
    userId: string,
    payload: { subject: string; message: string },
  ): Promise<ISupport> => {
    const result = await Support.create({
      subject: payload.subject,
      user: userId,
      messages: [{ sender: userId, message: payload.message }],
    });

    if (!result) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Failed to create support ticket',
      );
    }
    return result;
  },

  getAllSupports: async (query: Record<string, unknown>) => {
    const qb = new QueryBuilder(Support.find(), query)
      .search(['subject'])
      .filter()
      .sort()
      .paginate()
      .fields();

    const data = await qb.modelQuery
      .populate('user', 'name email')
      .populate('chat', '_id');
    const paginationInfo = await qb.getPaginationInfo();

    return { pagination: paginationInfo, data };
  },

  getMyTickets: async (
    userId: string,
    query: Record<string, unknown>,
  ) => {
    const qb = new QueryBuilder(Support.find({ user: userId }), query)
      .search(['subject'])
      .filter()
      .sort()
      .paginate()
      .fields();

    const data = await qb.modelQuery.populate('chat', '_id');
    const paginationInfo = await qb.getPaginationInfo();

    return { pagination: paginationInfo, data };
  },

  getSupportById: async (id: string) => {
    const result = await Support.findById(id)
      .populate('user', 'name email')
      .populate('messages.sender', 'name email')
      .populate('chat', '_id');

    if (!result) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Support ticket not found');
    }
    return result;
  },

  addMessage: async (
    ticketId: string,
    userId: string,
    message: string,
  ) => {
    const ticket = await Support.findById(ticketId);
    if (!ticket) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Support ticket not found');
    }

    ticket.messages.push({ sender: userId as any, message });
    await ticket.save();

    const result = await Support.findById(ticketId)
      .populate('user', 'name email')
      .populate('messages.sender', 'name email');

    return result;
  },

  deleteSupport: async (id: string) => {
    const result = await Support.findByIdAndDelete(id);
    if (!result) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Support ticket not found');
    }
    return { deleted: true };
  },
};
