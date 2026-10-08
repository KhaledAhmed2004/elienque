"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../app/modules/auth/auth.route");
const user_route_1 = require("../app/modules/user/user.route");
const notification_routes_1 = require("../app/modules/notification/notification.routes");
const subscription_route_1 = require("../app/modules/subscription/subscription.route");
const admin_route_1 = require("../app/modules/admin/admin.route");
const legal_route_1 = require("../app/modules/legal/legal.route");
const support_route_1 = require("../app/modules/support/support.route");
const chat_route_1 = require("../app/modules/chat/chat.route");
const message_route_1 = require("../app/modules/message/message.route");
const lead_route_1 = require("../app/modules/lead/lead.route");
const campaign_route_1 = require("../app/modules/campaign/campaign.route");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: '/users',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/admin',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/notifications',
        route: notification_routes_1.NotificationRoutes,
    },
    {
        path: '/subscriptions',
        route: subscription_route_1.SubscriptionRoutes,
    },
    {
        path: '/dashboard',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/legals',
        route: legal_route_1.LegalRoutes,
    },
    {
        path: '/supports',
        route: support_route_1.SupportRoutes,
    },
    {
        path: '/chats',
        route: chat_route_1.ChatRoutes,
    },
    {
        path: '/messages',
        route: message_route_1.MessageRoutes,
    },
    {
        path: '/leads',
        route: lead_route_1.LeadRoutes,
    },
    {
        path: '/campaigns',
        route: campaign_route_1.CampaignRoutes,
    },
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
//# sourceMappingURL=index.js.map