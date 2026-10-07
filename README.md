# Softium Planner

Kişisel yaşam ve iş takip uygulaması: projeler, hedefler, günlük düzen (alışkanlık + rutin), günlük ve alacak takibi (proje ödemeleri + yıllık ödemeler). Tek hesapla (kullanıcı adı + şifre) korunur.

**Özellikler:** Ana sayfa (bugünün görevleri, alışkanlıklar, haftalık özet) · Projeler (görevler, alt adımlar, öncelik, sürükle-bırak sıralama, şablonlar, ödeme geçmişi, teklif PDF) · Hedefler · Günlük düzen · Alacaklar (müşteri bazlı, aylık takvim, ekstre PDF, CSV) · Takvim · Günlük · `Ctrl+K` ile genel arama · hızlı ekle (+) · telefona yüklenebilir (PWA) · silmede "Geri al".

**Teknoloji:** React (Vite) · Node.js/Express · PostgreSQL · Docker

```
client/            React arayüzü
server.js          API + derlenmiş arayüzü sunar
auth.js            Tek hesap, şifre girişi (hash'li şifre, imzalı cookie)
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
   | `SETUP_CODE` | **İlk kurulum kodu.** Hesabı oluştururken bir kez sorulur. Domaini bulan başka biri hesabı senden önce açamasın diye vardır. Boş bırakırsan sunucu rastgele bir kod üretip loga yazar (`docker compose logs app`). |
   | `SESSION_SECRET` | İsteğe bağlı. Oturum cookie'sini imzalar. Boşsa otomatik üretilip veritabanında saklanır. |
   | `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Postgres bilgileri (Docker bunlarla veritabanını kendisi oluşturur) |
   | `APP_PORT` | Sunucuda `127.0.0.1` üzerinde açılacak port (varsayılan `34823`) |

   > Kullanıcı adı ve şifreyi `.env`'ye yazmıyorsun. Hesabı uygulamayı ilk açtığında oluşturuyorsun.

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
`https://planner.alanadin.com` adresini ilk açtığında **hesap oluşturma** ekranı gelir:
1. Kullanıcı adı ve şifre (en az 8 karakter) belirle.
2. `.env`'deki `SETUP_CODE` değerini yaz (ya da loga yazılan kodu).
3. **Hesabı Oluştur**'a bas. Bundan sonra kayıt ekranı **kalıcı olarak kapanır**, uygulamada yalnızca bu tek hesap vardır.

Sonraki her girişte kullanıcı adı ve şifre sorulur. Şifre veritabanında düz yazıyla değil, tuzlanmış `scrypt` hash'i olarak saklanır. 5 hatalı denemeden sonra o IP 15 dakika kilitlenir. Oturum 30 gün sürer. Sol menüde **Hesap** (şifre değiştirme, değişince diğer cihazlardaki oturumlar kapanır) ve **Çıkış Yap** var; telefonda "Daha" panelinde.

Şifreni unutursan: sunucuda `docker compose exec db psql -U $DB_USER -d $DB_DATABASE -c "DELETE FROM app_users;"` komutu hesabı siler ve kurulum ekranı yeniden açılır (verilerin silinmez).

## Sağlık: spor ve beslenme
Menüde **Sağlık** sekmesi: **Spor** (gün → antrenman → hareket → set; geçen seferin setleri, öneri, rekor, hacim ve 1RM grafikleri, vücut kilosu) ve **Beslenme** (kalori ve makrolar, öğünler, günlük hedefler). Telefonda alt menüyle rahat kullanılacak şekilde tasarlandı. Siteyi telefonda tarayıcıdan "Ana ekrana ekle" ile uygulama gibi kullanabilirsiniz.

- **Yemek bilgisi** ücretsiz kaynaklardan gelir: kendi kaydettiğiniz yemekler ve [Open Food Facts](https://world.openfoodfacts.org) (paketli ürünler). Open Food Facts değerleri gönüllüler tarafından girilir, paketle karşılaştırın. Bulamazsanız yemeği elle ekleyin (100 g değerleriyle).
- **Günlük hedefler** boy/kilo/yaş/aktivite/hedefe göre otomatik hesaplanır (Mifflin-St Jeor); istediğiniz değeri kendiniz yazarak ezebilirsiniz (Beslenme > dişli simgesi).

## Telegram botu: spor ve yemek girişi (isteğe bağlı, ücretsiz)
Aşağıdaki "Telegram ödeme hatırlatması" bölümündeki gibi bir bot oluşturup `TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` yazdığınızda aynı bot veri girişi için de çalışır. Yapay zekâ kullanmaz, tamamen ücretsizdir. Bot yalnızca sizin chat'inize cevap verir.

| Yazın | Ne olur |
|---|---|
| `bench 80x8 80x8 75x10` | Setleri bugünün antrenmanına ekler (onay ister) |
| `squat 100x5x3` | 100 kg × 5 tekrarı 3 set ekler |
| `bench 80x8, squat 100x5x3` | Birden fazla hareket |
| `bench` / `bench 5` | O hareketin son 3 / 5 antrenmanını gösterir, "Bugüne ekle" ve "Geçen seferkini kopyala" düğmeleri çıkar |
| `/antrenman` | Hareket seç, ağırlık ve tekrarı düğmelerle ayarla, "Seti kaydet" |
| `kahvaltı: yumurta 3 adet, ekmek 60g` | Yemekleri bulup kalori ve makroyu hesaplar (onay ister) |
| `tavuk göğsü 200g` | Öğünü saate göre seçer |
| `kilo 82.4` | Vücut kilosunu kaydeder |
| `/bugun`, `/kalan`, `/son`, `/geri`, `/yardim` | Özet, kalan kalori/protein, son antrenman, son kaydı sil, yardım |

Notlar:
- Bot "long polling" ile çalışır, domain, webhook veya açık port gerekmez.
- **Aynı bot token'ı aynı anda yalnızca bir yerde çalışmalıdır.** Sunucuda çalıştırıyorsanız bilgisayarınızdaki `.env`'de `TELEGRAM_*` değerlerini boş bırakın, yoksa iki taraf birbirini engeller (loglarda "another instance is polling" yazar).
- Yemek adı veritabanında yoksa bot Open Food Facts'te arar ve seçenek sunar. Seçtiğiniz yemek kaydedilir, bir sonraki sefer doğrudan bulunur.

## Telegram ödeme hatırlatması (isteğe bağlı)
Vadesi geçen ve 3 gün içinde gelen ödemeler her gün sabah Telegram'dan size mesaj olarak gelir.
1. Telegram'da `@BotFather` ile bir bot oluşturup token'ı alın.
2. Bota bir mesaj yazın, sonra `https://api.telegram.org/bot<TOKEN>/getUpdates` adresinden `chat.id` değerini bulun.
3. `.env` içine `TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` yazın, `docker compose up -d` çalıştırın.
4. Test için (giriş yaptıktan sonra tarayıcı konsolundan): `fetch('/api/reminders/test', {method:'POST'})`

Saat `REMINDER_HOUR` (varsayılan 9), saat dilimi `TZ` ile ayarlanır. Boş bırakırsanız özellik kapalıdır.

## Güncelleme
```bash
cd ~/Life-Tracker-2
git pull
docker compose up -d --build
```
Veritabanı `pgdata` volume'unda durur, güncellemede silinmez. **`docker compose down -v` komutunu kullanma**, `-v` veriyi siler.

## Yedekleme
Uygulama içinden anlık yedek: sol menüde **Yedek indir** tüm verileri tek bir JSON dosyası olarak indirir.

Sunucuda otomatik yedek:
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
cp .env.example .env     # DB_* ve PORT satırlarını aç; yerelde girişi kapatmak için AUTH_DISABLED=true yaz
npm install && (cd client && npm install)
npm run dev              # API  -> http://localhost:34823
cd client && npm run dev # arayüz -> http://localhost:43921 (/api isteklerini API'ye yönlendirir)
```

## Güvenlik notları
- `.env` dosyasını asla commit etme.
- Şifreyi uygulamadan değiştirirsin (Hesap). Yedek dosyasına (JSON) kullanıcı bilgileri ve şifre hash'i **konmaz**.
- `AUTH_DISABLED=true` sadece yerel geliştirme içindir, sunucuda asla kullanma.
- Tüm `/api/*` uçları giriş gerektirir; girişsiz istekler 401 döner.
- Sunucu güvenlik duvarında yalnızca 80/443 (ve SSH) açık olsun. 34823 dışarı açılmamalı.
