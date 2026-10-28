# AZOBSS Patch 1079 — Makan Malaysia Food Guide

Baseline: v1078

## New section
- Added `/Makan-Malaysia/` under the **More** menu.
- Initial curated dataset: 40 popular / iconic food locations across 16 Malaysian states / federal territories.
- Search by restaurant name, dish, city, address or tag.
- Filter by state and food category.
- Sort by Recommended, State, Name or Specialty.

## Google Maps
- Built-in Google Maps live iframe; no Google Maps API key required.
- State/category/search controls update the live Google Maps search so users can browse Google pins.
- Clicking a curated AZOBSS card focuses the selected place in Google Maps.
- `Open Google Maps` and `Directions` deep links are included.

## Starting location / directions
- `Lokasi Semasa` uses browser geolocation when permission is granted.
- User may type a different starting location instead of using current location.
- Directions send the selected origin + destination to Google Maps.

## Data / safety
- No hard-coded Google star ratings or opening-hours claims in the UI, because those change frequently.
- Page reminds users to verify current hours, pricing and halal/dietary status in Google Maps or directly with the venue.
- Capitol Satay Celup is explicitly tagged `Non-Halal - Verify` based on current Melaka tourism information.

## Navigation
- `Makan Malaysia` is inserted into static and legacy/dynamic More menus.
- More-nav cache version updated to v1079.

Package version: `1.0.1079`
