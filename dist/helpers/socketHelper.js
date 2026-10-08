"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketHelper = void 0;
const colors_1 = __importDefault(require("colors"));
const mongoose_1 = require("mongoose");
const logger_1 = require("../shared/logger");
const jwtHelper_1 = require("./jwtHelper");
const config_1 = __importDefault(require("../config"));
const chat_model_1 = require("../app/modules/chat/chat.model");
const isValidId = (v) => typeof v === 'string' && mongoose_1.Types.ObjectId.isValid(v);
// Room Name Generators
const USER_ROOM = (userId) => `user::${userId}`;
const CHAT_ROOM = (chatId) => `chat::${chatId}`;
const COMMUNITY_ROOM = (serviceArea) => `community::${serviceArea}`;
// Main Socket Handler
const socket = (io) => {
    io.on('connection', async (socket) => {
        try {
            // STEP 1 — Authenticate Socket Connection
            const token = socket.handshake.auth?.token ||
                socket.handshake.query?.token;
            if (!token || typeof token !== 'string') {
                logger_1.logger.warn(colors_1.default.yellow('Socket connection without token. Disconnecting.'));
                return socket.disconnect(true);
            }
            let payload;
            try {
                payload = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
            }
            catch (err) {
                logger_1.logger.warn(colors_1.default.red('Invalid JWT on socket connection. Disconnecting.'));
                return socket.disconnect(true);
            }
            const userId = payload?.id;
            if (!userId) {
                logger_1.logger.warn(colors_1.default.red('JWT payload missing id. Disconnecting.'));
                return socket.disconnect(true);
            }
            // STEP 2 — Join Personal Room
            socket.join(USER_ROOM(userId));
            logger_1.logger.info(colors_1.default.blue(`✅ User ${userId} connected & joined ${USER_ROOM(userId)}`));
            logEvent('socket_connected', `for user_id: ${userId}`);
            // Auto-join community room based on user's service area has been removed
            // (Legacy serviceArea field was removed in Slice 1)
            // STEP 3 — Handle Chat Room Join / Leave Events
            // Chat Room Join / Leave Events
            socket.on('JOIN_CHAT', async (data) => {
                const chatId = data?.chatId;
                if (!isValidId(chatId))
                    return;
                // Security: Ensure only chat participants can join the room
                const allowed = await chat_model_1.Chat.exists({
                    _id: chatId,
                    participants: userId,
                });
                if (!allowed) {
                    logEvent('JOIN_CHAT_DENIED', `for chat_id: ${chatId}`);
                    return;
                }
                socket.join(CHAT_ROOM(chatId));
                logEvent('JOIN_CHAT', `for chat_id: ${chatId}`);
                logger_1.logger.info(colors_1.default.green(`User ${userId} joined chat room ${CHAT_ROOM(chatId)}`));
            });
            socket.on('LEAVE_CHAT', async (data) => {
                const chatId = data?.chatId;
                if (!isValidId(chatId))
                    return;
                // Guard: Only allow leaving rooms the socket actually joined
                if (!socket.rooms.has(CHAT_ROOM(chatId))) {
                    logEvent('LEAVE_CHAT_DENIED', `for chat_id: ${chatId}`);
                    return;
                }
                socket.leave(CHAT_ROOM(chatId));
                logEvent('LEAVE_CHAT', `for chat_id: ${chatId}`);
                logger_1.logger.info(colors_1.default.yellow(`User ${userId} left chat room ${CHAT_ROOM(chatId)}`));
            });
            socket.on('JOIN_COMMUNITY', async (data) => {
                let area = data?.serviceArea;
                // Legacy: if client doesn't send area, we no longer fallback to userDoc.serviceArea
                if (area && typeof area === 'string') {
                    socket.join(COMMUNITY_ROOM(area));
                    logEvent('JOIN_COMMUNITY', `for service_area: ${area}`);
                    logger_1.logger.info(colors_1.default.green(`User ${userId} joined community room ${COMMUNITY_ROOM(area)}`));
                }
            });
            socket.on('LEAVE_COMMUNITY', (data) => {
                const area = data?.serviceArea;
                if (area && typeof area === 'string') {
                    socket.leave(COMMUNITY_ROOM(area));
                    logEvent('LEAVE_COMMUNITY', `for service_area: ${area}`);
                    logger_1.logger.info(colors_1.default.yellow(`User ${userId} left community room ${COMMUNITY_ROOM(area)}`));
                }
            });
            // Generic join-room / leave-room support (used by mobile SocketService)
            const handleJoinRoom = async (data) => {
                const rawRoomId = typeof data === 'string'
                    ? data
                    : data?.roomId || data?.room;
                if (!rawRoomId || typeof rawRoomId !== 'string')
                    return;
                if (rawRoomId.startsWith('chat::')) {
                    const chatId = rawRoomId.replace('chat::', '');
                    if (!isValidId(chatId))
                        return;
                    const allowed = await chat_model_1.Chat.exists({ _id: chatId, participants: userId });
                    if (!allowed) {
                        logEvent('JOIN_ROOM_DENIED', `for room: ${rawRoomId}`);
                        return;
                    }
                }
                socket.join(rawRoomId);
                logEvent('join-room', `for room: ${rawRoomId}`);
                logger_1.logger.info(colors_1.default.green(`User ${userId} joined room ${rawRoomId}`));
            };
            const handleLeaveRoom = (data) => {
                const rawRoomId = typeof data === 'string'
                    ? data
                    : data?.roomId || data?.room;
                if (!rawRoomId || typeof rawRoomId !== 'string')
                    return;
                socket.leave(rawRoomId);
                logEvent('leave-room', `for room: ${rawRoomId}`);
                logger_1.logger.info(colors_1.default.yellow(`User ${userId} left room ${rawRoomId}`));
            };
            socket.on('join-room', handleJoinRoom);
            socket.on('join_room', handleJoinRoom);
            socket.on('JOIN_ROOM', handleJoinRoom);
            socket.on('leave-room', handleLeaveRoom);
            socket.on('leave_room', handleLeaveRoom);
            socket.on('LEAVE_ROOM', handleLeaveRoom);
            // STEP 4 — Handle Disconnect Event
            socket.on('disconnect', () => {
                logger_1.logger.info(colors_1.default.red(`User ${userId} disconnected`));
                logEvent('socket_disconnected', `for user_id: ${userId}`);
            });
        }
        catch (err) {
            logger_1.logger.error(colors_1.default.red(`Socket connection error: ${String(err)}`));
            try {
                socket.disconnect(true);
            }
            catch (disconnectErr) {
                logger_1.logger.warn(colors_1.default.yellow(`Failed to disconnect socket: ${String(disconnectErr)}`));
            }
        }
    });
};
// Helper: Log formatter
const logEvent = (event, extra) => {
    logger_1.logger.info(`🔔 Event processed: ${event} ${extra || ''}`);
};
exports.socketHelper = { socket };
//# sourceMappingURL=socketHelper.js.map