"use strict";
/**
 * Task / Ride Completed Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskCompleted = void 0;
exports.taskCompleted = {
    name: 'taskCompleted',
    push: {
        title: 'Ride Completed',
        body: 'Your ride {{jobTitle}} was completed successfully.',
        data: {
            type: 'TASK_COMPLETED',
            jobId: '{{jobId}}',
            action: 'LEAVE_REVIEW',
        },
    },
    socket: {
        event: 'TASK_COMPLETED',
        data: {
            type: 'TASK_COMPLETED',
            jobId: '{{jobId}}',
            jobTitle: '{{jobTitle}}',
        },
    },
    database: {
        type: 'TASK',
        title: 'Ride Completed',
        text: 'Your ride {{jobTitle}} was completed successfully.',
    },
};
exports.default = exports.taskCompleted;
//# sourceMappingURL=taskCompleted.js.map