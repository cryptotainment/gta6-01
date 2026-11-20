# Solmar — Vice Coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/cryptotainment/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/cryptotainment/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

A 2D top-down open-world crime game in pure JavaScript (canvas, no libraries, no network), built for the [make.fun bounty](https://make.fun/bounty/gta6-01).

You are Riko Vale, a driver-for-hire drawn into the Solmar underworld. Drive and steal cars, outrun the police, and work through 6 story missions across a fictional coastal city — downtown, old town, beach, marina and industrial districts.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080. Or open `game/index.html` directly in a browser.

- **On foot:** WASD to move, mouse to aim, click to shoot (once you own a pistol)
- **Driving:** WASD to drive, E to enter/exit or steal a car, Space handbrake
- **Wanted level 0–5:** stealing, hitting pedestrians and shooting raise it; lose the cops by breaking line of sight, or repaint the car at TINT & PAINT
- **Missions:** First Fare, Hot Wheels, Beach Run, The Informant, Getaway, The Solmar Job — plus taxi fares, stunt jumps, 20 hidden sun coins and car collection
- **Save:** progress (missions, cash, best car) saves to localStorage; Continue from the start screen

## Build the entry

```sh
node main.ts
```

Requires Node 22, standard library only. It copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

## Screenshots

`1-cover.jpg` (cover), `2-onfoot.jpg`, `3-finale.jpg`, `4-chase.jpg` — real renders of the game at a fixed seed.
