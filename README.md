# Softium Planner

Kişisel yaşam ve iş takip uygulaması: projeler, hedefler, günlük düzen (alışkanlık + rutin), günlük ve alacak takibi (proje ödemeleri + yıllık ödemeler). Tek şifreyle korunur.

**Teknoloji:** React (Vite) · Node.js/Express · PostgreSQL · Docker

```
client/            React arayüzü
server.js          API + derlenmiş arayüzü sunar
auth.js            Şifre girişi (imzalı cookie)
schema.sql         İlk kurulumda oluşturulan tablolar
Dockerfile         Uygulama imajı
docker-compose.yml app + postgres
deploy/            nginx örneği ve yedek betiği
.env.example       Ortam değişkenleri şablonu
```

## Gereksinimler

| Ortam | Gerekenler |
|---|---|
| Sunucu (yayın) | Docker + Docker Compose, nginx, domain/alt domain, (SSL için) certbot |
| Yerel geliştirme | Node.js 20+, PostgreSQL 14+ |

## Başlatmadan önce yapılması gerekenler

1. **Repoyu klonla**
   ```bash
   git clone https://github.com/MuhammedIkbalAKGUNDOGDU/Life-Tracker-2.git
   cd Life-Tracker-2
   ```
2. **`.env` dosyasını oluştur.** `.env` repoya girmez (`.gitignore`'dadır), şifreler orada durur.
   ```bash
   cp .env.example .env
   ```
3. **`.env` içindeki değerleri doldur:**

   | Değişken | Açıklama |
   |---|---|
   | `APP_PASSWORD` | Giriş sayfasında yazacağın şifre. Uzun ve tahmin edilmesi zor olsun. |
   | `SESSION_SECRET` | Oturum cookie'sini imzalar. Üret: `openssl rand -hex 32` |
   | `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Postgres bilgileri (Docker bunlarla veritabanını kendisi oluşturur) |
   | `APP_PORT` | Sunucuda `127.0.0.1` üzerinde açılacak port (varsayılan `34823`) |

   > Production'da `APP_PASSWORD` ve `SESSION_SECRET` boşsa uygulama **başlamaz**. Bu bilerek böyle.

4. **DNS:** domain panelinde yayın yapacağın alt alan adı için (ör. `planner.alanadin.com`) sunucunun IP'sine **A kaydı** ekle.

## Sunucuda yayınlama (Docker + nginx)

### 1. Uygulamayı başlat
```bash
docker compose up -d --build
docker compose ps          # app ve db "running/healthy" olmalı
docker compose logs -f app # hata var mı bak
```
Uygulama sadece `127.0.0.1:34823`'te dinler, internetten doğrudan erişilemez. Veritabanı portu hiç dışarı açılmaz. İlk açılışta `schema.sql` ile tablolar kendiliğinden oluşur.

### 2. nginx'i ayarla
`deploy/nginx.conf.example` dosyasını örnek al:
```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/planner
sudo nano /etc/nginx/sites-available/planner      # planner.example.com -> kendi alan adın
sudo ln -s /etc/nginx/sites-available/planner /etc/nginx/sites-enabled/
```
SSL sertifikasını al (önce sertifika yokken 443 bloğunu geçici yorum satırı yap ya da certbot'un kendi ayarlamasını kullan):
```bash
sudo certbot --nginx -d planner.example.com
sudo nginx -t && sudo systemctl reload nginx
```
`proxy_set_header X-Forwarded-Proto $scheme;` satırı **şart**. Giriş cookie'sinin `Secure` olması ve istemci IP'sinin doğru görünmesi buna bağlı.

### 3. Mevcut verilerini taşı (isteğe bağlı)
Uygulama bir kez ayağa kalktıktan sonra (tablolar oluşmuş olur), kendi bilgisayarındaki verileri aktar:
```bash
# Bilgisayarında:
pg_dump -d life_tracker --data-only > data.sql
scp data.sql kullanici@sunucu:~/Life-Tracker-2/

# Sunucuda:
cd ~/Life-Tracker-2 && set -a && . ./.env && set +a
docker compose exec -T db psql -U "$DB_USER" -d "$DB_DATABASE" < data.sql
rm data.sql
```

### 4. Giriş
`https://planner.alanadin.com` adresini aç, `APP_PASSWORD` ile giriş yap. 5 hatalı denemeden sonra o IP 15 dakika kilitlenir. Oturum 30 gün sürer. Sol menüde "Çıkış Yap" var.

## Güncelleme
```bash
cd ~/Life-Tracker-2
git pull
docker compose up -d --build
```
Veritabanı `pgdata` volume'unda durur, güncellemede silinmez. **`docker compose down -v` komutunu kullanma**, `-v` veriyi siler.

## Yedekleme
`deploy/backup.sh` her çalıştığında sıkıştırılmış bir dump alır ve son 14'ünü tutar:
```bash
chmod +x deploy/backup.sh
crontab -e
# Her gece 03:00
0 3 * * * /home/kullanici/Life-Tracker-2/deploy/backup.sh >> /home/kullanici/Life-Tracker-2/backups/backup.log 2>&1
```
Geri yükleme:
```bash
gunzip -c backups/life_tracker_XXXX.sql.gz | docker compose exec -T db psql -U "$DB_USER" -d "$DB_DATABASE"
```
Yedekler sunucuyla aynı diskte durur; arada bir `scp` ile başka yere de kopyala.

## Yerel geliştirme (Docker olmadan)
```bash
createdb life_tracker && psql -d life_tracker -f schema.sql
cp .env.example .env     # DB_* ve PORT satırlarını aç, APP_PASSWORD/SESSION_SECRET'ı boş bırakırsan giriş devre dışı kalır
npm install && (cd client && npm install)
npm run dev              # API  -> http://localhost:34823
cd client && npm run dev # arayüz -> http://localhost:43921 (/api isteklerini API'ye yönlendirir)
```

## Güvenlik notları
- `.env` dosyasını asla commit etme. Şifreyi değiştirmek için `.env`'yi düzenleyip `docker compose up -d` çalıştır.
- `SESSION_SECRET`'ı değiştirirsen açık tüm oturumlar düşer.
- Tüm `/api/*` uçları giriş gerektirir; girişsiz istekler 401 döner.
- Sunucu güvenlik duvarında yalnızca 80/443 (ve SSH) açık olsun. 34823 dışarı açılmamalı.
