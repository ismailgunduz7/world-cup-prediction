<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Button from 'primevue/button';
import Toast from 'primevue/toast';

const MOBILE_NAV_BREAKPOINT = '(max-width: 768px)';

const route = useRoute();
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

const navItems = [
  { to: '/', label: 'Ana Sayfa', icon: 'pi pi-home' },
  { to: '/puan-durumu', label: 'Puan Durumu', icon: 'pi pi-chart-bar' },
  { to: '/fikstur', label: 'Fikstür', icon: 'pi pi-calendar' },
  { to: '/kurallar', label: 'Kurallar', icon: 'pi pi-list' },
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
</script>

<template>
  <Toast />
  <div class="app-shell">
    <header class="app-header" :class="{ 'is-mobile-nav-open': mobileNavOpen && isMobileNav }">
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
      v-if="isMobileNav && mobileNavOpen"
      type="button"
      class="mobile-nav-backdrop"
      aria-label="Menüyü kapat"
      @click="closeMobileNav"
    />

    <nav
      v-if="isMobileNav && mobileNavOpen"
      id="mobile-nav-panel"
      class="mobile-nav"
      aria-label="Mobil menü"
    >
      <RouterLink
        v-for="item in navItems"
        :key="`mobile-${item.to}`"
        :to="item.to"
        class="mobile-nav-link"
        @click="closeMobileNav"
      >
        <i :class="item.icon" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
