<p align="center">
  <img src="https://brands.home-assistant.io/_/iopool/icon@2x.png" width="300" />
</p>
<p align="center">
    Documentation for the iopool card to Home Assistant.
</p>
<p align="center">
	<img src="https://img.shields.io/github/license/mguyard/hass-iopool-card?style=default&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/mguyard/hass-iopool-card?style=default&color=0080ff" alt="Last Commit">
	<img src="https://img.shields.io/github/languages/top/mguyard/hass-iopool-card?style=default&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/mguyard/hass-iopool-card?style=default&color=0080ff" alt="repo-language-count">
    <a href="https://codecov.io/gh/mguyard/hass-iopool-card" >
        <img src="https://codecov.io/gh/mguyard/hass-iopool-card/graph/badge.svg?token=N2Y1LAEBGG" alt="CodeCov"/>
    </a>
<p>
<p align="center">
    <img src="https://img.shields.io/github/v/release/mguyard/hass-iopool-card?label=Stable" alt="Last Stable Release">
    <img src="https://img.shields.io/github/release-date/mguyard/hass-iopool-card?label=Stable" alt="Last Release Date Stable">
    <img src="https://img.shields.io/github/v/release/mguyard/hass-iopool-card?label=Beta&include_prereleases" alt="Last Beta Release">
    <img src="https://img.shields.io/github/release-date-pre/mguyard/hass-iopool-card?label=Beta" alt="Last Release Date Beta">
    <img src="https://img.shields.io/github/issues-search/mguyard/hass-iopool-card?query=label%3Abug%20is%3Aopened&label=Open%20Bugs" alt="Open Bugs">
    <img src="https://img.shields.io/github/issues-pr/mguyard/hass-iopool-card" alt="Open PRs">
<p>
<p align="center">
    <img src="https://github.com/mguyard/hass-iopool/actions/workflows/ci.yaml/badge.svg" alt="CI/CD Actions">
</p>
<br /><br />

# hass-iopool-card

Official Lovelace card for the [hass-iopool Home Assistant integration](https://docs.page/mguyard/hass-iopool).

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

The card is bundled with the hass-iopool integration. Install [hass-iopool](https://docs.page/mguyard/hass-iopool/integration) through HACS, then add the card from the Lovelace card picker by searching for iopool.

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
| `chart_period`           | 24, 48, 96, 168    | `48`        | Chart window in hours                                   |
| `temperature_thresholds` | tuple of 4 numbers | pool preset | Temperature zone transition values                      |
| `debug`                  | boolean            | `false`     | YAML-only console debug mode                            |
| `section_actions`        | object             | more-info        | Per-section tap actions           |

## Docs

Full documentation for the integration can be found:
- for `Stable` version [here](https://docs.page/mguyard/hass-iopool-card)
- for `Beta` version [here](https://docs.page/mguyard/hass-iopool-card~beta)

## Contribution

Want to contribute to [iopool card](https://docs.page/mguyard/hass-iopool-card~dev/support/contributing)?

## License

[GNU GENERAL PUBLIC LICENSE v3](LICENSE)

---

If you feel this integration was valuable and want to support it in other ways, you can [sponsor me](https://github.com/sponsors/mguyard).

