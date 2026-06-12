# Dünya Kupası Tahmin Oyunu

2026 FIFA Dünya Kupası için geliştirilmiş, takım seçimli ve tier tabanlı puanlama sistemine sahip bir tahmin/oyun platformu. Katılımcılar 3 takım seçer; seçtikleri takımların gerçek turnuva performansına göre puan kazanır. Yöneticiler maç skorlarını girer, grup sıralamalarını yönetir, en iyi 3. takımları belirler ve eleme ağacını otomatik oluşturur.

## İçindekiler

- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı Migrasyonları](#veritabanı-migrasyonları)
- [Ana Sayfa (Katılımcı)](#ana-sayfa-katılımcı)
- [Bracket Tahmini](#bracket-tahmini)
- [Rastgele Mod](#rastgele-mod)
- [Yarışmalar](#yarışmalar)
- [Geliştirme](#geliştirme)
- [Puanlama Sistemi](#puanlama-sistemi)
- [Turnuva Akışı](#turnuva-akışı)
- [Yönetici Paneli](#yönetici-paneli)
- [Bahis ilerlemesi (bet-client)](#bahis-ilerlemesi-bet-client)
- [Komut Satırı Araçları](#komut-satırı-araçları)
- [API Özeti](#api-özeti)
- [Mimari Notlar](#mimari-notlar)

---

## Özellikler

### Katılımcı tarafı

- JWT tabanlı kimlik doğrulama (bellekte access token + httpOnly cookie’de refresh token, rotation, “beni hatırla” desteği)
- **Faz-duyarlı ana sayfa** (turnuva durumuna göre rehber, kadro özeti veya kişisel panel)
- **Bracket tahmin kum havuzu** (grup sıralaması + en iyi 8 üçüncü → eleme ağacı; kaydedilmez, puanları etkilemez)
- **Rastgele mod** (gerçek seçimden bağımsız; koşul + tier filtresine göre animasyonlu 3 takım ataması, bir kez yeniden atma, kendi puan durumu sayfası)
- 3 takım seçimi (kilit tarihinden önce)
- Canlı puan durumu ve sıralama tablosu
- Oyuncu detay sayfası (puan kırılımı)
- Takım sayfası (maç geçmişi ve puanlar)
- Grup puan durumları ve eleme durumu etiketleri
- En iyi 3. takımlar sıralaması (12 → 8)

### Yönetici tarafı

- Gizli URL ile erişilen admin paneli
- Maç skoru girişi (grup + eleme) ve bahis istatistikleri (korner / sarı kart)
- Grup puan tablosu yönetimi ve finalize
- Manuel sıralama (beraberlik durumlarında yukarı/aşağı ok)
- En iyi 3. takım sıralaması (otomatik hesaplama + manuel düzenleme)
- Eleme turu takım filtreleme (elenen takımlar dropdown’da görünmez)
- FIFA 2026 eleme ağacı otomatik oluşturma (M73–M104)
- Puan kuralları ve tier bazlı puan tabloları düzenleme
- Kullanıcı yönetimi
- **Yarışmalar** (oyuncuları izole gruplara ayırma: kullanıcı başına tek yarışma, yarışma başına rastgele mod aç/kapa, yarışma bazlı liderlik izleme)
- Toplu puan yeniden hesaplama

### Otomasyon

- Grup finalize sonrası en iyi 3. takımların otomatik hesaplanması
- Tüm gruplar finalize edildiğinde eleme ağacının otomatik oluşturulması
- Eleme maç skoru girildiğinde kazanan/kaybedenin sonraki tura otomatik aktarılması
- Test verisi seed script’i (gerçekçi skor modu, eleme simülasyonu)

---

## Teknoloji Yığını

| Katman | Teknoloji |
| ------ | --------- |
| Frontend (tahmin) | Vue 3, TypeScript, Vite, Pinia, Vue Router, PrimeVue |
| Frontend (bahis) | Vue 3, TypeScript, Vite, Axios (tek sayfa) |
| Backend | Node.js, Hono, TypeScript |
| Veritabanı | Supabase (PostgreSQL) |
| Kimlik doğrulama | JWT + bcrypt, refresh token rotation |
| Monorepo | npm workspaces (`client`, `server`, `bet-client`) |

---

## Proje Yapısı

```text
world-cup-prediction/
├── client/                 # Vue 3 SPA (tahmin oyunu)
│   └── src/
│       ├── views/          # Sayfa bileşenleri (Home, Leaderboard, Admin, …)
│       ├── components/     # Ortak bileşenler (dashboard/, TournamentGuide, …)
│       ├── stores/         # Pinia store’ları
│       ├── api/            # Axios istemcisi
│       └── router/         # Vue Router tanımları
├── bet-client/             # Vue 3 SPA (bahis ilerlemesi — tek sayfa)
│   └── src/
│       ├── App.vue         # Korner / sarı kart ilerleme ekranı
│       ├── api.ts          # GET /bet-progress
│       └── components/icons/
├── server/                 # Hono API sunucusu
│   └── src/
│       ├── routes/         # API route’ları
│       ├── services/       # İş mantığı (puanlama, bracket, gruplar, …)
│       ├── data/           # WC2026 bracket ve 3.lük kombinasyon verileri
│       └── scripts/        # CLI araçları (create-user, seed-test-data)
├── supabase/
│   └── migrations/         # SQL migration dosyaları
├── .env.example            # Sunucu ortam değişkenleri şablonu
└── package.json            # Kök workspace script’leri
```

---

## Gereksinimler

- **Node.js** 20+
- **npm** 10+
- **Supabase** projesi (PostgreSQL)
- (Opsiyonel) `football-data.org` API anahtarı — harici maç senkronizasyonu için

---

## Kurulum

### 1. Depoyu klonlayın

```bash
git clone <repo-url>
cd world-cup-prediction
```

### 2. Bağımlılıkları yükleyin

```bash
npm install
```

### 3. Ortam değişkenlerini ayarlayın

Kök dizinde `.env` dosyası oluşturun:

```bash
cp .env.example .env
```

`client/.env` dosyasını da oluşturun:

```bash
cp client/.env.example client/.env
```

Detaylar için [Ortam Değişkenleri](#ortam-değişkenleri) bölümüne bakın.

### 4. Veritabanı migrasyonlarını uygulayın

Supabase SQL Editor’da `supabase/migrations/` altındaki dosyaları **dosya adı sırasına göre** çalıştırın (001 → 022):

```text
20260602155311_001_initial_schema.sql
20260602155311_002_seed_tiers.sql
20260602155312_003_seed_scoring_rule_types.sql
20260602155317_004_seed_tier_scoring_rules.sql
20260602155321_005_seed_teams.sql
20260602155322_006_seed_tournament_config.sql
20260602155444_007_seed_opening_match.sql
20260604191213_008_seed_group_matches.sql
20260604192731_009_rename_usa_team.sql
20260605114110_010_group_manual_rank.sql
20260605115923_011_best_third_rankings.sql
20260605125337_012_knockout_bracket_slots.sql
20260605161216_013_set_team_selections_fn.sql
20260610143342_014_random_mode.sql
20260610145828_015_random_mode_reroll_history.sql
20260610152028_016_random_mode_no_same_group.sql
20260610153359_017_seed_bronze_medal_scoring.sql
20260610154256_018_reorder_medal_scoring_rule_ids.sql
20260610155500_019_fix_advisor_findings.sql
20260610160000_020_competitions.sql
20260611120000_021_refresh_token_rotation_grace.sql
20260612100913_022_bet_progress.sql
```

> **Önemli:** Migration dosya adlarındaki zaman damgası gerçek oluşturma anını yansıtmalıdır. Yeni migration eklerken `.cursor/rules/supabase-migrations.mdc` kurallarına uyun. Ayrıntılı açıklamalar için [Veritabanı Migrasyonları](#veritabanı-migrasyonları) tablosuna bakın.

### 5. İlk yönetici kullanıcısını oluşturun

```bash
npm run create-user
```

Komut etkileşimli olarak kullanıcı adı, şifre, görünen ad ve yönetici (e/h) bilgilerini sorar.

### 6. Uygulamayı başlatın

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3001>
- Admin paneli: <http://localhost:5173/{ADMIN_PATH}> (varsayılan: `internal-console-7k9m2`)

---

## Ortam Değişkenleri

### Kök `.env` (sunucu)

| Değişken | Açıklama |
| -------- | -------- |
| `SUPABASE_URL` | Supabase proje URL’si |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role anahtarı (sunucu tarafı) |
| `JWT_ACCESS_SECRET` | Access token imzalama anahtarı (`openssl rand -hex 32`) — üretimde varsayılan değer kabul edilmez, aksi halde sunucu başlamaz |
| `JWT_REFRESH_SECRET` | Refresh token imzalama anahtarı — üretimde varsayılan değer kabul edilmez |
| `REFRESH_TOKEN_REMEMBER_TTL_DAYS` | “Beni hatırla” oturum süresi (gün) |
| `REFRESH_TOKEN_SESSION_TTL_DAYS` | Normal oturum süresi (gün) |
| `REFRESH_COOKIE_SAMESITE` | Refresh cookie SameSite politikası: `Lax` (varsayılan, aynı origin / proxy) veya `None` (client ve API farklı domain’de; `Secure` zorunlu olur) |
| `PORT` | API portu (varsayılan: `3001`) |
| `CLIENT_ORIGIN` | CORS izin verilen origin (varsayılan: `http://localhost:5173`) |
| `ADMIN_PATH` | Admin panel gizli URL segmenti |
| `FOOTBALL_DATA_API_KEY` | (Opsiyonel) Harici maç API anahtarı |

### `client/.env`

| Değişken                | Açıklama                                        |
| ----------------------- | ----------------------------------------------- |
| `VITE_ADMIN_PATH`       | Admin panel yolu — `ADMIN_PATH` ile aynı olmalı |
| `VITE_REMEMBER_ME_DAYS` | UI’da gösterilen “beni hatırla” süresi          |

---

## Veritabanı Migrasyonları

Migration dosya adı formatı:

```text
yyyyMMddHHmmss_NNN_snake_case_aciklama.sql
```

| #   | Dosya                      | Açıklama                                              |
| --- | -------------------------- | ----------------------------------------------------- |
| 001 | `initial_schema`           | Temel şema: kullanıcılar, takımlar, maçlar, puanlar   |
| 002 | `seed_tiers`               | 5 tier seviyesi                                       |
| 003 | `seed_scoring_rule_types`  | Puan kuralı türleri                                   |
| 004 | `seed_tier_scoring_rules`  | Tier × kural puan tablosu                             |
| 005 | `seed_teams`               | 48 takım (12 grup × 4)                                |
| 006 | `seed_tournament_config`   | Turnuva başlangıç ve kilit ayarları                   |
| 007 | `seed_opening_match`       | Açılış maçı                                           |
| 008 | `seed_group_matches`       | 72 grup maçı                                          |
| 009 | `rename_usa_team`          | ABD takım adı düzeltmesi                              |
| 010 | `group_manual_rank`        | Manuel grup sıralaması bayrağı                        |
| 011 | `best_third_rankings`      | En iyi 3. takımlar tablosu                            |
| 012 | `knockout_bracket_slots`   | Eleme bracket slot kolonları                          |
| 013 | `set_team_selections_fn`   | Atomik takım seçimi RPC (`set_team_selections`)       |
| 014 | `random_mode`              | Rastgele mod tabloları + RPC'ler                      |
| 015 | `random_mode_reroll_history` | Reroll geçmişi (hangi takım yerine ne geldi)        |
| 016 | `random_mode_no_same_group` | "Aynı gruptan takım gelmesin" koşulu + güncellenen RPC |
| 017 | `seed_bronze_medal_scoring` | Bronz madalya puan kuralı (3.lük maçı kazananı)       |
| 018 | `reorder_medal_scoring_rule_ids` | Madalya kural ID'lerini bronz/gümüş/altın sırasına alma |
| 019 | `fix_advisor_findings`     | Supabase advisor bulguları (SECURITY INVOKER, search_path) |
| 020 | `competitions`             | Yarışmalar tablosu + `users.competition_id` (oyuncu izolasyonu, yarışma başına rastgele mod) |
| 021 | `refresh_token_rotation_grace` | Yakın eşzamanlı refresh isteklerinde oturum düşmesini önleyen grace penceresi |
| 022 | `bet_progress`             | Bahis hedefleri (`bet_progress_config`) ve maç istatistikleri (`match_bet_stats`) |

---

## Ana Sayfa (Katılımcı)

Ana sayfa (`/`) turnuva durumuna göre dört fazda çalışır. Veri kaynağı: `GET /api/me/dashboard` (Faz 4) ve `/api/teams` (Faz 1–3 rehberi).

| Faz | Koşul | Görünüm |
| --- | ----- | ------- |
| 1 | Seçimler açık, kadro eksik | Turnuva rehberi, kilide geri sayım, Seçimlerim linki |
| 2 | Seçimler açık, 3 takım seçildi | Kadro kartları, kilide geri sayım, düzenleme mesajı ve linki, katlanabilir rehber |
| 3 | Seçimler kilitli, turnuva başlamadı | Kadro özeti, ilk maça geri sayım, katlanabilir rehber |
| 4 | Turnuva başladı | Kişisel panel: sıralama kartı, takım kartları, yaklaşan maçlar, mini lider tablosu, son hareketler, grup ilerlemesi |

Turnuva başlamadan dashboard endpoint’i yalnızca hafif veri döner (`status`, seçimler, minimal `teams`); ağır sorgular (lider tablosu, maç geçmişi, grup özeti) Faz 4’te çalışır.

Seçimi olmayan kullanıcı Faz 4’te boş-durum mesajı görür; sayfa çökmez.

---

## Bracket Tahmini

`/bracket` sayfası, katılımcıların **skorlardan tamamen bağımsız** bir eleme ağacı kurabildiği bir kum havuzudur. Hiçbir veri veritabanına yazılmaz, puan durumunu **etkilemez** ve turnuva durumundan bağımsız olarak her zaman kullanılabilir.

Akış (3 adım):

1. **Grup sıralamaları** — her grupta 4 takım sürükle-bırak ya da ok tuşlarıyla sıralanır (3. sıradaki takım üçüncülük adayı olur).
2. **En iyi 8 üçüncü** — 12 grup üçüncüsü arasından tur atlayacak 8 tanesi seçilir.
3. **Eleme ağacı** — Son 32’den finale kadar eşleşmeler oluşturulur; kullanıcı her maçta kazananı seçerek bir sonraki turu doldurur ve tahmini şampiyonu belirler.

Son 32 eşleşmeleri ve üçüncülük slot atamaları (`3@…`) resmî FIFA 2026 kombinasyon tablosuna göre sunucuda çözülür (`POST /api/bracket/preview` — salt-okunur, stateless). Eşleşme şablonu ve 495 satırlık kombinasyon tablosu tek kaynak olarak sunucuda tutulur; kazanan ilerletme mantığı (`W{n}`/`L{n}` slotları) istemcide hesaplanır. Arayüz mobil uyumludur: masaüstünde turlar yatay sütunlar, mobilde dikey istiflenir.

---

## Rastgele Mod

`/rastgele` sayfası, gerçek seçim yarışmasından **bağımsız** ikinci bir oyundur: oyuncuya, seçtiği koşula ve tier filtresine göre rastgele 3 takım atanır. Gerçek seçim akışı (`/secimlerim`) hiç değişmez; puanlama her iki modda da aynı `team_total_points` üzerinden işler. Rastgele mod, admin tarafından **her yarışma için ayrı ayrı** açılıp kapatılabilir (`competitions.random_mode_enabled`); hiçbir yarışmaya atanmamış oyuncular için kapalıdır. Bkz. [Yarışmalar](#yarışmalar).

**Koşullar** (hepsi tier filtresiyle kesişir):

- **Tamamen Rastgele** — 48 ülkenin tamamı uygun.
- **Kendi Seçtikleri Dışında** — oyuncunun gerçek modda seçtiği 3 takım hariç 45 ülke.
- **Hiç Seçilmemişlerden** — hiçbir oyuncunun gerçek modda seçmediği takımlar (randomlar değil, gerçek seçimler baz alınır).

Ek olarak **"Aynı gruptan takım gelmesin"** koşulu işaretlenebilir; bu durumda atanan 3 takımın her biri farklı bir Dünya Kupası grubundan seçilir (yeniden atmada da değişmeyen iki takımın grupları dışlanır). Bu koşul yeterli sayıda farklı grup yoksa anlamlı bir hata döndürür.

**Akış:** Oyuncu koşul + (opsiyonel) aynı-grup kuralı + tier filtresini belirler ve "Rastgele Seç"e basar. Havuz ve rastgele seçim **sunucuda** (yetkili) yapılır; istemci sonucu slot-makinesi animasyonuyla 1→2→3 sırayla açar. Tetikleme sonrası koşul ve tier filtresi **kilitlenir**. Oyuncu, takımlardan **yalnızca birini** aynı filtrelerle **bir kez** yeniden atabilir (reroll). Tüm tercihler ve atanan takımlar veritabanına yazılır (`random_mode_entries`, `random_mode_teams`). Tetikleme/yeniden atma gerçek seçimle aynı kilide tabidir (`areSelectionsLocked()`). Modun kendi puan durumu sayfası vardır (`/rastgele/puan-durumu`).

---

## Yarışmalar

Aynı turnuvayı birbirinden bağımsız oyuncu gruplarıyla (örn. aile, arkadaşlar, ofis) tek bir domain üzerinden oynatmaya yarayan, admin tarafından yönetilen bir gruplama katmanıdır. Oyuncular bu katmandan **habersizdir**: herkes aynı sisteme girer, ama yalnızca **kendi yarışmasındaki** oyuncuları görür.

- Admin, "Yarışmalar" sekmesinden anahtarlı (`key`) yarışmalar oluşturur (örn. `aile`, `arkadas`, `ofis`).
- Her oyuncu **en fazla bir** yarışmaya atanır; atama değiştirilebilir veya kaldırılabilir (Kullanıcılar sekmesindeki satır içi seçici veya düzenle ekranı).
- **İzolasyon:** Liderlik tablosu, rastgele mod liderliği, ana sayfa mini-liderlik/sıralama ve oyuncu detay sayfaları yalnızca aynı yarışmadaki oyuncuları kapsar. Başka yarışmadaki bir oyuncunun detayına erişim `404` döner. Turnuva verisi (takımlar, maçlar, gruplar, puanlama, takım puan tablosu) tüm yarışmalarda **ortaktır** — yalnızca *oyuncuların birbirini görmesi* bölünür.
- **Atanmamış oyuncu hiçbir oyuncu görmez** (liderlik tabloları boş) ve rastgele mod kapalıdır.
- **Rastgele mod yarışma başına** açılır/kapanır (`competitions.random_mode_enabled`). Örn. aile yarışmasında kapalıyken arkadaş yarışmasında açık olabilir.
- Admin, bir yarışmayı seçerek o yarışmanın oyuncularının gördüğü liderlik tablosunu izleyebilir.
- Atama değişiklikleri her istekte taze okunduğundan **anında** geçerli olur (yeni oturum/token gerekmez). Bir yarışma silindiğinde üyeleri `ON DELETE SET NULL` ile atanmamış duruma düşer.

İlgili şema: `competitions` tablosu + `users.competition_id`. Bkz. migration `020_competitions`.

---

## Geliştirme

```bash
# Her iki workspace’i birlikte başlat (tahmin oyunu)
npm run dev

# Bahis ilerlemesi client + backend
npm run dev:bet

# Yalnızca frontend
npm run dev:client

# Yalnızca bahis client (backend ayrıca gerekir)
npm run dev:bet-client

# Yalnızca backend
npm run dev:server

# Production build (tahmin oyunu)
npm run build

# Bahis client build (ayrı Netlify deploy)
npm run build:bet-client

# Hepsi
npm run build:all
```

Vite dev sunucusu `/api` isteklerini `http://localhost:3001` adresine proxy eder (`client`: 5173, `bet-client`: 5174).

---

## Puanlama Sistemi

Her takım bir **tier** (1–5) seviyesine sahiptir. Tier ne kadar yüksekse, o takımdan seçen oyuncu o kadar fazla puan potansiyeline sahiptir — ama aynı zamanda mağlubiyet cezaları da farklıdır.

### Puan kuralı türleri

| Kod               | Açıklama                  | Kategori |
| ----------------- | ------------------------- | -------- |
| `win`             | Galibiyet                 | Maç      |
| `draw`            | Beraberlik                | Maç      |
| `loss`            | Mağlubiyet                | Maç      |
| `goals_scored`    | Attığı gol (maç başına)   | Maç      |
| `goals_conceded`  | Yediği gol (maç başına)   | Maç      |
| `group_winner`    | Grup birinciliği          | Grup     |
| `group_runner_up` | Grup ikinciliği           | Grup     |
| `group_third`     | Grup üçüncülüğü           | Grup     |
| `round_advance`   | Atladığı eleme turu       | Eleme    |
| `silver_medal`    | Final kaybedeni           | Madalya  |
| `gold_medal`      | Şampiyon                  | Madalya  |
| `bronze_medal`    | 3.lük maçı kazananı       | Madalya  |

Puan değerleri admin panelinden tier bazında düzenlenebilir. Kurallar değiştirildiğinde **Puanları yeniden hesapla** butonu ile tüm puanlar güncellenir.

### Grup sıralama kriterleri

1. Puan
2. Averaj (gol farkı)
3. Atılan gol
4. Takım adı (A–Z)

Beraberlik durumunda admin manuel sıralama yapabilir; manuel sıralama finalize işleminde korunur.

---

## Turnuva Akışı

### Grup aşaması (72 maç)

- 12 grup (A–L), her grupta 4 takım
- Her takım 3 maç oynar (toplam 6 maç/grup)
- Admin skor girer → puan tabloları güncellenir
- Grup finalize edildiğinde sıralama bonus puanları (1./2./3.) hesaplanır

### En iyi 3. takımlar (12 → 8)

2026 formatında 12 grup üçüncüsü arasından en iyi 8’i Son 32’ye kalır.

- Otomatik sıralama: puan → averaj → atılan gol → grup kodu
- Admin manuel sıralama yapabilir
- Sıralama belirlendikten sonra FIFA Annex C’deki 495 senaryodan doğru 3.lük yerleşimi seçilir

### Eleme aşaması (M73–M104)

- FIFA 2026 sabit ağaç yapısı kullanılır (kura yok)
- Değişken kısım: hangi 8 grubun 3.leri kalır
- Ağaç oluşturulduğunda M73–M104 maçları veritabanına eklenir
- Skor girildiğinde kazanan (`W74` gibi) ve kaybeden (`L101` gibi) slotları sonraki tura otomatik doldurulur

```text
Grup skorları → Finalize → En iyi 3.ler → Ağaç oluştur → Eleme skorları → Kazanan ilerletme
```

---

## Yönetici Paneli

Admin paneline `/{ADMIN_PATH}` adresinden erişilir. Yönetici hesabıyla giriş yapıldığında katılımcı sayfalarına yönlendirme yapılmaz; doğrudan admin paneli açılır.

### Önerilen iş akışı

1. **Maçlar** sekmesinde grup maç skorlarını girin
2. Gerekirse **Grup puan durumunu yeniden oluştur** ile tabloları senkronize edin
3. Her grubu **Finalize et** (veya tüm grupları sırayla)
4. Beraberlik varsa ok tuşlarıyla sıralamayı düzenleyin ve kaydedin
5. **En İyi 3.ler (12→8)** kartında sıralamayı kontrol edin / düzenleyin
6. **Turnuva ağacını oluştur** (son grup finalize edildiğinde otomatik de tetiklenir)
7. Grup sıralaması değiştiyse **Son 32’yi senkronize et** ile eleme eşleşmelerini güncelleyin
8. Eleme maç skorlarını girin — kazananlar otomatik ilerler
9. Gerekirse **Puanları yeniden hesapla**

### Admin sekmeleri

| Sekme        | İşlev                                      |
| ------------ | ------------------------------------------ |
| Kullanıcılar | Kullanıcı CRUD + yarışma atama             |
| Yarışmalar   | Yarışma CRUD, yarışma başına rastgele mod aç/kapa, yarışma bazlı liderlik izleme |
| Kurallar     | Puan kuralı ve tier tabloları              |
| Ayarlar      | Turnuva config (kilit tarihi, puanlama bayrakları vb.) |
| Maçlar       | Skor girişi, korner/sarı kart istatistikleri, maç oluşturma/silme |
| Bahis        | Turnuva geneli korner / sarı kart hedefleri (Üst bahis eşikleri) |
| Gruplar      | Puan tabloları, finalize, manuel sıralama, en iyi 3.ler (12→8) |
| Rastgele     | Oyuncuların rastgele seçimleri + kullanıcı bazında sıfırlama |

---

## Bahis ilerlemesi (bet-client)

Tahmin oyunundan bağımsız, turnuva geneli **korner Üst** ve **sarı kart Üst** bahislerinin ilerlemesini gösteren tek sayfalık client. Aynı Supabase veritabanını ve backend API’yi kullanır; katılımcı endpoint’lerine bahis verisi karışmaz.

### Özellikler

- Korner ve sarı kart için ayrı progress bar (hedef aşıldığında %100’de kalır)
- `spotlightMatch`: canlı maç varsa **Canlı Maç** kartı (`kind: live`), yoksa **Sıradaki Maç** (`kind: scheduled`)
- Canlı maç kartı: skor + korner/sarı kart (girilmemiş alanlar `0`), elle giriş uyarısı; tarih/saat gösterilmez
- Sıradaki maç kartı: takımlar + maç tarihi/saati
- Bitmiş maçlar listesi (skor + takım bazlı istatistikler; girilmemiş alanlar `—`)
- Oynanan maç sayacı (`biten / 104`; toplam client tarafında hesaplanır)
- Admin panelinden özelleştirilebilir hedefler (`991` korner, `381` sarı kart varsayılan)

### API yanıtı (`GET /bet-progress`)

Public, auth gerektirmez. Katılımcı endpoint’lerinin camelCase DTO sözleşmesinden bağımsızdır; bahis verisi tahmin oyunu yanıtlarına eklenmez.

| Alan | Açıklama |
| ---- | -------- |
| `targets` | Hedef korner / sarı kart toplamları |
| `totals` | Bitmiş maçlardan toplanan gerçekleşen toplamlar |
| `progress` | Yüzde ilerleme (0–100, hedef aşımında 100’de kalır) |
| `spotlightMatch` | Canlı veya sıradaki maç (`kind`, skor, istatistik alanları) |
| `finishedMatches` | Bitmiş maçlar (yeniden eskiye) |

### Geliştirme

```bash
npm run dev:bet
```

- bet-client: <http://localhost:5174>
- Backend: <http://localhost:3001>

### Production deploy

bet-client ayrı bir Netlify sitesi olarak deploy edilir:

| Ayar | Değer |
| ---- | ----- |
| Base directory | `bet-client` |
| Build command | `npm run build -w bet-client` (repo kökünden) |
| Publish directory | `dist` |

`bet-client/public/_redirects` dosyası `/api` isteklerini Vercel backend’ine proxy’ler (tahmin client ile aynı pattern). Backend’in de deploy edilmiş olması gerekir.

### Veri modeli

| Tablo | Açıklama |
| ----- | -------- |
| `bet_progress_config` | Singleton hedefler (`target_corners`, `target_yellow_cards`) |
| `match_bet_stats` | Maç başına korner / sarı kart (`matches` ile 1:1, CASCADE delete) |

Skor girişi admin **Maçlar** sekmesindeki dialogdan yapılır; istatistikler `matches` tablosuna eklenmez.

---

## Komut Satırı Araçları

### Kullanıcı oluşturma

```bash
npm run create-user
```

### Test verisi seed

```bash
# Sıfırla + rastgele skorlarla grup aşamasını oynat
npm run seed-test-data -- --reset

# Gerçekçi skorlar (tier farkına göre favori daha sık kazanır)
npm run seed-test-data -- --reset --realistic

# Grup + eleme aşamasını simüle et
npm run seed-test-data -- --reset --realistic --with-knockout
```

#### Seed seçenekleri

| Bayrak               | Açıklama                                                                              |
| -------------------- | ------------------------------------------------------------------------------------- |
| `--reset`            | Grup skorları, puan tabloları ve eleme ilerlemelerini sıfırla; ardından maç oynat     |
| `--reset-only`       | Yalnızca sıfırla (maç oynatma); eleme maçlarını da siler                              |
| `--reset-knockout`   | `--reset` ile birlikte eleme maçlarını (M73–M104) sil                                 |
| `--keep-knockout`    | `--reset-only` / `reset-tournament` ile eleme maçlarını koru                          |
| `--clear-selections` | Oyuncu takım seçimlerini de sil (`--reset-only` ile)                                  |
| `--realistic`        | Tier tabanlı gerçekçi skor üretimi                                                    |
| `--with-knockout`    | Grup sonrası eleme maçlarını da oynat                                                 |
| `--skip-selections`  | Rastgele takım seçimi yapma                                                           |
| `--skip-finalize`    | Skor gir ama grupları finalize etme                                                   |
| `--matchday 1\|2\|3` | Yalnızca belirtilen maç haftasını oynat                                               |
| `--dry-run`          | Değişiklik yapmadan planı göster                                                      |

### Turnuva sıfırlama

```bash
# Yarışmaya hazırla: grup skorları sıfırlanır, eleme maçları silinir
npm run reset-tournament --

# Sıfırla + oyuncu takım seçimlerini de sil
npm run reset-tournament -- --clear-selections

# Eleme ağacını koru (yalnızca grup aşamasını sıfırla)
npm run reset-tournament -- --keep-knockout
```

Sıfırlama şunları temizler: grup maç skorları (durum: planlandı), grup puan tabloları, takım puan kayıtları, eleme ilerlemeleri, en iyi 3.lük sıralaması, eleme maçları (varsayılan). Kullanıcılar ve grup fikstürü korunur.

---

## API Özeti

Tüm endpoint’ler `/api` altında. Admin route’ları `/api/admin/{ADMIN_PATH}` altında.

### Genel

| Method | Endpoint             | Açıklama                         |
| ------ | -------------------- | -------------------------------- |
| GET    | `/health`            | Sağlık kontrolü                  |
| GET    | `/tournament/status` | Seçim kilidi, turnuva başlangıcı, rastgele mod (çağıranın yarışmasına göre) |
| GET    | `/bet-progress`        | Bahis ilerlemesi özeti (auth yok; bet-client)                                 |

### Kimlik doğrulama

| Method | Endpoint        | Açıklama                                      |
| ------ | --------------- | --------------------------------------------- |
| POST   | `/auth/login`   | Giriş                                         |
| POST   | `/auth/refresh` | Token yenileme                                |
| POST   | `/auth/logout`  | Çıkış                                         |
| GET    | `/me`           | Oturum bilgisi                                |
| GET    | `/me/dashboard` | Kişisel panel verisi (katılımcı; admin 403)   |
| PUT    | `/me/password`  | Şifre değiştirme                              |

### Katılımcı

| Method  | Endpoint              | Açıklama                                              |
| ------- | --------------------- | ----------------------------------------------------- |
| GET/PUT | `/selections`         | Takım seçimleri (`{ teamIds }`)                       |
| GET     | `/teams`              | Tier + grup listesi (tek kaynak `groups`)             |
| GET     | `/leaderboard`        | Sıralama tablosu                                      |
| GET     | `/players/:username/points` | Oyuncu puan detayı (username ile)               |
| GET     | `/teams/:id/matches`  | Takım maçları ve puanları                             |
| GET     | `/groups/standings`   | Grup puan durumları                                   |
| GET     | `/groups/best-thirds` | En iyi 3.ler sıralaması                               |
| POST    | `/bracket/preview`    | Bracket tahmin önizlemesi (stateless, salt-okunur)    |
| GET     | `/scoring-rules`      | Aktif puan kuralları                                  |
| GET     | `/random-mode/mine`   | Rastgele mod durumu + atanan takımlar                 |
| POST    | `/random-mode/trigger`| Rastgele 3 takım ata (koşul + tier; config'i kilitler)|
| POST    | `/random-mode/reroll` | Tek bir takımı yeniden ata (bir kez)                  |
| GET     | `/random-mode/leaderboard` | Rastgele mod sıralaması                           |

> **Yanıt sözleşmesi (katılımcı endpoint’leri).** Bu endpoint’ler ham DB satırları yerine
> yalnızca FE’nin kullandığı alanları, FE’ye uygun **camelCase** isimlerle döndürür
> (`name`, `groupCode`, `tierName`, `totalPoints`, `scheduledAt`, puan kayıtları
> `{ description, points, ruleCode, ruleName }`). Leaderboard’lar **başka kullanıcıların
> UUID/username’ini sızdırmaz**; oyuncu detayına gidiş `username` üzerindendir. `GET /teams`
> takımları tek kaynak olarak `groups` altında verir (eski tekrar eden düz `teams` dizisi
> kaldırıldı). Admin endpoint’leri bu sadeleştirmenin dışındadır. Ortak DTO dönüştürücüleri
> `server/src/lib/serializers.ts` içinde toplanır. **`GET /bet-progress` bu kapsam dışındadır**
> (public bahis özeti; korner/sarı kart verisi katılımcı endpoint’lerinde dönmez).

### Admin (seçilmiş)

| Method | Endpoint                       | Açıklama                                  |
| ------ | ------------------------------ | ----------------------------------------- |
| PUT    | `/matches/:id/result`          | Maç skoru + opsiyonel korner/sarı kart kaydet |
| GET    | `/bet-progress/config`         | Bahis hedefleri                             |
| PUT    | `/bet-progress/config`         | Bahis hedeflerini güncelle                  |
| GET    | `/competitions`                | Yarışmalar + üye sayıları                 |
| POST   | `/competitions`                | Yarışma oluştur (`key`, `name`, `randomModeEnabled`) |
| PUT    | `/competitions/:id`            | Yarışma güncelle                          |
| DELETE | `/competitions/:id`            | Yarışma sil (üyeler atanmamış olur)       |
| GET    | `/competitions/:id/leaderboard`| Yarışmanın liderlik tablosu (izleme)      |
| GET    | `/random-selections`           | Oyuncuların rastgele seçimleri            |
| DELETE | `/random-selections/:userId`   | Bir oyuncunun rastgele seçimini sıfırla   |
| POST   | `/groups/:code/finalize`       | Grubu finalize et                         |
| PUT    | `/groups/:code/rankings`       | Manuel grup sıralaması                    |
| GET    | `/groups/best-thirds`          | En iyi 3.ler durumu                       |
| POST   | `/groups/best-thirds/compute`  | Otomatik hesapla                          |
| PUT    | `/groups/best-thirds/rankings` | Manuel sıralama kaydet                    |
| POST   | `/knockout-bracket/generate`   | Eleme ağacı oluştur                       |
| POST   | `/knockout-bracket/sync`       | Son 32 takım atamalarını senkronize et    |
| GET    | `/knockout-bracket/status`     | Ağaç durumu                               |
| GET    | `/teams/eligible?stage=...`    | Eleme için uygun takımlar                 |
| POST   | `/recalculate`                 | Tüm puanları yeniden hesapla              |

---

## Mimari Notlar

### Eleme ağacı verisi

- `server/src/data/wc2026-knockout-bracket.ts` — 32 eleme maçının slot tanımları (`1E`, `2A`, `3@1E`, `W74`, `L101`, …)
- `server/src/data/wc2026-third-place-combinations.json` — FIFA’nın 495 Annex C senaryosu

### Servis katmanı

| Servis                            | Sorumluluk                                                         |
| --------------------------------- | ------------------------------------------------------------------ |
| `scoring-engine.ts`               | Puan hesaplama, grup finalize, eleme ilerleme                      |
| `group-standings-service.ts`      | Grup puan tablosu güncelleme                                       |
| `best-third-service.ts`           | En iyi 3.lük sıralaması                                            |
| `knockout-eligibility-service.ts` | Eleme turu takım uygunluğu                                         |
| `knockout-bracket-service.ts`     | Ağaç oluşturma, Son 32 senkronizasyonu, skor sonrası slot doldurma |
| `dashboard-service.ts`            | Katılımcı ana sayfa / `GET /me/dashboard` toplu veri               |
| `tournament-config.ts`            | Seçim kilidi, turnuva başlangıcı                                   |
| `bet-progress-service.ts`         | Bahis hedefleri, maç istatistikleri, public özet (`GET /bet-progress`) |

### Güvenlik

- Admin API route’ları JWT + `isAdmin` kontrolü gerektirir
- Admin panel URL’si gizli tutulur (`ADMIN_PATH` / `VITE_ADMIN_PATH`)
- Refresh token yalnızca `httpOnly` + `Secure` (üretimde) + `SameSite` cookie olarak tutulur; access token istemcide yalnızca bellekte saklanır (localStorage’a yazılmaz)
- Refresh token her yenilemede döndürülür (rotation) ve süresi dolan token’lar fırsatçı olarak temizlenir
- Üretimde varsayılan JWT secret’ları ile sunucu başlatılmaz (fail-fast)
- Supabase service role key yalnızca sunucu tarafında kullanılır; istemciye gönderilmez
- `.env` dosyaları git’e dahil edilmez

### Bilinen sınırlamalar

- Eleme ağacı görselleştirme UI’ı henüz yok (admin ve katılımcı tarafında bracket görünümü planlanabilir)
- Eleme maçları SQL seed’de yok; runtime’da ağaç oluşturma ile eklenir
- Fair play kriteri grup sıralamasında uygulanmaz

---

## Lisans

Bu proje özel kullanım içindir.
