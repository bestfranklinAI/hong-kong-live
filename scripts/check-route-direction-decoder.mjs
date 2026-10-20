/** Offline compatibility check against the official, pinned ArcGIS REST JS helper.
 * Requires the 4.11.0 npm tarball and recorded probe responses in the output folder.
 * Does not add a package to the application or query a government service.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const folder = new URL('../output/playwright/network-probe/', import.meta.url);
const archive = new URL('esri-arcgis-rest-routing-4.11.0.tgz', folder);
const helper = new URL('decoder-helper.cjs', folder);
writeFileSync(
  helper,
  execFileSync('tar', ['-xOf', fileURLToPath(archive), 'package/dist/cjs/helpers.js']),
);
const require = createRequire(import.meta.url);
const { decompressGeometry } = require(fileURLToPath(helper));
const source = JSON.parse(readFileSync(new URL('route-recommended.json', folder), 'utf8')).data;
const rows = source.directions[0].features.map((step, index) => {
  const points = decompressGeometry(step.compressedGeometry).paths.flat();
  return {
    index,
    pointCount: points.length,
    finite: points.every((point) => point.every(Number.isFinite)),
  };
});
const result = {
  decoder: '@esri/arcgis-rest-routing 4.11.0 decompressGeometry',
  archiveSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
  sampledDirections: rows.length,
  decodedFinite: rows.filter((row) => row.finite).length,
  conclusion: rows.every((row) => row.finite)
    ? 'Finite coordinates decoded; spatial alignment has not been established.'
    : 'This decoder does not accept these XYZM compressed directions. Do not use its nonfinite coordinates for markers.',
};
writeFileSync(new URL('decoder-check.json', folder), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
