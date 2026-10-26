// Zustand Campus Store — State Management for 3D Digital Twin & Live Status
import { create } from 'zustand';
import { wsUrl } from '../utils/api.js';

interface CampusState {
  cameraMode: 'orbit' | 'fpv' | 'topdown';

  // AI Features State
  isChatOpen: boolean;
  chatMessages: { role: 'user' | 'ai' | 'system', content: string }[];
  chatTarget: string | null; // null for global guide, or student id
  aiFlyTarget: { id: string, ts: number } | null; // name of building to fly to
  aiHighlightTypes: string[]; // types of buildings to highlight
  routeRequest: { from: string, to: string, ts: number } | null; // asked for by the Navigation page
  setRouteRequest: (from: string, to: string) => void;
  
  weatherData: { temp: number, isDay: boolean, condition: string, code: number } | null;
  isRaining: boolean;
  
  setCameraMode: (mode: 'orbit' | 'fpv' | 'topdown') => void;

  toggleChat: () => void;
  openChatWithTarget: (target: string | null) => void;
  addChatMessage: (msg: { role: 'user' | 'ai' | 'system', content: string }) => void;
  setAIFlyTarget: (target: string | null) => void;
  setAIHighlightTypes: (types: string[]) => void;
  
  fetchWeather: () => Promise<void>;
  toggleRain: () => void;

  parkingData: {
    total: number;
    occupied: number;
    spots: { id: string, occupied: boolean }[];
  };
  initParkingSpots: (spots: { id: string, occupied: boolean }[]) => void;
  initWebSocket: () => void;
}

export const useCampusStore = create<CampusState>((set, get) => ({
  cameraMode: 'orbit',

  isChatOpen: false,
  chatMessages: [],
  chatTarget: null,
  aiFlyTarget: null,
  aiHighlightTypes: [],
  routeRequest: null,
  weatherData: null,
  isRaining: false,

  parkingData: {
    total: 60,
    occupied: 0,
    spots: []
  },

  setCameraMode: (mode) => set({ cameraMode: mode }),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  openChatWithTarget: (target) => set({ isChatOpen: true, chatTarget: target, chatMessages: [] }),
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  setAIFlyTarget: (target) => set({ aiFlyTarget: target ? { id: target, ts: Date.now() } : null }),
  setAIHighlightTypes: (types) => set({ aiHighlightTypes: types }),
  setRouteRequest: (from, to) => set({ routeRequest: { from, to, ts: Date.now() } }),
  
  fetchWeather: async () => {
    try {
      // Coordinates for Hyderabad
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=17.2814&longitude=78.5396&current=temperature_2m,is_day,precipitation,weather_code&timezone=auto");
      const data = await res.json();
      const temp = data.current.temperature_2m;
      const isDay = data.current.is_day === 1;
      const code = data.current.weather_code;
      // WMO Weather interpretation codes (WW)
      // 51, 53, 55 (Drizzle), 61, 63, 65 (Rain), 80, 81, 82 (Showers), 95, 96, 99 (Thunderstorm)
      const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
      const isRaining = rainCodes.includes(code);
      
      let condition = "Clear";
      if (isRaining) condition = "Raining";
      else if ([1, 2, 3].includes(code)) condition = "Cloudy";
      else if ([45, 48].includes(code)) condition = "Foggy";
      
      set({ weatherData: { temp, isDay, condition, code }, isRaining });
    } catch (e) {
      console.error("Failed to fetch weather:", e);
    }
  },
  
  toggleRain: () => set((state) => ({ isRaining: !state.isRaining })),

  initParkingSpots: (spots) => set({ 
    parkingData: { 
      total: spots.length, 
      occupied: spots.filter(s => s.occupied).length, 
      spots 
    } 
  }),

  // Idempotent: one shared telemetry socket for the whole app. Previously every mount
  // (and React StrictMode's double mount) opened another socket that was never closed.
  initWebSocket: () => {
    if (telemetrySocket && telemetrySocket.readyState <= WebSocket.OPEN) return;
    if (reconnectTimer) return; // a reconnect is already scheduled

    const ws = new WebSocket(wsUrl('/ws/telemetry'));
    telemetrySocket = ws;
    ws.onopen = () => { reconnectDelay = 3000; };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.parking) {
          set({ parkingData: data.parking });
        }
      } catch (err) {
        console.error("WebSocket payload error:", err);
      }
    };
    ws.onclose = () => {
      if (telemetrySocket === ws) telemetrySocket = null;
      // Back off (3s → 30s) so a down backend isn't hammered
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        get().initWebSocket();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };
  },
}));

let telemetrySocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 3000;
