import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Moon,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';

export function WeatherGlyph({ icon, size = 54 }: { icon?: number | null; size?: number }) {
  const Glyph =
    icon === 50
      ? Sun
      : icon === 51 || icon === 52
        ? CloudSun
        : icon === 65
          ? CloudLightning
          : icon === 53 || icon === 54 || (icon != null && icon >= 62 && icon <= 64)
            ? CloudRain
            : icon != null && icon >= 70 && icon <= 75
              ? Moon
              : icon === 80
                ? Wind
                : icon != null && icon >= 83 && icon <= 85
                  ? CloudFog
                  : icon != null && icon >= 90
                    ? Thermometer
                    : Cloud;
  return <Glyph size={size} strokeWidth={1.2} aria-hidden="true" />;
}
