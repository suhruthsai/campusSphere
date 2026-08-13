import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { campusTools } from "./tools.js";

// Initialize the Groq LLM
// We use import.meta.env to get the Vite environment variable
const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
console.log("GROQ API KEY from env:", apiKey ? "Loaded" : "MISSING!");

const llm = new ChatGroq({
  apiKey: apiKey,
  model: "llama-3.3-70b-versatile", // Powerful model with native tool-calling support
  temperature: 0.2,
});

// Valid buildings list to inform the AI
const VALID_BUILDINGS = [
  "R&D", "Canteen", "CAD Lab", "Examination Department", "S&H Block", 
  "ECE", "CSE", "Mech & EEE", "Civil & IT", 
  "Library", "Auditorium", "Suhruth University (Main Gate)", "Back Gate", "Security Room"
];

// The main Campus Guide Agent (has access to tools to manipulate the 3D scene)
export const campusGuideAgent = createReactAgent({
  llm,
  tools: campusTools,
  messageModifier: `You are the Suhruth Digital Twin AI Assistant, an interactive and highly intelligent campus guide.
Your job is to help users navigate the 3D campus map, find buildings, and understand the layout.

Here are the exact names of the buildings that exist on the map:
${VALID_BUILDINGS.join(", ")}

CRITICAL: You have access to tools that manipulate the user's 3D view:
1. fly_to_building(buildingName): Use this when a user asks where a SPECIFIC building is (e.g., "Where is the CAD lab?"). 
   IMPORTANT: You must pass one of the exact building names listed above! Do not make up building names. If the user asks for "3d design", you should map that to "CAD Lab".
2. highlight_buildings(categories): Use this when a user asks to see a TYPE of building (e.g., "Show me all Academic buildings"). Pass an empty array to clear highlights.

Whenever a user asks to find something, you MUST use the appropriate tool to show them, and then reply conversationally explaining what you are showing them. Be concise, friendly, and helpful.`,
});

// Factory function to create unique student agents (no tools, just conversational personas)
export const createStudentAgent = (studentName: string, studentMajor: string, studentTrait: string) => {
  return createReactAgent({
    llm,
    tools: [], 
    messageModifier: `You are ${studentName}, a student majoring in ${studentMajor} at Suhruth University.
Your defining personality trait is: ${studentTrait}.
You are currently walking around the campus. The user has just stopped to talk to you.
Respond completely in character as this student. Keep your answers relatively brief (1-2 sentences max), as you are busy walking around. Do not act like an AI assistant.`,
  });
};
