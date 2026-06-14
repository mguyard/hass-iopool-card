/**
 * rollup-plugin-apex-svg-isolate.mjs
 *
 * Patches the ApexCharts ESM source at build time to prevent SVG.js from being
 * written to / read from window.SVG / global.SVG / globalThis.SVG.
 *
 * Root cause
 * ----------
 * ApexCharts v5 bundles SVG.js internally and registers it on the global:
 *
 *   if (Environment.isBrowser() && typeof window.SVG === "undefined") {
 *     window.SVG = SVG;
 *   }
 *
 * vehicle-info-card embeds ApexCharts v3 (SVG.js v2) which also uses window.SVG.
 * Whichever card loads first wins the slot. If vehicle-info-card runs first,
 * iopool-card reads SVG.js v2 → TypeError: e.put is not a function.
 *
 * Fix: 4 targeted patches on the ApexCharts ESM source (pre-minification):
 *
 *  1. Remove window.SVG = SVG / global.SVG = SVG assignments entirely.
 *     Keeps window.Apex / global.Apex initialisations intact.
 *
 *  2. In clippedImgArea() — replace window.SVG/global.SVG read with SVG directly.
 *
 *  3. In setupElements() — replace globalThis.SVG read with SVG directly.
 *
 *  4. In legend marker drawing — replace window.SVG/global.SVG read with SVG directly.
 */

const PLUGIN_NAME = 'apex-svg-isolate';

const PATCHES = [
  {
    name: 'remove-svg-global-assignments',
    // Removes both window.SVG = SVG assignments and global.SVG = SVG assignment
    // while keeping window.Apex and global.Apex initializations.
    from: `if (Environment.isBrowser() && typeof window.SVG === "undefined") {
  window.SVG = SVG;
}
if (Environment.isBrowser()) {
  if (typeof window.SVG === "undefined") {
    window.SVG = SVG;
  }
  if (typeof window.Apex === "undefined") {
    window.Apex = {};
  }
} else {
  if (typeof global !== "undefined") {
    if (typeof /** @type {any} */
    global.Apex === "undefined") {
      global.Apex = {};
    }
    if (typeof /** @type {any} */
    global.SVG === "undefined") {
      global.SVG = SVG;
    }
  }
}`,
    to: `if (Environment.isBrowser()) {
  if (typeof window.Apex === "undefined") {
    window.Apex = {};
  }
} else {
  if (typeof global !== "undefined") {
    if (typeof /** @type {any} */
    global.Apex === "undefined") {
      global.Apex = {};
    }
  }
}`,
  },
  {
    name: 'isolate-svg-xlink-in-clippedImgArea',
    // const SVGLib = Environment.isBrowser() ? window.SVG : global.SVG;
    // → const SVGLib = SVG;
    from: `    const SVGLib = Environment.isBrowser() ? (
      /** @type {any} */
      window.SVG
    ) : (
      /** @type {any} */
      global.SVG
    );
    elImage.setAttributeNS(SVGLib.xlink`,
    to: `    const SVGLib = SVG;
    elImage.setAttributeNS(SVGLib.xlink`,
  },
  {
    name: 'isolate-globalThis-svg-in-setupElements',
    // const SVG2 = globalThis.SVG;
    // → const SVG2 = SVG;
    from: `    const SVG2 = (
      /** @type {any} */
      globalThis.SVG
    );
    this.w.dom.Paper = SVG2().addTo(this.w.dom.elWrap);`,
    to: `    const SVG2 = SVG;
    this.w.dom.Paper = SVG2().addTo(this.w.dom.elWrap);`,
  },
  {
    name: 'isolate-svg-constructor-in-legend-markers',
    // const SVGLib = Environment.isBrowser() ? window.SVG : global.SVG;
    // const SVGMarker = SVGLib().addTo(...)
    // → const SVGLib = SVG;
    from: `      const SVGLib = Environment.isBrowser() ? (
        /** @type {any} */
        window.SVG
      ) : (
        /** @type {any} */
        global.SVG
      );
      const SVGMarker = SVGLib().addTo`,
    to: `      const SVGLib = SVG;
      const SVGMarker = SVGLib().addTo`,
  },
];

export default function apexSvgIsolate() {
  return {
    name: PLUGIN_NAME,

    transform(code, id) {
      // Only touch apexcharts — leave every other dependency alone.
      if (!id.includes('apexcharts')) return null;

      let patched = code;
      let changed = false;

      for (const patch of PATCHES) {
        if (patched.includes(patch.from)) {
          patched = patched.split(patch.from).join(patch.to);
          changed = true;
        } else {
          this.warn(
            `[${PLUGIN_NAME}] patch "${patch.name}" not applied — ` +
            `pattern not found in ${id}. ` +
            `ApexCharts internals may have changed; review the plugin.`
          );
        }
      }

      return changed ? { code: patched, map: null } : null;
    },
  };
}
