import { build } from 'esbuild';
await build({ entryPoints: ['src/engine/client.ts'], outfile: 'public/js/engine.js', bundle: true, format: 'esm', target: 'es2020', logLevel: 'error',
  banner: { js: '// GENERATED from src/engine/{fibre,costing}.ts by scripts/build-engine.mjs — do not edit' } });
console.log('public/js/engine.js built');
