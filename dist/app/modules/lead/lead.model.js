"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessLead = void 0;
const mongoose_1 = require("mongoose");
const lead_interface_1 = require("./lead.interface");
const businessLeadSchema = new mongoose_1.Schema({
    businessName: { type: String, required: true },
    ownerName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    promoterId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: Object.values(lead_interface_1.LeadStatus),
        default: lead_interface_1.LeadStatus.PENDING,
    },
}, {
    timestamps: true,
});
exports.BusinessLead = (0, mongoose_1.model)('BusinessLead', businessLeadSchema);
//# sourceMappingURL=lead.model.js.map