# Ping Alert V2

Windows masaüstü ağ izleme uygulaması. ICMP, TCP, HTTP/HTTPS ve SNMP kontrollerini yerel olarak çalıştırır; veriler bu bilgisayardaki SQLite veritabanında kalır.

## Windows kurulumu

1. `dist/PingAlertV2-Setup-0.1.0.exe` dosyasını çalıştırın.
2. Kurulum klasörünü seçin (varsayılan: kullanıcı klasörü).
3. Masaüstü ve Başlat menüsü kısayolları oluşturulur.

Kurulum imzalı değildir; Windows SmartScreen uyarı verebilir. **Yine de çalıştır** ile devam edebilirsiniz.

Kullanıcı verisi (cihazlar, ayarlar, geçmiş): `%APPDATA%\ping-alert-v2\`

## Geliştirme

```bash
npm install
npm run dev
```

## Kurulum paketini derleme

```bash
npm run build:win
```

Çıktı: `dist/PingAlertV2-Setup-<sürüm>.exe`

## Lisans

MIT
