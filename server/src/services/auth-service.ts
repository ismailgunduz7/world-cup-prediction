import bcrypt from 'bcryptjs';
import { supabase } from '../lib/config.js';
import {
  generateRefreshTokenId,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import { config } from '../lib/config.js';
import type { AuthUser, UserRow } from '../lib/types.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    isAdmin: user.is_admin,
    competitionId: user.competition_id ?? null,
  };
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data as UserRow | null;
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  isAdmin?: boolean;
  competitionId?: string | null;
}): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);
  const isAdmin = input.isAdmin ?? false;
  const { data, error } = await supabase
    .from('users')
    .insert({
      username: input.username,
      password_hash: passwordHash,
      display_name: input.displayName,
      is_admin: isAdmin,
      // Admins never participate, so they're never assigned to a competition.
      competition_id: isAdmin ? null : input.competitionId ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return toAuthUser(data as UserRow);
}

async function deleteExpiredRefreshTokens(): Promise<void> {
  // Opportunistic cleanup so expired rows don't accumulate forever.
  await supabase.from('refresh_tokens').delete().lt('expires_at', new Date().toISOString());
}

export async function login(username: string, password: string, rememberMe = false) {
  const user = await findUserByUsername(username);
  if (!user) {
    throw new Error('Geçersiz kullanıcı adı veya şifre');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('Geçersiz kullanıcı adı veya şifre');
  }

  const refreshTtlDays = rememberMe
    ? config.refreshTokenRememberTtlDays
    : config.refreshTokenSessionTtlDays;

  const authUser = toAuthUser(user);
  const tokenId = generateRefreshTokenId();
  const refreshToken = signRefreshToken(user.id, tokenId, `${refreshTtlDays}d`);
  const accessToken = signAccessToken(authUser);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

  const { error } = await supabase.from('refresh_tokens').insert({
    id: tokenId,
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw error;

  await deleteExpiredRefreshTokens();

  return {
    accessToken,
    refreshToken,
    user: authUser,
    rememberMe,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function refresh(oldRefreshToken: string) {
  const payload = verifyRefreshToken(oldRefreshToken);
  const tokenHash = hashToken(oldRefreshToken);

  const { data: stored, error } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('id', payload.tokenId)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!stored || new Date(stored.expires_at) < new Date()) {
    // Drop the stale row if it lingered past expiry.
    if (stored) await supabase.from('refresh_tokens').delete().eq('id', stored.id);
    throw new Error('Oturum süresi doldu');
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.sub)
    .single();

  if (userError) throw userError;

  const authUser = toAuthUser(user as UserRow);

  // Rotate the refresh token: issue a new one preserving the original absolute
  // expiry, then invalidate the old one. A stolen-but-replayed token fails
  // because its row no longer exists.
  const expiresAt = new Date(stored.expires_at);
  const remainingSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const newTokenId = generateRefreshTokenId();
  const newRefreshToken = signRefreshToken(authUser.id, newTokenId, remainingSeconds);

  const { error: insertError } = await supabase.from('refresh_tokens').insert({
    id: newTokenId,
    user_id: authUser.id,
    token_hash: hashToken(newRefreshToken),
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) throw insertError;

  await supabase.from('refresh_tokens').delete().eq('id', stored.id);
  await deleteExpiredRefreshTokens();

  const accessToken = signAccessToken(authUser);
  return { accessToken, refreshToken: newRefreshToken, user: authUser, refreshTokenExpiresAt: expiresAt };
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await supabase.from('refresh_tokens').delete().eq('id', payload.tokenId);
  } catch {
    // ignore invalid tokens on logout
  }
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toAuthUser(data as UserRow);
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as UserRow | null;
}

export async function updateUser(
  id: string,
  input: {
    username: string;
    displayName: string;
    isAdmin: boolean;
    password?: string;
    competitionId?: string | null;
  },
): Promise<AuthUser> {
  const existing = await findUserById(id);
  if (!existing) {
    throw new Error('Kullanıcı bulunamadı');
  }

  const updates: Partial<UserRow> = {
    username: input.username.trim(),
    display_name: input.displayName.trim(),
    is_admin: input.isAdmin,
  };

  // Admins never participate; promoting to admin clears any competition.
  if (input.isAdmin) {
    updates.competition_id = null;
  } else if (input.competitionId !== undefined) {
    updates.competition_id = input.competitionId;
  }

  if (input.password && input.password.trim().length > 0) {
    if (input.password.trim().length < 6) {
      throw new Error('Şifre en az 6 karakter olmalı');
    }
    updates.password_hash = await hashPassword(input.password.trim());
  }

  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select('*').single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor');
    }
    throw error;
  }

  if (input.isAdmin) {
    await supabase.from('team_selections').delete().eq('user_id', id);
  }

  if (input.password && input.password.trim().length > 0) {
    await supabase.from('refresh_tokens').delete().eq('user_id', id);
  }

  return toAuthUser(data as UserRow);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı');
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    throw new Error('Mevcut şifre hatalı');
  }

  const trimmedNew = newPassword.trim();
  if (trimmedNew.length < 6) {
    throw new Error('Yeni şifre en az 6 karakter olmalı');
  }

  if (currentPassword === trimmedNew) {
    throw new Error('Yeni şifre mevcut şifreden farklı olmalı');
  }

  const { error } = await supabase
    .from('users')
    .update({ password_hash: await hashPassword(trimmedNew) })
    .eq('id', userId);

  if (error) throw error;

  await supabase.from('refresh_tokens').delete().eq('user_id', userId);
}

export async function deleteUser(id: string): Promise<void> {
  const existing = await findUserById(id);
  if (!existing) {
    throw new Error('Kullanıcı bulunamadı');
  }

  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
}
