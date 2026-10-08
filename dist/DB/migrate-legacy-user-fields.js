"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../shared/logger");
const user_model_1 = require("../app/modules/user/user.model");
const migrateLegacyUserFields = async () => {
    try {
        logger_1.logger.info('Connecting to database...');
        await mongoose_1.default.connect(config_1.default.database_url);
        logger_1.logger.info('Connected to database.');
        logger_1.logger.info('Starting migration: Unsetting legacy fields from users collection...');
        const result = await user_model_1.User.updateMany({}, {
            $unset: {
                serviceAreaId: 1,
                serviceArea: 1,
                companyName: 1,
                company: 1,
                vehicles: 1,
                selectedVehicle: 1,
            },
        });
        logger_1.logger.info(`Migration completed successfully.`);
        logger_1.logger.info(`Matched documents: ${result.matchedCount}`);
        logger_1.logger.info(`Modified documents: ${result.modifiedCount}`);
    }
    catch (error) {
        logger_1.logger.error('Migration failed:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
        logger_1.logger.info('Disconnected from database.');
        process.exit(0);
    }
};
migrateLegacyUserFields();
//# sourceMappingURL=migrate-legacy-user-fields.js.map