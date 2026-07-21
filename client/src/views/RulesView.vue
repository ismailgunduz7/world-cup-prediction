<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import { useReferenceStore, type ReferenceGroup, type ReferenceTier } from '@/stores/reference';

type RuleRow = {
  id: number;
  points: number;
  ruleType: {
    id: number;
    name: string;
    description: string | null;
    sortOrder?: number;
    isActive: boolean;
  };
  tier: { id: number; name: string; sortOrder?: number };
};

type TierColumn = {
  id: number;
  label: string;
  sortOrder: number;
};

type MatrixRow = {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  pointsByTier: Record<number, number>;
};

const reference = useReferenceStore();

const loading = ref(true);
const rules = ref<RuleRow[]>([]);
const scoringFlags = ref({
  group_stage_counts_as_round_advancement: false,
  knockout_result_over_120: false,
});
const teamTiers = ref<ReferenceTier[]>([]);
const teamGroups = ref<ReferenceGroup[]>([]);

onMounted(async () => {
  const [rulesData, teamsData] = await Promise.all([
    reference.ensureScoringRules(),
    reference.ensureTeams(),
  ]);
  rules.value = rulesData.rules;
  scoringFlags.value = rulesData.scoringFlags;
  teamTiers.value = teamsData.tiers;
  teamGroups.value = teamsData.groups;
  loading.value = false;
});

// Tier başına o tier'daki takımlar (isme göre sıralı).
function teamsByTier(tierId: number) {
  return teamGroups.value
    .flatMap((g) => g.teams)
    .filter((t) => t.tier?.id === tierId)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

const tierColumns = computed<TierColumn[]>(() => {
  const map = new Map<number, TierColumn>();

  for (const rule of rules.value) {
    const tier = rule.tier;
    if (!map.has(tier.id)) {
      map.set(tier.id, {
        id: tier.id,
        label: tier.name,
        sortOrder: tier.sortOrder ?? tier.id,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
});

const matrixRows = computed<MatrixRow[]>(() => {
  const map = new Map<number, MatrixRow>();

  for (const rule of rules.value) {
    const ruleType = rule.ruleType;
    if (!ruleType.isActive) continue;

    if (!map.has(ruleType.id)) {
      map.set(ruleType.id, {
        id: ruleType.id,
        name: ruleType.name,
        description: ruleType.description,
        sortOrder: ruleType.sortOrder ?? 0,
        pointsByTier: {},
      });
    }

    map.get(ruleType.id)!.pointsByTier[rule.tier.id] = Number(rule.points);
  }

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
});

function pointsFor(row: MatrixRow, tierId: number) {
  return row.pointsByTier[tierId] ?? null;
}

function formatPoints(value: number) {
  const formatted = Number(value);
  if (Number.isInteger(formatted)) return formatted > 0 ? `+${formatted}` : String(formatted);
  return formatted > 0 ? `+${formatted}` : String(formatted);
}

function pointsClass(value: number) {
  if (value > 0) return 'text-positive';
  if (value < 0) return 'text-negative';
  return '';
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader title="Kurallar" subtitle="Tier ve kural tipine göre puan tablosu" />

    <Card class="rules-explainer">
      <template #title>Eleme turu: Uzatma ve Penaltılar</template>
      <template #content>
        <ul class="rules-notes">
          <li>
            <strong>Grup aşaması:</strong> Maçlar berabere bitebilir; galibiyet, beraberlik,
            mağlubiyet ve gol puanları maç sonucuna göre verilir.
          </li>
          <li>
            <strong>Eleme turunda 90 dakikada biten maçlar:</strong> Normal kurallar geçerlidir —
            kazanan galibiyet, kaybeden mağlubiyet puanı alır; goller maç skoruna göre sayılır.
          </li>
          <li v-if="!scoringFlags.knockout_result_over_120">
            <strong>Uzatmaya ve/veya penaltılara giden maçlar:</strong> Galibiyet/beraberlik/mağlubiyet
            ve atılan/yenilen gol puanları <strong>90 dakikanın skoru</strong> üzerinden hesaplanır.
            Maç 90 dakikada berabere olduğu için iki takım da beraberlik puanı ve 90 dakikadaki gol
            puanlarını alır. Uzatma veya penaltılarda kazanan takım <strong>ayrıca tur atlama
            bonusu</strong> kazanır.
          </li>
          <li v-else>
            <strong>Uzatmaya ve/veya penaltılara giden maçlar:</strong> Galibiyet/beraberlik/mağlubiyet
            ve atılan/yenilen gol puanları <strong>uzatma sonu (120. dakika) skoru</strong> üzerinden
            hesaplanır. Uzatmada kazanan takım galibiyet, rakibi mağlubiyet puanı alır; penaltılarda
            karara bağlanan maçlar 120. dakika skoruna göre beraberlik sayılır. Tur atlama bonusu her
            durumda kazanan takıma verilir.
          </li>
          <li>
            Penaltılar yalnızca turu kimin geçeceğini belirler; penaltı golleri puanlamaya dahil
            değildir.
          </li>
          <li>
            <strong>Tur atlama puanı:</strong> Grup aşaması bu puana
            <strong>{{ scoringFlags.group_stage_counts_as_round_advancement ? 'dahildir' : 'dahil değildir' }}</strong>.
          </li>
        </ul>
        <p class="rules-mode">
          Aktif mod:
          <strong>{{
            scoringFlags.knockout_result_over_120
              ? 'Eleme sonuçları 120 dakika üzerinden'
              : 'Eleme sonuçları 90 dakika üzerinden'
          }}</strong>
          hesaplanıyor.
        </p>
      </template>
    </Card>

    <Card>
      <template #content>
        <DataTable
          :value="matrixRows"
          size="small"
          responsive-layout="scroll"
          striped-rows
          class="rules-matrix"
        >
          <Column header="Kural" frozen style="min-width: 11rem">
            <template #body="{ data }">
              <span class="rule-name">{{ data.name }}</span>
              <span v-if="data.description" class="rule-desc">{{ data.description }}</span>
            </template>
          </Column>
          <Column
            v-for="tier in tierColumns"
            :key="tier.id"
            :header="tier.label"
            style="min-width: 5.25rem; width: 5.25rem"
            body-class="points-cell"
            header-class="points-header"
          >
            <template #body="{ data }">
              <span
                v-if="pointsFor(data, tier.id) !== null"
                :class="pointsClass(pointsFor(data, tier.id)!)"
                class="points-value"
              >
                {{ formatPoints(pointsFor(data, tier.id)!) }}
              </span>
              <span v-else class="text-muted">—</span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card class="tier-teams-card">
      <template #title>Takımların Tier Dağılımı</template>
      <template #content>
        <div class="tier-grid">
          <div v-for="tier in teamTiers" :key="tier.id" class="tier-block">
            <h3 class="tier-title">{{ tier.name }}</h3>
            <ul class="team-list">
              <li v-for="team in teamsByTier(tier.id)" :key="team.id" class="team-row">
                <RouterLink
                  :to="{ name: 'team-matches', params: { id: team.id }, query: { from: 'rules' } }"
                  class="team-link"
                >
                  {{ team.name }}
                </RouterLink>
                <Tag :value="`Grup ${team.groupCode}`" severity="secondary" class="team-group-tag" />
              </li>
            </ul>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
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

.rules-matrix :deep(th.points-header),
.rules-matrix :deep(td.points-cell) {
  text-align: center;
}

.rules-matrix :deep(th.points-header .p-datatable-column-header-content) {
  justify-content: center;
}

.points-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.rules-notes {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  line-height: 1.5;
  font-size: 0.9rem;
}

.rules-mode {
  margin: 0.9rem 0 0;
  font-size: 0.88rem;
  color: var(--color-text-muted);
}

.tier-teams-card :deep(.p-card-title) {
  font-size: 1rem;
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.tier-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.team-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.team-link {
  color: inherit;
  text-decoration: none;
  font-weight: 500;
}

.team-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.team-group-tag {
  flex-shrink: 0;
  font-size: 0.72rem;
}

@media (max-width: 900px) {
  .tier-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .tier-grid {
    grid-template-columns: 1fr;
  }
}
</style>
