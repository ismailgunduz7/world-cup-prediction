import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api, { clearAccessToken, setAccessToken } from '@/api/client';
import { clearRememberLogin, saveRememberLogin } from '@/utils/remember-login';
import { clearSelectionDraft } from '@/utils/selection-draft';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  const isAuthenticated = computed(() => !!user.value);

  async function initialize() {
    // The access token only lives in memory, so on a fresh load we try to
    // re-mint it from the httpOnly refresh cookie. A 401 here just means the
    // visitor isn't logged in.
    try {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.accessToken);
      user.value = data.user;
    } catch {
      clearAccessToken();
      user.value = null;
    } finally {
      initialized.value = true;
    }
  }

  async function login(username: string, password: string, rememberMe = false) {
    loading.value = true;
    try {
      const { data } = await api.post('/auth/login', { username, password, rememberMe });
      setAccessToken(data.accessToken);
      user.value = data.user;

      if (rememberMe) {
        saveRememberLogin(username);
      } else {
        clearRememberLogin();
      }
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    const userId = user.value?.id;
    try {
      await api.post('/auth/logout');
    } finally {
      if (userId) clearSelectionDraft(userId);
      clearAccessToken();
      user.value = null;
    }
  }

  return { user, loading, initialized, isAuthenticated, initialize, login, logout };
});
