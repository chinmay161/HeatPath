"""
Unit tests for cool spots discovery endpoint.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch
from app.main import app


@pytest.mark.anyio
async def test_get_cool_spots_success():
    fake_overpass_response = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 18.9230,
                "lon": 72.8350,
                "tags": {
                    "leisure": "park",
                    "name": "Colaba Woods",
                },
            },
            {
                "type": "node",
                "id": 102,
                "lat": 18.9240,
                "lon": 72.8360,
                "tags": {
                    "shop": "mall",
                    "name": "Cusrow Baug Mall",
                },
            },
            {
                "type": "node",
                "id": 103,
                "lat": 18.9225,
                "lon": 72.8348,
                "tags": {
                    "amenity": "drinking_water",
                },
            },
        ]
    }

    class MockResponse:
        status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return fake_overpass_response

    with patch("httpx.AsyncClient.post", return_value=MockResponse()):
        async with AsyncClient(app=app, base_url="http://test") as client:
            res = await client.get("/cool-spots/?lat=18.9220&lon=72.8347&radius_m=1500")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "available"
            assert data["count"] == 3
            # Check classification
            categories = [s["category"] for s in data["spots"]]
            assert "park" in categories
            assert "ac" in categories
            assert "water" in categories


@pytest.mark.anyio
async def test_get_cool_spots_category_filter():
    fake_overpass_response = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 18.9230,
                "lon": 72.8350,
                "tags": {
                    "leisure": "park",
                    "name": "Colaba Woods",
                },
            },
            {
                "type": "node",
                "id": 102,
                "lat": 18.9240,
                "lon": 72.8360,
                "tags": {
                    "shop": "mall",
                    "name": "Cusrow Baug Mall",
                },
            },
        ]
    }

    class MockResponse:
        status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return fake_overpass_response

    with patch("httpx.AsyncClient.post", return_value=MockResponse()):
        async with AsyncClient(app=app, base_url="http://test") as client:
            res = await client.get("/cool-spots/?lat=18.9220&lon=72.8347&category=park")
            assert res.status_code == 200
            data = res.json()
            assert data["count"] == 1
            assert data["spots"][0]["category"] == "park"


@pytest.mark.anyio
async def test_get_cool_spots_invalid_coords():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get("/cool-spots/?lat=95.0&lon=72.8347")
        assert res.status_code == 400
