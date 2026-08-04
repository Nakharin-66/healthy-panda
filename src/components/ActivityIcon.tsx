import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  Heart,
  Mountain,
  Music,
  Target,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";

export const ACTIVITY_ICONS = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  zap: Zap,
  bike: Bike,
  mountain: Mountain,
  waves: Waves,
  "flower-2": Flower2,
  flame: Flame,
  activity: Activity,
  music: Music,
  target: Target,
  "trending-up": TrendingUp,
  heart: Heart,
} as const;

export type ActivityIconName = keyof typeof ACTIVITY_ICONS;

export const ACTIVITY_ICON_LIST = Object.keys(ACTIVITY_ICONS) as ActivityIconName[];

export function ActivityIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ACTIVITY_ICONS[name as ActivityIconName] ?? Dumbbell;
  return <Icon className={className} />;
}
