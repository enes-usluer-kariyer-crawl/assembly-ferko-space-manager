# Assembly Ferko Space Manager

Assembly Ferko çalışanları için geliştirilmiş, rol tabanlı onay sistemi, otomatik çakışma çözümü ve catering yönetimi özellikleri içeren toplantı odası rezervasyon sistemi.

## İçindekiler

- [Özellikler](#özellikler)
- [Teknoloji Stack](#teknoloji-stack)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Proje Yapısı](#proje-yapısı)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Temel Özellikler](#temel-özellikler)
- [Kullanıcı Rolleri](#kullanıcı-rolleri)
- [API ve Server Actions](#api-ve-server-actions)
- [Test Hesapları](#test-hesapları)
- [Deployment](#deployment)

## Özellikler

### Rezervasyon Yönetimi
- Toplantı odası rezervasyonu oluşturma, düzenleme ve iptal etme
- Tekrarlayan etkinlik desteği (haftalık)
- Catering talebi seçeneği
- Gerçek zamanlı müsaitlik kontrolü
- Çakışma önleme sistemi

### Büyük Etkinlik İzolasyonu (Kill Switch)
Yüksek öncelikli toplantılar için özel sistem:
- **Tetikleyici Etiketler:**
  - `ÖM-Success Meetings`
  - `Exco Toplantısı`
  - `ÖM- HR Small Talks`
- Bu etiketlerle yapılan rezervasyonlar tüm 5 odanın boş olmasını gerektirir
- Başarılı rezervasyon diğer odalarda otomatik blok oluşturur

### Onay İş Akışı
- Standart kullanıcı rezervasyonları onay bekler
- Admin rezervasyonları otomatik onaylanır
- Durum akışı: `pending` → `approved`/`rejected` → `cancelled`

### Raporlama ve Analitik
- Toplam rezervasyon ve saat istatistikleri
- Oda kullanım oranları
- En aktif kullanıcılar listesi
- Son 30 günlük aktivite logu

## Teknoloji Stack

### Frontend
| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| Next.js | 16.1.5 | React framework (App Router) |
| TypeScript | 5.7 | Tip güvenli JavaScript |
| Tailwind CSS | 3.4.19 | Utility-first CSS framework |
| shadcn/ui | - | Radix UI tabanlı bileşenler |
| react-big-calendar | 1.19.4 | Takvim görüntüleme |
| date-fns | 4.1.0 | Tarih işlemleri |

### Backend
| Teknoloji | Açıklama |
|-----------|----------|
| Next.js Server Actions | API route alternatifi |
| Supabase | PostgreSQL veritabanı ve Auth |

### UI Kütüphaneleri
- Radix UI (checkbox, dialog, label, select, slot, tooltip)
- Lucide React (ikonlar)
- Sonner (toast bildirimleri)

## Kurulum

### Gereksinimler
- Node.js 18+
- npm veya yarn
- Supabase hesabı

### Adımlar

1. **Repoyu klonlayın:**
```bash
git clone <repo-url>
cd assembly-ferko-space-manager
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Ortam değişkenlerini ayarlayın:**
```bash
cp .env.local.example .env.local
```

4. **Supabase veritabanını kurun:**
```bash
# supabase/migrations klasöründeki migration dosyalarını sırayla çalıştırın
```

5. **Geliştirme sunucusunu başlatın:**
```bash
npm run dev
```

6. **Tarayıcıda açın:**
```
http://localhost:3000
```

## Ortam Değişkenleri

`.env.local` dosyasında aşağıdaki değişkenleri tanımlayın:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Proje Yapısı

```
assembly-ferko-space-manager/
├── src/
│   ├── app/                          # Next.js App Router sayfaları
│   │   ├── admin/
│   │   │   ├── approvals/           # Admin onay yönetimi
│   │   │   └── reports/             # Analitik ve raporlama
│   │   ├── auth/
│   │   │   └── callback/            # Supabase auth callback
│   │   ├── login/                   # Giriş sayfası
│   │   ├── reservations/            # Kullanıcı rezervasyonları
│   │   ├── test-db/                 # Veritabanı test sayfası
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Ana sayfa (Dashboard)
│   │   ├── CalendarPage.tsx         # Takvim bileşeni
│   │   └── globals.css              # Global stiller
│   │
│   ├── components/
│   │   ├── calendar/                # Takvim bileşenleri
│   │   │   ├── BookingCalendar.tsx  # Ana takvim
│   │   │   ├── CalendarToolbar.tsx  # Takvim araç çubuğu
│   │   │   ├── NewReservationDialog.tsx
│   │   │   └── ReservationDetailDialog.tsx
│   │   ├── layout/
│   │   │   ├── ClientLayout.tsx     # Ana layout wrapper
│   │   │   └── Sidebar.tsx          # Navigasyon sidebar
│   │   ├── reservations/            # Rezervasyon işlem bileşenleri
│   │   └── ui/                      # shadcn/ui bileşenleri
│   │
│   ├── lib/
│   │   ├── actions/                 # Server Actions
│   │   │   ├── reservations.ts      # Rezervasyon CRUD işlemleri
│   │   │   ├── availability.ts      # Müsaitlik kontrolü
│   │   │   ├── reports.ts           # Raporlama
│   │   │   └── auth.ts              # Kimlik doğrulama
│   │   ├── supabase/                # Supabase client yapılandırması
│   │   └── utils.ts                 # Yardımcı fonksiyonlar
│   │
│   └── constants/
│       └── rooms.ts                 # Oda tanımları ve kapasiteleri
│
├── supabase/
│   └── migrations/                  # Veritabanı migration dosyaları
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## Veritabanı Şeması

### Profiles (Kullanıcı Profilleri)
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary Key (auth.users referansı) |
| email | TEXT | E-posta adresi |
| full_name | TEXT | Ad soyad |
| role | ENUM | 'admin' veya 'user' |
| is_admin | BOOLEAN | Admin flag |

### Rooms (Toplantı Odaları)
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary Key |
| name | TEXT | Oda adı (unique) |
| capacity | INTEGER | Kapasite |
| features | TEXT[] | Özellikler (projeksiyon, whiteboard, vb.) |
| is_active | BOOLEAN | Aktif durumu |

### Reservations (Rezervasyonlar)
| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary Key |
| room_id | UUID | Oda referansı |
| user_id | UUID | Kullanıcı referansı |
| title | TEXT | Rezervasyon başlığı |
| description | TEXT | Açıklama |
| start_time | TIMESTAMPTZ | Başlangıç zamanı |
| end_time | TIMESTAMPTZ | Bitiş zamanı |
| status | ENUM | 'pending', 'approved', 'rejected', 'cancelled' |
| tags | TEXT[] | Etiketler |
| catering_requested | BOOLEAN | Catering talebi |
| is_recurring | BOOLEAN | Tekrarlayan mı |
| recurrence_pattern | TEXT | 'none' veya 'weekly' |
| parent_reservation_id | UUID | Ana rezervasyon (tekrarlayan için) |

## Temel Özellikler

### Toplantı Odaları

| Oda | Kapasite |
|-----|----------|
| Büyük Oda | 20 kişi |
| Eğitim Odası | 15 kişi |
| Demo Odası | 4 kişi |
| Koltuklu Oda | 2 kişi |
| Masalı Oda | 2 kişi |

### Kimlik Doğrulama
- Magic Link ile e-posta doğrulaması
- OTP (5 dakika geçerlilik)
- Test hesapları için şifre ile giriş
- İzin verilen domain'ler: `@kariyer.net`, `@techcareer.net`, `@coens.io`
- Rate limiting: 2 dakikada 1 istek

### Güvenlik
- Row Level Security (RLS) politikaları
- Kullanıcılar sadece kendi rezervasyonlarını görebilir
- Admin kontrolü tüm sayfalarda
- E-posta domain whitelist

## Kullanıcı Rolleri

### Standart Kullanıcı
- Rezervasyon oluşturma (onay gerektirir)
- Kendi rezervasyonlarını görüntüleme
- Kendi rezervasyonlarını düzenleme/iptal etme

### Admin
- Tüm rezervasyonları görüntüleme
- Rezervasyonları onaylama/reddetme
- Herhangi bir rezervasyonu iptal etme
- Raporlara erişim
- Big Event sırasında override yapabilme
- Otomatik onay ile rezervasyon oluşturma

## API ve Server Actions

### Rezervasyon İşlemleri
```typescript
// Rezervasyonları listele
getReservations(filters?: { startDate?, endDate?, roomId? })

// Rezervasyon oluştur
createReservation(data: ReservationInput)

// Rezervasyon güncelle
updateReservation(id: string, data: Partial<ReservationInput>)

// Rezervasyon iptal et
cancelReservation(id: string)

// Rezervasyon onayla (admin)
approveReservation(id: string)

// Rezervasyon reddet (admin)
rejectReservation(id: string)
```

### Müsaitlik Kontrolü
```typescript
// Müsaitlik kontrol et (Big Event mantığı dahil)
checkAvailability(roomId: string, startTime: Date, endTime: Date, tags?: string[])
```

### Raporlama
```typescript
// İstatistikleri getir
getReportStats()
```

### Kimlik Doğrulama
```typescript
// Magic link gönder
loginWithMagicLink(email: string)

// OTP doğrula
verifyOtpCode(email: string, code: string)

// Çıkış yap
signOut()
```

## Test Hesapları

| E-posta | Şifre | Rol |
|---------|-------|-----|
| eusluer.eu@kariyer.net | test-user-password-2024 | Kullanıcı |
| eusluer.eu@coens.io | test-admin-password-2024 | Admin |

## Scripts

```bash
# Geliştirme sunucusu
npm run dev

# Production build
npm run build

# Production sunucusu
npm run start

# Lint kontrolü
npm run lint
```

## Deployment

### Railway
Production URL: `https://assembly-ferko-space-manager-production.up.railway.app`

### Vercel
```bash
npm run build
# Vercel'e deploy edin
```

### Gerekli Ayarlar
1. Supabase projesini oluşturun
2. Migration'ları çalıştırın
3. Ortam değişkenlerini ayarlayın
4. Deploy edin

## Migration Dosyaları

| Dosya | Açıklama |
|-------|----------|
| 001_initial_schema.sql | Temel tablolar |
| 002_recurring_events.sql | Tekrarlayan etkinlik desteği |
| 003_private_calendar_access.sql | RLS politikaları |
| 004_add_is_admin_column.sql | Admin kolonu |
| 005_rate_limit.sql | Rate limiting |
| 006_fix_profiles_rls.sql | Profil RLS düzeltmesi |

## Lisans

Bu proje Assembly Ferko için özel olarak geliştirilmiştir.

---

Assembly Ferko Space Manager - Toplantı odası yönetimi artık daha kolay!
