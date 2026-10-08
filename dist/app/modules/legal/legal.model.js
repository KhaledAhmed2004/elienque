"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalPage = void 0;
const mongoose_1 = require("mongoose");
const legalPageSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    content: {
        type: String,
        default: '',
    },
}, { timestamps: true, versionKey: false });
// Unique Index on title with case-insensitive collation
legalPageSchema.index({ title: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
exports.LegalPage = (0, mongoose_1.model)('LegalPage', legalPageSchema);
//# sourceMappingURL=legal.model.js.map