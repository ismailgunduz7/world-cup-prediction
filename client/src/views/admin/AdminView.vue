<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Password from 'primevue/password';
import ToggleSwitch from 'primevue/toggleswitch';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import api, { ADMIN_PATH } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import FormFieldError from '@/components/FormFieldError.vue';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import {
  hasErrors,
  minLength,
  optionalMinLength,
  pickError,
  required,
  requiredNumber,
  type ValidationErrors,
} from '@/utils/validation';

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
};

type TeamOption = { id: number; name_tr: string; group_code: string };

type AdminTab = 'users' | 'rules' | 'settings' | 'matches' | 'groups';

const adminTabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'users', label: 'Kullanıcılar' },
  { key: 'rules', label: 'Kurallar' },
  { key: 'settings', label: 'Ayarlar' },
  { key: 'matches', label: 'Maçlar' },
  { key: 'groups', label: 'Gruplar' },
];

const activeTab = ref<AdminTab>('users');

const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();
const loading = ref(true);

const users = ref<UserRow[]>([]);
const rules = ref<Array<Record<string, unknown>>>([]);
const savingRuleRowId = ref<number | null>(null);
const savingTierId = ref<number | null>(null);
const config = ref<Array<{ key: string; value: Record<string, unknown> }>>([]);
const matches = ref<Array<Record<string, unknown>>>([]);
const teams = ref<TeamOption[]>([]);
const matchCount = ref(0);

type GroupStandingRow = {
  rank: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isFinalized: boolean;
  qualificationLabel: string | null;
};

type BestThirdRow = {
  globalRank: number;
  teamId: number;
  teamName: string;
  groupCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalDifference: number;
  points: number;
  isAdvancing: boolean;
};

type BestThirdSummary = {
  isReady: boolean;
  isComputed: boolean;
  rankIsManual: boolean;
  advancingCount: number;
  rows: BestThirdRow[];
};

type GroupSummary = {
  code: string;
  totalMatches: number;
  finishedMatches: number;
  isFinalized: boolean;
  rankIsManual: boolean;
  canFinalize: boolean;
  standings: GroupStandingRow[];
};

const groups = ref<GroupSummary[]>([]);
const bestThirds = ref<BestThirdSummary | null>(null);
const finalizingGroupCode = ref<string | null>(null);
const finalizingAll = ref(false);
const rebuildingStandings = ref(false);
const savingGroupRankCode = ref<string | null>(null);
const savingBestThirdRankings = ref(false);
const computingBestThirds = ref(false);
const generatingKnockoutBracket = ref(false);
const syncingKnockoutBracket = ref(false);
const knockoutBracketExists = ref(false);
const groupRankDrafts = ref<Record<string, number[]>>({});
const bestThirdRankDraft = ref<number[] | null>(null);
const eligibleTeams = ref<TeamOption[]>([]);
const eligibleTeamsMeta = ref<{ qualifierCount: number | null; requiredQualifiers: number | null } | null>(
  null,
);
const loadingEligibleTeams = ref(false);

const newUser = ref({ username: '', password: '', displayName: '', isAdmin: false });
const newUserErrors = ref<ValidationErrors>({});

const editUserVisible = ref(false);
const editUser = ref({
  id: '',
  username: '',
  password: '',
  displayName: '',
  isAdmin: false,
});
const editUserErrors = ref<ValidationErrors>({});

const scoringFlags = ref({ group_stage_counts_as_round_advancement: false });

type SelectionLockMode = 'before_first_match' | 'manual';

const selectionLock = ref<{ mode: SelectionLockMode; offset_hours: number }>({
  mode: 'before_first_match',
  offset_hours: 1,
});
const selectionLockManualAt = ref('');
const selectionLockPreview = ref<{ lockAt: string | null; isLocked: boolean } | null>(null);
const savingSelectionLock = ref(false);

const selectionLockModeOptions = [
  { label: 'İlk maçtan belirli süre önce', value: 'before_first_match' },
  { label: 'Manuel tarih', value: 'manual' },
];

const newMatch = ref({
  homeTeamId: null as number | null,
  awayTeamId: null as number | null,
  stage: null as string | null,
  groupCode: '',
  roundLabel: '',
  scheduledAt: '',
});
const newMatchErrors = ref<ValidationErrors>({});

const scoreDialogVisible = ref(false);
const scoreMatch = ref<Record<string, unknown> | null>(null);
const scoreForm = ref({ homeScore: 0, awayScore: 0, status: 'finished' });
const scoreErrors = ref<ValidationErrors>({});

const stageOptions = [
  { label: 'Grup Aşaması', value: 'group' },
  { label: 'Son 32', value: 'round_of_32' },
  { label: 'Son 16', value: 'round_of_16' },
  { label: 'Çeyrek Final', value: 'quarter_final' },
  { label: 'Yarı Final', value: 'semi_final' },
  { label: '3.lük Maçı', value: 'third_place' },
  { label: 'Final', value: 'final' },
];

const statusOptions = [
  { label: 'Planlandı', value: 'scheduled' },
  { label: 'Canlı', value: 'live' },
  { label: 'Bitti', value: 'finished' },
  { label: 'Ertelendi', value: 'postponed' },
  { label: 'İptal', value: 'cancelled' },
];

const groupOptions = 'ABCDEFGHIJKL'.split('').map((c) => ({ label: `Grup ${c}`, value: c }));

const isGroupStage = computed(() => newMatch.value.stage === 'group');

const matchTeamsPool = computed(() => {
  if (!newMatch.value.stage) return [];
  if (isGroupStage.value) {
    if (!newMatch.value.groupCode) return [];
    return teams.value.filter((t) => t.group_code === newMatch.value.groupCode);
  }
  return eligibleTeams.value;
});

const canPickTeams = computed(() => matchTeamsPool.value.length > 0);

const knockoutTeamsHint = computed(() => {
  if (!newMatch.value.stage || isGroupStage.value) return null;
  if (loadingEligibleTeams.value) return 'Uygun takımlar yükleniyor...';
  if (canPickTeams.value) {
    if (newMatch.value.stage === 'round_of_32' && eligibleTeamsMeta.value) {
      return `Son 32: ${eligibleTeamsMeta.value.qualifierCount ?? 0}/32 takım hazır (12 grup 1. + 12 grup 2. + 8 en iyi 3.)`;
    }
    return `${matchTeamsPool.value.length} takım bu tur için uygun`;
  }
  if (newMatch.value.stage === 'round_of_32') {
    return 'Son 32 için tüm gruplar finalize edilmeli ve en iyi 3.ler sıralaması belirlenmeli.';
  }
  if (newMatch.value.stage === 'third_place') {
    return '3.lük maçı için yarı final maçları bitmiş olmalı.';
  }
  return 'Bu tur için uygun takım yok — önceki tur maçları tamamlanmamış veya takımlar elenmiş olabilir.';
});

function teamToOption(t: TeamOption) {
  return { label: `${t.name_tr} (Grup ${t.group_code})`, value: t.id };
}

const homeTeamOptions = computed(() =>
  matchTeamsPool.value
    .filter((t) => t.id !== newMatch.value.awayTeamId)
    .map(teamToOption),
);

const awayTeamOptions = computed(() =>
  matchTeamsPool.value
    .filter((t) => t.id !== newMatch.value.homeTeamId)
    .map(teamToOption),
);

function onMatchStageChange() {
  newMatch.value.groupCode = '';
  newMatch.value.homeTeamId = null;
  newMatch.value.awayTeamId = null;
  if (newMatch.value.stage) {
    void loadEligibleTeams(newMatch.value.stage);
  } else {
    eligibleTeams.value = [];
    eligibleTeamsMeta.value = null;
  }
}

function onMatchGroupChange() {
  newMatch.value.homeTeamId = null;
  newMatch.value.awayTeamId = null;
}

watch(
  () => newMatch.value.homeTeamId,
  (homeId) => {
    if (homeId && homeId === newMatch.value.awayTeamId) {
      newMatch.value.awayTeamId = null;
    }
  },
);

watch(
  () => newMatch.value.awayTeamId,
  (awayId) => {
    if (awayId && awayId === newMatch.value.homeTeamId) {
      newMatch.value.homeTeamId = null;
    }
  },
);

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function loadGroups() {
  const [{ data: groupsData }, { data: bestThirdData }, { data: bracketStatus }] = await Promise.all([
    api.get(`/admin/${ADMIN_PATH}/groups`),
    api.get(`/admin/${ADMIN_PATH}/groups/best-thirds`),
    api.get(`/admin/${ADMIN_PATH}/knockout-bracket/status`),
  ]);
  groups.value = groupsData.groups;
  bestThirds.value = bestThirdData.bestThirds;
  knockoutBracketExists.value = bracketStatus.exists;
  groupRankDrafts.value = {};
  bestThirdRankDraft.value = null;
}

async function loadEligibleTeams(stage: string) {
  if (stage === 'group') {
    eligibleTeams.value = [];
    eligibleTeamsMeta.value = null;
    return;
  }

  loadingEligibleTeams.value = true;
  try {
    const { data } = await api.get(`/admin/${ADMIN_PATH}/teams/eligible`, { params: { stage } });
    eligibleTeams.value = data.teams;
    eligibleTeamsMeta.value = {
      qualifierCount: data.qualifierCount ?? null,
      requiredQualifiers: data.requiredQualifiers ?? null,
    };
  } catch {
    eligibleTeams.value = [];
    eligibleTeamsMeta.value = null;
  } finally {
    loadingEligibleTeams.value = false;
  }
}

function applySelectionLockConfig(configRows: Array<{ key: string; value: Record<string, unknown> }>) {
  const lockConfig = configRows.find((row) => row.key === 'selection_lock');
  if (lockConfig?.value) {
    selectionLock.value = {
      mode: (lockConfig.value.mode as SelectionLockMode) ?? 'before_first_match',
      offset_hours: Number(lockConfig.value.offset_hours ?? 1),
    };
  }

  const manualConfig = configRows.find((row) => row.key === 'selection_lock_manual');
  const lockedAt = manualConfig?.value?.locked_at;
  selectionLockManualAt.value =
    typeof lockedAt === 'string' ? toDatetimeLocalValue(lockedAt) : '';
}

async function refreshSelectionLockPreview() {
  const { data } = await api.get('/tournament/status');
  selectionLockPreview.value = {
    lockAt: data.selectionLockAt,
    isLocked: data.selectionsLocked,
  };
}

async function loadDashboard() {
  const { data } = await api.get(`/admin/${ADMIN_PATH}/dashboard`);
  users.value = data.users;
  rules.value = data.rules;
  config.value = data.config;
  matchCount.value = data.matchCount;

  const flags = data.config.find((c: { key: string }) => c.key === 'scoring_flags');
  if (flags) scoringFlags.value = flags.value as typeof scoringFlags.value;
  applySelectionLockConfig(data.config);

  const [{ data: matchData }, { data: teamData }] = await Promise.all([
    api.get(`/admin/${ADMIN_PATH}/matches`),
    api.get(`/admin/${ADMIN_PATH}/teams`),
    loadGroups(),
    refreshSelectionLockPreview(),
  ]);
  matches.value = matchData.matches;
  teams.value = teamData.teams;
  loading.value = false;

  if (newMatch.value.stage && newMatch.value.stage !== 'group') {
    await loadEligibleTeams(newMatch.value.stage);
  }
}

onMounted(loadDashboard);

function validateNewUser(): boolean {
  const errors: ValidationErrors = {};

  const usernameReq = required(newUser.value.username, 'Kullanıcı adı');
  if (usernameReq) errors.username = usernameReq;
  else {
    const m = minLength(newUser.value.username, 2, 'Kullanıcı adı');
    if (m) errors.username = m;
  }

  const displayReq = required(newUser.value.displayName, 'Görünen ad');
  if (displayReq) errors.displayName = displayReq;
  else {
    const m = minLength(newUser.value.displayName, 2, 'Görünen ad');
    if (m) errors.displayName = m;
  }

  const passwordReq = required(newUser.value.password, 'Şifre');
  if (passwordReq) errors.password = passwordReq;
  else {
    const m = minLength(newUser.value.password, 6, 'Şifre');
    if (m) errors.password = m;
  }

  newUserErrors.value = errors;
  return !hasErrors(errors);
}

async function createUser() {
  if (!validateNewUser()) return;

  try {
    await api.post(`/admin/${ADMIN_PATH}/users`, {
      username: newUser.value.username.trim(),
      password: newUser.value.password,
      displayName: newUser.value.displayName.trim(),
      isAdmin: newUser.value.isAdmin,
    });
    toast.add({ severity: 'success', summary: 'Kullanıcı oluşturuldu', life: 3000 });
    newUser.value = { username: '', password: '', displayName: '', isAdmin: false };
    newUserErrors.value = {};
    await loadDashboard();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
  }
}

function openEditUser(user: UserRow) {
  editUser.value = {
    id: user.id,
    username: user.username,
    password: '',
    displayName: user.display_name,
    isAdmin: user.is_admin,
  };
  editUserErrors.value = {};
  editUserVisible.value = true;
}

function validateEditUser(): boolean {
  const errors: ValidationErrors = {};

  const usernameReq = required(editUser.value.username, 'Kullanıcı adı');
  if (usernameReq) errors.username = usernameReq;
  else {
    const m = minLength(editUser.value.username, 2, 'Kullanıcı adı');
    if (m) errors.username = m;
  }

  const displayReq = required(editUser.value.displayName, 'Görünen ad');
  if (displayReq) errors.displayName = displayReq;
  else {
    const m = minLength(editUser.value.displayName, 2, 'Görünen ad');
    if (m) errors.displayName = m;
  }

  const passwordHint = optionalMinLength(editUser.value.password, 6, 'Şifre');
  if (passwordHint) errors.password = passwordHint;

  editUserErrors.value = errors;
  return !hasErrors(errors);
}

async function saveEditUser() {
  if (!validateEditUser()) return;

  try {
    await api.put(`/admin/${ADMIN_PATH}/users/${editUser.value.id}`, {
      username: editUser.value.username.trim(),
      displayName: editUser.value.displayName.trim(),
      isAdmin: editUser.value.isAdmin,
      password: editUser.value.password.trim() || undefined,
    });
    toast.add({ severity: 'success', summary: 'Kullanıcı güncellendi', life: 3000 });
    editUserVisible.value = false;
    await loadDashboard();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
  }
}

function confirmDeleteUser(user: UserRow) {
  confirm.require({
    message: `"${user.display_name}" kullanıcısı ve tüm verileri silinecek. Emin misiniz?`,
    header: 'Kullanıcıyı Sil',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'İptal',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/admin/${ADMIN_PATH}/users/${user.id}`);
        toast.add({ severity: 'success', summary: 'Kullanıcı silindi', life: 3000 });
        await loadDashboard();
      } catch (err: unknown) {
        toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
      }
    },
  });
}

function validateNewMatch(): boolean {
  const errors: ValidationErrors = {};

  if (!newMatch.value.stage) {
    errors.stage = 'Tur seçimi zorunludur';
  }

  if (isGroupStage.value && !newMatch.value.groupCode) {
    errors.groupCode = 'Grup seçimi zorunludur';
  }

  const homeReq = requiredNumber(newMatch.value.homeTeamId, 'Ev sahibi');
  if (homeReq) errors.homeTeamId = homeReq;

  const awayReq = requiredNumber(newMatch.value.awayTeamId, 'Deplasman');
  if (awayReq) errors.awayTeamId = awayReq;

  const dateReq = required(newMatch.value.scheduledAt, 'Tarih ve saat');
  if (dateReq) errors.scheduledAt = dateReq;

  if (
    newMatch.value.homeTeamId &&
    newMatch.value.awayTeamId &&
    newMatch.value.homeTeamId === newMatch.value.awayTeamId
  ) {
    errors.awayTeamId = 'Ev sahibi ve deplasman farklı olmalıdır';
  }

  newMatchErrors.value = errors;
  return !hasErrors(errors);
}

async function createMatch() {
  if (!validateNewMatch()) return;

  try {
    const scheduledAt = new Date(newMatch.value.scheduledAt).toISOString();
    await api.post(`/admin/${ADMIN_PATH}/matches`, {
      homeTeamId: newMatch.value.homeTeamId,
      awayTeamId: newMatch.value.awayTeamId,
      stage: newMatch.value.stage,
      groupCode: newMatch.value.stage === 'group' ? newMatch.value.groupCode || undefined : undefined,
      roundLabel: newMatch.value.roundLabel.trim() || undefined,
      scheduledAt,
    });
    toast.add({ severity: 'success', summary: 'Maç eklendi', life: 3000 });
    newMatch.value = {
      homeTeamId: null,
      awayTeamId: null,
      stage: null,
      groupCode: '',
      roundLabel: '',
      scheduledAt: '',
    };
    newMatchErrors.value = {};
    await loadDashboard();
    if (newMatch.value.stage && newMatch.value.stage !== 'group') {
      await loadEligibleTeams(newMatch.value.stage);
    }
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
  }
}

function openScoreDialog(match: Record<string, unknown>) {
  scoreMatch.value = match;
  scoreForm.value = {
    homeScore: (match.home_score as number) ?? 0,
    awayScore: (match.away_score as number) ?? 0,
    status: (match.status as string) ?? 'finished',
  };
  scoreErrors.value = {};
  scoreDialogVisible.value = true;
}

function validateScore(): boolean {
  const errors: ValidationErrors = {};

  const homeReq = requiredNumber(scoreForm.value.homeScore, 'Ev sahibi skoru');
  if (homeReq) errors.homeScore = homeReq;
  else if (scoreForm.value.homeScore < 0) errors.homeScore = 'Skor negatif olamaz';

  const awayReq = requiredNumber(scoreForm.value.awayScore, 'Deplasman skoru');
  if (awayReq) errors.awayScore = awayReq;
  else if (scoreForm.value.awayScore < 0) errors.awayScore = 'Skor negatif olamaz';

  scoreErrors.value = errors;
  return !hasErrors(errors);
}

async function saveScore() {
  if (!scoreMatch.value || !validateScore()) return;

  try {
    await api.put(`/admin/${ADMIN_PATH}/matches/${scoreMatch.value.id}/result`, {
      homeScore: scoreForm.value.homeScore,
      awayScore: scoreForm.value.awayScore,
      status: scoreForm.value.status,
    });
    toast.add({ severity: 'success', summary: 'Skor güncellendi', life: 3000 });
    scoreDialogVisible.value = false;
    await loadDashboard();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
  }
}

function confirmDeleteMatch(match: Record<string, unknown>) {
  const home = teamName(match.home_team as Record<string, unknown>);
  const away = teamName(match.away_team as Record<string, unknown>);
  confirm.require({
    message: `${home} vs ${away} maçı silinecek. Emin misiniz?`,
    header: 'Maçı Sil',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'İptal',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/admin/${ADMIN_PATH}/matches/${match.id}`);
        toast.add({ severity: 'success', summary: 'Maç silindi', life: 3000 });
        await loadDashboard();
      } catch (err: unknown) {
        toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
      }
    },
  });
}

async function saveRulesBulk(updates: Array<{ id: number; points: number }>, summary: string) {
  await api.put(`/admin/${ADMIN_PATH}/rules/bulk`, { updates });
  toast.add({ severity: 'success', summary, life: 3000 });
}

async function saveRuleRow(ruleTypeId: number) {
  savingRuleRowId.value = ruleTypeId;
  try {
    const updates = rules.value
      .filter((rule) => (rule.rule_type as { id: number }).id === ruleTypeId)
      .map((rule) => ({ id: rule.id as number, points: Number(rule.points) }));
    await saveRulesBulk(updates, 'Kural satırı kaydedildi');
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
  } finally {
    savingRuleRowId.value = null;
  }
}

async function saveTierColumn(tierId: number) {
  savingTierId.value = tierId;
  try {
    const activeRuleTypeIds = new Set(
      ruleMatrixRows.value.filter((row) => row.isActive).map((row) => row.id),
    );
    const updates = rules.value
      .filter(
        (rule) =>
          activeRuleTypeIds.has((rule.rule_type as { id: number }).id) &&
          (rule.tier as { id: number }).id === tierId,
      )
      .map((rule) => ({ id: rule.id as number, points: Number(rule.points) }));
    await saveRulesBulk(updates, 'Tier sütunu kaydedildi');
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hata'), life: 4000 });
  } finally {
    savingTierId.value = null;
  }
}

async function toggleRuleType(ruleTypeId: number, isActive: boolean) {
  await api.put(`/admin/${ADMIN_PATH}/rule-types/${ruleTypeId}`, { isActive });
  for (const rule of rules.value) {
    const ruleType = rule.rule_type as { id: number; is_active: boolean };
    if (ruleType.id === ruleTypeId) {
      ruleType.is_active = isActive;
    }
  }
  toast.add({
    severity: 'success',
    summary: isActive ? 'Kural aktifleştirildi' : 'Kural pasifleştirildi',
    life: 3000,
  });
}

async function saveScoringFlags() {
  await api.put(`/admin/${ADMIN_PATH}/config/scoring_flags`, { value: scoringFlags.value });
  toast.add({ severity: 'success', summary: 'Ayar kaydedildi', life: 3000 });
}

async function saveSelectionLock() {
  savingSelectionLock.value = true;
  try {
    await api.put(`/admin/${ADMIN_PATH}/config/selection_lock`, { value: selectionLock.value });

    const lockedAt = selectionLockManualAt.value.trim()
      ? new Date(selectionLockManualAt.value).toISOString()
      : null;

    if (selectionLock.value.mode === 'manual' && !lockedAt) {
      toast.add({
        severity: 'warn',
        summary: 'Kilit tarihi gerekli',
        detail: 'Manuel mod için tarih ve saat seçin',
        life: 4000,
      });
      return;
    }

    await api.put(`/admin/${ADMIN_PATH}/config/selection_lock_manual`, {
      value: { locked_at: selectionLock.value.mode === 'manual' ? lockedAt : null },
    });

    await refreshSelectionLockPreview();
    toast.add({ severity: 'success', summary: 'Seçim kilidi kaydedildi', life: 3000 });
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Kaydedilemedi'), life: 4000 });
  } finally {
    savingSelectionLock.value = false;
  }
}

async function recalculate() {
  const { data } = await api.post(`/admin/${ADMIN_PATH}/recalculate`);
  toast.add({
    severity: 'info',
    summary: 'Yeniden hesaplandı',
    detail: `${data.entriesCount} puan kaydı`,
    life: 3000,
  });
}

async function rebuildStandings() {
  rebuildingStandings.value = true;
  try {
    const { data } = await api.post(`/admin/${ADMIN_PATH}/groups/rebuild-standings`);
    toast.add({
      severity: 'success',
      summary: 'Puan tabloları güncellendi',
      detail: `${data.recalculated.entriesCount} puan kaydı`,
      life: 3500,
    });
    await loadGroups();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hesaplanamadı'), life: 4000 });
  } finally {
    rebuildingStandings.value = false;
  }
}

const groupsReadyToFinalize = computed(() =>
  groups.value.filter((group) => group.canFinalize && !group.isFinalized),
);

function groupStatusLabel(group: GroupSummary) {
  if (group.isFinalized) return 'Finalize edildi';
  if (group.canFinalize) return 'Finalize edilebilir';
  return `${group.finishedMatches}/${group.totalMatches} maç bitti`;
}

function groupStatusSeverity(group: GroupSummary): 'success' | 'warn' | 'secondary' {
  if (group.isFinalized) return 'success';
  if (group.canFinalize) return 'warn';
  return 'secondary';
}

function orderedStandings(group: GroupSummary): GroupStandingRow[] {
  const byId = new Map(group.standings.map((standing) => [standing.teamId, standing]));
  const order =
    groupRankDrafts.value[group.code] ??
    [...group.standings].sort((a, b) => a.rank - b.rank).map((standing) => standing.teamId);

  return order.map((teamId, index) => ({
    ...byId.get(teamId)!,
    rank: index + 1,
  }));
}

function canEditGroupRankings(group: GroupSummary) {
  return group.canFinalize || group.isFinalized;
}

function moveGroupTeam(group: GroupSummary, teamId: number, direction: 'up' | 'down') {
  const current =
    groupRankDrafts.value[group.code] ??
    [...group.standings].sort((a, b) => a.rank - b.rank).map((standing) => standing.teamId);
  const index = current.indexOf(teamId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= current.length) return;

  const next = [...current];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  groupRankDrafts.value[group.code] = next;
}

function hasRankDraft(group: GroupSummary) {
  const draft = groupRankDrafts.value[group.code];
  if (!draft) return false;

  const original = [...group.standings].sort((a, b) => a.rank - b.rank).map((standing) => standing.teamId);
  return draft.join(',') !== original.join(',');
}

async function saveGroupRankings(group: GroupSummary) {
  const teamIds =
    groupRankDrafts.value[group.code] ??
    [...group.standings].sort((a, b) => a.rank - b.rank).map((standing) => standing.teamId);

  savingGroupRankCode.value = group.code;
  try {
    const { data } = await api.put(`/admin/${ADMIN_PATH}/groups/${group.code}/rankings`, { teamIds });
    toast.add({
      severity: 'success',
      summary: `Grup ${group.code} sıralaması kaydedildi`,
      detail: `${data.recalculated.entriesCount} puan kaydı`,
      life: 3500,
    });
    await loadGroups();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Kaydedilemedi'), life: 4000 });
  } finally {
    savingGroupRankCode.value = null;
  }
}

const allGroupsFinalized = computed(
  () => groups.value.length > 0 && groups.value.every((group) => group.isFinalized),
);

function orderedBestThirdRows(): BestThirdRow[] {
  if (!bestThirds.value?.rows.length) return [];
  const byId = new Map(bestThirds.value.rows.map((row) => [row.teamId, row]));
  const order =
    bestThirdRankDraft.value ??
    [...bestThirds.value.rows].sort((a, b) => a.globalRank - b.globalRank).map((row) => row.teamId);

  return order.map((teamId, index) => ({
    ...byId.get(teamId)!,
    globalRank: index + 1,
    isAdvancing: index < 8,
  }));
}

function moveBestThirdTeam(teamId: number, direction: 'up' | 'down') {
  if (!bestThirds.value?.rows.length) return;
  const current =
    bestThirdRankDraft.value ??
    [...bestThirds.value.rows].sort((a, b) => a.globalRank - b.globalRank).map((row) => row.teamId);
  const index = current.indexOf(teamId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= current.length) return;

  const next = [...current];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  bestThirdRankDraft.value = next;
}

function hasBestThirdRankDraft() {
  if (!bestThirdRankDraft.value || !bestThirds.value?.rows.length) return false;
  const original = [...bestThirds.value.rows]
    .sort((a, b) => a.globalRank - b.globalRank)
    .map((row) => row.teamId);
  return bestThirdRankDraft.value.join(',') !== original.join(',');
}

function isGroupRankQualified(row: { rank: number; qualificationLabel: string | null }) {
  return row.rank <= 3 && (row.qualificationLabel?.startsWith('Son 32') ?? false);
}

function rankBadgeClass(qualified: boolean) {
  return ['rank-badge', { 'rank-badge--qualified': qualified }];
}

async function generateKnockoutBracketAction() {
  generatingKnockoutBracket.value = true;
  try {
    const { data } = await api.post(`/admin/${ADMIN_PATH}/knockout-bracket/generate`);
    toast.add({
      severity: 'success',
      summary: 'Turnuva ağacı oluşturuldu',
      detail: `${data.created} maç (FIFA senaryo #${data.combinationNo})`,
      life: 4000,
    });
    knockoutBracketExists.value = true;
    await loadDashboard();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Oluşturulamadı'), life: 4000 });
  } finally {
    generatingKnockoutBracket.value = false;
  }
}

function confirmGenerateKnockoutBracket() {
  confirm.require({
    message: 'Son 32–Final arası 32 eleme maçı FIFA 2026 ağacına göre oluşturulacak. Son 32 eşleşmeleri en iyi 3.ler kombinasyonuna göre belirlenir.',
    header: 'Turnuva ağacını oluştur',
    icon: 'pi pi-sitemap',
    acceptLabel: 'Oluştur',
    rejectLabel: 'İptal',
    accept: () => generateKnockoutBracketAction(),
  });
}

async function syncKnockoutBracketAction() {
  syncingKnockoutBracket.value = true;
  try {
    const { data } = await api.post(`/admin/${ADMIN_PATH}/knockout-bracket/sync`);
    toast.add({
      severity: 'success',
      summary: 'Son 32 senkronize edildi',
      detail: `${data.updated} maç güncellendi${data.reset ? `, ${data.reset} maç sıfırlandı` : ''}`,
      life: 4000,
    });
    await loadDashboard();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Senkronize edilemedi'), life: 4000 });
  } finally {
    syncingKnockoutBracket.value = false;
  }
}

function confirmSyncKnockoutBracket() {
  confirm.require({
    message:
      'Son 32 takım atamaları güncel grup sıralamasına göre yeniden hesaplanır. Yanlış takımlarla oynanmış maçlar sıfırlanır ve sonraki turlara yansıyan sonuçlar temizlenir.',
    header: 'Son 32’yi senkronize et',
    icon: 'pi pi-refresh',
    acceptLabel: 'Senkronize et',
    rejectLabel: 'İptal',
    accept: () => syncKnockoutBracketAction(),
  });
}

async function computeBestThirdRankings() {
  computingBestThirds.value = true;
  try {
    const { data } = await api.post(`/admin/${ADMIN_PATH}/groups/best-thirds/compute`);
    bestThirds.value = data.bestThirds;
    bestThirdRankDraft.value = null;
    toast.add({
      severity: 'success',
      summary: 'En iyi 3.ler hesaplandı',
      detail: `${data.bestThirds.advancingCount} takım Son 32'ye katılacak`,
      life: 3500,
    });
    await loadGroups();
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Hesaplanamadı'), life: 4000 });
  } finally {
    computingBestThirds.value = false;
  }
}

async function saveBestThirdRankings() {
  if (!bestThirds.value?.rows.length) return;
  const teamIds =
    bestThirdRankDraft.value ??
    [...bestThirds.value.rows].sort((a, b) => a.globalRank - b.globalRank).map((row) => row.teamId);

  savingBestThirdRankings.value = true;
  try {
    const { data } = await api.put(`/admin/${ADMIN_PATH}/groups/best-thirds/rankings`, { teamIds });
    bestThirds.value = data.bestThirds;
    bestThirdRankDraft.value = null;
    toast.add({
      severity: 'success',
      summary: 'En iyi 3.ler sıralaması kaydedildi',
      detail: `${data.bestThirds.advancingCount} takım Son 32'ye katılacak`,
      life: 3500,
    });
    if (newMatch.value.stage && newMatch.value.stage !== 'group') {
      await loadEligibleTeams(newMatch.value.stage);
    }
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Kaydedilemedi'), life: 4000 });
  } finally {
    savingBestThirdRankings.value = false;
  }
}

function confirmRecomputeBestThirds() {
  confirm.require({
    message: 'Manuel sıralama silinir; puan → averaj → gol → takım adı (A-Z) ile otomatik sıralama uygulanır.',
    header: 'En iyi 3.leri otomatik hesapla',
    icon: 'pi pi-sort-amount-down',
    acceptLabel: 'Hesapla',
    rejectLabel: 'İptal',
    accept: () => computeBestThirdRankings(),
  });
}

function confirmFinalizeGroup(group: GroupSummary) {
  confirm.require({
    message: group.isFinalized
      ? group.rankIsManual
        ? `Grup ${group.code}: kayıtlı manuel sıralama korunur, sadece bonus puanlar güncellenir.`
        : `Grup ${group.code} sıralaması otomatik kurallara göre yeniden hesaplanır ve bonus puanlar güncellenir.`
      : `Grup ${group.code} finalize edilecek. Sıralama belirlenecek ve liderlik/ikincilik puanları dağıtılacak.`,
    header: group.isFinalized ? 'Grubu yeniden finalize et' : 'Grubu finalize et',
    icon: 'pi pi-flag',
    acceptLabel: group.isFinalized ? 'Güncelle' : 'Finalize et',
    rejectLabel: 'İptal',
    accept: () => finalizeGroup(group.code),
  });
}

function confirmApplyAutoRankings(group: GroupSummary) {
  confirm.require({
    message: `Grup ${group.code} manuel sıralama silinir; puan → averaj → gol → takım adı (A-Z) ile otomatik sıralama uygulanır.`,
    header: 'Otomatik sıralamayı uygula',
    icon: 'pi pi-sort-amount-down',
    acceptLabel: 'Uygula',
    rejectLabel: 'İptal',
    accept: () => finalizeGroup(group.code, true),
  });
}

function confirmFinalizeAllGroups() {
  const ready = groupsReadyToFinalize.value;
  if (ready.length === 0) {
    toast.add({
      severity: 'info',
      summary: 'Finalize edilecek grup yok',
      detail: 'Tüm maçları bitmiş ve henüz finalize edilmemiş grup bulunmuyor.',
      life: 3500,
    });
    return;
  }

  confirm.require({
    message: `${ready.length} grup finalize edilecek (Grup ${ready.map((g) => g.code).join(', ')}).`,
    header: 'Tüm grupları finalize et',
    icon: 'pi pi-flag-fill',
    acceptLabel: 'Finalize et',
    rejectLabel: 'İptal',
    accept: () => finalizeAllGroups(),
  });
}

async function finalizeGroup(code: string, forceAuto = false) {
  finalizingGroupCode.value = code;
  try {
    const url = forceAuto
      ? `/admin/${ADMIN_PATH}/groups/${code}/finalize?forceAuto=true`
      : `/admin/${ADMIN_PATH}/groups/${code}/finalize`;
    const { data } = await api.post(url);
    toast.add({
      severity: 'success',
      summary: forceAuto ? `Grup ${code} otomatik sıralandı` : `Grup ${code} finalize edildi`,
      detail: `${data.recalculated.entriesCount} puan kaydı`,
      life: 3500,
    });
    await loadGroups();
    if (newMatch.value.stage && newMatch.value.stage !== 'group') {
      await loadEligibleTeams(newMatch.value.stage);
    }
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Finalize edilemedi'), life: 4000 });
  } finally {
    finalizingGroupCode.value = null;
  }
}

async function finalizeAllGroups() {
  finalizingAll.value = true;
  try {
    const ready = groupsReadyToFinalize.value;
    for (const group of ready) {
      await api.post(`/admin/${ADMIN_PATH}/groups/${group.code}/finalize`);
    }
    toast.add({
      severity: 'success',
      summary: 'Gruplar finalize edildi',
      detail: `${ready.length} grup işlendi`,
      life: 3500,
    });
    await loadGroups();
    if (newMatch.value.stage && newMatch.value.stage !== 'group') {
      await loadEligibleTeams(newMatch.value.stage);
    }
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: 'Hata', detail: apiError(err, 'Finalize edilemedi'), life: 4000 });
  } finally {
    finalizingAll.value = false;
  }
}

type RuleCell = {
  id: number;
  points: number;
};

function getRuleCell(ruleTypeId: number, tierId: number): RuleCell | undefined {
  return ruleCellsByKey.value.get(`${ruleTypeId}:${tierId}`) as RuleCell | undefined;
}

const ruleCellsByKey = computed(() => {
  const map = new Map<string, Record<string, unknown>>();

  for (const rule of rules.value) {
    const ruleTypeId = (rule.rule_type as { id: number }).id;
    const tierId = (rule.tier as { id: number }).id;
    map.set(`${ruleTypeId}:${tierId}`, rule);
  }

  return map;
});

type TierColumn = {
  id: number;
  label: string;
  sortOrder: number;
};

type RuleMatrixRow = {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

const tierColumns = computed<TierColumn[]>(() => {
  const map = new Map<number, TierColumn>();

  for (const rule of rules.value) {
    const tier = rule.tier as { id: number; name_tr: string; sort_order?: number };
    if (!map.has(tier.id)) {
      map.set(tier.id, {
        id: tier.id,
        label: tier.name_tr,
        sortOrder: tier.sort_order ?? tier.id,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
});

const ruleMatrixRows = computed<RuleMatrixRow[]>(() => {
  const map = new Map<number, RuleMatrixRow>();

  for (const rule of rules.value) {
    const ruleType = rule.rule_type as {
      id: number;
      name_tr: string;
      description_tr: string | null;
      sort_order?: number;
      is_active: boolean;
    };

    if (!map.has(ruleType.id)) {
      map.set(ruleType.id, {
        id: ruleType.id,
        name: ruleType.name_tr,
        description: ruleType.description_tr,
        sortOrder: ruleType.sort_order ?? 0,
        isActive: ruleType.is_active,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
});

function ruleRowClass(data: RuleMatrixRow) {
  return data.isActive ? '' : 'rule-row-inactive';
}

function teamName(team: Record<string, unknown> | undefined) {
  return (team as { name_tr: string } | undefined)?.name_tr ?? '';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stageLabel(stage: string) {
  return stageOptions.find((s) => s.value === stage)?.label ?? stage;
}

function isSelf(userId: string) {
  return userId === auth.user?.id;
}
</script>

<template>
  <ConfirmDialog />
  <div class="page-stack admin-panel">
    <PageHeader title="Yönetim Paneli" subtitle="Kullanıcılar, kurallar, maçlar ve ayarlar" />

    <LoadingState v-if="loading" />
    <Card v-else>
      <template #content>
        <nav class="admin-tabs" role="tablist" aria-label="Yönetim sekmeleri">
          <button
            v-for="tab in adminTabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="admin-tab"
            :class="{ 'is-active': activeTab === tab.key }"
            :aria-selected="activeTab === tab.key"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div v-show="activeTab === 'users'" class="admin-tab-panel" role="tabpanel">
            <DataTable :value="users" size="small" responsive-layout="scroll">
          <Column field="username" header="Kullanıcı Adı" />
          <Column field="display_name" header="Görünen Ad" />
          <Column header="Yönetici">
            <template #body="{ data }">{{ data.is_admin ? 'Evet' : 'Hayır' }}</template>
          </Column>
          <Column header="İşlemler" style="width: 10rem">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded @click="openEditUser(data)" />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                :disabled="isSelf(data.id)"
                @click="confirmDeleteUser(data)"
              />
            </template>
          </Column>
        </DataTable>

        <div class="form-block">
          <h3 class="section-title">Yeni Kullanıcı</h3>
          <div class="form-grid">
            <div class="form-field">
              <InputText v-model="newUser.username" placeholder="Kullanıcı adı" class="w-full" />
              <FormFieldError :message="pickError(newUserErrors, 'username')" />
            </div>
            <div class="form-field">
              <Password v-model="newUser.password" placeholder="Şifre" :feedback="false" toggle-mask class="w-full" input-class="w-full" />
              <FormFieldError :message="pickError(newUserErrors, 'password')" />
            </div>
            <div class="form-field">
              <InputText v-model="newUser.displayName" placeholder="Görünen ad" class="w-full" />
              <FormFieldError :message="pickError(newUserErrors, 'displayName')" />
            </div>
            <div class="form-field form-field-toggle">
              <div class="toggle-row">
                <ToggleSwitch v-model="newUser.isAdmin" />
                <label>Yönetici</label>
              </div>
              <span class="field-error-spacer" aria-hidden="true" />
            </div>
            <div class="form-field form-field-action">
              <Button label="Oluştur" icon="pi pi-user-plus" @click="createUser" />
              <span class="field-error-spacer" aria-hidden="true" />
            </div>
          </div>
        </div>
        </div>

        <div v-show="activeTab === 'rules'" class="admin-tab-panel" role="tabpanel">
        <div class="toolbar">
          <Button label="Tüm Puanları Yeniden Hesapla" icon="pi pi-refresh" @click="recalculate" />
        </div>

        <DataTable
          :value="ruleMatrixRows"
          size="small"
          responsive-layout="scroll"
          striped-rows
          :row-class="ruleRowClass"
          class="admin-rules-matrix"
        >
          <Column header="Kural" frozen style="min-width: 13rem">
            <template #body="{ data }">
              <div class="rule-cell" :class="{ 'rule-cell-inactive': !data.isActive }">
                <ToggleSwitch
                  :model-value="data.isActive"
                  :input-id="`rule-type-${data.id}`"
                  :aria-label="data.isActive ? 'Kuralı kapat' : 'Kuralı aç'"
                  @update:model-value="toggleRuleType(data.id, $event)"
                />
                <div class="rule-cell-text">
                  <span class="rule-name">{{ data.name }}</span>
                  <span v-if="data.description" class="rule-desc">{{ data.description }}</span>
                </div>
              </div>
            </template>
          </Column>
          <Column
            v-for="tier in tierColumns"
            :key="tier.id"
            :header="tier.label"
            style="min-width: 6.5rem; width: 6.5rem"
            body-class="points-cell"
            header-class="points-header"
            footer-class="points-footer"
          >
            <template #body="{ data }">
              <InputNumber
                v-if="getRuleCell(data.id, tier.id)"
                v-model="getRuleCell(data.id, tier.id)!.points"
                mode="decimal"
                :min-fraction-digits="0"
                :max-fraction-digits="2"
                :disabled="!data.isActive"
                input-class="points-input"
                class="points-input-wrap"
              />
              <span v-else class="text-muted">—</span>
            </template>
            <template #footer>
              <Button
                label="Kaydet"
                size="small"
                severity="secondary"
                :loading="savingTierId === tier.id"
                @click="saveTierColumn(tier.id)"
              />
            </template>
          </Column>
          <Column style="width: 6.5rem" body-class="row-save-cell" footer-class="row-save-footer">
            <template #body="{ data }">
              <Button
                label="Kaydet"
                size="small"
                :disabled="!data.isActive"
                :loading="savingRuleRowId === data.id"
                @click="saveRuleRow(data.id)"
              />
            </template>
          </Column>
        </DataTable>
        </div>

        <div v-show="activeTab === 'settings'" class="admin-tab-panel settings-panel" role="tabpanel">
        <section class="settings-section">
          <h3 class="section-title">Seçim kilidi</h3>
          <Message severity="info" :closable="false">
            Oyuncuların takım seçimlerini ne zaman değiştiremeyeceğini belirleyin.
          </Message>

          <div class="form-field">
            <label for="selection-lock-mode">Kilit modu</label>
            <Select
              input-id="selection-lock-mode"
              v-model="selectionLock.mode"
              :options="selectionLockModeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div v-if="selectionLock.mode === 'before_first_match'" class="form-field">
            <label for="selection-lock-offset">İlk maçtan kaç saat önce kilitlensin?</label>
            <InputNumber
              input-id="selection-lock-offset"
              v-model="selectionLock.offset_hours"
              :min="0"
              :max="168"
              class="w-full"
            />
            <p class="field-hint text-muted">
              Takvimdeki en erken maçın başlangıcından bu kadar saat önce seçimler kilitlenir.
            </p>
          </div>

          <div v-else class="form-field">
            <label for="selection-lock-manual">Kilit tarihi ve saati</label>
            <InputText
              id="selection-lock-manual"
              v-model="selectionLockManualAt"
              type="datetime-local"
              class="w-full"
            />
            <p class="field-hint text-muted">Bu tarih geçtiğinde seçimler kilitlenir.</p>
          </div>

          <p v-if="selectionLockPreview" class="settings-preview">
            <Tag
              :value="selectionLockPreview.isLocked ? 'Kilitli' : 'Açık'"
              :severity="selectionLockPreview.isLocked ? 'danger' : 'success'"
            />
            <span v-if="selectionLockPreview.lockAt" class="text-muted">
              Kilit zamanı: {{ formatDate(selectionLockPreview.lockAt) }}
            </span>
            <span v-else class="text-muted">Kilit zamanı hesaplanamadı</span>
          </p>

          <Button
            label="Kaydet"
            icon="pi pi-check"
            :loading="savingSelectionLock"
            @click="saveSelectionLock"
          />
        </section>

        <section class="settings-section">
          <h3 class="section-title">Puanlama</h3>
          <Message severity="info" :closable="false">
            Grup aşamasının "atladığı tur başına" puanına dahil edilip edilmeyeceğini buradan değiştirebilirsiniz.
          </Message>
          <div class="settings-control">
            <ToggleSwitch v-model="scoringFlags.group_stage_counts_as_round_advancement" input-id="group-stage-advance" />
            <label for="group-stage-advance">Grup aşaması tur atlama puanına dahil</label>
          </div>
          <Button label="Kaydet" icon="pi pi-check" @click="saveScoringFlags" />
        </section>
        </div>

        <div v-show="activeTab === 'matches'" class="admin-tab-panel" role="tabpanel">
        <Message severity="info" :closable="false" class="mb-2">
          Toplam maç: {{ matchCount }}
        </Message>

        <div class="form-block">
          <h3 class="section-title">Yeni Maç</h3>
          <div class="form-grid">
            <div class="form-field">
              <label>Tur</label>
              <Select
                v-model="newMatch.stage"
                :options="stageOptions"
                option-label="label"
                option-value="value"
                placeholder="Tur seçin"
                class="w-full"
                @update:model-value="onMatchStageChange"
              />
              <FormFieldError :message="pickError(newMatchErrors, 'stage')" />
            </div>
            <div v-if="isGroupStage" class="form-field">
              <label>Grup</label>
              <Select
                v-model="newMatch.groupCode"
                :options="groupOptions"
                option-label="label"
                option-value="value"
                placeholder="Grup seçin"
                class="w-full"
                @update:model-value="onMatchGroupChange"
              />
              <FormFieldError :message="pickError(newMatchErrors, 'groupCode')" />
            </div>
            <div class="form-field">
              <label>Ev sahibi</label>
              <Select
                v-model="newMatch.homeTeamId"
                :options="homeTeamOptions"
                option-label="label"
                option-value="value"
                placeholder="Ev sahibi seçin"
                class="w-full"
                filter
                filter-placeholder="Ülke ara..."
                filter-locale="tr-TR"
                :disabled="!canPickTeams"
              />
              <FormFieldError :message="pickError(newMatchErrors, 'homeTeamId')" />
            </div>
            <div class="form-field">
              <label>Deplasman</label>
              <Select
                v-model="newMatch.awayTeamId"
                :options="awayTeamOptions"
                option-label="label"
                option-value="value"
                placeholder="Deplasman seçin"
                class="w-full"
                filter
                filter-placeholder="Ülke ara..."
                filter-locale="tr-TR"
                :disabled="!canPickTeams"
              />
              <FormFieldError :message="pickError(newMatchErrors, 'awayTeamId')" />
            </div>
            <div class="form-field">
              <label>Tur etiketi (isteğe bağlı)</label>
              <InputText v-model="newMatch.roundLabel" placeholder="Örn. Grup A - 1. Maç" class="w-full" />
            </div>
            <div class="form-field form-field-match-submit">
              <label>Tarih ve saat</label>
              <div class="match-submit-row">
                <InputText v-model="newMatch.scheduledAt" type="datetime-local" class="match-datetime-input" />
                <Button label="Maç Ekle" icon="pi pi-plus" @click="createMatch" />
              </div>
              <FormFieldError :message="pickError(newMatchErrors, 'scheduledAt')" />
            </div>
          </div>
          <Message v-if="isGroupStage && !newMatch.groupCode" severity="info" :closable="false" class="mt-2">
            Grup aşaması için önce grup, ardından takımları seçin.
          </Message>
          <Message v-else-if="newMatch.stage && !isGroupStage && knockoutTeamsHint" severity="info" :closable="false" class="mt-2">
            {{ knockoutTeamsHint }}
          </Message>
        </div>

        <DataTable :value="matches" size="small" class="mt-3" responsive-layout="scroll">
          <Column header="Maç">
            <template #body="{ data }">
              {{ teamName(data.home_team as Record<string, unknown>) }} vs
              {{ teamName(data.away_team as Record<string, unknown>) }}
            </template>
          </Column>
          <Column header="Tur">
            <template #body="{ data }">{{ stageLabel(String(data.stage)) }}</template>
          </Column>
          <Column header="Tarih">
            <template #body="{ data }">{{ formatDate(String(data.scheduled_at)) }}</template>
          </Column>
          <Column field="status" header="Durum" />
          <Column header="Skor">
            <template #body="{ data }">
              {{ data.home_score ?? '-' }} - {{ data.away_score ?? '-' }}
            </template>
          </Column>
          <Column header="İşlemler" style="width: 8rem">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded title="Skor güncelle" @click="openScoreDialog(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" title="Maçı sil" @click="confirmDeleteMatch(data)" />
            </template>
          </Column>
        </DataTable>
        </div>

        <div v-show="activeTab === 'groups'" class="admin-tab-panel groups-panel" role="tabpanel">
          <Message severity="info" :closable="false" class="mb-2">
            Eşit takımlarda oklarla sıralamayı düzenleyip <strong>Sıralamayı kaydet</strong> yeterli (bonus puanlar hemen güncellenir).
            Tie-break: puan → averaj → atılan gol → takım adı (A-Z). Manuel kayıttan sonra yeniden finalize, sıralamayı korur.
          </Message>

          <div class="groups-toolbar">
            <Button
              label="Puan tablolarını yeniden hesapla"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              :loading="rebuildingStandings"
              :disabled="rebuildingStandings || finalizingAll"
              @click="rebuildStandings"
            />
            <Button
              label="Tümünü finalize et"
              icon="pi pi-flag-fill"
              severity="secondary"
              :loading="finalizingAll"
              :disabled="groupsReadyToFinalize.length === 0 || finalizingAll || rebuildingStandings"
              @click="confirmFinalizeAllGroups"
            />
            <span v-if="groupsReadyToFinalize.length" class="groups-toolbar-hint text-muted">
              {{ groupsReadyToFinalize.length }} grup hazır
            </span>
          </div>

          <div class="groups-grid">
            <Card v-for="group in groups" :key="group.code" class="group-card">
              <template #title>
                <div class="group-card-header">
                  <span>Grup {{ group.code }}</span>
                  <div class="group-card-tags">
                    <Tag v-if="group.rankIsManual" value="Manuel sıralama" severity="info" />
                    <Tag :value="groupStatusLabel(group)" :severity="groupStatusSeverity(group)" />
                  </div>
                </div>
              </template>
              <template #content>
                <DataTable :value="orderedStandings(group)" size="small" responsive-layout="scroll">
                  <Column header="#" style="width: 2.75rem">
                    <template #body="{ data }">
                      <span :class="rankBadgeClass(isGroupRankQualified(data))">{{ data.rank }}</span>
                    </template>
                  </Column>
                  <Column field="teamName" header="Takım">
                    <template #body="{ data }">
                      <span>{{ data.teamName }}</span>
                    </template>
                  </Column>
                  <Column field="played" header="O" style="width: 2.5rem" />
                  <Column field="won" header="G" style="width: 2.5rem" />
                  <Column field="drawn" header="B" style="width: 2.5rem" />
                  <Column field="lost" header="M" style="width: 2.5rem" />
                  <Column header="Av" style="width: 3rem">
                    <template #body="{ data }">
                      {{ data.goalDifference > 0 ? `+${data.goalDifference}` : data.goalDifference }}
                    </template>
                  </Column>
                  <Column field="points" header="P" style="width: 2.5rem">
                    <template #body="{ data }">
                      <strong>{{ data.points }}</strong>
                    </template>
                  </Column>
                  <Column v-if="canEditGroupRankings(group)" header="" style="width: 4.5rem">
                    <template #body="{ data }">
                      <div class="rank-move-buttons">
                        <Button
                          icon="pi pi-chevron-up"
                          size="small"
                          text
                          rounded
                          :disabled="data.rank === 1"
                          @click="moveGroupTeam(group, data.teamId, 'up')"
                        />
                        <Button
                          icon="pi pi-chevron-down"
                          size="small"
                          text
                          rounded
                          :disabled="data.rank === group.standings.length"
                          @click="moveGroupTeam(group, data.teamId, 'down')"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>

                <div class="group-card-actions">
                  <Button
                    v-if="canEditGroupRankings(group) && hasRankDraft(group)"
                    label="Sıralamayı kaydet"
                    icon="pi pi-check"
                    size="small"
                    severity="secondary"
                    :loading="savingGroupRankCode === group.code"
                    :disabled="finalizingAll || rebuildingStandings"
                    @click="saveGroupRankings(group)"
                  />
                  <Button
                    :label="group.isFinalized ? 'Bonus puanları güncelle' : 'Finalize et'"
                    icon="pi pi-flag"
                    size="small"
                    :loading="finalizingGroupCode === group.code"
                    :disabled="!group.canFinalize || finalizingAll"
                    @click="confirmFinalizeGroup(group)"
                  />
                  <Button
                    v-if="group.isFinalized && group.rankIsManual"
                    label="Otomatik sıralamaya dön"
                    icon="pi pi-sort-amount-down"
                    size="small"
                    severity="secondary"
                    outlined
                    :loading="finalizingGroupCode === group.code"
                    :disabled="finalizingAll || rebuildingStandings"
                    @click="confirmApplyAutoRankings(group)"
                  />
                </div>
              </template>
            </Card>
          </div>

          <Card class="best-thirds-card mt-3">
            <template #title>
              <div class="group-card-header">
                <span>En İyi 3.ler (12 → 8)</span>
                <div class="group-card-tags">
                  <Tag v-if="bestThirds?.rankIsManual" value="Manuel sıralama" severity="info" />
                  <Tag
                    v-if="allGroupsFinalized"
                    value="Gruplar tamam"
                    severity="success"
                  />
                  <Tag
                    v-else
                    value="Tüm gruplar finalize edilmeli"
                    severity="warn"
                  />
                </div>
              </div>
            </template>
            <template #content>
              <Message severity="info" :closable="false" class="mb-2">
                12 grup üçüncüsü arasından en iyi 8, Son 32'ye katılır (12 birinci + 12 ikinci + 8 üçüncü = 32).
                Tie-break: puan → averaj → gol → takım adı (A-Z).
              </Message>

              <div v-if="!allGroupsFinalized" class="text-muted">
                Tüm gruplar finalize edildikten sonra tablo oluşturulur.
              </div>

              <template v-else>
                <div class="groups-toolbar mb-2">
                  <Button
                    label="Otomatik hesapla"
                    icon="pi pi-calculator"
                    size="small"
                    severity="secondary"
                    outlined
                    :loading="computingBestThirds"
                    :disabled="computingBestThirds || savingBestThirdRankings"
                    @click="confirmRecomputeBestThirds"
                  />
                  <span v-if="bestThirds?.isComputed" class="groups-toolbar-hint text-muted">
                    {{ bestThirds.advancingCount }}/8 takım Son 32'ye katılacak
                  </span>
                </div>

                <DataTable
                  v-if="bestThirds?.isComputed"
                  :value="orderedBestThirdRows()"
                  size="small"
                  responsive-layout="scroll"
                >
                  <Column header="#" style="width: 2.75rem">
                    <template #body="{ data }">
                      <span :class="rankBadgeClass(data.isAdvancing)">{{ data.globalRank }}</span>
                    </template>
                  </Column>
                  <Column header="Takım">
                    <template #body="{ data }">
                      <span>{{ data.teamName }}</span>
                      <Tag :value="`Grup ${data.groupCode}`" severity="secondary" class="ml-2 table-tag" />
                    </template>
                  </Column>
                  <Column field="played" header="O" style="width: 2.5rem" />
                  <Column field="won" header="G" style="width: 2.5rem" />
                  <Column field="drawn" header="B" style="width: 2.5rem" />
                  <Column field="lost" header="M" style="width: 2.5rem" />
                  <Column header="Av" style="width: 3rem">
                    <template #body="{ data }">
                      {{ data.goalDifference > 0 ? `+${data.goalDifference}` : data.goalDifference }}
                    </template>
                  </Column>
                  <Column field="points" header="P" style="width: 2.5rem">
                    <template #body="{ data }">
                      <strong>{{ data.points }}</strong>
                    </template>
                  </Column>
                  <Column header="" style="width: 4.5rem">
                    <template #body="{ data }">
                      <div class="rank-move-buttons">
                        <Button
                          icon="pi pi-chevron-up"
                          size="small"
                          text
                          rounded
                          :disabled="data.globalRank === 1"
                          @click="moveBestThirdTeam(data.teamId, 'up')"
                        />
                        <Button
                          icon="pi pi-chevron-down"
                          size="small"
                          text
                          rounded
                          :disabled="data.globalRank === (bestThirds?.rows.length ?? 0)"
                          @click="moveBestThirdTeam(data.teamId, 'down')"
                        />
                      </div>
                    </template>
                  </Column>
                </DataTable>

                <div v-else class="text-muted">
                  Henüz hesaplanmadı — otomatik hesapla veya tüm grupları finalize edin.
                </div>

                <div v-if="bestThirds?.isComputed" class="group-card-actions">
                  <Button
                    v-if="hasBestThirdRankDraft()"
                    label="Sıralamayı kaydet"
                    icon="pi pi-check"
                    size="small"
                    severity="secondary"
                    :loading="savingBestThirdRankings"
                    @click="saveBestThirdRankings"
                  />
                  <Button
                    v-if="!knockoutBracketExists"
                    label="Turnuva ağacını oluştur"
                    icon="pi pi-sitemap"
                    size="small"
                    :loading="generatingKnockoutBracket"
                    :disabled="generatingKnockoutBracket || savingBestThirdRankings"
                    @click="confirmGenerateKnockoutBracket"
                  />
                  <template v-else>
                    <Tag value="Turnuva ağacı oluşturuldu" severity="success" />
                    <Button
                      label="Son 32’yi senkronize et"
                      icon="pi pi-refresh"
                      size="small"
                      severity="secondary"
                      :loading="syncingKnockoutBracket"
                      :disabled="syncingKnockoutBracket || savingBestThirdRankings"
                      @click="confirmSyncKnockoutBracket"
                    />
                  </template>
                </div>
              </template>
            </template>
          </Card>
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="editUserVisible" header="Kullanıcı Düzenle" modal :style="{ width: 'min(28rem, 92vw)' }">
      <div class="dialog-form">
        <div class="form-field">
          <label>Kullanıcı adı</label>
          <InputText v-model="editUser.username" class="w-full" />
          <FormFieldError :message="pickError(editUserErrors, 'username')" />
        </div>
        <div class="form-field">
          <label>Görünen ad</label>
          <InputText v-model="editUser.displayName" class="w-full" />
          <FormFieldError :message="pickError(editUserErrors, 'displayName')" />
        </div>
        <div class="form-field">
          <label>Yeni şifre (boş bırakılırsa değişmez)</label>
          <Password v-model="editUser.password" :feedback="false" toggle-mask class="w-full" input-class="w-full" />
          <FormFieldError :message="pickError(editUserErrors, 'password')" />
        </div>
        <div class="form-field">
          <label>Yönetici</label>
          <div class="switch-align">
            <ToggleSwitch v-model="editUser.isAdmin" :disabled="isSelf(editUser.id)" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="İptal" severity="secondary" text @click="editUserVisible = false" />
        <Button label="Kaydet" icon="pi pi-check" @click="saveEditUser" />
      </template>
    </Dialog>

    <Dialog v-model:visible="scoreDialogVisible" header="Skor Güncelle" modal :style="{ width: 'min(24rem, 92vw)' }">
      <div v-if="scoreMatch" class="dialog-form">
        <p class="dialog-match-title">
          {{ teamName(scoreMatch.home_team as Record<string, unknown>) }} vs
          {{ teamName(scoreMatch.away_team as Record<string, unknown>) }}
        </p>
        <div class="form-field">
          <label>Ev sahibi skoru</label>
          <InputNumber v-model="scoreForm.homeScore" :min="0" class="w-full" />
          <FormFieldError :message="pickError(scoreErrors, 'homeScore')" />
        </div>
        <div class="form-field">
          <label>Deplasman skoru</label>
          <InputNumber v-model="scoreForm.awayScore" :min="0" class="w-full" />
          <FormFieldError :message="pickError(scoreErrors, 'awayScore')" />
        </div>
        <div class="form-field">
          <label>Durum</label>
          <Select v-model="scoreForm.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="İptal" severity="secondary" text @click="scoreDialogVisible = false" />
        <Button label="Kaydet" icon="pi pi-check" @click="saveScore" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.admin-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.25rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1rem;
}

.admin-tabs::-webkit-scrollbar {
  display: none;
}

.admin-tab {
  appearance: none;
  border: none;
  background: transparent;
  flex-shrink: 0;
  white-space: nowrap;
  padding: 0.75rem 1rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.admin-tab:hover {
  color: var(--color-text);
}

.admin-tab.is-active {
  color: var(--color-primary-hover);
  border-bottom-color: var(--color-primary);
}

.admin-tab-panel {
  padding-top: 0.25rem;
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 40rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-preview {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin: 0;
  font-size: 0.9rem;
}

.field-hint {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
}

.settings-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.settings-control label {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.admin-rules-matrix :deep(th.points-header),
.admin-rules-matrix :deep(td.points-cell),
.admin-rules-matrix :deep(td.points-footer) {
  text-align: center;
}

.admin-rules-matrix :deep(th.points-header .p-datatable-column-header-content) {
  justify-content: center;
}

.admin-rules-matrix :deep(.points-input-wrap) {
  width: 100%;
}

.admin-rules-matrix :deep(.points-input) {
  width: 100%;
  text-align: center;
}

.admin-rules-matrix :deep(td.row-save-cell),
.admin-rules-matrix :deep(td.row-save-footer) {
  text-align: center;
}

.rule-cell {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.rule-cell-text {
  min-width: 0;
}

.rule-name {
  display: block;
  font-weight: 500;
}

.rule-desc {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.footer-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.admin-rules-matrix :deep(.rule-row-inactive) {
  opacity: 0.72;
}

.rule-cell-inactive .rule-name,
.rule-cell-inactive .rule-desc {
  color: var(--color-text-muted);
}

.form-block {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.admin-panel .form-grid {
  align-items: start;
}

.switch-align {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
}

.toggle-row label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.form-field-action {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.match-submit-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.match-datetime-input {
  flex: 1;
  min-width: 0;
}

.form-field-match-submit {
  grid-column: 1 / -1;
  max-width: 36rem;
}

.field-error-spacer {
  display: block;
  min-height: 1.25rem;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toolbar {
  margin-bottom: 1rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-3 {
  margin-top: 1rem;
}

.mb-2 {
  margin-bottom: 0.75rem;
}

.dialog-match-title {
  margin: 0;
  font-weight: 600;
}

.groups-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.groups-toolbar-hint {
  font-size: 0.9rem;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.group-card :deep(.p-card-title) {
  font-size: 1rem;
}

.group-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.group-card-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.group-card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

.rank-move-buttons {
  display: flex;
  gap: 0.15rem;
}

.best-thirds-card :deep(.p-card-title) {
  font-size: 1rem;
}

.table-tag {
  font-size: 0.72rem;
}

@media (max-width: 768px) {
  .groups-grid {
    grid-template-columns: 1fr;
  }

  .admin-tab {
    padding: 0.65rem 0.75rem;
    font-size: 0.85rem;
  }

  .toolbar :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .rule-cell {
    flex-direction: column;
    gap: 0.4rem;
  }

  .admin-rules-matrix :deep(.p-datatable-frozen-column) {
    min-width: 9.5rem !important;
  }
}

@media (max-width: 640px) {
  .match-submit-row {
    flex-direction: column;
    align-items: stretch;
  }

  .match-submit-row :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }
}
</style>
