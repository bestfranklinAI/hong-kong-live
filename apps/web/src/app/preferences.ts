import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Basemap, MapLanguage } from '../scene/basemaps';
import type { Quality, RouteRequest } from '@hk/contracts';
import type { CityPresentation } from '../scene/CityLayers';
import { configuredCitySources, hasCitySource } from '../scene/city-sources';

interface Preferences {
  walkingProfile: RouteRequest['profile'];
  directionsLanguage: RouteRequest['language'];
  setWalkingProfile: (profile: RouteRequest['profile']) => void;
  setDirectionsLanguage: (language: RouteRequest['language']) => void;
  cityView: boolean;
  cityPresentation: CityPresentation;
  setCityPresentation: (presentation: CityPresentation) => void;
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
      walkingProfile: 'recommended',
      directionsLanguage: 'en',
      setWalkingProfile: (walkingProfile) => set({ walkingProfile }),
      setDirectionsLanguage: (directionsLanguage) => set({ directionsLanguage }),
      cityView: hasCitySource,
      cityPresentation: configuredCitySources.buildings ? 'buildings' : 'photo',
      setCityPresentation: (cityPresentation) => set({ cityPresentation }),
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
      partialize: ({
        savedIds,
        quality,
        basemap,
        mapLanguage,
        cityView,
        cityPresentation,
        walkingProfile,
        directionsLanguage,
      }) => ({
        walkingProfile,
        directionsLanguage,
        cityView,
        cityPresentation,
        savedIds,
        quality,
        basemap,
        mapLanguage,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Preferences> | null;
        return {
          ...current,
          walkingProfile:
            saved?.walkingProfile === 'shortest' || saved?.walkingProfile === 'barrier-free'
              ? saved.walkingProfile
              : 'recommended',
          directionsLanguage: saved?.directionsLanguage === 'zh-HK' ? 'zh-HK' : 'en',
          cityView: typeof saved?.cityView === 'boolean' ? saved.cityView : current.cityView,
          cityPresentation:
            saved?.cityPresentation === 'buildings' && configuredCitySources.buildings
              ? 'buildings'
              : saved?.cityPresentation === 'photo' && configuredCitySources.photo
                ? 'photo'
                : current.cityPresentation,
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
