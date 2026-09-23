# Penconix — Lisans Yönetim Platformu

Saf **Python (FastAPI + Jinja2 + SQLite)** projesidir. Node.js / React / TypeScript
kullanılmaz.

## Kurulum

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Çalıştırma

```bash
python main.py
# veya: uvicorn main:app --host 0.0.0.0 --port 8000
```

Uygulama `http://localhost:8000` adresinde çalışır. SQLite veritabanı
(`penconix.db`) ilk açılışta otomatik oluşturulur; `licenses` tablosuna `user_id`
kolonu eksikse **otomatik migrasyonla eklenir**, mevcut veri kaybolmaz.

## Rotalar

| Rota | Açıklama |
|---|---|
| `/` | Herkese açık tanıtım sayfası |
| `/kayit` | Müşteri kaydı (yeni hesaba 1 HWID kredisi) |
| `/giris` | Müşteri girişi (session cookie) |
| `/cikis` | Oturumu kapatır |
| `/panel` | Müşteri paneli (giriş zorunlu): lisans claim, HWID sıfırlama, indirme |
| `/download` | Güncel .exe dosyası |
| `/admin` | Yönetici: lisans listesi, üretim, HWID reset, sil (Basic Auth) |
| `/admin/kullanicilar` | Müşteri listesi + HWID kredisi verme |
| `/admin/ayarlar` | Sürüm yönetimi + .exe yükleme |
| `/api/verify` | Client .exe lisans doğrulama (POST) |
| `/api/version` | Client .exe güncel sürüm sorgusu (GET) |

## Yapılandırma (opsiyonel ortam değişkenleri)

| Değişken | Varsayılan |
|---|---|
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `penconix-admin` — **prod'da mutlaka değiştirin** |
| `SESSION_SECRET` | İlk çalıştırmada otomatik üretilip `.session_secret` dosyasına yazılır |
| `PENCONIX_DB` | `./penconix.db` |
| `PORT` | `8000` |

## Admin girişi

`/admin` altındaki tüm sayfalar HTTP Basic Auth ile korunur. Tarayıcı açılır
açılmaz kullanıcı adı/şifre sorar.

## Client .exe API sözleşmesi (değişmedi)

```json
POST /api/verify
{ "license_key": "PNX-...", "hwid": "..." }
→ { "status": "ok" | "invalid" | "disabled" | "expired" | "hwid_mismatch", "tier": "VIP" }

GET /api/version
→ { "version": "1.0.0", "download_url": "/download", ... }
```

İlk doğrulamada gelen HWID lisansa kalıcı yazılır; sonraki çağrılarda
farklı HWID gelirse `hwid_mismatch` döner. Sıfırlama panel veya admin
tarafından yapılır.

## Yönetici ilk adımları

1. `/admin` → **+ Yeni Lisans**: tier ve gün süresi seçip key üretin.
2. Key'i müşteriye iletin; müşteri `/kayit` → `/panel` → "Lisans Ekle" ile bağlar.
3. `/admin/ayarlar` → güncel `.exe` dosyasını yükleyin; `/download` anında güncellenir.
