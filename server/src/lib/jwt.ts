import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from './config.js';
import type { AuthUser } from './types.js';

export type AccessTokenPayload = {
  sub: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  tokenId: string;
  type: 'refresh';
};

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    type: 'access',
  };
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(
  userId: string,
  tokenId: string,
  expiresIn: jwt.SignOptions['expiresIn'],
): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    tokenId,
    type: 'refresh',
  };
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.jwtAccessSecret) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, config.jwtRefreshSecret) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshTokenId(): string {
  return crypto.randomUUID();
}
