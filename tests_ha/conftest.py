"""Fixtures: HA with a gym zone, helper, local calendar and the blueprint."""

import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.components.calendar import DOMAIN as CALENDAR_DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

BLUEPRINT = Path(__file__).parent.parent / "blueprints/automation/gym_visit.yaml"
PHONE = "device_tracker.phone"
HELPER = "input_datetime.gym_visit_start"
CALENDAR = "calendar.gym"
INSIDE = (50.0, 8.0)
INSIDE_2 = (50.0001, 8.0001)
OUTSIDE = (50.1, 8.1)


class Gym:
    """Test driver: moves time and the phone, reads the calendar."""

    def __init__(self, hass: HomeAssistant, freezer: FrozenDateTimeFactory) -> None:
        self.hass = hass
        self.freezer = freezer

    async def at(self, when: str) -> None:
        """Jump the clock to a local 'YYYY-MM-DD HH:MM:SS' and fire time listeners."""
        self.freezer.move_to(local(when))
        async_fire_time_changed(self.hass)
        await self.hass.async_block_till_done()

    async def _move(self, pos: tuple[float, float]) -> None:
        self.hass.states.async_set(
            PHONE,
            "not_home",
            {"latitude": pos[0], "longitude": pos[1], "gps_accuracy": 10},
        )
        await self.hass.async_block_till_done()

    async def at_gym(self, pos: tuple[float, float] = INSIDE) -> None:
        await self._move(pos)

    async def away(self) -> None:
        await self._move(OUTSIDE)

    async def events(self) -> list[dict[str, Any]]:
        resp = await self.hass.services.async_call(
            CALENDAR_DOMAIN,
            "get_events",
            {
                "entity_id": CALENDAR,
                "start_date_time": "2020-01-01 00:00:00",
                "end_date_time": "2030-01-01 00:00:00",
            },
            blocking=True,
            return_response=True,
        )
        return resp[CALENDAR]["events"]  # type: ignore[index,return-value]

    def helper(self) -> str:
        return self.hass.states.get(HELPER).state  # type: ignore[union-attr]

    async def set_helper(self, value: str) -> None:
        await self.hass.services.async_call(
            "input_datetime",
            "set_datetime",
            {"entity_id": HELPER, "datetime": value},
            blocking=True,
        )


def local(value: str) -> datetime:
    parsed = dt_util.parse_datetime(value)
    assert parsed is not None
    return parsed.replace(tzinfo=dt_util.get_default_time_zone())


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Required by pytest-homeassistant-custom-component."""


@pytest.fixture
def expected_lingering_timers() -> bool:
    """The template trigger's per-minute now() timer outlives the test."""
    return True


@pytest.fixture
async def gym(
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    tmp_path: Path,
) -> Gym:
    hass.config.config_dir = str(tmp_path)  # isolates calendar storage per test
    await hass.config.async_set_time_zone("Europe/Berlin")
    freezer.move_to(local("2026-11-19 12:00:00"))
    # Away to start with, so the first at_gym() is a real zone enter.
    hass.states.async_set(
        PHONE, "not_home", {"latitude": 50.1, "longitude": 8.1, "gps_accuracy": 10}
    )

    assert await async_setup_component(
        hass,
        "zone",
        {"zone": {"name": "gym", "latitude": 50.0, "longitude": 8.0, "radius": 100}},
    )
    assert await async_setup_component(
        hass,
        "input_datetime",
        {"input_datetime": {"gym_visit_start": {"has_date": True, "has_time": True}}},
    )
    await hass.services.async_call(
        "input_datetime",
        "set_datetime",
        {"entity_id": HELPER, "datetime": "1970-01-01 00:00:00"},
        blocking=True,
    )

    Path(hass.config.path(".storage")).mkdir(parents=True, exist_ok=True)
    entry = MockConfigEntry(
        domain="local_calendar",
        data={"calendar_name": "Gym", "storage_key": "gym"},
    )
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    target = Path(hass.config.path("blueprints/automation/gym_trackr"))
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy(BLUEPRINT, target / "gym_visit.yaml")

    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": {
                "alias": "gym",
                "use_blueprint": {
                    "path": "gym_trackr/gym_visit.yaml",
                    "input": {
                        "person": PHONE,
                        "zone": "zone.gym",
                        "calendar": CALENDAR,
                        "start_helper": HELPER,
                    },
                },
            }
        },
    )
    await hass.async_block_till_done()
    return Gym(hass, freezer)
