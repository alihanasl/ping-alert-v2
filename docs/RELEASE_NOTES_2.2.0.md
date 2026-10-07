# Ping Alert V2 — 2.2.0 (SNMP monitoring)

**Release date:** 2026-10-07  
**Installer:** `dist/PingAlertV2-Setup-2.2.0.exe`

## Summary

Device reachability is now determined by **SNMP** (default OID `sysUpTime.0` — `1.3.6.1.2.1.1.3.0`), not ICMP ping. The dashboard, alarms, email notifications, history, and device records are unchanged in behavior; only the probe source changed.

## Highlights

- **SNMP v2c** by default (UDP **161**), configurable timeout (**2000 ms**) and retries (**1**)
- **Global SNMP settings** (Settings → SNMP): version, port, timeout, retries, community (masked)
- **Per-device community** optional; empty uses the global community
- **Test SNMP** on the device form (sysUpTime + sysName when available)
- **IP range scan** and bulk add use SNMP instead of ping
- **Automatic migration:** existing ICMP devices become SNMP with default OID (no data loss)
- **Failure threshold** unchanged (default: 3 consecutive failures before Offline + alert)

## Upgrade notes

1. After updating, open **Settings → SNMP** and set the **global community** (required unless every device has its own).
2. Ensure targets allow **SNMP v2c** and **UDP 161** from the PC running Ping Alert V2.
3. Existing devices keep name, IP, group, intervals, and alarm-related settings.

## Dashboard vs logs

- Dashboard: **Online** / **Offline** (same as before)
- Logs and probe messages may show: SNMP timeout, community/auth error, network error, etc.

## Technical

- Library: `net-snmp` (in-process, no `snmpget.exe`)
- Range scan concurrency: up to **30** parallel SNMP checks
- Schema migration **v2** converts `check_type = icmp` → `snmp`

## Previous release

- **2.1.0** — IP range scan and bulk device creation

---

# Ping Alert V2 — 2.2.0 (SNMP izleme)

**Yayın:** 2026-10-07  
**Kurulum:** `dist/PingAlertV2-Setup-2.2.0.exe`

## Özet

Cihaz erişilebilirliği artık ICMP ping ile değil **SNMP** ile ölçülür (varsayılan OID: `sysUpTime.0` — `1.3.6.1.2.1.1.3.0`). Dashboard, alarmlar, e-posta, geçmiş ve cihaz kayıtları aynı mantıkta; yalnızca kontrol kaynağı SNMP oldu.

## Öne çıkanlar

- Varsayılan **SNMP v2c**, port **161**, zaman aşımı **2000 ms**, yeniden deneme **1** (ayarlardan değişir)
- **Global SNMP ayarları** (Ayarlar → SNMP): sürüm, port, timeout, retry, community (maskeli)
- **Cihaz bazlı community** isteğe bağlı; boşsa global kullanılır
- Cihaz formunda **SNMP test et** (uptime + isteğe bağlı sistem adı)
- **IP tarama** ve aralıkla ekleme SNMP kullanır
- **Otomatik migrasyon:** eski ICMP cihazlar SNMP’ye dönüşür (kayıtlar silinmez)
- **Başarısızlık eşiği** aynı (varsayılan: 3 ardışık hata → Çevrimdışı + uyarı)

## Güncelleme sonrası

1. **Ayarlar → SNMP** bölümünde **global community** tanımlayın (cihazda özel yoksa zorunlu).
2. Hedef cihazlarda **SNMP v2c** ve **UDP 161** erişimini doğrulayın.
3. Mevcut cihaz adı, IP, grup ve aralık/eşik ayarları korunur.

## GitHub release metni (kopyala-yapıştır)

```markdown
## Ping Alert V2 2.2.0 — SNMP monitoring

### What's new
- Reachability checks use SNMP (sysUpTime.0) instead of ICMP ping
- Global SNMP settings + optional per-device community
- Test SNMP button on device form
- IP scan / bulk add over SNMP
- ICMP devices auto-migrated to SNMP on upgrade

### Upgrade
Set **Settings → SNMP → Community** after install. Allow UDP 161 / SNMP v2c from the monitoring host.

### Download
- Windows x64: `PingAlertV2-Setup-2.2.0.exe`
```
