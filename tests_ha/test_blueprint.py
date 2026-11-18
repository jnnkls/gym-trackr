"""Behaviour of the gym visit blueprint (times are Europe/Berlin local)."""

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED

from .conftest import INSIDE_2, Gym

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
    # One jump past the cap, no tick in between: either trigger may win.
    await gym.at("2026-11-19 22:00:01")
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
    await gym.set_helper("2026-11-19 10:00:00")
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
