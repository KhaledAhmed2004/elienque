"use strict";
/**
 * New Message Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.newMessage = void 0;
exports.newMessage = {
    name: 'newMessage',
    push: {
        title: 'New Message from {{senderName}}',
        body: '{{messagePreview}}',
        data: {
            type: 'NEW_MESSAGE',
            senderId: '{{senderId}}',
            chatId: '{{chatId}}',
            action: 'OPEN_CHAT',
        },
    },
    socket: {
        event: 'MESSAGE_NOTIFICATION',
        data: {
            type: 'NEW_MESSAGE',
            senderId: '{{senderId}}',
            senderName: '{{senderName}}',
            chatId: '{{chatId}}',
            message: '{{messagePreview}}',
        },
    },
    database: {
        type: 'MESSAGE',
        title: 'New Message from {{senderName}}',
        text: '{{messagePreview}}',
    },
};
exports.default = exports.newMessage;
//# sourceMappingURL=newMessage.js.map