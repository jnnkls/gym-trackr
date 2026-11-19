"""Behaviour of the gym visit blueprint (times are Europe/Berlin local)."""

from datetime import UTC, datetime
from unittest.mock import patch

from homeassistant.components.local_calendar.calendar import LocalCalendarEntity
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED

from .conftest import HELPER, INSIDE_2, PHONE, Gym

MARKER = "⚠ Ende geschätzt"


def span(event: dict) -> tuple[str, str]:
    return event["start"][:19].replace("T", " "), event["end"][:19].replace("T", " ")


async def test_normal_visit(gym: Gym) -> None:
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 19:10:00")
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 19:10:00")
    assert ev["summary"] == "Gym"
    assert not ev.get("description")
    assert gym.helper().startswith("1970")


async def test_short_visit_discarded(gym: Gym) -> None:
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 18:10:00")
    await gym.away()
    assert await gym.events() == []
    assert gym.helper().startswith("1970")


async def test_midnight_visit_single_event(gym: Gym) -> None:
    await gym.at("2026-11-19 23:30:00")
    await gym.at_gym()
    await gym.at("2026-11-20 00:45:00")
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 23:30:00", "2026-11-20 00:45:00")


async def test_cap_while_inside(gym: Gym) -> None:
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 22:01:00")
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 22:00:00")
    assert ev["description"] == MARKER
    await gym.at("2026-11-19 22:30:00")
    await gym.away()
    assert len(await gym.events()) == 1


async def test_long_leave_capped(gym: Gym) -> None:
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    # Clock passes the cap without a time tick, so the cap trigger cannot run
    # first: this pins the leave-capped branch.
    await gym.at("2026-11-19 22:00:01", tick=False)
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 22:00:00")
    assert ev["description"] == MARKER
    assert gym.helper().startswith("1970")


async def test_reenter_ignored(gym: Gym) -> None:
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 18:30:00")
    await gym.at_gym(INSIDE_2)
    await gym.at("2026-11-19 19:00:00")
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 19:00:00")


async def test_reenter_after_leave_reopens_visit(gym: Gym) -> None:
    """A real leave then enter inside a zone-trigger cycle starts a fresh visit."""
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 18:30:00")
    await gym.away()
    await gym.at("2026-11-19 18:32:00")
    await gym.at_gym()
    assert gym.helper() == "2026-11-19 18:32:00"


async def test_flapping_two_events(gym: Gym) -> None:
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 18:30:00")
    await gym.away()
    await gym.at("2026-11-19 18:32:00")
    await gym.at_gym()
    await gym.at("2026-11-19 19:00:00")
    await gym.away()
    evs = sorted(await gym.events(), key=lambda e: e["start"])
    assert [span(e) for e in evs] == [
        ("2026-11-19 18:00:00", "2026-11-19 18:30:00"),
        ("2026-11-19 18:32:00", "2026-11-19 19:00:00"),
    ]


async def test_restart_after_leave(gym: Gym) -> None:
    await gym.at("2026-11-19 19:00:00")
    await gym.set_helper("2026-11-19 18:00:00")
    await gym.away()
    gym.hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await gym.hass.async_block_till_done()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 19:00:00")
    assert ev["description"] == MARKER
    assert gym.helper().startswith("1970")


async def test_restart_after_leave_long(gym: Gym) -> None:
    await gym.at("2026-11-19 19:00:00")
    # Disabled while set, so the cap template trigger cannot close it first.
    await gym.set_helper_while_disabled("2026-11-19 10:00:00")
    await gym.away()
    gym.hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await gym.hass.async_block_till_done()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 10:00:00", "2026-11-19 14:00:00")
    assert ev["description"] == MARKER


async def test_restart_still_inside(gym: Gym) -> None:
    await gym.at("2026-11-19 19:00:00")
    await gym.set_helper("2026-11-19 18:00:00")
    await gym.at_gym()
    gym.hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await gym.hass.async_block_till_done()
    assert await gym.events() == []
    assert gym.helper() == "2026-11-19 18:00:00"


async def test_unknown_helper_counts_as_closed(gym: Gym) -> None:
    gym.hass.states.async_set("input_datetime.gym_visit_start", "unknown")
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    assert gym.helper() == "2026-11-19 18:00:00"
    await gym.at("2026-11-19 19:10:00")
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 19:10:00")
    assert not ev.get("description")


async def test_dst_fallback_uses_real_elapsed_time(gym: Gym) -> None:
    """Enter 02:30 CET (2nd occurrence), leave 03:10 CET: 40 minutes, not 100.

    Asserted on the calendar call: local_calendar itself drops the fold when it
    stores a local time, so reading the event back cannot show it.
    """
    created: list[dict] = []
    orig = LocalCalendarEntity.async_create_event

    async def spy(self: LocalCalendarEntity, **kwargs: object) -> None:
        created.append(kwargs)
        await orig(self, **kwargs)

    with patch.object(LocalCalendarEntity, "async_create_event", spy):
        gym.freezer.move_to(datetime(2026, 10, 25, 1, 30, tzinfo=UTC))
        await gym.at_gym()
        assert gym.helper() == "2026-10-25 02:30:00"
        gym.freezer.move_to(datetime(2026, 10, 25, 2, 10, tzinfo=UTC))
        await gym.away()
    [call] = created
    assert call["dtend"].timestamp() - call["dtstart"].timestamp() == 40 * 60


async def test_unparsable_helper_counts_as_closed(gym: Gym) -> None:
    gym.hass.states.async_set(HELPER, "2026-99-99 xx")
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    assert gym.helper() == "2026-11-19 18:00:00"
    await gym.at("2026-11-19 19:10:00")
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 19:10:00")


async def test_restart_with_unavailable_tracker_keeps_visit(gym: Gym) -> None:
    await gym.at("2026-11-19 19:00:00")
    await gym.set_helper("2026-11-19 18:00:00")
    gym.hass.states.async_set(PHONE, "unavailable")
    gym.hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await gym.hass.async_block_till_done()
    assert await gym.events() == []
    assert gym.helper() == "2026-11-19 18:00:00"


async def test_restart_short_visit_discarded(gym: Gym) -> None:
    await gym.at("2026-11-19 19:00:00")
    await gym.set_helper("2026-11-19 18:56:00")
    await gym.away()
    gym.hass.bus.async_fire(EVENT_HOMEASSISTANT_STARTED)
    await gym.hass.async_block_till_done()
    assert await gym.events() == []
    assert gym.helper().startswith("1970")


async def test_enter_with_stale_open_visit_closes_it_and_starts_new(gym: Gym) -> None:
    await gym.at("2026-11-19 19:00:00")
    await gym.set_helper_while_disabled("2026-11-19 10:00:00")
    await gym.at_gym()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 10:00:00", "2026-11-19 14:00:00")
    assert ev["description"] == MARKER
    assert gym.helper() == "2026-11-19 19:00:00"
    await gym.at("2026-11-19 19:30:00")
    await gym.away()
    assert len(await gym.events()) == 2


async def test_default_midnight_value_is_closed(gym: Gym) -> None:
    # input_datetime defaults to "<today> 00:00:00" without a restorable state.
    await gym.set_helper("2026-11-19 00:00:00")
    await gym.at("2026-11-19 04:01:00")
    assert await gym.events() == []


async def test_enter_after_default_midnight_starts_fresh(gym: Gym) -> None:
    await gym.set_helper("2026-11-19 00:00:00")
    await gym.at("2026-11-19 18:00:00")
    await gym.at_gym()
    await gym.at("2026-11-19 19:10:00")
    await gym.away()
    [ev] = await gym.events()
    assert span(ev) == ("2026-11-19 18:00:00", "2026-11-19 19:10:00")
    assert not ev.get("description")
