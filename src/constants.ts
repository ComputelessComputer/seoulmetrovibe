import type { GeoPoint } from './types';

export const SEOUL_CENTER: GeoPoint = { lat: 37.5665, lng: 126.978 };
export const SEOUL_ZOOM = 11;

export const STATIONS_URL =
  'https://raw.githubusercontent.com/sudo-happy/data-archive/main/metro/station/data-metro-station-1.0.0.json';
export const LINES_URL =
  'https://raw.githubusercontent.com/sudo-happy/data-archive/main/metro/line/data-metro-line-1.0.0.json';
export const GITHUB_REPO_URL = 'https://github.com/ComputelessComputer/seoulmetrovibe';

export const LIVE_API_KEY = 'YOUR_API_KEY';
export const LIVE_API_BASE =
  'http://openAPI.seoul.go.kr:8088/YOUR_API_KEY/json/realtimePosition/0/200/ALL';

export const TARGET_TRAIN_COUNT = 300;

export const LINE_INFO: Record<string, { instrument: string; description: string }> = {
  '1호선': {
    instrument: 'Walking Bass',
    description: 'The oldest line, running since 1974. Dark blue, the backbone of the city.',
  },
  '2호선': {
    instrument: 'Piano',
    description:
      'The great circle line. 51 stations looping central Seoul — it never stops, always returning.',
  },
  '3호선': {
    instrument: 'Saxophone',
    description: 'Orange, diagonal from Goyang to Ogeum. Warm, urban, slightly sharp.',
  },
  '4호선': {
    instrument: 'Vibraphone',
    description: 'Sky blue, crossing the Han River from north to south. Metallic, crystalline.',
  },
  '5호선': {
    instrument: 'String Pad',
    description:
      'Purple, the longest line. 56 stations east to west — it sustains, fills the background.',
  },
  '6호선': {
    instrument: 'Brushed Snare',
    description: 'Brown, curving through the northwest. Soft percussion, underheard but always there.',
  },
  '7호선': {
    instrument: 'Fretless Bass',
    description: 'Olive, long diagonal from Dobong to Incheon. Low and buzzy, finding the groove.',
  },
  '8호선': {
    instrument: 'Bells',
    description: 'Pink, the shortest line. High notes, brief, vanishing.',
  },
  '9호선': {
    instrument: 'Flute',
    description: 'Gold, the express line along the Han River. Fast, bright, skipping stations.',
  },
  분당선: {
    instrument: 'Gentle Piano',
    description: 'Yellow, the Bundang suburban line. Softer keys, steady rhythm.',
  },
  수인분당선: {
    instrument: 'Gentle Piano',
    description: 'Yellow, running from Suwon to Seoul. The same instrument, a longer journey.',
  },
  신분당선: {
    instrument: 'Solo Saxophone',
    description: 'Deep red, the Sinbundang express. Fast, deliberate, louder than the rest.',
  },
  경의중앙선: {
    instrument: 'Sustained Chord',
    description: 'Teal, running east to west through the city. Long tones, a slow exhale.',
  },
  공항철도: {
    instrument: 'Clean Tone',
    description: 'Blue, to Incheon Airport. Unhurried, clear, departure.',
  },
  경강선: {
    instrument: 'Glass Piano',
    description: 'A newer eastbound regional line out of Pangyo toward Icheon and Yeoju. More air, longer spacing, a wider horizon.',
  },
  경춘선: {
    instrument: 'Acoustic Guitar',
    description: 'The Seoul-to-Chuncheon corridor. More daylight, longer gaps, a commuter line that already feels like leaving the city.',
  },
  김포골드라인: {
    instrument: 'Claves',
    description: 'A compact automatic line feeding Gimpo into the airport network. Short stations, quick turns, relentless compression.',
  },
  서해선: {
    instrument: 'Harmonium',
    description: 'A west-side cross-regional line linking Goyang, Gimpo, Bucheon, Siheung, and Ansan. Long lateral motion, steady and broad.',
  },
  신림선: {
    instrument: 'Marimba',
    description: 'A rubber-tyred light metro through southwest Seoul. Tight stop spacing and fast pulses, built for dense neighborhood movement.',
  },
  용인에버라인: {
    instrument: 'Toy Piano',
    description: 'A driverless light line through Yongin connecting the Bundang corridor to Everland. Bright, synthetic, almost playful.',
  },
  우이신설선: {
    instrument: 'Celesta',
    description: 'A small northern Seoul light rail from Bukhansan Ui to Sinseol-dong. Short hops, cool air, precise bright notes.',
  },
  의정부경전철: {
    instrument: 'Muted Trumpet',
    description: 'A fully automatic light metro threading through Uijeongbu. Compact stations, quick bends, a clipped mechanical rhythm.',
  },
  '인천1호선': {
    instrument: 'Electric Piano',
    description: "Incheon's first subway spine, running north to south through the city's core. Blue, practical, and tidal.",
  },
  '인천2호선': {
    instrument: 'Woodblock',
    description: "Incheon's driverless east-west light metro. Faster openings, tighter curves, and a bright orange snap.",
  },
  GTXA: {
    instrument: 'Synth Brass',
    description: 'The first GTX express corridor, built for speed more than stop density. Fewer stations, harder acceleration, cleaner cuts.',
  },
};

export const LINE_DISPLAY_NAMES: Record<string, string> = {
  경의중앙선: '경의중앙',
  김포골드라인: '김포골드',
  수인분당선: '수인분당',
  신분당선: '신분당',
  우이신설선: '우이신설',
  GTXA: '지티엑스 에이',
};

export const LINE_COLOR_OVERRIDES: Record<string, string> = {
  '1호선': '#0d3692',
  '2호선': '#33a23d',
  '3호선': '#fe5b10',
  '4호선': '#32a1c8',
  '5호선': '#8b50a4',
  '6호선': '#c55c1d',
  '7호선': '#54640d',
  '8호선': '#f14c82',
  '9호선': '#aa9872',
  분당선: '#f5a200',
  수인분당선: '#f5a200',
  신분당선: '#c82127',
  경의중앙선: '#77c4a3',
  경춘선: '#178c72',
  공항철도: '#0090d2',
  경강선: '#0054a6',
  우이신설선: '#b7c450',
};

export const OTHER_LINE_COLORS = [
  '#3a86ff',
  '#ff6b6b',
  '#00a896',
  '#6c5ce7',
  '#ff9f1c',
  '#2d6a4f',
  '#8d99ae',
];
