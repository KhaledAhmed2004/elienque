import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { AdminRoutes } from '../app/modules/admin/admin.route';
import { ItemRoutes } from '../app/modules/item/item.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { SupportRoutes } from '../app/modules/support/support.route';
import { ChatRoutes } from '../app/modules/chat/chat.route';
import { MessageRoutes } from '../app/modules/message/message.route';
import { CommunityChatRoutes } from '../app/modules/community-chat/communityChat.route';
import { ExpenseRoutes } from '../app/modules/expense/expense.route';
import { InvoiceRoutes } from '../app/modules/invoice/invoice.route';
import { DocumentRoutes } from '../app/modules/document/document.route';
import { WalletRoutes } from '../app/modules/wallet/wallet.route';
import { CampaignRoutes } from '../app/modules/campaign/campaign.route';
import { PromotionRoutes } from '../app/modules/promotion/promotion.route';
import { ConversionRoutes } from '../app/modules/conversion/conversion.route';
import { TrackingRoutes } from '../app/modules/promotion/tracking.route';
import { LeadRoutes } from '../app/modules/lead/lead.route';

const router = express.Router();

const apiRoutes = [
  {
    path: '/leads',
    route: LeadRoutes,
  },
  {
    path: '/user',
    route: UserRoutes,
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
    path: '/admin',
    route: AdminRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/subscription',
    route: SubscriptionRoutes,
  },
  {
    path: '/subscriptions',
    route: SubscriptionRoutes,
  },
  {
    path: '/campaigns',
    route: CampaignRoutes,
  },
  {
    path: '/campaign',
    route: CampaignRoutes,
  },
  {
    path: '/promotions',
    route: PromotionRoutes,
  },
  {
    path: '/promotion',
    route: PromotionRoutes,
  },
  {
    path: '/conversions',
    route: ConversionRoutes,
  },
  {
    path: '/conversion',
    route: ConversionRoutes,
  },
  {
    path: '/wallets',
    route: WalletRoutes,
  },
  {
    path: '/wallet',
    route: WalletRoutes,
  },
  {
    path: '/c',
    route: TrackingRoutes,
  },
  {
    path: '/dashboard',
    route: AdminRoutes,
  },
  {
    path: '/items',
    route: ItemRoutes,
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
    path: '/community-chats',
    route: CommunityChatRoutes,
  },
  {
    path: '/expenses',
    route: ExpenseRoutes,
  },
  {
    path: '/invoices',
    route: InvoiceRoutes,
  },
  {
    path: '/documents',
    route: DocumentRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
