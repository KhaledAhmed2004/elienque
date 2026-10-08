"use strict";
/**
 * Chauffeur Applied Notification Template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverApplied = exports.chauffeurApplied = void 0;
exports.chauffeurApplied = {
    name: 'chauffeurApplied',
    push: {
        title: 'New Chauffeur Application',
        body: '{{chauffeurName}}{{driverName}} applied for ride: {{jobTitle}}',
        data: {
            type: 'CHAUFFEUR_APPLIED',
            jobId: '{{jobId}}',
            chauffeurId: '{{chauffeurId}}{{driverId}}',
            action: 'VIEW_JOB_APPLICATIONS',
        },
    },
    socket: {
        event: 'CHAUFFEUR_APPLIED',
        data: {
            type: 'CHAUFFEUR_APPLIED',
            jobId: '{{jobId}}',
            chauffeurId: '{{chauffeurId}}{{driverId}}',
            chauffeurName: '{{chauffeurName}}{{driverName}}',
        },
    },
    database: {
        type: 'TASK',
        title: 'New Chauffeur Application',
        text: '{{chauffeurName}}{{driverName}} applied for ride: {{jobTitle}}',
    },
};
exports.driverApplied = {
    ...exports.chauffeurApplied,
    name: 'driverApplied',
};
exports.default = exports.chauffeurApplied;
//# sourceMappingURL=chauffeurApplied.js.map