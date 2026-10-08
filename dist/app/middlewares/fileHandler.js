"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.fileHandler = exports.s3 = void 0;
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const sharp_1 = __importDefault(require("sharp"));
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../errors/ApiError"));
const client_s3_1 = require("@aws-sdk/client-s3");
const cloudinary_1 = __importDefault(require("cloudinary"));
const config_1 = __importDefault(require("../../config"));
// ===============================
// Configuration & Policies
// ===============================
const allowedTypes = {
    images: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    media: [
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
        'audio/webm',
        'audio/mp4',
    ],
    documents: ['application/pdf'],
};
// Default file size limits per category (in MB)
const CATEGORY_SIZE_LIMITS = {
    images: 10,
    documents: 25,
    media: 50,
};
// Allowed extensions per folder
const ALLOWED_EXTENSIONS = {
    images: ['.jpg', '.jpeg', '.png', '.webp'],
    documents: ['.pdf'],
    media: ['.mp4', '.webm', '.mp3', '.ogg', '.wav'],
};
// ===============================
// Cloud & Local Storage Providers
// ===============================
exports.s3 = new client_s3_1.S3Client({
    region: config_1.default.r2?.accountId ? 'auto' : process.env.AWS_REGION || 'us-east-1',
    endpoint: config_1.default.r2?.s3ApiUrl
        ? config_1.default.r2.s3ApiUrl
        : config_1.default.r2?.accountId
            ? `https://${config_1.default.r2.accountId}.r2.cloudflarestorage.com`
            : undefined,
    credentials: {
        accessKeyId: config_1.default.r2?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: config_1.default.r2?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const S3Provider = {
    upload: async (buffer, storageKey, _folder, mimeType) => {
        const bucket = config_1.default.r2?.bucketName || process.env.AWS_S3_BUCKET || '';
        if (!bucket) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'AWS S3 / Cloudflare R2 Bucket configuration is missing');
        }
        // Private bucket upload without public-read ACL
        await exports.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: buffer,
            ContentType: mimeType,
        }));
        if (config_1.default.r2?.customDomain) {
            return `${config_1.default.r2.customDomain.replace(/\/$/, '')}/${storageKey}`;
        }
        if (config_1.default.r2?.accountId) {
            return `https://${config_1.default.r2.accountId}.r2.cloudflarestorage.com/${bucket}/${storageKey}`;
        }
        const region = process.env.AWS_REGION || 'us-east-1';
        return `https://${bucket}.s3.${region}.amazonaws.com/${storageKey}`;
    },
    delete: async (storageKey) => {
        const bucketName = config_1.default.r2?.bucketName || process.env.AWS_S3_BUCKET || '';
        if (!bucketName)
            return;
        await exports.s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: bucketName, Key: storageKey }));
    },
};
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
});
const CloudinaryProvider = {
    upload: async (buffer, storageKey, folder, _mimeType) => {
        const publicId = storageKey.replace(/\.[^/.]+$/, '');
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.v2.uploader.upload_stream({
                folder,
                resource_type: 'auto',
                public_id: path_1.default.basename(publicId),
            }, (err, res) => {
                if (err || !res)
                    reject(err || new Error('Upload failed'));
                else
                    resolve(res);
            });
            uploadStream.end(buffer);
        });
        return result.secure_url;
    },
    delete: async (storageKey) => {
        const publicId = storageKey.replace(/\.[^/.]+$/, '');
        await cloudinary_1.default.v2.uploader.destroy(publicId, {
            resource_type: 'auto',
        });
    },
};
const LocalProvider = {
    upload: async (buffer, storageKey, _folder, _mimeType) => {
        const filePath = path_1.default.join(process.cwd(), 'uploads', storageKey);
        await ensureDirAsync(path_1.default.dirname(filePath));
        await fs_1.default.promises.writeFile(filePath, buffer);
        return `/uploads/${storageKey}`;
    },
    delete: async (storageKey) => {
        const filePath = path_1.default.join(process.cwd(), 'uploads', storageKey);
        try {
            await fs_1.default.promises.unlink(filePath);
        }
        catch {
            // Silently ignore if already deleted
        }
    },
};
const STORAGE_PROVIDERS = {
    s3: S3Provider,
    cloudinary: CloudinaryProvider,
    local: LocalProvider,
};
// ===============================
// Helpers & Security Validators
// ===============================
const ensureDirAsync = async (dir) => {
    await fs_1.default.promises.mkdir(dir, { recursive: true });
};
const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0)
        return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${sizes[i]}`;
};
const parseJsonData = (body) => {
    if (body &&
        typeof body === 'object' &&
        'data' in body &&
        typeof body.data === 'string') {
        try {
            return JSON.parse(body.data);
        }
        catch {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid JSON format in "data" field');
        }
    }
    return body || {};
};
const getFolderByMime = (mime) => {
    if (mime.startsWith('image/'))
        return 'images';
    if (mime.startsWith('video/') || mime.startsWith('audio/'))
        return 'media';
    if (mime === 'application/pdf')
        return 'documents';
    throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Unsupported file type '${mime}'`);
};
// Cryptographically secure, path-traversal immune server-generated storage key
const generateStorageKey = (folder, ext) => {
    const normalizedExt = ext.startsWith('.')
        ? ext.toLowerCase()
        : `.${ext.toLowerCase()}`;
    const uniqueId = crypto_1.default.randomUUID();
    return `${folder}/${uniqueId}${normalizedExt}`;
};
/**
 * Multi-layer Content Signature (Magic Byte) Inspection
 * Verifies container headers against the declared MIME type
 */
const verifyMagicBytes = (buffer, mime) => {
    if (buffer.length < 4)
        return false;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (mime === 'image/png') {
        return (buffer.length >= 8 &&
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47 &&
            buffer[4] === 0x0d &&
            buffer[5] === 0x0a &&
            buffer[6] === 0x1a &&
            buffer[7] === 0x0a);
    }
    // JPEG: FF D8 FF
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
    if (mime === 'image/webp') {
        if (buffer.length < 12)
            return false;
        const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
        const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
        return isRiff && isWebp;
    }
    // PDF: %PDF- (25 50 44 46)
    if (mime === 'application/pdf') {
        return buffer.toString('ascii', 0, 5).startsWith('%PDF-');
    }
    // MP4 / M4A: ftyp at bytes 4..8
    if (mime === 'video/mp4' || mime === 'audio/mp4') {
        if (buffer.length < 8)
            return false;
        return buffer.toString('ascii', 4, 8) === 'ftyp';
    }
    // WebM / EBML: 1A 45 DF A3
    if (mime === 'video/webm' || mime === 'audio/webm') {
        return (buffer[0] === 0x1a &&
            buffer[1] === 0x45 &&
            buffer[2] === 0xdf &&
            buffer[3] === 0xa3);
    }
    // MP3: ID3 header or sync frame (FF FB / FF FA / FF F3 / FF F2)
    if (mime === 'audio/mpeg') {
        const isId3 = buffer.toString('ascii', 0, 3) === 'ID3';
        const isSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
        return isId3 || isSync;
    }
    // WAV: RIFF (0..4) + WAVE (8..12)
    if (mime === 'audio/wav') {
        if (buffer.length < 12)
            return false;
        return (buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WAVE');
    }
    // OGG: OggS (4F 67 67 53)
    if (mime === 'audio/ogg') {
        return buffer.toString('ascii', 0, 4) === 'OggS';
    }
    return false;
};
// ===============================
// Multer Storage & Filtering
// ===============================
const createStorage = (mode) => {
    if (mode === 'memory')
        return multer_1.default.memoryStorage();
    const baseUploadDir = path_1.default.join(process.cwd(), 'uploads');
    // Initialize directories asynchronously in background
    ensureDirAsync(path_1.default.join(baseUploadDir, 'images')).catch(() => { });
    ensureDirAsync(path_1.default.join(baseUploadDir, 'media')).catch(() => { });
    ensureDirAsync(path_1.default.join(baseUploadDir, 'documents')).catch(() => { });
    return multer_1.default.diskStorage({
        destination: (_req, file, cb) => {
            const canonicalFolder = getFolderByMime(file.mimetype);
            const folderPath = path_1.default.join(baseUploadDir, canonicalFolder);
            cb(null, folderPath);
        },
        filename: (_req, file, cb) => {
            // Server-generated random filename prevents path traversal
            const ext = path_1.default.extname(file.originalname).toLowerCase();
            cb(null, `${crypto_1.default.randomUUID()}${ext}`);
        },
    });
};
const fileFilter = (_req, file, cb) => {
    let folder;
    try {
        folder = getFolderByMime(file.mimetype);
    }
    catch (e) {
        const msg = e.message || 'Unsupported file type';
        return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, msg));
    }
    // 1. MIME Validation
    if (!allowedTypes[folder]?.includes(file.mimetype)) {
        return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid MIME type '${file.mimetype}'. Allowed for ${folder}: ${allowedTypes[folder]?.join(', ') || 'none'}`));
    }
    // 2. Extension Sanity Validation
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS[folder]?.includes(ext)) {
        return cb(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid file extension '${ext}'. Allowed for ${folder}: ${ALLOWED_EXTENSIONS[folder].join(', ')}`));
    }
    cb(null, true);
};
// ===============================
// Format-Specific Processing Pipeline
// ===============================
const processFileContent = async (file, storageMode, maxWidth = 800) => {
    let rawBuffer;
    if (storageMode === 'memory') {
        rawBuffer = file.buffer;
    }
    else {
        rawBuffer = await fs_1.default.promises.readFile(file.path);
    }
    // 1. Multi-layer Magic-Byte Validation
    const isValidSignature = verifyMagicBytes(rawBuffer, file.mimetype);
    if (!isValidSignature) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `File content does not match declared format '${file.mimetype}' (Signature verification failed)`);
    }
    // 2. Format-Specific Handling: Sharp is STRICTLY for Images
    const isImage = file.mimetype.startsWith('image/');
    if (isImage) {
        let sharpInstance = (0, sharp_1.default)(rawBuffer).resize({
            width: maxWidth,
            withoutEnlargement: true,
        });
        let targetMime = file.mimetype;
        if (file.mimetype === 'image/png') {
            sharpInstance = sharpInstance.png({ compressionLevel: 8, palette: true });
        }
        else if (file.mimetype === 'image/webp') {
            sharpInstance = sharpInstance.webp({ quality: 80 });
        }
        else {
            sharpInstance = sharpInstance.jpeg({ quality: 80 });
            targetMime = 'image/jpeg';
        }
        const optimizedBuffer = await sharpInstance.toBuffer();
        if (storageMode === 'local' && file.path) {
            await fs_1.default.promises.writeFile(file.path, optimizedBuffer);
        }
        return { buffer: optimizedBuffer, mimeType: targetMime };
    }
    // 3. Documents (PDF) & Media: Direct clean passthrough
    return { buffer: rawBuffer, mimeType: file.mimetype };
};
// ===============================
// Field Policy & Normalization
// ===============================
const groupFilesByField = (files) => {
    const byField = {};
    if (Array.isArray(files)) {
        for (const f of files) {
            byField[f.fieldname] = byField[f.fieldname] || [];
            byField[f.fieldname].push(f);
        }
    }
    else {
        Object.assign(byField, files);
    }
    return byField;
};
const enforceFieldPolicy = (filesByField, opts) => {
    if (!opts.enforceAllowedFields || opts.enforceAllowedFields.length === 0)
        return;
    const allowed = new Set(opts.enforceAllowedFields);
    for (const fieldName of Object.keys(filesByField)) {
        let isAllowed = false;
        if (allowed.has(fieldName)) {
            isAllowed = true;
        }
        else {
            for (const baseField of opts.enforceAllowedFields) {
                if (fieldName.startsWith(`${baseField}[`) ||
                    fieldName.endsWith(`.${baseField}`)) {
                    isAllowed = true;
                    break;
                }
            }
        }
        if (!isAllowed) {
            const expected = opts.enforceAllowedFields.length === 1
                ? `'${opts.enforceAllowedFields[0]}'`
                : `'${opts.enforceAllowedFields.join("', '")}'`;
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Expected field name ${expected} but got '${fieldName}'`);
        }
        let baseField = fieldName;
        if (fieldName.includes('[')) {
            baseField = fieldName.split('[')[0];
        }
        else if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            baseField = parts[parts.length - 1];
        }
        const maxCount = opts.perFieldMaxCount?.[baseField] ?? 1;
        if (filesByField[fieldName].length > maxCount) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Too many files for field '${fieldName}'. Max ${maxCount}.`);
        }
    }
};
const normalizeOptions = (options) => {
    const arrayToOptions = (arr) => {
        const enforceAllowedFields = [];
        const perFieldMaxCount = {};
        let maxFilesTotal = 0;
        for (const entry of arr) {
            if (typeof entry === 'string') {
                enforceAllowedFields.push(entry);
                perFieldMaxCount[entry] = perFieldMaxCount[entry] ?? 1;
                maxFilesTotal += 1;
            }
            else if (entry && typeof entry.name === 'string') {
                enforceAllowedFields.push(entry.name);
                perFieldMaxCount[entry.name] = entry.maxCount ?? 1;
                maxFilesTotal += entry.maxCount ?? 1;
            }
        }
        return { enforceAllowedFields, perFieldMaxCount, maxFilesTotal };
    };
    const base = Array.isArray(options)
        ? arrayToOptions(options)
        : options || {};
    const storageMode = base.storageMode ||
        (process.env.UPLOAD_MODE === 'memory' ? 'memory' : 'local');
    const cloudProvider = base.cloudProvider ||
        process.env.CLOUD_PROVIDER ||
        's3';
    const maxFileSizeMB = base.maxFileSizeMB || CATEGORY_SIZE_LIMITS.documents;
    const maxFilesTotal = base.maxFilesTotal ?? 10;
    const imageMaxWidth = base.imageMaxWidth ?? 800;
    return {
        ...base,
        storageMode,
        cloudProvider,
        maxFileSizeMB,
        maxFilesTotal,
        imageMaxWidth,
    };
};
// ===============================
// Core Middleware
// ===============================
const fileHandler = (options) => {
    const resolved = normalizeOptions(options);
    const providerKey = resolved.storageMode === 'local' ? 'local' : resolved.cloudProvider;
    const provider = STORAGE_PROVIDERS[providerKey];
    const upload = (0, multer_1.default)({
        storage: createStorage(resolved.storageMode),
        fileFilter,
        limits: {
            fileSize: resolved.maxFileSizeMB * 1024 * 1024,
            files: resolved.maxFilesTotal,
        },
    }).any();
    return async (req, res, next) => {
        upload(req, res, async (err) => {
            if (err) {
                if (err instanceof multer_1.default.MulterError) {
                    const msg = mapMulterError(err, {
                        maxFileSizeMB: resolved.maxFileSizeMB,
                        maxFilesTotal: resolved.maxFilesTotal,
                    });
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, msg));
                }
                return next(err);
            }
            // Track staged files for rollback in case of downstream processing errors
            const stagedStorageKeys = [];
            try {
                const proto = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.get('host');
                const effectiveBaseUrl = resolved.baseUrl || process.env.BASE_URL || `${proto}://${host}`;
                req.body = parseJsonData(req.body);
                let filesByField = {};
                if (req.files) {
                    filesByField = groupFilesByField(req.files);
                    enforceFieldPolicy(filesByField, resolved);
                    const processedBodyData = {};
                    for (const [fieldName, fileArray] of Object.entries(filesByField)) {
                        const urls = [];
                        for (const file of fileArray) {
                            const folder = getFolderByMime(file.mimetype);
                            const ext = path_1.default.extname(file.originalname) || '.bin';
                            const storageKey = generateStorageKey(folder, ext);
                            const { buffer, mimeType } = await processFileContent(file, resolved.storageMode, resolved.imageMaxWidth);
                            // Calculate SHA-256 Checksum
                            const checksum = crypto_1.default
                                .createHash('sha256')
                                .update(buffer)
                                .digest('hex');
                            let uploadUrl;
                            if (resolved.storageMode === 'local') {
                                uploadUrl = `${effectiveBaseUrl}/uploads/${storageKey}`;
                                await LocalProvider.upload(buffer, storageKey, folder, mimeType);
                            }
                            else {
                                uploadUrl = await provider.upload(buffer, storageKey, folder, mimeType);
                            }
                            stagedStorageKeys.push(storageKey);
                            urls.push(uploadUrl);
                        }
                        processedBodyData[fieldName] =
                            fileArray.length > 1 ? urls : urls[0];
                    }
                    if (Array.isArray(req.body)) {
                        req.body = req.body.map((item, index) => {
                            const newItem = { ...item };
                            for (const [key, val] of Object.entries(processedBodyData)) {
                                if (Array.isArray(val)) {
                                    newItem[key] = val[index];
                                }
                                else {
                                    newItem[key] = index === 0 ? val : undefined;
                                }
                            }
                            return newItem;
                        });
                    }
                    else {
                        req.body = { ...req.body, ...processedBodyData };
                    }
                }
                next();
            }
            catch (error) {
                // Automatic cleanup of staged uploads if an error occurs within middleware
                for (const key of stagedStorageKeys) {
                    try {
                        await provider.delete(key);
                    }
                    catch {
                        // Silently ignore cleanup failures
                    }
                }
                next(error);
            }
        });
    };
};
exports.fileHandler = fileHandler;
// ===============================
// Safe File Deletion Utility
// ===============================
/**
 * Deletes a file using its canonical storageKey or legacy full URL
 */
const deleteFile = async (target, options) => {
    if (!target)
        return;
    const providerName = options?.provider ||
        process.env.CLOUD_PROVIDER ||
        's3';
    const provider = STORAGE_PROVIDERS[providerName];
    let storageKey = target;
    // Safe extraction for legacy URLs with domain/bucket validation
    if (target.startsWith('http://') || target.startsWith('https://')) {
        try {
            const url = new URL(target);
            const pathname = url.pathname.replace(/^\/+/, '');
            const bucketName = config_1.default.r2?.bucketName || process.env.AWS_S3_BUCKET || '';
            const customDomain = config_1.default.r2?.customDomain
                ? config_1.default.r2.customDomain
                    .replace(/^https?:\/\//, '')
                    .replace(/\/$/, '')
                : '';
            if (customDomain && target.includes(customDomain)) {
                storageKey = pathname;
            }
            else if (bucketName && pathname.startsWith(`${bucketName}/`)) {
                storageKey = pathname.slice(bucketName.length + 1);
            }
            else if (pathname.includes('/uploads/')) {
                storageKey = pathname.split('/uploads/')[1] || pathname;
            }
            else {
                storageKey = pathname;
            }
        }
        catch {
            storageKey = target.replace(/^https?:\/\/[^/]+\//, '');
        }
    }
    else if (target.startsWith('/uploads/')) {
        storageKey = target.replace(/^\/uploads\//, '');
    }
    await provider.delete(storageKey);
};
exports.deleteFile = deleteFile;
// ===============================
// Multer Error Mapper
// ===============================
const mapMulterError = (err, opts) => {
    const field = err.field;
    switch (err.code) {
        case 'LIMIT_FILE_SIZE': {
            const sizeText = opts?.maxFileSizeMB
                ? `Max ${opts.maxFileSizeMB} MB`
                : 'File size limit exceeded';
            return `File too large${field ? ` for field '${field}'` : ''}. ${sizeText}.`;
        }
        case 'LIMIT_FILE_COUNT': {
            return `Too many files uploaded. Max total files: ${opts?.maxFilesTotal ?? 'limit'}.`;
        }
        case 'LIMIT_UNEXPECTED_FILE': {
            return `Unexpected file field${field ? ` '${field}'` : ''}.`;
        }
        case 'LIMIT_PART_COUNT': {
            return 'Too many parts in form-data. Reduce number of files or fields.';
        }
        case 'LIMIT_FIELD_KEY': {
            return 'Field name too long.';
        }
        case 'LIMIT_FIELD_VALUE': {
            return 'Field value too long.';
        }
        case 'LIMIT_FIELD_COUNT': {
            return 'Too many non-file fields.';
        }
        default:
            return `${err.message || 'Upload error'}${err.code ? ` (${err.code})` : ''}`;
    }
};
//# sourceMappingURL=fileHandler.js.map