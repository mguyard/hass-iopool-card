# hass-iopool-card

[![Version](https://img.shields.io/github/v/release/mguyard/hass-iopool-card?style=flat-square)](https://github.com/mguyard/hass-iopool-card/releases)
[![License](https://img.shields.io/github/license/mguyard/hass-iopool-card?style=flat-square)](LICENSE)
[![HACS](https://img.shields.io/badge/HACS-custom%20integration-41BDF5?style=flat-square)](https://hacs.xyz/)

Official Lovelace card for the hass-iopool Home Assistant integration.

It presents the main pool data and controls in a single card: temperature, pH, ORP, filtration mode, pump control, daily filtration progress, boost, and a temperature history chart.

## Features

- Live gauges for temperature, pH, and ORP
- Header badges for probe mode and action status
- Filtration mode selector with Standard, Active winter, and Passive winter
- Optional pump control when a switch entity is configured
- Daily filtration progress and iopool recommendation
- Boost presets with countdown
- Temperature chart with selectable history windows
- YAML-only debug mode for console diagnostics

## Installation

The card is bundled with the hass-iopool integration. Install hass-iopool through HACS, then add the card from the Lovelace card picker by searching for iopool.

## Usage

```yaml
type: custom:iopool-card
device_id: YOUR_DEVICE_ID
```

## Configuration

| Key                      | Type               | Default     | Description                                             |
| ------------------------ | ------------------ | ----------- | ------------------------------------------------------- |
| `device_id`              | string             | required    | Home Assistant device ID for the iopool pool            |
| `pump_entity`            | string             | none        | Optional pump switch entity, such as `switch.pool_pump` |
| `show_chart`             | boolean            | `true`      | Show or hide the temperature chart                      |
| `chart_period`           | 24, 48, 96, 168    | `96`        | Chart window in hours                                   |
| `temperature_thresholds` | tuple of 4 numbers | pool preset | Temperature zone transition values                      |
| `debug`                  | boolean            | `false`     | YAML-only console debug mode                            |
| `section_actions`        | object             | none        | Per-section tap, hold, and double tap actions           |

## Development

```bash
npm ci
npm run dev
npm test
npm run build
```

## License

MIT

## Links

- [hass-iopool](https://github.com/mguyard/hass-iopool)
- [Documentation site](https://docs.page/mguyard/hass-iopool-card)
- [Issues](https://github.com/mguyard/hass-iopool-card/issues)# hass-iopool-card
