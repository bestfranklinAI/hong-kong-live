import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { facilitySnapshotSchema } from '@hk/contracts';
import { FACILITY_SOURCES, FacilityCatalogue, type Fetcher } from '@hk/providers';

export async function persistentFacilities(directory: string, fetcher: Fetcher) {
  await mkdir(directory, { recursive: true });
  const initial = [];
  for (const source of FACILITY_SOURCES) {
    try {
      const snapshot = facilitySnapshotSchema.parse(
        JSON.parse(await readFile(join(directory, `${source.id}.json`), 'utf8')),
      );
      if (
        snapshot.dataset === source.id &&
        snapshot.records.every((row) => row.facility?.dataset === source.id)
      )
        initial.push(snapshot);
    } catch {
      /* A missing or invalid snapshot is replaced by a validated download. */
    }
  }
  return new FacilityCatalogue(fetcher, initial, Date.now, async (snapshot) => {
    const target = join(directory, `${snapshot.dataset}.json`);
    await writeFile(`${target}.tmp`, JSON.stringify(snapshot));
    await rename(`${target}.tmp`, target);
  });
}
