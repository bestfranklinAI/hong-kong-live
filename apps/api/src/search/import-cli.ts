import { fileURLToPath } from 'node:url';
import { RestaurantStore } from './store';
import { importRestaurants } from './collector';
const store = new RestaurantStore(
  process.env.HK_SEARCH_DB ??
    fileURLToPath(new URL('../../../../.data/search.sqlite', import.meta.url)),
);
try {
  await importRestaurants(store, fetch);
  console.info(store.status(Date.now()));
} finally {
  store.close();
}
