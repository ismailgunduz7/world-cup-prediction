<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import { useAuthStore } from '@/stores/auth';
import { ADMIN_PATH } from '@/api/client';
import FormFieldError from '@/components/FormFieldError.vue';
import { loadRememberLogin } from '@/utils/remember-login';
import {
  hasErrors,
  minLength,
  pickError,
  required,
  type ValidationErrors,
} from '@/utils/validation';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const rememberMeDays = Number(import.meta.env.VITE_REMEMBER_ME_DAYS ?? 30);

const username = ref('');
const password = ref('');
const rememberMe = ref(true);
const error = ref('');
const fieldErrors = ref<ValidationErrors>({});

const rememberMeLabel = computed(
  () => `Oturumum ${rememberMeDays} gün açık kalsın`,
);

onMounted(() => {
  const saved = loadRememberLogin();
  if (saved) {
    username.value = saved.username;
    rememberMe.value = true;
  }
});

function validateLogin(): boolean {
  const errors: ValidationErrors = {};

  const usernameReq = required(username.value, 'Kullanıcı adı');
  if (usernameReq) errors.username = usernameReq;
  else {
    const m = minLength(username.value, 2, 'Kullanıcı adı');
    if (m) errors.username = m;
  }

  const passwordReq = required(password.value, 'Şifre');
  if (passwordReq) errors.password = passwordReq;

  fieldErrors.value = errors;
  return !hasErrors(errors);
}

async function submit() {
  error.value = '';
  if (!validateLogin()) return;

  try {
    await auth.login(username.value.trim(), password.value, rememberMe.value);
    if (auth.user?.isAdmin) {
      router.push(`/${ADMIN_PATH}`);
      return;
    }
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch {
    error.value = 'Kullanıcı adı veya şifre hatalı';
  }
}
</script>

<template>
  <div class="login-page">
    <Card class="login-card">
      <template #content>
        <div class="login-brand">
          <span class="emoji">⚽</span>
          <h1>2026 Dünya Kupası</h1>
          <p class="text-muted">Tahmin Oyunu</p>
        </div>
        <form class="login-form" @submit.prevent="submit">
          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
          <div class="form-field">
            <label for="username">Kullanıcı Adı</label>
            <InputText id="username" v-model="username" autocomplete="username" class="w-full" />
            <FormFieldError :message="pickError(fieldErrors, 'username')" />
          </div>
          <div class="form-field">
            <label for="password">Şifre</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              toggle-mask
              autocomplete="current-password"
              class="w-full"
              input-class="w-full"
            />
            <FormFieldError :message="pickError(fieldErrors, 'password')" />
          </div>
          <div class="remember-row">
            <Checkbox v-model="rememberMe" input-id="remember-me" binary />
            <label for="remember-me">{{ rememberMeLabel }}</label>
          </div>
          <Button type="submit" label="Giriş Yap" icon="pi pi-sign-in" :loading="auth.loading" class="w-full" />
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-brand h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.login-brand p {
  margin: 0.25rem 0 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.25rem;
}

.remember-row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.remember-row label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  cursor: pointer;
}
</style>
