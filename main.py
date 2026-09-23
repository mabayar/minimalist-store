"""
Penconix — Lisans Yönetim Platformu
====================================
Saf Python: FastAPI + Jinja2 + SQLite. Node.js / React / Convex KULLANILMAZ.

Rotalar:
  GET  /                       → landing.html          (herkese açık tanıtım)
  GET|POST /kayit              → register.html         (yeni müşteri; 1 HWID kredisi)
  GET|POST /giris              → login.html            (session-cookie auth)
  GET  /cikis                  → oturumu kapatır → /
  GET  /panel                  → customer_panel.html   (giriş zorunlu)
  POST /panel/claim            → lisans key'i hesaba bağlar
  POST /panel/reset-hwid/{id}  → müşteri kendi HWID'sini sıfırlar (1 kredi düşer)
  GET  /download               → güncel .exe dosyası

  GET  /admin                  → dashboard.html        (Basic Auth; lisans yönetimi)
  GET  /admin/kullanicilar     → admin_users.html      (müşteriler + kredi verme)
  GET  /admin/ayarlar          → ayarlar.html          (sürüm + .exe yükleme)
  POST /admin/...              → lisans/sürüm/kredi işlemleri

  POST /api/verify             → client .exe lisans doğrulama (BOZULMADI)
  GET  /api/version            → client .exe güncel sürüm sorgusu (BOZULMADI)
"""

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("PENCONIX_DB", BASE_DIR / "penconix.db"))
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "penconix-admin")

# Session imzalama anahtarı: env'de yoksa dosyaya yazılıp sabitlenir.
SESSION_SECRET = os.environ.get("SESSION_SECRET")
if not SESSION_SECRET:
    secret_file = BASE_DIR / ".session_secret"
    if secret_file.exists():
        SESSION_SECRET = secret_file.read_text().strip()
    else:
        SESSION_SECRET = secrets.token_hex(32)
        secret_file.write_text(SESSION_SECRET)

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
basic_auth = HTTPBasic(auto_error=True)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


# --------------------------------------------------------------------------
# Veritabanı + otomatik migration
# --------------------------------------------------------------------------

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def run_migrations() -> None:
    """Uygulama ayağa kalkarken tablo/kolon kontrolü. Mevcut veri KAYBOLMAZ."""
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                email              TEXT UNIQUE NOT NULL,
                password_hash      TEXT NOT NULL,
                hwid_reset_credits INTEGER NOT NULL DEFAULT 1,
                created_at         TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS licenses (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT UNIQUE NOT NULL,
                hwid        TEXT,
                tier        TEXT NOT NULL DEFAULT 'VIP',
                expire_date TEXT,
                is_active   INTEGER NOT NULL DEFAULT 1,
                user_id     INTEGER REFERENCES users(id),
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )

        # Eski kurulumlarda licenses tablosunda user_id yoksa ekle (ALTER).
        cols = {r["name"] for r in db.execute("PRAGMA table_info(licenses)")}
        if "user_id" not in cols:
            db.execute(
                "ALTER TABLE licenses ADD COLUMN user_id INTEGER REFERENCES users(id)"
            )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS app_versions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                version     TEXT NOT NULL,
                filename    TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                notes       TEXT,
                is_active   INTEGER NOT NULL DEFAULT 0,
                uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


# --------------------------------------------------------------------------
# Yardımcılar
# --------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"pbkdf2$200000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, AttributeError):
        return False


def generate_license_key(tier: str) -> str:
    prefix = "VP" if tier == "VIP+" else "VIP"
    blocks = [
        "".join(secrets.choice(KEY_ALPHABET) for _ in range(5)) for _ in range(3)
    ]
    return f"PNX-{prefix}-{'-'.join(blocks)}"


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[dict]:
    return dict(row) if row is not None else None


def flash(request: Request, message: str, kind: str = "info") -> None:
    request.session["flash"] = {"message": message, "type": kind}


def pop_flash(request: Request) -> Optional[dict]:
    return request.session.pop("flash", None)


def get_latest_version(db: sqlite3.Connection) -> Optional[dict]:
    return row_to_dict(
        db.execute(
            "SELECT * FROM app_versions WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
        ).fetchone()
    )


# --------------------------------------------------------------------------
# Auth bağımlılıkları
# --------------------------------------------------------------------------

def current_user(request: Request) -> Optional[dict]:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    with get_db() as db:
        return row_to_dict(
            db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        )


def require_login(user: Optional[dict]) -> dict:
    if user is None:
        raise HTTPException(status_code=303, headers={"Location": "/giris"})
    return user


def require_admin(credentials: HTTPBasicCredentials = Depends(basic_auth)) -> str:
    ok_user = hmac.compare_digest(credentials.username.encode(), ADMIN_USERNAME.encode())
    ok_pass = hmac.compare_digest(credentials.password.encode(), ADMIN_PASSWORD.encode())
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=401,
            detail="Geçersiz yönetici kimliği.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def render(request: Request, template: str, context: dict):
    user = current_user(request)
    context.setdefault("session_user", user)
    context.setdefault("flash", pop_flash(request))
    context.setdefault("path", request.url.path)
    return templates.TemplateResponse(request, template, context)


# --------------------------------------------------------------------------
# Uygulama
# --------------------------------------------------------------------------

app = FastAPI(title="Penconix Lisans Yönetim Platformu")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, max_age=60 * 60 * 24 * 14)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.on_event("startup")
def on_startup() -> None:
    run_migrations()


# --------------------------------------------------------------------------
# Herkese açık rotalar
# --------------------------------------------------------------------------

@app.get("/")
def landing(request: Request):
    with get_db() as db:
        latest = get_latest_version(db)
    return render(request, "landing.html", {"latest": latest})


@app.get("/kayit")
def register_page(request: Request):
    if current_user(request):
        return RedirectResponse("/panel", status_code=303)
    return render(request, "register.html", {})


@app.post("/kayit")
def register(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    password2: str = Form(...),
):
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        flash(request, "Geçerli bir e-posta adresi girin.", "error")
        return RedirectResponse("/kayit", status_code=303)
    if len(password) < 6:
        flash(request, "Şifre en az 6 karakter olmalıdır.", "error")
        return RedirectResponse("/kayit", status_code=303)
    if password != password2:
        flash(request, "Şifreler birbiriyle uyuşmuyor.", "error")
        return RedirectResponse("/kayit", status_code=303)

    with get_db() as db:
        exists = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            flash(request, "Bu e-posta ile bir hesap zaten var. Giriş yapın.", "error")
            return RedirectResponse("/giris", status_code=303)

        # Yeni müşteriye varsayılan 1 HWID sıfırlama kredisi tanımlanır.
        cur = db.execute(
            "INSERT INTO users (email, password_hash, hwid_reset_credits) VALUES (?, ?, 1)",
            (email, hash_password(password)),
        )
        request.session["user_id"] = cur.lastrowid

    flash(request, "Kaydınız oluşturuldu. Panele hoş geldiniz!", "success")
    return RedirectResponse("/panel", status_code=303)


@app.get("/giris")
def login_page(request: Request):
    if current_user(request):
        return RedirectResponse("/panel", status_code=303)
    return render(request, "login.html", {})


@app.post("/giris")
def login(request: Request, email: str = Form(...), password: str = Form(...)):
    with get_db() as db:
        user = row_to_dict(
            db.execute(
                "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
            ).fetchone()
        )
    if not user or not verify_password(password, user["password_hash"]):
        flash(request, "E-posta veya şifre hatalı.", "error")
        return RedirectResponse("/giris", status_code=303)

    request.session["user_id"] = user["id"]
    flash(request, "Giriş yapıldı.", "success")
    return RedirectResponse("/panel", status_code=303)


@app.get("/cikis")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=303)


@app.get("/download")
def download_latest():
    with get_db() as db:
        latest = get_latest_version(db)
    if not latest:
        raise HTTPException(status_code=404, detail="Yayınlanmış bir sürüm yok.")
    return FileResponse(
        UPLOAD_DIR / latest["stored_name"],
        filename=latest["filename"],
        media_type="application/octet-stream",
    )


# --------------------------------------------------------------------------
# Müşteri paneli (giriş zorunlu)
# --------------------------------------------------------------------------

@app.get("/panel")
def panel(request: Request, user: Optional[dict] = Depends(current_user)):
    if user is None:
        return RedirectResponse("/giris", status_code=303)
    with get_db() as db:
        licenses = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM licenses WHERE user_id = ? ORDER BY id DESC",
                (user["id"],),
            ).fetchall()
        ]
        latest = get_latest_version(db)
    return render(
        request,
        "customer_panel.html",
        {"user": user, "licenses": licenses, "latest": latest},
    )


@app.post("/panel/claim")
def claim_license(
    request: Request,
    license_key: str = Form(...),
    user: Optional[dict] = Depends(current_user),
):
    if user is None:
        return RedirectResponse("/giris", status_code=303)
    key = license_key.strip().upper()
    with get_db() as db:
        lic = db.execute(
            "SELECT * FROM licenses WHERE license_key = ?", (key,)
        ).fetchone()
        if not lic:
            flash(request, "Böyle bir lisans anahtarı bulunamadı.", "error")
        elif lic["user_id"] and lic["user_id"] != user["id"]:
            flash(request, "Bu lisans zaten başka bir hesaba bağlı.", "error")
        else:
            db.execute(
                "UPDATE licenses SET user_id = ? WHERE id = ?", (user["id"], lic["id"])
            )
            flash(request, f"{key} hesabınıza eklendi.", "success")
    return RedirectResponse("/panel", status_code=303)


@app.post("/panel/reset-hwid/{license_id}")
def customer_reset_hwid(
    request: Request,
    license_id: int,
    user: Optional[dict] = Depends(current_user),
):
    if user is None:
        return RedirectResponse("/giris", status_code=303)
    with get_db() as db:
        if user["hwid_reset_credits"] <= 0:
            flash(
                request,
                "Sıfırlama hakkınız bitti, yöneticinizle iletişime geçin.",
                "error",
            )
            return RedirectResponse("/panel", status_code=303)

        lic = db.execute(
            "SELECT * FROM licenses WHERE id = ? AND user_id = ?",
            (license_id, user["id"]),
        ).fetchone()
        if not lic:
            flash(request, "Bu lisans size ait değil.", "error")
            return RedirectResponse("/panel", status_code=303)
        if not lic["hwid"]:
            flash(request, "Bu lisansın HWID'si zaten boş.", "info")
            return RedirectResponse("/panel", status_code=303)

        db.execute("UPDATE licenses SET hwid = NULL WHERE id = ?", (license_id,))
        db.execute(
            "UPDATE users SET hwid_reset_credits = hwid_reset_credits - 1 WHERE id = ?",
            (user["id"],),
        )
    flash(request, "HWID sıfırlandı. Kredinizden 1 düştü.", "success")
    return RedirectResponse("/panel", status_code=303)


# --------------------------------------------------------------------------
# Admin paneli (Basic Auth)
# --------------------------------------------------------------------------

@app.get("/admin")
def admin_dashboard(request: Request, admin: str = Depends(require_admin)):
    with get_db() as db:
        licenses = [
            dict(r) for r in db.execute(
                """
                SELECT l.*, u.email AS owner_email
                FROM licenses l LEFT JOIN users u ON u.id = l.user_id
                ORDER BY l.id DESC
                """
            ).fetchall()
        ]
        stats = {
            "total": len(licenses),
            "active": sum(1 for l in licenses if l["is_active"]),
            "claimed": sum(1 for l in licenses if l["user_id"]),
            "customers": db.execute("SELECT COUNT(*) c FROM users").fetchone()["c"],
        }
    return render(
        request, "dashboard.html", {"licenses": licenses, "stats": stats}
    )


@app.post("/admin/licenses/create")
def admin_create_license(
    tier: str = Form("VIP"),
    days: int = Form(0),
    admin: str = Depends(require_admin),
):
    if tier not in ("VIP", "VIP+"):
        tier = "VIP"
    expire = (datetime.now() + timedelta(days=days)).isoformat(
        timespec="seconds"
    ) if days > 0 else None
    with get_db() as db:
        db.execute(
            "INSERT INTO licenses (license_key, tier, expire_date, is_active) VALUES (?, ?, ?, 1)",
            (generate_license_key(tier), tier, expire),
        )
    return RedirectResponse("/admin", status_code=303)


@app.post("/admin/licenses/{license_id}/toggle")
def admin_toggle_license(license_id: int, admin: str = Depends(require_admin)):
    with get_db() as db:
        db.execute(
            "UPDATE licenses SET is_active = 1 - is_active WHERE id = ?", (license_id,)
        )
    return RedirectResponse("/admin", status_code=303)


@app.post("/admin/licenses/{license_id}/reset-hwid")
def admin_reset_hwid(license_id: int, admin: str = Depends(require_admin)):
    with get_db() as db:
        db.execute("UPDATE licenses SET hwid = NULL WHERE id = ?", (license_id,))
    return RedirectResponse("/admin", status_code=303)


@app.post("/admin/licenses/{license_id}/delete")
def admin_delete_license(license_id: int, admin: str = Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM licenses WHERE id = ?", (license_id,))
    return RedirectResponse("/admin", status_code=303)


@app.get("/admin/kullanicilar")
def admin_users(request: Request, admin: str = Depends(require_admin)):
    with get_db() as db:
        customers = [
            dict(r) for r in db.execute(
                """
                SELECT u.id, u.email, u.hwid_reset_credits, u.created_at,
                       COUNT(l.id) AS license_count
                FROM users u LEFT JOIN licenses l ON l.user_id = u.id
                GROUP BY u.id ORDER BY u.id DESC
                """
            ).fetchall()
        ]
    return render(request, "admin_users.html", {"customers": customers})


@app.post("/admin/users/{user_id}/grant-credits")
def admin_grant_credits(
    user_id: int,
    amount: int = Form(1),
    admin: str = Depends(require_admin),
):
    with get_db() as db:
        db.execute(
            """
            UPDATE users
            SET hwid_reset_credits = MAX(0, hwid_reset_credits + ?)
            WHERE id = ?
            """,
            (amount, user_id),
        )
    return RedirectResponse("/admin/kullanicilar", status_code=303)


@app.get("/admin/ayarlar")
def admin_settings(request: Request, admin: str = Depends(require_admin)):
    with get_db() as db:
        versions = [
            dict(r) for r in db.execute(
                "SELECT * FROM app_versions ORDER BY id DESC"
            ).fetchall()
        ]
    return render(request, "ayarlar.html", {"versions": versions})


@app.post("/admin/ayarlar/upload")
async def admin_upload_version(
    request: Request,
    version: str = Form(...),
    notes: str = Form(""),
    file: UploadFile = File(...),
    admin: str = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".exe"):
        return HTMLResponse(
            '<meta http-equiv="refresh" content="0">'
            "<p>Sadece .exe dosyası yüklenebilir. Geri dönüp tekrar deneyin.</p>",
            status_code=400,
        )

    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"
    dest = UPLOAD_DIR / safe_name
    with open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)

    with get_db() as db:
        # Önceki aktif sürümler arşive alınır; yeni sürüm "güncel" olur.
        db.execute("UPDATE app_versions SET is_active = 0 WHERE is_active = 1")
        db.execute(
            """
            INSERT INTO app_versions (version, filename, stored_name, notes, is_active)
            VALUES (?, ?, ?, ?, 1)
            """,
            (version.strip(), file.filename, safe_name, notes.strip() or None),
        )
    return RedirectResponse("/admin/ayarlar", status_code=303)


@app.post("/admin/versions/{version_id}/activate")
def admin_activate_version(version_id: int, admin: str = Depends(require_admin)):
    with get_db() as db:
        db.execute("UPDATE app_versions SET is_active = 0 WHERE is_active = 1")
        db.execute("UPDATE app_versions SET is_active = 1 WHERE id = ?", (version_id,))
    return RedirectResponse("/admin/ayarlar", status_code=303)


@app.post("/admin/versions/{version_id}/delete")
def admin_delete_version(version_id: int, admin: str = Depends(require_admin)):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM app_versions WHERE id = ?", (version_id,)
        ).fetchone()
        if row:
            (UPLOAD_DIR / row["stored_name"]).unlink(missing_ok=True)
            db.execute("DELETE FROM app_versions WHERE id = ?", (version_id,))
    return RedirectResponse("/admin/ayarlar", status_code=303)


# --------------------------------------------------------------------------
# Client .exe API'leri — MEVCUT SÖZLEŞME AYNEN KORUNUR
# --------------------------------------------------------------------------

@app.post("/api/verify")
async def api_verify(request: Request):
    """
    Gövde: { "license_key": "...", "hwid": "..." }
      (eski client uyumluluğu için "licenseKey" da kabul edilir)
    Yanıt: { "status": "ok"|"invalid"|"disabled"|"expired"|"hwid_mismatch", "tier": "..." }
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "invalid"}

    license_key = (body.get("license_key") or body.get("licenseKey") or "").strip().upper()
    hwid = (body.get("hwid") or body.get("HWID") or "").strip()
    if not license_key or not hwid:
        return {"status": "invalid"}

    with get_db() as db:
        lic = db.execute(
            "SELECT * FROM licenses WHERE license_key = ?", (license_key,)
        ).fetchone()
        if not lic:
            return {"status": "invalid"}
        if not lic["is_active"]:
            return {"status": "disabled"}
        if lic["expire_date"]:
            try:
                if datetime.fromisoformat(lic["expire_date"]) < datetime.now():
                    return {"status": "expired"}
            except ValueError:
                pass

        if not lic["hwid"]:
            # İlk aktivasyon: gelen makine HWID'si kalıcı yazılır.
            db.execute(
                "UPDATE licenses SET hwid = ? WHERE id = ?", (hwid, lic["id"])
            )
            return {"status": "ok", "tier": lic["tier"]}
        if lic["hwid"] != hwid:
            return {"status": "hwid_mismatch"}
        return {"status": "ok", "tier": lic["tier"]}


@app.get("/api/version")
def api_version():
    with get_db() as db:
        latest = get_latest_version(db)
    if not latest:
        return {"version": None, "download_url": None}
    return {
        "version": latest["version"],
        "filename": latest["filename"],
        "download_url": "/download",
        "notes": latest["notes"],
        "uploaded_at": latest["uploaded_at"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
