import { readFileSync } from 'fs';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const isDev = process.env.ROLLUP_WATCH === 'true';

export default {
  input: 'src/iopool-card.ts',
  output: {
    file: 'dist/iopool-card.js',
    format: 'iife',
    name: 'IopoolCard',
    sourcemap: isDev,
    globals: {},
  },
  plugins: [
    replace({
      __CARD_VERSION__: JSON.stringify(pkg.version),
      preventAssignment: true,
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    json(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
    !isDev && terser({
      format: {
        comments: false,
      },
      compress: {
        drop_console: false,
        passes: 2,
      },
    }),
  ].filter(Boolean),
};