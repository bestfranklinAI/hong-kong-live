import { useEffect, useRef, useState } from 'react';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { SceneController } from './SceneController';
import type { MapSceneProps } from './types';
import './scene.css';

export default function MapScene(props: MapSceneProps) {
  const performanceOutput = useRef<HTMLPreElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const callbacks = useRef({
    onFacilitySelect: props.onFacilitySelect,
    onSearchPinSelect: props.onSearchPinSelect,
    onRotationChange: props.onRotationChange,
    onTrainSelect: props.onTrainSelect,
    onSelect: props.onSelect,
    onStatus: props.onStatus,
    onCameraSelect: props.onCameraSelect,
    onStationSelect: props.onStationSelect,
    onBusStopSelect: props.onBusStopSelect,
    onBusAreaSelect: props.onBusAreaSelect,
  });
  const [cityLoading, setCityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacks.current = {
      onFacilitySelect: props.onFacilitySelect,
      onSearchPinSelect: props.onSearchPinSelect,
      onRotationChange: props.onRotationChange,
      onTrainSelect: props.onTrainSelect,
      onSelect: props.onSelect,
      onStatus: props.onStatus,
      onCameraSelect: props.onCameraSelect,
      onStationSelect: props.onStationSelect,
      onBusStopSelect: props.onBusStopSelect,
      onBusAreaSelect: props.onBusAreaSelect,
    };
  }, [
    props.onFacilitySelect,
    props.onSearchPinSelect,
    props.onRotationChange,
    props.onTrainSelect,
    props.onSelect,
    props.onStatus,
    props.onCameraSelect,
    props.onStationSelect,
    props.onBusStopSelect,
    props.onBusAreaSelect,
  ]);

  useEffect(() => {
    if (!host.current || !credits.current) return;
    try {
      controller.current = new SceneController(host.current, {
        onFacilitySelect: (row) => callbacks.current.onFacilitySelect?.(row),
        creditContainer: credits.current,
        onSearchPinSelect: () => callbacks.current.onSearchPinSelect?.(),
        onRotationChange: (rotated) => callbacks.current.onRotationChange?.(rotated),
        performanceOutput: performanceOutput.current ?? undefined,
        onCameraSelect: (camera) => callbacks.current.onCameraSelect?.(camera),
        onStationSelect: (selection) => callbacks.current.onStationSelect?.(selection),
        onBusAreaSelect: (area) => callbacks.current.onBusAreaSelect?.(area),
        onBusStopSelect: (stop) => callbacks.current.onBusStopSelect?.(stop),
        onTrainSelect: (arrival) => callbacks.current.onTrainSelect?.(arrival),
        onSelect: (place) => callbacks.current.onSelect(place),
        onStatus: (status) => {
          setCityLoading(Boolean(status.cityLoading));
          callbacks.current.onStatus?.(status);
          if (!status.ready) setError(status.message);
        },
        basemap: 'none',
        mapLanguage: 'en',
        tilesetUrl: import.meta.env.VITE_HK_3D_TILESET_URL || undefined,
      });
    } catch {
      const message =
        'The map needs WebGL2 graphics support. You can still search places and check their details.';
      setError(message);
      callbacks.current.onStatus?.({ ready: false, message });
    }
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.setBasemap(
      import.meta.env.VITE_MAP_BASEMAP === 'none' ? 'none' : props.basemap,
      props.mapLanguage,
    );
  }, [props.basemap, props.mapLanguage]);

  useEffect(() => {
    controller.current?.setCityView(props.cityView);
  }, [props.cityView]);

  useEffect(() => {
    controller.current?.setRainfall(props.rainfall ?? null);
  }, [props.rainfall]);

  useEffect(() => {
    controller.current?.setPlaces(props.places);
  }, [props.places]);
  useEffect(() => {
    controller.current?.setQuality(props.quality);
  }, [props.quality]);
  useEffect(() => {
    controller.current?.setMode(props.mode);
  }, [props.mode]);
  useEffect(() => {
    controller.current?.setTrafficCameras(props.cameras, props.selectedCamera ?? null);
  }, [props.cameras, props.selectedCamera, props.mode]);
  useEffect(() => {
    controller.current?.setBusStops(props.busStops, props.selectedBusStop ?? null);
  }, [props.busStops, props.selectedBusStop]);

  useEffect(() => {
    controller.current?.setTrainMotion(props.trainMotion ?? null);
  }, [props.trainMotion]);

  useEffect(() => {
    controller.current?.setMtrStation(props.stationSelection ?? null);
  }, [props.stationSelection, props.mode]);
  useEffect(() => {
    controller.current?.selectPlace(props.selectedPlace);
  }, [props.selectedPlace]);
  useEffect(() => {
    controller.current?.setSearchPin(props.searchPin ?? null);
  }, [props.searchPin]);
  useEffect(() => {
    controller.current?.setFacilities(props.facilities);
  }, [props.facilities]);

  useEffect(() => {
    if (props.command?.type === 'locate' && props.command.location)
      controller.current?.locate(props.command.location);
    else if (props.command) controller.current?.command(props.command.type);
  }, [props.command]);

  useEffect(() => {
    const canvasHost = host.current;
    const obstruction = props.frameAbove ? document.querySelector(props.frameAbove) : null;
    if (!canvasHost || !obstruction) {
      controller.current?.setViewportInsets({ top: 0, bottom: 0 });
      return;
    }

    let frame = 0;
    const measure = () => {
      const mapBounds = canvasHost.getBoundingClientRect();
      const panelBounds = obstruction.getBoundingClientRect();
      const overlaps = panelBounds.right > mapBounds.left && panelBounds.left < mapBounds.right;
      controller.current?.setViewportInsets({
        top: Math.min(96, mapBounds.height * 0.2),
        bottom: overlaps ? Math.max(0, mapBounds.bottom - panelBounds.top + 24) : 0,
      });
    };
    const scheduleMeasurement = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasurement);
    window.addEventListener('hk-sheet-settled', scheduleMeasurement);
    observer.observe(canvasHost);
    observer.observe(obstruction);
    measure();
    return () => {
      window.removeEventListener('hk-sheet-settled', scheduleMeasurement);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [props.frameAbove, props.selectedPlace?.id]);

  return (
    <div className="map-scene" data-testid="map-scene">
      <div className="map-scene__canvas" ref={host} />
      <div className="map-scene__credits" ref={credits} />
      {import.meta.env.VITE_SCENE_DIAGNOSTICS === 'true' && (
        <details className="scene-diagnostics">
          <summary>Local render diagnostics</summary>
          <pre aria-label="Scene metrics" ref={performanceOutput} />
        </details>
      )}
      {cityLoading && (
        <div className="city-loading" role="status">
          Loading 3D detail…
        </div>
      )}
      {error && (
        <div className="map-scene__fallback" role="status">
          <strong>Explore through the place list</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
