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
- [Geliştirme](#geliştirme)
- [Puanlama Sistemi](#puanlama-sistemi)
- [Turnuva Akışı](#turnuva-akışı)
- [Yönetici Paneli](#yönetici-paneli)
- [Komut Satırı Araçları](#komut-satırı-araçları)
- [API Özeti](#api-özeti)
- [Mimari Notlar](#mimari-notlar)

---

## Özellikler

### Katılımcı tarafı

- JWT tabanlı kimlik doğrulama (bellekte access token + httpOnly cookie’de refresh token, rotation, “beni hatırla” desteği)
- **Faz-duyarlı ana sayfa** (turnuva durumuna göre rehber, kadro özeti veya kişisel panel)
- 3 takım seçimi (kilit tarihinden önce)
- Canlı puan durumu ve sıralama tablosu
- Oyuncu detay sayfası (puan kırılımı)
- Takım sayfası (maç geçmişi ve puanlar)
- Grup puan durumları ve eleme durumu etiketleri
- En iyi 3. takımlar sıralaması (12 → 8)

### Yönetici tarafı

- Gizli URL ile erişilen admin paneli
- Maç skoru girişi (grup + eleme)
- Grup puan tablosu yönetimi ve finalize
- Manuel sıralama (beraberlik durumlarında yukarı/aşağı ok)
- En iyi 3. takım sıralaması (otomatik hesaplama + manuel düzenleme)
- Eleme turu takım filtreleme (elenen takımlar dropdown’da görünmez)
- FIFA 2026 eleme ağacı otomatik oluşturma (M73–M104)
- Puan kuralları ve tier bazlı puan tabloları düzenleme
- Kullanıcı yönetimi
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
| Frontend | Vue 3, TypeScript, Vite, Pinia, Vue Router, PrimeVue |
| Backend | Node.js, Hono, TypeScript |
| Veritabanı | Supabase (PostgreSQL) |
| Kimlik doğrulama | JWT + bcrypt, refresh token rotation |
| Monorepo | npm workspaces (`client`, `server`) |

---

## Proje Yapısı

```text
world-cup-prediction/
├── client/                 # Vue 3 SPA
│   └── src/
│       ├── views/          # Sayfa bileşenleri (Home, Leaderboard, Admin, …)
│       ├── components/     # Ortak bileşenler (dashboard/, TournamentGuide, …)
│       ├── stores/         # Pinia store’ları
│       ├── api/            # Axios istemcisi
│       └── router/         # Vue Router tanımları
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

Supabase SQL Editor’da `supabase/migrations/` altındaki dosyaları **dosya adı sırasına göre** çalıştırın:

```text
001_initial_schema.sql
002_seed_tiers.sql
003_seed_scoring_rule_types.sql
004_seed_tier_scoring_rules.sql
005_seed_teams.sql
006_seed_tournament_config.sql
007_seed_opening_match.sql
008_seed_group_matches.sql
009_rename_usa_team.sql
010_group_manual_rank.sql
011_best_third_rankings.sql
012_knockout_bracket_slots.sql
013_set_team_selections_fn.sql
```

> **Önemli:** Migration dosya adlarındaki zaman damgası gerçek oluşturma anını yansıtmalıdır. Yeni migration eklerken `.cursor/rules/supabase-migrations.mdc` kurallarına uyun.

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

---

## Ana Sayfa (Katılımcı)

Ana sayfa (`/`) turnuva durumuna göre üç fazda çalışır. Veri kaynağı: `GET /api/me/dashboard` (Faz 3) ve `/api/teams` (Faz 1–2 rehberi).

| Faz | Koşul | Görünüm |
| --- | ----- | ------- |
| 1 | Seçimler açık | Turnuva rehberi (tier/grup), seçim geri sayımı, Seçimlerim linki |
| 2 | Seçimler kilitli, turnuva başlamadı | Kadro özeti (3 takım), ilk maça geri sayım, katlanabilir rehber |
| 3 | Turnuva başladı | Kişisel panel: sıralama kartı, takım kartları, yaklaşan maçlar, mini lider tablosu, son hareketler, grup ilerlemesi |

Turnuva başlamadan dashboard endpoint’i yalnızca hafif veri döner (`status`, seçimler, minimal `teams`); ağır sorgular (lider tablosu, maç geçmişi, grup özeti) Faz 3’te çalışır.

Seçimi olmayan kullanıcı Faz 3’te boş-durum mesajı görür; sayfa çökmez.

---

## Geliştirme

```bash
# Her iki workspace’i birlikte başlat
npm run dev

# Yalnızca frontend
npm run dev:client

# Yalnızca backend
npm run dev:server

# Production build
npm run build
```

Vite dev sunucusu `/api` isteklerini `http://localhost:3001` adresine proxy eder.

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
| Dashboard    | Genel durum özeti                          |
| Maçlar       | Skor girişi, maç oluşturma/silme           |
| Gruplar      | Puan tabloları, finalize, manuel sıralama  |
| En İyi 3.ler | 12→8 sıralaması                            |
| Kurallar     | Puan kuralı ve tier tabloları              |
| Ayarlar      | Turnuva config (kilit tarihi vb.)          |
| Kullanıcılar | Kullanıcı CRUD                             |

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
| GET    | `/tournament/status` | Seçim kilidi, turnuva başlangıcı |

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

| Method  | Endpoint              | Açıklama                  |
| ------- | --------------------- | ------------------------- |
| GET/PUT | `/selections`         | Takım seçimleri           |
| GET     | `/leaderboard`        | Sıralama tablosu          |
| GET     | `/players/:id`        | Oyuncu puan detayı        |
| GET     | `/teams/:id`          | Takım maçları ve puanları |
| GET     | `/groups`             | Grup puan durumları       |
| GET     | `/groups/best-thirds` | En iyi 3.ler sıralaması   |
| GET     | `/scoring-rules`      | Aktif puan kuralları      |

### Admin (seçilmiş)

| Method | Endpoint                       | Açıklama                                  |
| ------ | ------------------------------ | ----------------------------------------- |
| PUT    | `/matches/:id/result`          | Maç skoru kaydet                          |
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
