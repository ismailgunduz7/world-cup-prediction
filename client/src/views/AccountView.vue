<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import FormFieldError from '@/components/FormFieldError.vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/api/client';
import {
  hasErrors,
  minLength,
  pickError,
  required,
  type ValidationErrors,
} from '@/utils/validation';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const saving = ref(false);
const error = ref('');
const fieldErrors = ref<ValidationErrors>({});

function validate(): boolean {
  const errors: ValidationErrors = {};

  const currentReq = required(currentPassword.value, 'Mevcut şifre');
  if (currentReq) errors.currentPassword = currentReq;

  const newReq = required(newPassword.value, 'Yeni şifre');
  if (newReq) errors.newPassword = newReq;
  else {
    const min = minLength(newPassword.value, 6, 'Yeni şifre');
    if (min) errors.newPassword = min;
  }

  const confirmReq = required(confirmPassword.value, 'Yeni şifre tekrar');
  if (confirmReq) errors.confirmPassword = confirmReq;
  else if (confirmPassword.value !== newPassword.value) {
    errors.confirmPassword = 'Yeni şifreler eşleşmiyor';
  }

  fieldErrors.value = errors;
  return !hasErrors(errors);
}

async function submit() {
  error.value = '';
  if (!validate()) return;

  saving.value = true;
  try {
    await api.put('/me/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });

    toast.add({
      severity: 'success',
      summary: 'Şifre güncellendi',
      detail: 'Güvenlik için tekrar giriş yapmanız gerekiyor',
      life: 4000,
    });

    await auth.logout();
    router.push('/giris');
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Şifre değiştirilemedi';
    error.value = message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page-stack">
    <PageHeader title="Hesabım" subtitle="Şifrenizi güncelleyin" />

    <Card class="account-card">
      <template #content>
        <p class="account-user">
          <strong>{{ auth.user?.displayName }}</strong>
          <span class="text-muted">@{{ auth.user?.username }}</span>
        </p>

        <form class="account-form" @submit.prevent="submit">
          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

          <div class="form-field">
            <label for="current-password">Mevcut Şifre</label>
            <Password
              id="current-password"
              v-model="currentPassword"
              :feedback="false"
              toggle-mask
              autocomplete="current-password"
              class="w-full"
              input-class="w-full"
            />
            <FormFieldError :message="pickError(fieldErrors, 'currentPassword')" />
          </div>

          <div class="form-field">
            <label for="new-password">Yeni Şifre</label>
            <Password
              id="new-password"
              v-model="newPassword"
              :feedback="false"
              toggle-mask
              autocomplete="new-password"
              class="w-full"
              input-class="w-full"
            />
            <FormFieldError :message="pickError(fieldErrors, 'newPassword')" />
          </div>

          <div class="form-field">
            <label for="confirm-password">Yeni Şifre (Tekrar)</label>
            <Password
              id="confirm-password"
              v-model="confirmPassword"
              :feedback="false"
              toggle-mask
              autocomplete="new-password"
              class="w-full"
              input-class="w-full"
            />
            <FormFieldError :message="pickError(fieldErrors, 'confirmPassword')" />
          </div>

          <Button type="submit" label="Şifreyi Güncelle" icon="pi pi-lock" :loading="saving" />
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.account-card {
  max-width: 28rem;
}

.account-user {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0 0 1.25rem;
}

.account-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
