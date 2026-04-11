export type DataMode = 'demo' | 'live';
export type ThemeMode = 'dark' | 'light';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Station {
  id: string;
  name: string;
  lineId: string;
  lineName: string;
  lat: number;
  lng: number;
  sequence: number;
}

export interface Line {
  id: string;
  name: string;
  color: string;
  points: GeoPoint[];
  branches: GeoPoint[][];
  stations: Station[];
  length: number;
}

export interface Train {
  id: string;
  lineId: string;
  progress: number;
  speed: number;
  direction: 1 | -1;
  express: boolean;
  active: boolean;
  pulseUntil: number;
}

export interface TrainRenderState extends Train {
  point: GeoPoint;
  stationProgress: number;
}

export interface LivePosition {
  trainNo: string;
  lineId: string;
  progress: number;
  express: boolean;
}

export interface MetroData {
  lines: Line[];
  stations: Station[];
}
