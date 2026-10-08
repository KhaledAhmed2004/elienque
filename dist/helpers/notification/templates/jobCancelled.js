"use strict";
/**
 * Job Cancelled Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobCancelled = void 0;
exports.jobCancelled = {
    name: 'jobCancelled',
    push: {
        title: 'Ride / Job Cancelled',
        body: '{{jobTitle}} has been cancelled. {{reason}}',
        data: {
            type: 'JOB_CANCELLED',
            jobId: '{{jobId}}',
            action: 'VIEW_JOB',
        },
    },
    socket: {
        event: 'JOB_CANCELLED',
        data: {
            type: 'JOB_CANCELLED',
            jobId: '{{jobId}}',
            reason: '{{reason}}',
        },
    },
    database: {
        type: 'TASK',
        title: 'Ride / Job Cancelled',
        text: '{{jobTitle}} has been cancelled. {{reason}}',
    },
};
exports.default = exports.jobCancelled;
//# sourceMappingURL=jobCancelled.js.map