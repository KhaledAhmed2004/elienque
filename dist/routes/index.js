"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRoutes = void 0;
const faq_route_1 = require("../app/modules/faq/faq.route");
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../app/modules/auth/auth.route");
const user_route_1 = require("../app/modules/user/user.route");
const notification_routes_1 = require("../app/modules/notification/notification.routes");
const dashboard_route_1 = require("../app/modules/dashboard/dashboard.route");
const legal_route_1 = require("../app/modules/legal/legal.route");
const support_route_1 = require("../app/modules/support/support.route");
const chat_route_1 = require("../app/modules/chat/chat.route");
const message_route_1 = require("../app/modules/message/message.route");
const setting_route_1 = require("../app/modules/setting/setting.route");
const route_route_1 = require("../app/modules/route/route.route");
const port_route_1 = require("../app/modules/port/port.route");
const ferry_route_1 = require("../app/modules/ferry/ferry.route");
const schedule_route_1 = require("../app/modules/schedule/schedule.route");
const booking_route_1 = require("../app/modules/booking/booking.route");
const ticket_route_1 = require("../app/modules/ticket/ticket.route");
const offDay_route_1 = require("../app/modules/offDay/offDay.route");
const provider_route_1 = require("../app/modules/provider/provider.route");
const operator_route_1 = require("../app/modules/operator/operator.route");
const admin_route_1 = require("../app/modules/admin/admin.route");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: '/users',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/user',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/notifications',
        route: notification_routes_1.NotificationRoutes,
    },
    {
        path: '/dashboard',
        route: dashboard_route_1.DashboardRoutes,
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
        path: '/settings',
        route: setting_route_1.SettingRoutes,
    },
    {
        path: '/routes',
        route: route_route_1.FerryRouteRoutes,
    },
    {
        path: '/ports',
        route: port_route_1.PortRoutes,
    },
    {
        path: '/ferries',
        route: ferry_route_1.FerryRoutes,
    },
    {
        path: '/schedules',
        route: schedule_route_1.ScheduleRoutes,
    },
    {
        path: '/trips',
        route: schedule_route_1.ScheduleRoutes,
    },
    {
        path: '/bookings',
        route: booking_route_1.BookingRoutes,
    },
    {
        path: '/manage-booking',
        route: booking_route_1.BookingRoutes,
    },
    {
        path: '/tickets',
        route: ticket_route_1.TicketRoutes,
    },
    {
        path: '/operator',
        route: operator_route_1.OperatorRoutes,
    },
    {
        path: '/admin',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/providers',
        route: provider_route_1.ProviderRoutes,
    },
    {
        path: '/off-days',
        route: offDay_route_1.OffDayRoutes,
    },
    {
        path: '/faqs',
        route: faq_route_1.FaqRoutes,
    },
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.AppRoutes = router;
exports.default = router;
//# sourceMappingURL=index.js.map