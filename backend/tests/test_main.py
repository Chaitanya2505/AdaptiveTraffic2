import os
import pytest
from io import BytesIO

# Configure environment variables for test execution BEFORE importing settings or main app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test_secret_key_for_erakshak_test_suite_987654321"

from httpx import AsyncClient, ASGITransport
from app.main import app, seed_data
from app.database import Base, engine

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture(autouse=True)
async def init_db():
    # Make sure tables are recreated for each test case to avoid pollution
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default users and junctions
    await seed_data()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.anyio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert "documentation_url" in response.json()

@pytest.mark.anyio
async def test_auth_workflow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register a new user
        reg_payload = {
            "username": "testoperator",
            "email": "testop@erakshak.gov.in",
            "password": "testpassword123",
            "role": "operator"
        }
        response = await ac.post("/auth/register", json=reg_payload)
        assert response.status_code == 201
        assert response.json()["username"] == "testoperator"
        assert response.json()["role"] == "operator"

        # 2. Login to get JWT
        login_payload = {
            "username": "testoperator",
            "password": "testpassword123"
        }
        response = await ac.post("/auth/login", json=login_payload)
        assert response.status_code == 200
        token_data = response.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"
        token = token_data["access_token"]

        # 3. Retrieve user profile using token
        headers = {"Authorization": f"Bearer {token}"}
        response = await ac.get("/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["username"] == "testoperator"

@pytest.mark.anyio
async def test_junctions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get token for authentication (using seeded admin account)
        login_response = await ac.post("/auth/login", json={"username": "admin", "password": "adminpassword"})
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. List seeded junctions
        response = await ac.get("/junctions")
        assert response.status_code == 200
        junctions = response.json()
        assert len(junctions) >= 3
        assert any(j["id"] == "J-001" for j in junctions)

        # 2. Get specific junction
        response = await ac.get("/junctions/J-001")
        assert response.status_code == 200
        assert response.json()["name"] == "Ring Road x BRTS"

        # 3. Create a new junction
        new_j = {
            "id": "J-004",
            "name": "Varachha Road",
            "latitude": 21.2000,
            "longitude": 72.8500,
            "num_lanes": 4,
            "has_brts": False,
            "status": "active"
        }
        response = await ac.post("/junctions", json=new_j, headers=headers)
        assert response.status_code == 201
        assert response.json()["id"] == "J-004"

@pytest.mark.anyio
async def test_vision_and_violations():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get token
        login_response = await ac.post("/auth/login", json={"username": "admin", "password": "adminpassword"})
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Run vision detection simulation with file upload
        mock_file = BytesIO(b"fake image data")
        files = {"file": ("test.jpg", mock_file, "image/jpeg")}
        data = {"junction_id": "J-001"}
        
        response = await ac.post("/vision/detect", data=data, files=files, headers=headers)
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["junction_id"] == "J-001"
        assert "detections" in res_data
        assert "queue_lengths" in res_data

        # 2. Check if violations were created
        response = await ac.get("/violations", headers=headers)
        assert response.status_code == 200
        violations = response.json()
        
        if len(violations) > 0:
            violation_id = violations[0]["id"]
            # Get violation detail
            response = await ac.get(f"/violations/{violation_id}", headers=headers)
            assert response.status_code == 200
            assert response.json()["junction_id"] == "J-001"
            
            # Acknowledge the violation
            response = await ac.post(f"/violations/{violation_id}/ack", headers=headers)
            assert response.status_code == 200
            assert response.json()["status"] == "acknowledged"

@pytest.mark.anyio
async def test_signals():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get token
        login_response = await ac.post("/auth/login", json={"username": "admin", "password": "adminpassword"})
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Optimize signal timing
        opt_payload = {"junction_id": "J-001", "mode": "RL"}
        response = await ac.post("/signals/optimize", json=opt_payload, headers=headers)
        assert response.status_code == 200
        assert response.json()["junction_id"] == "J-001"
        assert response.json()["mode"] == "RL"

        # 2. Apply manual override
        apply_payload = {
            "phase": "EW_GREEN",
            "duration": 45,
            "mode": "MANUAL"
        }
        response = await ac.post("/signals/J-001/apply", json=apply_payload, headers=headers)
        assert response.status_code == 200
        assert response.json()["phase"] == "EW_GREEN"
        assert response.json()["mode"] == "MANUAL"

        # 3. Retrieve history
        response = await ac.get("/signals/J-001/history", headers=headers)
        assert response.status_code == 200
        history = response.json()
        assert len(history) >= 2
