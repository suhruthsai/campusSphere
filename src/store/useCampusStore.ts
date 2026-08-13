// Zustand Campus Store — State Management for 3D Digital Twin & Live Status
import { create } from 'zustand';
import { Building } from '../types/index.ts';
import { buildings } from '../data/campus.js';

interface CampusState {
  buildings: Building[];
  selectedBuilding: Building | null;
  cameraMode: 'orbit' | 'fpv' | 'topdown';
  liveTelemetryActive: boolean;

  // AI Features State
  isChatOpen: boolean;
  chatMessages: { role: 'user' | 'ai' | 'system', content: string }[];
  chatTarget: string | null; // null for global guide, or student id
  aiFlyTarget: { id: string, ts: number } | null; // name of building to fly to
  aiHighlightTypes: string[]; // types of buildings to highlight
  
  weatherData: { temp: number, isDay: boolean, condition: string, code: number } | null;
  isRaining: boolean;
  
  selectBuilding: (b: Building | null) => void;
  setCameraMode: (mode: 'orbit' | 'fpv' | 'topdown') => void;
  toggleTelemetry: () => void;

  toggleChat: () => void;
  openChatWithTarget: (target: string | null) => void;
  addChatMessage: (msg: { role: 'user' | 'ai' | 'system', content: string }) => void;
  setChatMessages: (msgs: { role: 'user' | 'ai' | 'system', content: string }[]) => void;
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
  buildings: buildings as Building[],
  selectedBuilding: null,
  cameraMode: 'orbit',
  liveTelemetryActive: true,

  isChatOpen: false,
  chatMessages: [],
  chatTarget: null,
  aiFlyTarget: null,
  aiHighlightTypes: [],
  weatherData: null,
  isRaining: false,

  parkingData: {
    total: 60,
    occupied: 0,
    spots: []
  },

  selectBuilding: (building) => set({ selectedBuilding: building }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleTelemetry: () => set((state) => ({ liveTelemetryActive: !state.liveTelemetryActive })),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  openChatWithTarget: (target) => set({ isChatOpen: true, chatTarget: target, chatMessages: [] }),
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  setChatMessages: (msgs) => set({ chatMessages: msgs }),
  setAIFlyTarget: (target) => set({ aiFlyTarget: target ? { id: target, ts: Date.now() } : null }),
  setAIHighlightTypes: (types) => set({ aiHighlightTypes: types }),
  
  fetchWeather: async () => {
    try {
      // Coordinates for Hyderabad
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=17.3850&longitude=78.4867&current=temperature_2m,is_day,precipitation,weather_code&timezone=auto");
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

  initWebSocket: () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/telemetry`);
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
      console.log("WebSocket disconnected. Reconnecting in 3s...");
      setTimeout(() => get().initWebSocket(), 3000);
    };
  },
}));
