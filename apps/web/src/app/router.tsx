import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { AtlasApp } from './AtlasApp';
import { parseSearch } from './search-state';

const rootRoute = createRootRoute({ component: Outlet });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseSearch,
  component: AtlasApp,
});

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
