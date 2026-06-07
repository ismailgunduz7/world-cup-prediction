import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ADMIN_PATH } from '@/api/client';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/giris',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, participantOnly: true },
    },
    {
      path: '/secimlerim',
      name: 'selections',
      component: () => import('@/views/SelectionsView.vue'),
      meta: { requiresAuth: true, participantOnly: true },
    },
    {
      path: '/puan-durumu',
      name: 'leaderboard',
      component: () => import('@/views/LeaderboardView.vue'),
      meta: { requiresAuth: true, participantOnly: true },
    },
    {
      path: '/kurallar',
      name: 'rules',
      component: () => import('@/views/RulesView.vue'),
      meta: { requiresAuth: true, participantOnly: true },
    },
    {
      path: '/hesap',
      name: 'account',
      component: () => import('@/views/AccountView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/takim/:id',
      name: 'team-matches',
      component: () => import('@/views/TeamMatchesView.vue'),
      meta: { requiresAuth: true, participantOnly: true },
    },
    {
      path: '/oyuncu/:id',
      name: 'player-points',
      component: () => import('@/views/PlayerPointsView.vue'),
      meta: { requiresAuth: true, participantOnly: true },
    },
    {
      path: `/${ADMIN_PATH}`,
      name: 'admin',
      component: () => import('@/views/admin/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, hidden: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) {
    await auth.initialize();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return auth.user?.isAdmin ? { name: 'admin' } : { name: 'home' };
  }

  if (to.meta.requiresAdmin && !auth.user?.isAdmin) {
    return { name: 'home' };
  }

  if (to.meta.participantOnly && auth.user?.isAdmin) {
    return { name: 'admin' };
  }

  return true;
});

export default router;
