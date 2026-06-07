<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import { useAuthStore } from '@/stores/auth';
import { ADMIN_PATH } from '@/api/client';

const MOBILE_NAV_BREAKPOINT = '(max-width: 768px)';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const mobileNavOpen = ref(false);
const isMobileNav = ref(false);

let mobileNavMediaQuery: MediaQueryList | null = null;

function syncMobileNavLayout() {
  isMobileNav.value = window.matchMedia(MOBILE_NAV_BREAKPOINT).matches;
  if (!isMobileNav.value) {
    closeMobileNav();
  }
}

onMounted(() => {
  syncMobileNavLayout();
  mobileNavMediaQuery = window.matchMedia(MOBILE_NAV_BREAKPOINT);
  mobileNavMediaQuery.addEventListener('change', syncMobileNavLayout);
});

onUnmounted(() => {
  mobileNavMediaQuery?.removeEventListener('change', syncMobileNavLayout);
  document.body.style.overflow = '';
});

const isAdmin = computed(() => auth.user?.isAdmin === true);

const showNav = computed(
  () => route.name !== 'login' && !route.meta.hidden && !isAdmin.value,
);

const showAdminBar = computed(
  () => isAdmin.value && (route.name === 'admin' || route.name === 'account'),
);

const navItems = [
  { to: '/', label: 'Ana Sayfa', icon: 'pi pi-home' },
  { to: '/secimlerim', label: 'Seçimlerim', icon: 'pi pi-check-square' },
  { to: '/puan-durumu', label: 'Puan Durumu', icon: 'pi pi-chart-bar' },
  { to: '/bracket', label: 'Bracket', icon: 'pi pi-sitemap' },
  { to: '/kurallar', label: 'Kurallar', icon: 'pi pi-list' },
];

const mobileNavItems = [
  ...navItems,
  { to: '/hesap', label: 'Hesabım', icon: 'pi pi-user' },
];

function closeMobileNav() {
  mobileNavOpen.value = false;
}

function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value;
}

watch(
  () => route.fullPath,
  () => {
    closeMobileNav();
  },
);

watch(mobileNavOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

async function handleLogout() {
  closeMobileNav();
  await auth.logout();
  router.push('/giris');
}
</script>

<template>
  <Toast />
  <div class="app-shell">
    <header v-if="showNav" class="app-header" :class="{ 'is-mobile-nav-open': mobileNavOpen && isMobileNav }">
      <div class="app-header-inner">
        <div class="brand">
          <span class="brand-icon">⚽</span>
          <span>2026 DK Tahmin</span>
        </div>

        <nav class="main-nav" aria-label="Ana menü">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :title="item.label"
          >
            <i :class="item.icon" />
            <span class="nav-label">{{ item.label }}</span>
          </RouterLink>
        </nav>

        <div class="header-end">
          <RouterLink
            to="/hesap"
            class="user-chip user-chip-link header-account-desktop"
            :title="auth.user?.displayName ?? 'Hesabım'"
            aria-label="Hesabım"
          >
            <i class="pi pi-user user-chip-icon" aria-hidden="true" />
            <span class="user-chip-text">{{ auth.user?.displayName }}</span>
          </RouterLink>
          <Button
            label="Çıkış"
            icon="pi pi-sign-out"
            severity="secondary"
            text
            class="logout-btn header-logout-desktop"
            @click="handleLogout"
          />
          <Button
            v-if="isMobileNav"
            type="button"
            :icon="mobileNavOpen ? 'pi pi-times' : 'pi pi-bars'"
            severity="secondary"
            text
            rounded
            class="nav-toggle"
            :aria-expanded="mobileNavOpen"
            aria-controls="mobile-nav-panel"
            aria-label="Menü"
            @click="toggleMobileNav"
          />
        </div>
      </div>
    </header>

    <button
      v-if="showNav && isMobileNav && mobileNavOpen"
      type="button"
      class="mobile-nav-backdrop"
      aria-label="Menüyü kapat"
      @click="closeMobileNav"
    />

    <nav
      v-if="showNav && isMobileNav && mobileNavOpen"
      id="mobile-nav-panel"
      class="mobile-nav"
      aria-label="Mobil menü"
    >
      <RouterLink
        v-for="item in mobileNavItems"
        :key="`mobile-${item.to}`"
        :to="item.to"
        class="mobile-nav-link"
        @click="closeMobileNav"
      >
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </RouterLink>
      <button type="button" class="mobile-nav-link mobile-nav-logout" @click="handleLogout">
        <i class="pi pi-sign-out" />
        <span>Çıkış</span>
      </button>
    </nav>

    <header v-if="showAdminBar" class="app-header">
      <div class="app-header-inner">
        <div class="brand">
          <span class="brand-icon">⚙️</span>
          <span>Yönetim Paneli</span>
        </div>
        <div class="header-end">
          <RouterLink
            v-if="route.name === 'account'"
            :to="`/${ADMIN_PATH}`"
            class="admin-back-link"
          >
            <i class="pi pi-arrow-left" />
            <span class="admin-back-text">Panele Dön</span>
          </RouterLink>
          <RouterLink to="/hesap" class="user-chip user-chip-link" :title="auth.user?.displayName ?? 'Hesabım'" aria-label="Hesabım">
            <i class="pi pi-user user-chip-icon" aria-hidden="true" />
            <span class="user-chip-text">{{ auth.user?.displayName }}</span>
          </RouterLink>
          <Button
            label="Çıkış"
            icon="pi pi-sign-out"
            severity="secondary"
            text
            class="logout-btn"
            @click="handleLogout"
          />
        </div>
      </div>
    </header>

    <main class="app-main" :class="{ 'app-main--login': route.name === 'login' }">
      <RouterView />
    </main>
  </div>
</template>
