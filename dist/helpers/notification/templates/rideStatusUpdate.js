"use strict";
/**
 * Ride Status Update Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rideStatusUpdate = void 0;
exports.rideStatusUpdate = {
    name: 'rideStatusUpdate',
    push: {
        title: 'Ride Status Updated',
        body: '{{driverName}} updated ride status to {{rideStatus}}',
        data: {
            type: 'RIDE_STATUS_UPDATE',
            jobId: '{{jobId}}',
            rideStatus: '{{rideStatus}}',
            action: 'VIEW_JOB',
        },
    },
    socket: {
        event: 'RIDE_STATUS_UPDATE',
        data: {
            type: 'RIDE_STATUS_UPDATE',
            jobId: '{{jobId}}',
            rideStatus: '{{rideStatus}}',
            driverName: '{{driverName}}',
        },
    },
    database: {
        type: 'TASK',
        title: 'Ride Status Updated',
        text: '{{driverName}} updated ride status to {{rideStatus}}',
    },
};
exports.default = exports.rideStatusUpdate;
//# sourceMappingURL=rideStatusUpdate.js.map