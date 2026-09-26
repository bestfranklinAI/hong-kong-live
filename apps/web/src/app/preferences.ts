import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Basemap, MapLanguage } from '../scene/basemaps';
import type { Quality } from '@hk/contracts';

interface Preferences {
  cityView: boolean;
  setCityView: (enabled: boolean) => void;
  savedIds: string[];
  quality: Quality;
  basemap: Basemap;
  mapLanguage: MapLanguage;
  setBasemap: (basemap: Basemap) => void;
  setMapLanguage: (mapLanguage: MapLanguage) => void;
  toggleSaved: (id: string) => void;
  setQuality: (quality: Quality) => void;
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      cityView: Boolean(import.meta.env.VITE_HK_3D_TILESET_URL),
      setCityView: (cityView) => set({ cityView }),
      savedIds: [],
      quality: 'balanced',
      basemap: 'landsd-map',
      mapLanguage: 'en',
      setBasemap: (basemap) => set({ basemap }),
      setMapLanguage: (mapLanguage) => set({ mapLanguage }),
      toggleSaved: (id) =>
        set((state) => ({
          savedIds: state.savedIds.includes(id)
            ? state.savedIds.filter((saved) => saved !== id)
            : [...state.savedIds, id],
        })),
      setQuality: (quality) => set({ quality }),
    }),
    {
      name: 'hk-live-preferences',
      version: 1,
      partialize: ({ savedIds, quality, basemap, mapLanguage, cityView }) => ({
        cityView,
        savedIds,
        quality,
        basemap,
        mapLanguage,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Preferences> | null;
        return {
          ...current,
          cityView: typeof saved?.cityView === 'boolean' ? saved.cityView : current.cityView,
          basemap:
            saved?.basemap === 'landsd-aerial' || saved?.basemap === 'openstreetmap'
              ? saved.basemap
              : 'landsd-map',
          mapLanguage: saved?.mapLanguage === 'tc' ? 'tc' : 'en',
          savedIds: Array.isArray(saved?.savedIds)
            ? saved.savedIds.filter((id): id is string => typeof id === 'string').slice(0, 100)
            : [],
          quality:
            saved?.quality === 'efficient' || saved?.quality === 'detailed'
              ? saved.quality
              : 'balanced',
        };
      },
    },
  ),
);
