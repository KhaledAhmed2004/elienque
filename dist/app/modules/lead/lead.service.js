"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const lead_model_1 = require("./lead.model");
const lead_interface_1 = require("./lead.interface");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const user_model_1 = require("../user/user.model");
const user_1 = require("../../../enums/user");
const emailHelper_1 = require("../../../helpers/emailHelper");
const mongoose_1 = __importDefault(require("mongoose"));
const submitLead = async (promoterId, payload) => {
    // Check if a User already exists with this phone or email
    const existingUser = await user_model_1.User.findOne({
        $or: [{ phone: payload.phone }, { email: payload.email }],
    });
    if (existingUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'A user with this phone or email is already registered on the platform.');
    }
    // Check if a PENDING, IN_PROGRESS, or APPROVED lead exists
    const existingLead = await lead_model_1.BusinessLead.findOne({
        $or: [{ phone: payload.phone }, { email: payload.email }],
        status: {
            $in: [lead_interface_1.LeadStatus.PENDING, lead_interface_1.LeadStatus.IN_PROGRESS, lead_interface_1.LeadStatus.APPROVED],
        },
    });
    if (existingLead) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'An active lead with this phone or email already exists.');
    }
    // Create lead (AC-1, AC-4)
    const result = await lead_model_1.BusinessLead.create({
        ...payload,
        promoterId,
    });
    return result;
};
const getAllLeads = async (query) => {
    const leadQuery = new QueryBuilder_1.default(lead_model_1.BusinessLead.find().populate('promoterId', 'name email phone'), query)
        .search(['businessName', 'ownerName', 'email', 'phone'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const { data, pagination } = await leadQuery.execute();
    return { meta: pagination, result: data };
};
const getMyLeads = async (promoterId, query) => {
    const leadQuery = new QueryBuilder_1.default(lead_model_1.BusinessLead.find({ promoterId }), query)
        .search(['businessName', 'ownerName', 'email', 'phone'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const { data, pagination } = await leadQuery.execute();
    return { meta: pagination, result: data };
};
const getSingleLead = async (id, userRole, userId) => {
    const lead = await lead_model_1.BusinessLead.findById(id).populate('promoterId', 'name email phone');
    if (!lead) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Lead not found');
    }
    // If user is a promoter, they can only view their own leads
    if (userRole === 'PROMOTER' && lead.promoterId._id.toString() !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not authorized to view this lead');
    }
    return lead;
};
const updateLeadStatus = async (id, payload) => {
    const session = await mongoose_1.default.startSession();
    let result;
    try {
        session.startTransaction();
        const lead = await lead_model_1.BusinessLead.findById(id)
            .populate('promoterId', 'name email')
            .session(session);
        if (!lead) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Lead not found');
        }
        if (lead.status === payload.status) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Lead is already ${payload.status}`);
        }
        result = await lead_model_1.BusinessLead.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
            session,
        });
        if (payload.status === lead_interface_1.LeadStatus.APPROVED) {
            // Create user account for the business owner
            const isExistUser = await user_model_1.User.findOne({ email: lead.email }).session(session);
            if (!isExistUser) {
                const tempPassword = Math.random().toString(36).slice(-8);
                const createdUsers = await user_model_1.User.create([
                    {
                        name: lead.ownerName,
                        businessName: lead.businessName,
                        email: lead.email,
                        phone: lead.phone,
                        role: user_1.USER_ROLES.BUSINESS_OWNER,
                        accountState: user_1.ACCOUNT_STATE.VERIFIED,
                        password: tempPassword,
                        needsPasswordChange: true,
                    },
                ], { session });
                if (result && createdUsers.length > 0) {
                    result.userId = createdUsers[0]._id;
                    await result.save({ session });
                }
                // Email to business owner
                await emailHelper_1.emailHelper.sendEmail({
                    to: lead.email,
                    subject: 'Welcome to Elineuque - Account Created',
                    html: `Hello ${lead.ownerName},<br><br>Your business account has been approved. Your temporary password is: <b>${tempPassword}</b><br>Please log in and change your password.`,
                });
            }
            else if (result) {
                result.userId = isExistUser._id;
                await result.save({ session });
            }
            // Notification to promoter
            await emailHelper_1.emailHelper.sendEmail({
                to: lead.promoterId.email,
                subject: 'Lead Approved!',
                html: `Great news! Your lead for ${lead.businessName} has been approved.`,
            });
        }
        else if (payload.status === lead_interface_1.LeadStatus.REJECTED) {
            // Notification to promoter
            await emailHelper_1.emailHelper.sendEmail({
                to: lead.promoterId.email,
                subject: 'Lead Update',
                html: `Your lead for ${lead.businessName} was rejected. Reason: ${payload.rejectReason || 'N/A'}`,
            });
        }
        await session.commitTransaction();
        await session.endSession();
    }
    catch (error) {
        await session.abortTransaction();
        await session.endSession();
        throw error;
    }
    return result;
};
exports.LeadService = {
    submitLead,
    getAllLeads,
    getMyLeads,
    getSingleLead,
    updateLeadStatus,
};
//# sourceMappingURL=lead.service.js.map