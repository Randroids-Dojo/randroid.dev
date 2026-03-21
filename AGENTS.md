# AGENTS.md — Site Conventions for AI Agents

## Repos NOT to showcase on randroid.dev

The following public repos exist but should NOT be added as story cards or playable cards on the site:

- **Godot-Claude-Skills** (`Randroids-Dojo/Godot-Claude-Skills`) — old, not worth showcasing
- **Rumored** (`Randroids-Dojo/Rumored`) — old, not worth showcasing

## Card Ordering

Playable cards and story cards in `index.html` must always be ordered **newest first** (most recently added cards at the top of their section). When adding a new card, place it above all existing cards in the relevant grid (`playable-grid` or `tools-grid`). Blog cards follow the same convention, ordered by publish date descending.

## Hero Stats

The hero stat counters in `index.html` must be kept in sync manually when projects are added or removed:
- **Projects**: total playable cards + total story cards
- **Playable**: number of playable cards in the Play Live section
- **Languages**: number of distinct programming languages represented across all cards
