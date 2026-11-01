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
const ALLOWED_MIME_TYPES_BY_FOLDER = {
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
const DEFAULT_CATEGORY_SIZE_LIMITS_MB = {
    images: 10,
    documents: 25,
    media: 50,
};
const ALLOWED_EXTENSIONS_BY_FOLDER = {
    images: ['.jpg', '.jpeg', '.png', '.webp'],
    documents: ['.pdf'],
    media: ['.mp4', '.webm', '.mp3', '.ogg', '.wav'],
};
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBM_MAGIC_BYTES = [0x1a, 0x45, 0xdf, 0xa3];
const isValidPngSignature = (fileBuffer) => {
    if (fileBuffer.length < PNG_MAGIC_BYTES.length) {
        return false;
    }
    return PNG_MAGIC_BYTES.every((expectedByte, byteIndex) => fileBuffer[byteIndex] === expectedByte);
};
const isValidJpegSignature = (fileBuffer) => {
    return (fileBuffer.length >= 3 &&
        fileBuffer[0] === 0xff &&
        fileBuffer[1] === 0xd8 &&
        fileBuffer[2] === 0xff);
};
const isValidWebpSignature = (fileBuffer) => {
    if (fileBuffer.length < 12) {
        return false;
    }
    const riffContainerIdentifier = fileBuffer.toString('ascii', 0, 4);
    const webpFormatIdentifier = fileBuffer.toString('ascii', 8, 12);
    return riffContainerIdentifier === 'RIFF' && webpFormatIdentifier === 'WEBP';
};
const isValidPdfSignature = (fileBuffer) => {
    if (fileBuffer.length < 5) {
        return false;
    }
    return fileBuffer.toString('ascii', 0, 5).startsWith('%PDF-');
};
const isValidMp4OrM4aSignature = (fileBuffer) => {
    if (fileBuffer.length < 8) {
        return false;
    }
    return fileBuffer.toString('ascii', 4, 8) === 'ftyp';
};
const isValidWebmSignature = (fileBuffer) => {
    if (fileBuffer.length < WEBM_MAGIC_BYTES.length) {
        return false;
    }
    return WEBM_MAGIC_BYTES.every((expectedByte, byteIndex) => fileBuffer[byteIndex] === expectedByte);
};
const isValidMp3Signature = (fileBuffer) => {
    if (fileBuffer.length < 3) {
        return false;
    }
    const hasId3Tag = fileBuffer.toString('ascii', 0, 3) === 'ID3';
    const hasMpegAudioFrameSync = fileBuffer[0] === 0xff && (fileBuffer[1] & 0xe0) === 0xe0;
    return hasId3Tag || hasMpegAudioFrameSync;
};
const isValidWavSignature = (fileBuffer) => {
    if (fileBuffer.length < 12) {
        return false;
    }
    const riffIdentifier = fileBuffer.toString('ascii', 0, 4);
    const waveIdentifier = fileBuffer.toString('ascii', 8, 12);
    return riffIdentifier === 'RIFF' && waveIdentifier === 'WAVE';
};
const isValidOggSignature = (fileBuffer) => {
    if (fileBuffer.length < 4) {
        return false;
    }
    return fileBuffer.toString('ascii', 0, 4) === 'OggS';
};
const hasValidFileSignature = (fileBuffer, declaredMimeType) => {
    if (fileBuffer.length < 4) {
        return false;
    }
    if (declaredMimeType === 'image/png') {
        return isValidPngSignature(fileBuffer);
    }
    if (declaredMimeType === 'image/jpeg' || declaredMimeType === 'image/jpg') {
        return isValidJpegSignature(fileBuffer);
    }
    if (declaredMimeType === 'image/webp') {
        return isValidWebpSignature(fileBuffer);
    }
    if (declaredMimeType === 'application/pdf') {
        return isValidPdfSignature(fileBuffer);
    }
    if (declaredMimeType === 'video/mp4' || declaredMimeType === 'audio/mp4') {
        return isValidMp4OrM4aSignature(fileBuffer);
    }
    if (declaredMimeType === 'video/webm' || declaredMimeType === 'audio/webm') {
        return isValidWebmSignature(fileBuffer);
    }
    if (declaredMimeType === 'audio/mpeg') {
        return isValidMp3Signature(fileBuffer);
    }
    if (declaredMimeType === 'audio/wav') {
        return isValidWavSignature(fileBuffer);
    }
    if (declaredMimeType === 'audio/ogg') {
        return isValidOggSignature(fileBuffer);
    }
    return false;
};
const ensureDirectoryExists = async (directoryPath) => {
    await fs_1.default.promises.mkdir(directoryPath, { recursive: true });
};
const resolveFolderByMimeType = (mimeType) => {
    if (mimeType.startsWith('image/')) {
        return 'images';
    }
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        return 'media';
    }
    if (mimeType === 'application/pdf') {
        return 'documents';
    }
    throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Unsupported file type '${mimeType}'`);
};
const generateUniqueStorageKey = (targetFolder, rawFileExtension) => {
    const normalizedExtension = rawFileExtension.startsWith('.')
        ? rawFileExtension.toLowerCase()
        : `.${rawFileExtension.toLowerCase()}`;
    const randomIdentifier = crypto_1.default.randomUUID();
    return `${targetFolder}/${randomIdentifier}${normalizedExtension}`;
};
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
const buildS3PublicUrl = (storageKey, bucketName) => {
    if (config_1.default.r2?.customDomain) {
        const formattedDomain = config_1.default.r2.customDomain.replace(/\/$/, '');
        return `${formattedDomain}/${storageKey}`;
    }
    if (config_1.default.r2?.accountId) {
        return `https://${config_1.default.r2.accountId}.r2.cloudflarestorage.com/${bucketName}/${storageKey}`;
    }
    const configuredRegion = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucketName}.s3.${configuredRegion}.amazonaws.com/${storageKey}`;
};
const s3StorageProvider = {
    upload: async (fileBuffer, storageKey, _targetFolder, mimeType) => {
        const bucketName = config_1.default.r2?.bucketName || process.env.AWS_S3_BUCKET || '';
        if (!bucketName) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'AWS S3 / Cloudflare R2 Bucket configuration is missing');
        }
        await exports.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: bucketName,
            Key: storageKey,
            Body: fileBuffer,
            ContentType: mimeType,
        }));
        return buildS3PublicUrl(storageKey, bucketName);
    },
    delete: async (storageKey) => {
        const bucketName = config_1.default.r2?.bucketName || process.env.AWS_S3_BUCKET || '';
        if (!bucketName) {
            return;
        }
        await exports.s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: bucketName,
            Key: storageKey,
        }));
    },
};
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
});
const cloudinaryStorageProvider = {
    upload: async (fileBuffer, storageKey, targetFolder, _mimeType) => {
        const publicId = path_1.default.basename(storageKey).replace(/\.[^/.]+$/, '');
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.v2.uploader.upload_stream({
                folder: targetFolder,
                resource_type: 'auto',
                public_id: publicId,
            }, (error, response) => {
                if (error || !response) {
                    reject(error || new Error('Upload failed'));
                }
                else {
                    resolve(response);
                }
            });
            uploadStream.end(fileBuffer);
        });
        return uploadResult.secure_url;
    },
    delete: async (storageKey) => {
        const publicId = storageKey.replace(/\.[^/.]+$/, '');
        await cloudinary_1.default.v2.uploader.destroy(publicId, {
            resource_type: 'auto',
        });
    },
};
const localStorageProvider = {
    upload: async (fileBuffer, storageKey, _targetFolder, _mimeType) => {
        const localDestinationPath = path_1.default.join(process.cwd(), 'uploads', storageKey);
        const destinationDirectory = path_1.default.dirname(localDestinationPath);
        await ensureDirectoryExists(destinationDirectory);
        await fs_1.default.promises.writeFile(localDestinationPath, fileBuffer);
        return `/uploads/${storageKey}`;
    },
    delete: async (storageKey) => {
        const localDestinationPath = path_1.default.join(process.cwd(), 'uploads', storageKey);
        try {
            await fs_1.default.promises.unlink(localDestinationPath);
        }
        catch {
            return;
        }
    },
};
const STORAGE_PROVIDERS = {
    s3: s3StorageProvider,
    cloudinary: cloudinaryStorageProvider,
    local: localStorageProvider,
};
const optimizeImageBuffer = async (rawImageBuffer, mimeType, maxWidth) => {
    let sharpInstance = (0, sharp_1.default)(rawImageBuffer).resize({
        width: maxWidth,
        withoutEnlargement: true,
    });
    let outputMimeType = mimeType;
    if (mimeType === 'image/png') {
        sharpInstance = sharpInstance.png({ compressionLevel: 8, palette: true });
    }
    else if (mimeType === 'image/webp') {
        sharpInstance = sharpInstance.webp({ quality: 80 });
    }
    else {
        sharpInstance = sharpInstance.jpeg({ quality: 80 });
        outputMimeType = 'image/jpeg';
    }
    const optimizedBuffer = await sharpInstance.toBuffer();
    return { buffer: optimizedBuffer, mimeType: outputMimeType };
};
const prepareFileBuffer = async (uploadedFile, storageMode, imageMaxWidth) => {
    const fileBuffer = storageMode === 'memory'
        ? uploadedFile.buffer
        : await fs_1.default.promises.readFile(uploadedFile.path);
    const isValidSignature = hasValidFileSignature(fileBuffer, uploadedFile.mimetype);
    if (!isValidSignature) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `File content does not match declared format '${uploadedFile.mimetype}' (Signature verification failed)`);
    }
    const isImageFile = uploadedFile.mimetype.startsWith('image/');
    if (isImageFile) {
        const { buffer: optimizedBuffer, mimeType: outputMimeType } = await optimizeImageBuffer(fileBuffer, uploadedFile.mimetype, imageMaxWidth);
        if (storageMode === 'local' && uploadedFile.path) {
            await fs_1.default.promises.writeFile(uploadedFile.path, optimizedBuffer);
        }
        return { buffer: optimizedBuffer, mimeType: outputMimeType };
    }
    return { buffer: fileBuffer, mimeType: uploadedFile.mimetype };
};
const createMulterStorageEngine = (storageMode) => {
    if (storageMode === 'memory') {
        return multer_1.default.memoryStorage();
    }
    const baseUploadDirectory = path_1.default.join(process.cwd(), 'uploads');
    ensureDirectoryExists(path_1.default.join(baseUploadDirectory, 'images')).catch(() => { });
    ensureDirectoryExists(path_1.default.join(baseUploadDirectory, 'media')).catch(() => { });
    ensureDirectoryExists(path_1.default.join(baseUploadDirectory, 'documents')).catch(() => { });
    return multer_1.default.diskStorage({
        destination: (_req, file, callback) => {
            const canonicalFolder = resolveFolderByMimeType(file.mimetype);
            const destinationFolder = path_1.default.join(baseUploadDirectory, canonicalFolder);
            callback(null, destinationFolder);
        },
        filename: (_req, file, callback) => {
            const extension = path_1.default.extname(file.originalname).toLowerCase();
            const uniqueFilename = `${crypto_1.default.randomUUID()}${extension}`;
            callback(null, uniqueFilename);
        },
    });
};
const validateIncomingFile = (_req, file, callback) => {
    let targetFolder;
    try {
        targetFolder = resolveFolderByMimeType(file.mimetype);
    }
    catch (error) {
        const errorMessage = error.message || 'Unsupported file type';
        return callback(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, errorMessage));
    }
    const allowedMimeTypes = ALLOWED_MIME_TYPES_BY_FOLDER[targetFolder];
    const isMimeTypePermitted = allowedMimeTypes?.includes(file.mimetype);
    if (!isMimeTypePermitted) {
        const permittedMimesList = allowedMimeTypes?.join(', ') || 'none';
        return callback(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid MIME type '${file.mimetype}'. Allowed for ${targetFolder}: ${permittedMimesList}`));
    }
    const fileExtension = path_1.default.extname(file.originalname).toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS_BY_FOLDER[targetFolder];
    const isExtensionPermitted = allowedExtensions?.includes(fileExtension);
    if (!isExtensionPermitted) {
        const permittedExtensionsList = allowedExtensions.join(', ');
        return callback(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid file extension '${fileExtension}'. Allowed for ${targetFolder}: ${permittedExtensionsList}`));
    }
    callback(null, true);
};
const extractJsonPayloadFromBody = (requestBody) => {
    const hasStringifiedDataField = Boolean(requestBody) &&
        typeof requestBody === 'object' &&
        'data' in requestBody &&
        typeof requestBody.data === 'string';
    if (hasStringifiedDataField) {
        try {
            return JSON.parse(requestBody.data);
        }
        catch {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid JSON format in "data" field');
        }
    }
    return requestBody || {};
};
const groupUploadedFilesByField = (files) => {
    const filesByField = {};
    if (Array.isArray(files)) {
        for (const file of files) {
            filesByField[file.fieldname] = filesByField[file.fieldname] || [];
            filesByField[file.fieldname].push(file);
        }
    }
    else {
        Object.assign(filesByField, files);
    }
    return filesByField;
};
const extractBaseFieldName = (fieldName) => {
    if (fieldName.includes('[')) {
        return fieldName.split('[')[0];
    }
    if (fieldName.includes('.')) {
        const segments = fieldName.split('.');
        return segments[segments.length - 1];
    }
    return fieldName;
};
const isFieldAllowedByPolicy = (fieldName, allowedFieldNames) => {
    const exactMatchSet = new Set(allowedFieldNames);
    if (exactMatchSet.has(fieldName)) {
        return true;
    }
    return allowedFieldNames.some(baseField => fieldName.startsWith(`${baseField}[`) ||
        fieldName.endsWith(`.${baseField}`));
};
const formatExpectedFieldsMessage = (allowedFields) => {
    if (allowedFields.length === 1) {
        return `'${allowedFields[0]}'`;
    }
    return `'${allowedFields.join("', '")}'`;
};
const validateUploadedFieldPolicies = (filesByField, options) => {
    const allowedFieldNames = options.enforceAllowedFields;
    if (!allowedFieldNames || allowedFieldNames.length === 0) {
        return;
    }
    for (const [fieldName, fieldFiles] of Object.entries(filesByField)) {
        const isAllowed = isFieldAllowedByPolicy(fieldName, allowedFieldNames);
        if (!isAllowed) {
            const expectedFieldsText = formatExpectedFieldsMessage(allowedFieldNames);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Expected field name ${expectedFieldsText} but got '${fieldName}'`);
        }
        const baseFieldName = extractBaseFieldName(fieldName);
        const maxFilesAllowedForField = options.perFieldMaxCount?.[baseFieldName] ?? 1;
        if (fieldFiles.length > maxFilesAllowedForField) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Too many files for field '${fieldName}'. Max ${maxFilesAllowedForField}.`);
        }
    }
};
const convertFieldRulesToOptions = (fieldRules) => {
    const enforceAllowedFields = [];
    const perFieldMaxCount = {};
    let maxFilesTotal = 0;
    for (const rule of fieldRules) {
        if (typeof rule === 'string') {
            const fieldName = rule;
            enforceAllowedFields.push(fieldName);
            perFieldMaxCount[fieldName] = perFieldMaxCount[fieldName] ?? 1;
            maxFilesTotal += 1;
        }
        else if (rule && typeof rule.name === 'string') {
            const fieldName = rule.name;
            const fieldMaxCount = rule.maxCount ?? 1;
            enforceAllowedFields.push(fieldName);
            perFieldMaxCount[fieldName] = fieldMaxCount;
            maxFilesTotal += fieldMaxCount;
        }
    }
    return { enforceAllowedFields, perFieldMaxCount, maxFilesTotal };
};
const resolveFileHandlerOptions = (options) => {
    const baseOptions = Array.isArray(options)
        ? convertFieldRulesToOptions(options)
        : options || {};
    const storageMode = baseOptions.storageMode ||
        (process.env.UPLOAD_MODE === 'memory' ? 'memory' : 'local');
    const cloudProvider = baseOptions.cloudProvider ||
        process.env.CLOUD_PROVIDER ||
        's3';
    const maxFileSizeMB = baseOptions.maxFileSizeMB || DEFAULT_CATEGORY_SIZE_LIMITS_MB.documents;
    const maxFilesTotal = baseOptions.maxFilesTotal ?? 10;
    const imageMaxWidth = baseOptions.imageMaxWidth ?? 800;
    return {
        ...baseOptions,
        storageMode,
        cloudProvider,
        maxFileSizeMB,
        maxFilesTotal,
        imageMaxWidth,
    };
};
const resolveRequestBaseUrl = (req, customBaseUrl) => {
    if (customBaseUrl) {
        return customBaseUrl;
    }
    if (process.env.BASE_URL) {
        return process.env.BASE_URL;
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};
const mergeUploadedUrlsIntoRequestBody = (currentRequestBody, uploadedUrlsByField) => {
    if (Array.isArray(currentRequestBody)) {
        return currentRequestBody.map((item, itemIndex) => {
            const mergedItem = { ...item };
            for (const [fieldName, urls] of Object.entries(uploadedUrlsByField)) {
                if (Array.isArray(urls)) {
                    mergedItem[fieldName] = urls[itemIndex];
                }
                else {
                    mergedItem[fieldName] = itemIndex === 0 ? urls : undefined;
                }
            }
            return mergedItem;
        });
    }
    const baseObject = currentRequestBody && typeof currentRequestBody === 'object'
        ? currentRequestBody
        : {};
    return { ...baseObject, ...uploadedUrlsByField };
};
const cleanupStagedUploads = async (stagedStorageKeys, storageProvider) => {
    for (const storageKey of stagedStorageKeys) {
        try {
            await storageProvider.delete(storageKey);
        }
        catch {
            continue;
        }
    }
};
const persistFileToStorage = async (storageProvider, storageMode, fileBuffer, storageKey, targetFolder, mimeType, effectiveBaseUrl) => {
    if (storageMode === 'local') {
        await storageProvider.upload(fileBuffer, storageKey, targetFolder, mimeType);
        return `${effectiveBaseUrl}/uploads/${storageKey}`;
    }
    return await storageProvider.upload(fileBuffer, storageKey, targetFolder, mimeType);
};
const fileHandler = (options) => {
    const resolvedOptions = resolveFileHandlerOptions(options);
    const activeProviderKey = resolvedOptions.storageMode === 'local'
        ? 'local'
        : resolvedOptions.cloudProvider;
    const storageProvider = STORAGE_PROVIDERS[activeProviderKey];
    const uploadMiddleware = (0, multer_1.default)({
        storage: createMulterStorageEngine(resolvedOptions.storageMode),
        fileFilter: validateIncomingFile,
        limits: {
            fileSize: resolvedOptions.maxFileSizeMB * 1024 * 1024,
            files: resolvedOptions.maxFilesTotal,
        },
    }).any();
    return async (req, res, next) => {
        uploadMiddleware(req, res, async (uploadError) => {
            if (uploadError) {
                if (uploadError instanceof multer_1.default.MulterError) {
                    const formattedMessage = mapMulterErrorMessage(uploadError, {
                        maxFileSizeMB: resolvedOptions.maxFileSizeMB,
                        maxFilesTotal: resolvedOptions.maxFilesTotal,
                    });
                    return next(new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, formattedMessage));
                }
                return next(uploadError);
            }
            const stagedStorageKeys = [];
            try {
                const effectiveBaseUrl = resolveRequestBaseUrl(req, resolvedOptions.baseUrl);
                req.body = extractJsonPayloadFromBody(req.body);
                if (req.files) {
                    const filesByField = groupUploadedFilesByField(req.files);
                    validateUploadedFieldPolicies(filesByField, resolvedOptions);
                    const uploadedUrlsByField = {};
                    for (const [fieldName, fieldFiles] of Object.entries(filesByField)) {
                        const uploadedUrls = [];
                        for (const file of fieldFiles) {
                            const targetFolder = resolveFolderByMimeType(file.mimetype);
                            const fileExtension = path_1.default.extname(file.originalname) || '.bin';
                            const storageKey = generateUniqueStorageKey(targetFolder, fileExtension);
                            const { buffer: processedBuffer, mimeType: finalMimeType } = await prepareFileBuffer(file, resolvedOptions.storageMode, resolvedOptions.imageMaxWidth);
                            const publicAccessUrl = await persistFileToStorage(storageProvider, resolvedOptions.storageMode, processedBuffer, storageKey, targetFolder, finalMimeType, effectiveBaseUrl);
                            stagedStorageKeys.push(storageKey);
                            uploadedUrls.push(publicAccessUrl);
                        }
                        uploadedUrlsByField[fieldName] =
                            fieldFiles.length > 1 ? uploadedUrls : uploadedUrls[0];
                    }
                    req.body = mergeUploadedUrlsIntoRequestBody(req.body, uploadedUrlsByField);
                }
                next();
            }
            catch (processingError) {
                await cleanupStagedUploads(stagedStorageKeys, storageProvider);
                next(processingError);
            }
        });
    };
};
exports.fileHandler = fileHandler;
const extractStorageKeyFromTarget = (targetPathOrUrl) => {
    const isHttpUrl = targetPathOrUrl.startsWith('http://') ||
        targetPathOrUrl.startsWith('https://');
    if (isHttpUrl) {
        try {
            const parsedUrl = new URL(targetPathOrUrl);
            const pathnameWithoutLeadingSlash = parsedUrl.pathname.replace(/^\/+/, '');
            const configuredBucketName = config_1.default.r2?.bucketName || process.env.AWS_S3_BUCKET || '';
            const configuredCustomDomain = config_1.default.r2?.customDomain
                ? config_1.default.r2.customDomain
                    .replace(/^https?:\/\//, '')
                    .replace(/\/$/, '')
                : '';
            const matchesCustomDomain = configuredCustomDomain &&
                targetPathOrUrl.includes(configuredCustomDomain);
            if (matchesCustomDomain) {
                return pathnameWithoutLeadingSlash;
            }
            const startsWithBucketName = configuredBucketName &&
                pathnameWithoutLeadingSlash.startsWith(`${configuredBucketName}/`);
            if (startsWithBucketName) {
                return pathnameWithoutLeadingSlash.slice(configuredBucketName.length + 1);
            }
            const containsLocalUploadsSegment = pathnameWithoutLeadingSlash.includes('/uploads/');
            if (containsLocalUploadsSegment) {
                return (pathnameWithoutLeadingSlash.split('/uploads/')[1] ||
                    pathnameWithoutLeadingSlash);
            }
            return pathnameWithoutLeadingSlash;
        }
        catch {
            return targetPathOrUrl.replace(/^https?:\/\/[^/]+\//, '');
        }
    }
    const isLocalUploadsPath = targetPathOrUrl.startsWith('/uploads/');
    if (isLocalUploadsPath) {
        return targetPathOrUrl.replace(/^\/uploads\//, '');
    }
    return targetPathOrUrl;
};
const deleteFile = async (target, options) => {
    if (!target) {
        return;
    }
    const providerName = options?.provider ||
        process.env.CLOUD_PROVIDER ||
        's3';
    const storageProvider = STORAGE_PROVIDERS[providerName];
    const storageKey = extractStorageKeyFromTarget(target);
    await storageProvider.delete(storageKey);
};
exports.deleteFile = deleteFile;
const mapMulterErrorMessage = (multerError, limits) => {
    const fieldName = multerError.field;
    const fieldSuffix = fieldName ? ` for field '${fieldName}'` : '';
    switch (multerError.code) {
        case 'LIMIT_FILE_SIZE': {
            const maxAllowedSizeText = limits?.maxFileSizeMB
                ? `Max ${limits.maxFileSizeMB} MB`
                : 'File size limit exceeded';
            return `File too large${fieldSuffix}. ${maxAllowedSizeText}.`;
        }
        case 'LIMIT_FILE_COUNT': {
            const maxAllowedFilesText = limits?.maxFilesTotal ?? 'limit';
            return `Too many files uploaded. Max total files: ${maxAllowedFilesText}.`;
        }
        case 'LIMIT_UNEXPECTED_FILE': {
            return `Unexpected file field${fieldName ? ` '${fieldName}'` : ''}.`;
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
        default: {
            const fallbackMessage = multerError.message || 'Upload error';
            const errorCodeSuffix = multerError.code ? ` (${multerError.code})` : '';
            return `${fallbackMessage}${errorCodeSuffix}`;
        }
    }
};
//# sourceMappingURL=fileHandler.js.map