import { createRouter, createWebHistory } from 'vue-router';

// Turnuva bittikten sonra site tamamen herkese açık ve statiktir: kimlik
// doğrulama, guard veya kişiye özel sayfa yoktur.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/puan-durumu',
      name: 'leaderboard',
      component: () => import('@/views/LeaderboardView.vue'),
    },
    {
      path: '/fikstur',
      name: 'fixtures',
      component: () => import('@/views/FixturesView.vue'),
    },
    {
      path: '/kurallar',
      name: 'rules',
      component: () => import('@/views/RulesView.vue'),
    },
    {
      path: '/takim/:id',
      name: 'team-matches',
      component: () => import('@/views/TeamMatchesView.vue'),
    },
    {
      path: '/oyuncu/:id',
      name: 'player-points',
      component: () => import('@/views/PlayerPointsView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

export default router;
