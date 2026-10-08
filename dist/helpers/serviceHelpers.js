"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOwnershipOrThrow = exports.ensureStatusOrThrow = exports.withTransaction = exports.getCount = exports.existsById = exports.restoreByIdOrThrow = exports.softDeleteByIdOrThrow = exports.deleteByIdOrThrow = exports.updateByIdOrThrow = exports.findByIdOrThrow = exports.notDeleted = exports.validateObjectIdOrThrow = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ApiError_1 = __importDefault(require("../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const validateObjectIdOrThrow = (id, field = 'id') => {
    const s = id?.toString?.() ?? String(id);
    if (!mongoose_1.Types.ObjectId.isValid(s)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid ${field}: ${s}`);
    }
};
exports.validateObjectIdOrThrow = validateObjectIdOrThrow;
// Helper to exclude soft deleted docs by default
const notDeleted = (extra = {}) => ({
    isDeleted: { $ne: true },
    ...extra,
});
exports.notDeleted = notDeleted;
/**
 * Generic function to find a document by ID with error handling
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param entityName - Name of the entity for error messages
 * @returns Found document
 * @throws ApiError if document not found
 */
const findByIdOrThrow = async (model, id, entityName = 'Resource', opts = {}) => {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findById(id, opts.projection);
    if (opts.session)
        q = q.session(opts.session);
    if (opts.lean)
        q = q.lean();
    const document = await q;
    if (!document) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return document;
};
exports.findByIdOrThrow = findByIdOrThrow;
/**
 * Generic function to update a document by ID with validation
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param updateData - Data to update
 * @param entityName - Name of the entity for error messages
 * @returns Updated document
 * @throws ApiError if document not found
 */
const updateByIdOrThrow = async (model, id, updateData, entityName = 'Resource', opts = {}) => {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });
    if (opts.session)
        q = q.session(opts.session);
    if (opts.projection)
        q = q.select(opts.projection);
    const updatedDocument = await q;
    if (!updatedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return updatedDocument;
};
exports.updateByIdOrThrow = updateByIdOrThrow;
/**
 * Generic function to delete a document by ID with validation
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param entityName - Name of the entity for error messages
 * @returns Deleted document
 * @throws ApiError if document not found
 */
const deleteByIdOrThrow = async (model, id, entityName = 'Resource') => {
    (0, exports.validateObjectIdOrThrow)(id);
    const deletedDocument = await model.findByIdAndDelete(id);
    if (!deletedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return deletedDocument;
};
exports.deleteByIdOrThrow = deleteByIdOrThrow;
/**
 * Generic function to soft delete a document (set isDeleted: true)
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @param entityName - Name of the entity for error messages
 * @returns Updated document
 * @throws ApiError if document not found
 */
const softDeleteByIdOrThrow = async (model, id, entityName = 'Resource', opts = {}) => {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }, { new: true, runValidators: true });
    if (opts.session)
        q = q.session(opts.session);
    if (opts.projection)
        q = q.select(opts.projection);
    const updatedDocument = await q;
    if (!updatedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return updatedDocument;
};
exports.softDeleteByIdOrThrow = softDeleteByIdOrThrow;
const restoreByIdOrThrow = async (model, id, entityName = 'Resource', opts = {}) => {
    (0, exports.validateObjectIdOrThrow)(id);
    let q = model.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null }, { new: true, runValidators: true });
    if (opts.session)
        q = q.session(opts.session);
    if (opts.projection)
        q = q.select(opts.projection);
    const updatedDocument = await q;
    if (!updatedDocument) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, `${entityName} not found (${String(id)})`);
    }
    return updatedDocument;
};
exports.restoreByIdOrThrow = restoreByIdOrThrow;
/**
 * Check if a document exists by ID
 * @param model - Mongoose model
 * @param id - Document ID (string or ObjectId)
 * @returns Boolean indicating existence
 */
const existsById = async (model, id) => {
    (0, exports.validateObjectIdOrThrow)(id);
    const res = await model.exists({ _id: id });
    return !!res;
};
exports.existsById = existsById;
/**
 * Get document count with optional filter
 * @param model - Mongoose model
 * @param filter - Optional filter conditions
 * @returns Document count
 */
const getCount = async (model, filter = {}) => {
    const isEmpty = Object.keys(filter).length === 0;
    if (isEmpty)
        return model.estimatedDocumentCount();
    return await model.countDocuments(filter);
};
exports.getCount = getCount;
/**
 * Run a set of operations inside a MongoDB transaction
 * @param fn - Callback that receives the session and returns a result
 * @returns Result of the callback after commit
 */
const withTransaction = async (fn, opts) => {
    const session = await mongoose_1.default.startSession();
    const readConcern = opts?.readConcern ?? { level: 'snapshot' };
    const writeConcern = opts?.writeConcern ?? { w: 'majority', j: true };
    const maxRetries = Math.max(0, opts?.maxRetries ?? 0);
    let attempt = 0;
    while (true) {
        try {
            await session.startTransaction({ readConcern, writeConcern });
            const result = await fn(session);
            await session.commitTransaction();
            return result;
        }
        catch (error) {
            await session.abortTransaction();
            const transient = !!error?.errorLabels?.includes?.('TransientTransactionError');
            if (transient && attempt < maxRetries) {
                attempt += 1;
                continue;
            }
            throw error;
        }
        finally {
            session.endSession();
        }
    }
};
exports.withTransaction = withTransaction;
/**
 * Ensure a document's status matches expected value(s), otherwise throw
 * @param currentStatus - The current status value
 * @param expected - A single expected status or a list of allowed statuses
 * @param options - Optional error customization
 */
const ensureStatusOrThrow = (currentStatus, expected, options) => {
    const ok = Array.isArray(expected)
        ? expected.includes(currentStatus)
        : currentStatus === expected;
    if (!ok) {
        const code = options?.code ?? http_status_codes_1.StatusCodes.BAD_REQUEST;
        const entity = options?.entityName ?? 'Resource';
        const message = options?.message ?? `${entity} has invalid status: ${String(currentStatus)}`;
        throw new ApiError_1.default(code, message);
    }
};
exports.ensureStatusOrThrow = ensureStatusOrThrow;
const toIdStr = (v) => (v ? v.toString() : '');
const ensureOwnershipOrThrow = (entity, ownerKey, userId, options) => {
    const keys = Array.isArray(ownerKey) ? ownerKey : [ownerKey];
    const userStr = userId.toString();
    const hasOwnership = keys.some((k) => {
        const value = k
            .split('.')
            .reduce((acc, part) => (acc ? acc[part] : undefined), entity);
        if (Array.isArray(value))
            return value.map(toIdStr).includes(userStr);
        return toIdStr(value) === userStr;
    });
    if (!hasOwnership) {
        const code = options?.code ?? http_status_codes_1.StatusCodes.FORBIDDEN;
        const message = options?.message ?? 'You are not authorized to perform this action';
        throw new ApiError_1.default(code, message);
    }
};
exports.ensureOwnershipOrThrow = ensureOwnershipOrThrow;
//# sourceMappingURL=serviceHelpers.js.map