"""Auth flows — uses isolated DATABASE_URL from conftest."""

from fastapi.testclient import TestClient

from app.main import app


def test_bootstrap_then_login_with_documented_dev_password() -> None:
    """Matches backend/.env.example documented password length and a valid EmailStr."""
    with TestClient(app) as client:
        boot = client.post(
            "/api/auth/bootstrap",
            json={
                "organization_name": "Pytest Org",
                "admin_email": "admin@example.com",
                "admin_password": "ChangeThis_Dev_Only_1",
                "admin_full_name": "CI Admin",
            },
        )
        assert boot.status_code == 200, boot.text
        login = client.post(
            "/api/auth/login",
            json={"email": "admin@example.com", "password": "ChangeThis_Dev_Only_1"},
        )
        assert login.status_code == 200, login.text
        body = login.json()
        assert body.get("access_token")
        assert body.get("user", {}).get("email") == "admin@example.com"


def test_login_rejects_localhost_domain_email_with_422() -> None:
    """admin@localhost fails Pydantic EmailStr (domain must contain a period)."""
    with TestClient(app) as client:
        r = client.post(
            "/api/auth/login",
            json={"email": "admin@localhost", "password": "anypassword1"},
        )
        assert r.status_code == 422
        detail = r.json().get("detail")
        assert isinstance(detail, list)
        assert any("email" in str(item).lower() or "@" in str(item) for item in detail)
