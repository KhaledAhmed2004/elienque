import { JwtPayload } from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { ACCOUNT_STATE, APP_STATE, USER_ROLES } from '../enums/user';

export type JwtUser = {
  id: string;
  email: string;
  role: USER_ROLES;
  appState?: APP_STATE;
  accountState?: ACCOUNT_STATE;
  serviceAreaId?: string;
} & JwtPayload;

declare global {
  var io: SocketIOServer | undefined;

  namespace Express {
    interface Request {
      user: JwtUser;
    }
  }
}
