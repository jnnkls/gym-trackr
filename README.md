# Gym Trackr

A Home Assistant blueprint plus a Lovelace card. The blueprint writes one calendar event per gym visit (zone enter to leave) to a local calendar; the card shows a visit counter and a 90-day heatmap. It does not track workouts or training. The card opens on the last 90 days; the `‹`, `›` and toggle buttons switch to the per-year view.

## Prerequisites

- Home Assistant with the Companion app on your phone, with location tracking enabled.
- HACS (the "Marketplace") installed, to add the card.

## Setup

1. **Zone.** Create a zone named `Gym` (Settings > Areas, labels & zones > Zones) around your gym.
2. **Calendar.** Add the Local Calendar integration and create a calendar named `Gym` (entity `calendar.gym`).
3. **Helper.** Create a helper of type Date and/or time named `gym_visit_start` (`input_datetime.gym_visit_start`) with **both date and time** enabled. It stores the start of the open visit; `1970-01-01` means no open visit. Use one helper per automation (per person); sharing a helper makes visits overwrite each other.
4. **Blueprint.** Import it:

   [![Open your Home Assistant instance and import the blueprint.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2Fjnnkls%2Fgym-trackr%2Fmain%2Fblueprints%2Fautomation%2Fgym_visit.yaml)

   Then create an automation from it and fill the inputs:

   | Input                    | Meaning                          | Default |
   | ------------------------ | -------------------------------- | ------- |
   | Person or device tracker | Whose location counts            | -       |
   | Gym zone                 | The `Gym` zone                   | -       |
   | Calendar                 | The `Gym` local calendar         | -       |
   | Visit start helper       | `input_datetime.gym_visit_start` | -       |
   | Minimum visit duration   | Shorter visits are discarded     | 15 min  |
   | Maximum visit duration   | Longer visits are capped         | 4 h     |

5. **Card.** In HACS add `https://github.com/jnnkls/gym-trackr` as a custom repository (type Dashboard/Plugin), install "Gym Trackr", and reload the browser. Add a manual card:

   ```yaml
   type: custom:gym-trackr-card
   entity: calendar.gym
   ```

## Backfilling

Add events titled `Gym` to the Home Assistant calendar by hand. All-day events are allowed; they count as a visit with unknown duration.

## Editing visits

Click a day in the card to open a dialog: change start/end of a visit, delete it, or add a visit (default 18:00-19:00). Times are in your Home Assistant time zone; an end at or before the start means the next day. Saving clears the estimated-end marker. This needs a calendar that supports creating, updating and deleting events (e.g. Local Calendar).

## Estimated end marker

If a visit is capped (or Home Assistant restarted while you were away) the end is a guess and the event description is set to `⚠ Ende geschätzt`. To clear it, open the event in the calendar, correct the end time and delete the description.

## Limitations

- Geofence accuracy depends on your phone; enter/leave can fire late or early.
- If the phone is offline when you leave, the end time may be late (and is capped and marked).
