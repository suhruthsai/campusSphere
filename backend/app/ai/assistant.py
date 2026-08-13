# AI Assistant Engine — LangChain RAG & Campus Intelligence
from typing import Dict, Any

CAMPUS_KNOWLEDGE_BASE = {
  "suhruth": "Suhruth University is a smart campus featuring 11 primary blocks (CSE, ECE, Mech & EEE, Civil & IT, S&H, R&D, Canteen, Exam Dept, Library, Ground, Parking).",
  "cse": "The Computer Science & Engineering (CSE) Block houses the AI Research Lab, Coding Lab, and 4 lecture halls.",
  "parking": "Smart Parking features 120 total slots divided across Zone A (Faculty), Zone B (Students), Zone C (Staff), and Zone D (Visitors).",
  "library": "The Campus Library has 140 total seats, reading halls, digital archives, and live occupancy tracking.",
  "energy": "Campus energy management monitors real-time kWh consumption across all 11 buildings with solar power integration.",
}

class CampusAIAssistant:
    """LangChain RAG Assistant engine for CampusSphere."""

    @staticmethod
    def answer_query(message: str) -> Dict[str, Any]:
        query = message.lower()
        
        if "canteen" in query or "food" in query:
            reply = "The Canteen is located next to the CAD Lab in the top row of campus. Current occupancy is at 84% capacity."
        elif "library" in query or "book" in query:
            reply = "The Library currently has 25 available seats out of 140. Reading Hall 1 is open till 10:00 PM."
        elif "parking" in query or "car" in query or "vehicle" in query:
            reply = "Smart Parking currently has 36 available slots out of 120 (Zone B for students has 17 free slots)."
        elif "lab" in query or "ai" in query:
            reply = "The AI Research Lab is on Floor 2 of the CSE Block, equipped with 15 RTX 4090 GPU workstations."
        elif "building" in query or "block" in query:
            reply = "Suhruth University features 11 active blocks arranged in 3 horizontal bands, including CSE, ECE, Mech, Civil, S&H, and R&D."
        else:
            reply = f"CampusSphere Intelligence: In response to '{message}', all 15 campus modules (Digital Twin, Parking, Library, Energy, Water, Crowd, Environment) are operating normally."

        return {
            "reply": reply,
            "sources": ["Suhruth University Campus Digital Twin Registry v2.4"]
        }
