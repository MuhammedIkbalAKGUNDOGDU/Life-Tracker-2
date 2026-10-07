# Softium Planner: Kullanıcı Deneyimi ve Test Raporu

Tarih: 7 Ekim 2026. Test ortamı: yerel sunucu + gerçek PostgreSQL, tarayıcıda masaüstü (1200 px, 800 px) ve telefon (390 px) ölçüsünde, koyu ve açık tema. Test için eklenen tüm geçici kayıtlar (ZZ ile başlayanlar) silindi; yalnızca istenen **mock spor verisi** duruyor.

## 1. Bulunan ve düzeltilen hatalar

| # | Hata | Etki | Durum |
|---|---|---|---|
| 1 | **Tarih kayması:** sunucu DATE alanlarını UTC'ye çevirip gönderiyordu (Türkiye'de bir gün geri). | Yıllık ödeme ve hedef düzenlerken tarih her kayıtta 1 gün geri gidiyordu, günlükte "bugün" bulunamıyordu | Düzeltildi (DATE alanları artık düz `YYYY-MM-DD`) |
| 2 | **Günlük "Bugünün modu"** kayıt sonrası "seçilmedi" gösteriyordu (aynı sebep) | Bugünkü kayıt forma geri yüklenmiyordu | Düzeltildi |
| 3 | **Alışkanlık serisi (streak):** bugünkü tamamlama sayılmıyordu (UTC/yerel saat karışıklığı) | "Aktif zincir 0" görünüyordu | Düzeltildi |
| 4 | **Toast okunmuyor** (açık temada koyu zemin + koyu yazı) | Bildirimler ve "Geri al" okunamıyordu | Düzeltildi |
| 5 | **Sayı alanı** (`NumInput`) değeri geri alıyordu: değeri üst bileşen kullanmıyorsa yazılan sayı eski haline dönüyordu | Beslenme'de gram düzenlenemiyordu | Düzeltildi |
| 6 | **Vücut kilosu farkı** ters işaretliydi (+24,5 yerine −24,5) | Yanlış bilgi | Düzeltildi |
| 7 | Hareket kartında ağırlık/tekrar geçen seferle dolmuyordu (hep 20 × 8) | Her sette elle girmek gerekiyordu | Düzeltildi |
| 8 | "Antrenmanı başlat" deyip kapatınca **boş antrenman** kalıyordu | Ekran kirliliği | Düzeltildi (boş ve isimsiz antrenman silinir) |
| 9 | Eksik API adresleri HTML döndürüyordu | Anlaşılmaz "Unexpected token <" hatası | Düzeltildi (JSON 404) |
| 10 | Login'de yanlış şifreden sonra alan dolu kalıyordu, şifreyi göster yoktu | Telefonda zahmetli | Düzeltildi |

## 2. Kullanıcı deneyimi iyileştirmeleri (bu turda yapıldı)

**Telefon**
- Alt menü artık 5 öğe (Ana Sayfa, Projeler, Alacaklar, Sağlık, **Daha**). Önceden 8 öğe yatay kayıyor, bir kısmı görünmüyordu. **Daha** paneli: Hedefler, Günlük Düzen, Takvim, Günlük + **Ara, Yedek indir, Tema değiştir, Çıkış yap** (bunlara telefonda hiç ulaşılamıyordu).
- Özet kartları tek sütunda dev kartlar yerine **2 sütun, kompakt**.
- Form alanları 16 px: iOS'ta alana dokununca sayfanın yakınlaşması engellendi.
- Dokunma hedefleri (düzenle/sil/kapat/çip) en az 40 px.
- Modal alt butonları taşmıyor (sığmayanlar alta iniyor), klavye kısayolu ipucu telefonda gizli.
- Takvim başlığı ve proje filtreleri ekrana sığıyor.
- Projeler sayfasında "Yaklaşan vadeler" ve "Kalan ödemeler" panelleri telefonda kapalı başlıyor (proje listesi öne çıkıyor).

**Genel**
- Klavye odağı her yerde görünür (`:focus-visible`).
- Kısa masaüstü pencerelerinde sol menü artık taşmıyor (kaydırılabilir ve sıkışık düzen).
- Sayfa başlığı artık sayfayı gösteriyor (örn. "Sağlık · Softium Planner").
- Bildirimler ekran okuyucuya duyuruluyor (`aria-live`).
- Güvenlik başlıkları (`nosniff`, `X-Frame-Options`, `Referrer-Policy`) ve `X-Powered-By` kapatıldı.
- **Rutinler düzenlenebiliyor** (önceden sadece silinebiliyordu). Adımlar eşleştirildiği için bugünkü işaretler korunuyor.

## 3. Denenen ve çalışan özellikler

Giriş (doğru/yanlış şifre, 5 hatalı denemede kilit, oturum kalıcılığı, çıkış, API 401) · Ana Sayfa · Projeler (oluştur, düzenle, görev, tek Kaydet, Ctrl+Enter, Esc, geri alma, şablon, ödeme geçmişi, sürükle-bırak) · Hedefler (oluştur, +1, otomatik tamamlama, sil + geri al) · Alışkanlıklar (oluştur, işaretle, matris) · Rutinler (oluştur, başlat, adım, tamamla, düzenle) · Günlük · Alacaklar (kartlar, hatırlatmalar, aylık takvim, yıl seçimi, müşteri satırları, ödeme tarihine göre tahsilat, CSV, gizle/göster) · Yıllık ödemeler (ekle, ödendi → gelecek yıl otomatik kayıt, kategori ve kırılım pencereleri) · Takvim · Ctrl+K arama · Hızlı ekle (görev, günlük notu) · Açık/koyu tema · Sağlık: antrenman başlat, geçen antrenmandan hareket getirme, hareket seçme (son seanslar), set, ısınma, rekor, seans detayı, ilerleme grafikleri, vücut kilosu · Beslenme: kayıtlı yemek arama (yazım hatası toleransı), Open Food Facts araması, yeni yemek, gram ve öğün, gram düzenleme, hedef hesabı · Telegram botu (sahte Telegram ile: set, geçmiş, düğme akışı, yemek, kilo, geri al).

## 4. Denenemeyenler (kısıt)

- **Yazdırma / PDF** (teklif, ekstre): test tarayıcısı açılır pencereyi engelliyor; hata mesajı çalışıyor, gerçek yazdırma denenmedi.
- **PWA / service worker**: test tarayıcısı desteklemiyor; manifest doğru yayınlanıyor.
- **Gerçek Telegram botu**: sahte Telegram ile denendi, gerçek token ile denenmedi.
- Gerçek telefonda (iOS Safari / Android Chrome) dokunma ve klavye davranışı.

## 5. Kalan eksikler ve öneriler (öncelik sırasıyla)

**Yüksek**
1. **Telefonda "geri" tuşu**: açık modal ve paneller tarayıcı geçmişine girmiyor; geri tuşu modalı kapatmak yerine sayfadan çıkarıyor. Modallar `history.pushState` ile bağlanmalı.
2. **Projeler sayfası mantığı**: üstte 4 özet kart + iki ödeme paneli var, asıl proje listesi aşağıda. Ödeme panelleri Alacaklar sayfasıyla tekrar ediyor; kaldırmak ya da tek satır özet yapmak daha temiz.
3. **Gerçek cihaz testi**: özellikle sayı klavyesi, tarih seçici, alt çubuk ve güvenli alan (çentik) payı.

**Orta**
5. Hareket yönetimi: hareketleri yeniden adlandırma/silme/kas grubu değiştirme ekranı yok (sadece oluşturulabiliyor).
6. Antrenmanda dinlenme sayacı, superset, kg/lb seçimi yok.
7. Beslenme: haftalık özet ve grafik, su takibi, öğün şablonları ("sık yediklerim" listesi) yok.
8. Alışkanlık, rutin ve günlük silmede **geri al** yok (görev, proje, hedefte var).
9. Günlükte arama ve düzenleme-silme akışı daha belirgin olabilir.
10. Hata durumları: bazı sayfalarda (Alacaklar, Takvim) sunucuya ulaşılamazsa sessiz kalıyor; "Tekrar dene" gösterilmeli. Yükleniyor iskeletleri (skeleton) yok.
11. Tarih ayrıştırma: istemcide `new Date('YYYY-MM-DD')` UTC kabul ediliyor; Türkiye için doğru, ama UTC'nin gerisindeki bir saat diliminde bir gün kayar. İleride tek bir `parseDay` yardımcısına geçilmeli.
12. Açık tema: tüm ekranlarda gözle kontrol edildi, ama otomatik kontrast ölçümü yapılmadı.

**Düşük**
13. Yedek indirme dışında **içe aktarma** (yedekten geri yükleme) arayüzü yok.
14. Web bildirimleri (push) yok; hatırlatma sadece Telegram ile.
15. Birden fazla kullanıcı / şifre sıfırlama yok (tek şifre tasarımı gereği).
16. Eski kodda ~40 lint uyarısı (kullanılmayan import, React 19 efekt kuralları). İşlevi etkilemiyor, temizlenmeli.
17. Alt çubuktaki "Daha" paneli ve hızlı ekle düğmesi küçük ekranda içerikle üst üste binebiliyor (içerik altına boşluk eklendi, tamamen çözülmedi).
