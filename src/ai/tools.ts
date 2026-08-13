import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { useCampusStore } from "../store/useCampusStore.js";

// Tool to fly the camera to a specific building
export const flyToBuildingTool = tool(
  async ({ buildingName }) => {
    // Get the Zustand store and call the action
    console.log(`[AI TOOL EXECUTED] fly_to_building with argument: "${buildingName}"`);
    useCampusStore.getState().setAIFlyTarget(buildingName);
    return `Successfully initiated camera flight to ${buildingName}.`;
  },
  {
    name: "fly_to_building",
    description: "Flies the 3D camera to look at a specific building on the campus map.",
    schema: z.object({
      buildingName: z.string().describe("The exact name of the building to fly to (e.g., 'CAD Lab', 'Admin Block')"),
    }),
  }
);

// Tool to highlight buildings by category
export const highlightBuildingsTool = tool(
  async ({ categories }) => {
    useCampusStore.getState().setAIHighlightTypes(categories);
    return `Successfully highlighted buildings of categories: ${categories.join(', ')}.`;
  },
  {
    name: "highlight_buildings",
    description: "Makes buildings of specific categories glow brightly while dimming the rest of the campus. Pass an empty array to reset highlights.",
    schema: z.object({
      categories: z.array(z.string()).describe("Array of building types to highlight (e.g., ['Academic'], ['Research', 'Facilities'], or [] to clear)"),
    }),
  }
);

export const campusTools = [flyToBuildingTool, highlightBuildingsTool];
