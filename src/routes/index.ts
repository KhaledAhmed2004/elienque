import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { AdminRoutes } from '../app/modules/admin/admin.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { SupportRoutes } from '../app/modules/support/support.route';
import { ChatRoutes } from '../app/modules/chat/chat.route';
import { MessageRoutes } from '../app/modules/message/message.route';
import { LeadRoutes } from '../app/modules/lead/lead.route';
import { CampaignRoutes } from '../app/modules/campaign/campaign.route';

const router = express.Router();

const apiRoutes = [

  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/admin',
    route: AdminRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/subscriptions',
    route: SubscriptionRoutes,
  },

  {
    path: '/dashboard',
    route: AdminRoutes,
  },

  {
    path: '/legals',
    route: LegalRoutes,
  },
  {
    path: '/supports',
    route: SupportRoutes,
  },
  {
    path: '/chats',
    route: ChatRoutes,
  },
  {
    path: '/messages',
    route: MessageRoutes,
  },
  {
    path: '/leads',
    route: LeadRoutes,
  },
  {
    path: '/campaigns',
    route: CampaignRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
