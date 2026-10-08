import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { DashboardRoutes } from '../app/modules/dashboard/dashboard.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { SupportRoutes } from '../app/modules/support/support.route';
import { ChatRoutes } from '../app/modules/chat/chat.route';
import { MessageRoutes } from '../app/modules/message/message.route';
import { LeadRoutes } from '../app/modules/lead/lead.route';
import { CampaignRoutes } from '../app/modules/campaign/campaign.route';
import { ReceiptRoutes } from '../app/modules/receipt/receipt.route';
import { CashOutRoutes } from '../app/modules/cashOut/cashOut.route';
import { DraftRoutes } from '../app/modules/draft/draft.routes';
import { SettingRoutes } from '../app/modules/setting/setting.route';
import { PostRoutes } from '../app/modules/post/post.route';

const router = express.Router();

const apiRoutes = [
  {
    path: '/posts',
    route: PostRoutes,
  },

  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
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
    route: DashboardRoutes,
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
  {
    path: '/receipts',
    route: ReceiptRoutes,
  },
  {
    path: '/cashouts',
    route: CashOutRoutes,
  },
  {
    path: '/admin/drafts',
    route: DraftRoutes.adminRoutes,
  },
  {
    path: '/drafts',
    route: DraftRoutes.ownerRoutes,
  },
  {
    path: '/settings',
    route: SettingRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
