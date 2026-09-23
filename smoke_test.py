"""
Penconix uçtan uca duman testi.
Çalıştırma: python smoke_test.py  (geçici SQLite üzerinde, proje DB'sine dokunmaz)
"""
import os
import tempfile

os.environ["PENCONIX_DB"] = os.path.join(tempfile.gettempdir(), "penconix_test.db")

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

with TestClient(main.app) as c:
    # 1) Landing
    r = c.get("/")
    assert r.status_code == 200 and "Penconix" in r.text, r.status_code

    # 2) Kayıt → panel
    r = c.post(
        "/kayit",
        data={"email": "test@ornek.com", "password": "parola123", "password2": "parola123"},
        follow_redirects=False,
    )
    assert r.status_code == 303, (r.status_code, r.text[:300])
    r = c.get("/panel")
    assert r.status_code == 200 and "Hoş geldin" in r.text

    # 3) Admin lisans üretimi (Basic Auth)
    auth = ("admin", main.ADMIN_PASSWORD)
    r = c.post(
        "/admin/licenses/create",
        data={"tier": "VIP+", "days": "30"},
        auth=auth,
        follow_redirects=False,
    )
    assert r.status_code == 303, (r.status_code, r.text[:300])
    r = c.get("/admin", auth=auth)
    assert "PNX-VP-" in r.text
    import re

    key = re.search(r"PNX-VP-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}", r.text).group(0)

    # 4) Müşteri lisansı claim eder
    r = c.post("/panel/claim", data={"license_key": key.lower()}, follow_redirects=False)
    assert r.status_code == 303
    r = c.get("/panel")
    assert key in r.text

    # 5) /api/verify: ilk çağrı HWID'i bağlar
    r = c.post("/api/verify", json={"license_key": key, "hwid": "HW-ABC123"})
    assert r.json() == {"status": "ok", "tier": "VIP+"}, r.json()
    # farklı HWID → mismatch
    r = c.post("/api/verify", json={"license_key": key, "hwid": "OTHER"})
    assert r.json()["status"] == "hwid_mismatch"
    # client'ın eski camelCase alanı da çalışmalı
    r = c.post("/api/verify", json={"licenseKey": key, "hwid": "HW-ABC123"})
    assert r.json()["status"] == "ok"

    # 6) Müşteri HWID sıfırlar (kredi 1→0)
    r = c.post("/panel/reset-hwid/1", follow_redirects=False)
    assert r.status_code == 303
    r = c.get("/panel")
    assert "HWID sıfırlandı" in r.text

    # 7) Sıfırlama sonrası yeni makine bağlanabilmeli
    r = c.post("/api/verify", json={"license_key": key, "hwid": "YENI-MAKINE"})
    assert r.json()["status"] == "ok", r.json()

    # 8) Kredi bitti → sıfırlama engellenir
    r = c.post("/panel/reset-hwid/1", follow_redirects=False)
    assert r.status_code == 303
    r = c.get("/panel")
    assert "Sıfırlama hakkınız bitti" in r.text

    # 9) Admin müşteriye +2 kredi verir
    r = c.post(
        "/admin/users/1/grant-credits",
        data={"amount": "2"},
        auth=auth,
        follow_redirects=False,
    )
    assert r.status_code == 303
    r = c.get("/admin/kullanicilar", auth=auth)
    assert "test@ornek.com" in r.text

    # 10) /api/version (sürüm yok)
    r = c.get("/api/version")
    assert r.json()["version"] is None

    # 11) Admin sürüm yükleme (.exe) → /download + /api/version
    r = c.post(
        "/admin/ayarlar/upload",
        data={"version": "1.0.0", "notes": "ilk"},
        files={"file": ("penconix.exe", b"MZ fake exe")},
        auth=auth,
        follow_redirects=False,
    )
    assert r.status_code == 303, (r.status_code, r.text[:300])
    r = c.get("/api/version")
    assert r.json()["version"] == "1.0.0", r.json()
    r = c.get("/download")
    assert r.status_code == 200 and r.content == b"MZ fake exe"

    # 12) Giriş/çıkış akışı
    c.get("/cikis")
    r = c.post(
        "/giris", data={"email": "test@ornek.com", "password": "parola123"}, follow_redirects=False
    )
    assert r.status_code == 303
    r = c.post("/giris", data={"email": "test@ornek.com", "password": "YANLIS"}, follow_redirects=False)
    assert r.status_code == 303
    r = c.get("/giris")
    assert "hatalı" in r.text

print("SMOKE_TEST_OK")
