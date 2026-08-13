// ── AI Engine Mock Data ──────────────────────────────────────────────────────
// Predictions, Assistant Knowledge, and Recommendation Engine data

// ══════════════════════════════════════════════════════════════════════════════
// 16. AI Prediction Engine
// ══════════════════════════════════════════════════════════════════════════════
export const predictions = {
  models: [
    { id: 'm1', name: 'Parking Occupancy Predictor',    module: 'parking',    algorithm: 'XGBoost',      accuracy: 94.2, lastTrained: '2026-07-28', status: 'active',    features: 12, dataPoints: 18400 },
    { id: 'm2', name: 'Library Seat Forecaster',        module: 'library',    algorithm: 'Prophet',      accuracy: 91.8, lastTrained: '2026-07-27', status: 'active',    features: 8,  dataPoints: 12200 },
    { id: 'm3', name: 'Classroom Demand Predictor',     module: 'classroom',  algorithm: 'Random Forest', accuracy: 89.5, lastTrained: '2026-07-26', status: 'active',    features: 15, dataPoints: 9800  },
    { id: 'm4', name: 'Energy Consumption Forecaster',  module: 'energy',     algorithm: 'LSTM + XGBoost',accuracy: 96.1, lastTrained: '2026-07-29', status: 'active',    features: 22, dataPoints: 52000 },
    { id: 'm5', name: 'Water Usage Predictor',          module: 'water',      algorithm: 'Prophet',      accuracy: 88.7, lastTrained: '2026-07-25', status: 'active',    features: 10, dataPoints: 8600  },
    { id: 'm6', name: 'Crowd Density Analyzer',         module: 'crowd',      algorithm: 'YOLO + KNN',   accuracy: 92.4, lastTrained: '2026-07-30', status: 'active',    features: 18, dataPoints: 34000 },
    { id: 'm7', name: 'Equipment Failure Detector',     module: 'equipment',  algorithm: 'Isolation Forest', accuracy: 87.3, lastTrained: '2026-07-24', status: 'retraining', features: 30, dataPoints: 4200 },
  ],

  liveForecasts: {
    parking:   { next1h: 92, next3h: [92, 98, 85], trend: 'rising',  confidence: 0.94, alert: 'Zone B will reach 95% by 10:30 AM' },
    library:   { next1h: 108, next3h: [108, 115, 102], trend: 'rising',  confidence: 0.91, alert: 'Reading Hall 1 predicted to be full by 11:00 AM' },
    classroom: { next1h: 14, next3h: [14, 16, 12], trend: 'stable', confidence: 0.89, alert: '3 classrooms available in CSE Block after 2:00 PM' },
    energy:    { next1h: 198, next3h: [198, 215, 180], trend: 'rising',  confidence: 0.96, alert: 'Peak demand expected at 2:00 PM — recommend load shed' },
    water:     { next1h: 1450, next3h: [1450, 1200, 1100], trend: 'falling', confidence: 0.88, alert: 'Normal consumption expected' },
    crowd:     { next1h: 2950, next3h: [2950, 3100, 2800], trend: 'rising',  confidence: 0.92, alert: 'Canteen zone will exceed 90% capacity at lunch' },
    equipment: { failures: 2, nextLikely: 'VLSI Lab Oscilloscope #3 — 72% failure probability in 14 days', confidence: 0.87 },
  },

  history: [
    { id: 'ph1', date: '2026-07-30', module: 'parking',  predicted: 88, actual: 91, accuracy: 96.7, model: 'XGBoost' },
    { id: 'ph2', date: '2026-07-30', module: 'energy',   predicted: 1820, actual: 1842, accuracy: 98.8, model: 'LSTM + XGBoost' },
    { id: 'ph3', date: '2026-07-30', module: 'crowd',    predicted: 2780, actual: 2840, accuracy: 97.9, model: 'YOLO + KNN' },
    { id: 'ph4', date: '2026-07-29', module: 'library',  predicted: 95, actual: 97, accuracy: 97.9, model: 'Prophet' },
    { id: 'ph5', date: '2026-07-29', module: 'water',    predicted: 27800, actual: 28450, accuracy: 97.7, model: 'Prophet' },
    { id: 'ph6', date: '2026-07-29', module: 'parking',  predicted: 82, actual: 80, accuracy: 97.5, model: 'XGBoost' },
    { id: 'ph7', date: '2026-07-28', module: 'energy',   predicted: 1910, actual: 1920, accuracy: 99.5, model: 'LSTM + XGBoost' },
    { id: 'ph8', date: '2026-07-28', module: 'classroom',predicted: 11, actual: 13, accuracy: 84.6, model: 'Random Forest' },
  ],

  trainingLogs: [
    { id: 'tl1', model: 'Energy Consumption Forecaster', date: '2026-07-29', duration: '4m 12s', epochs: 150, loss: 0.0023, status: 'completed' },
    { id: 'tl2', model: 'Crowd Density Analyzer',        date: '2026-07-30', duration: '6m 45s', epochs: 200, loss: 0.0041, status: 'completed' },
    { id: 'tl3', model: 'Equipment Failure Detector',     date: '2026-07-31', duration: '2m 30s', epochs: 80,  loss: 0.0089, status: 'in-progress' },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// 17. AI Campus Assistant
// ══════════════════════════════════════════════════════════════════════════════
export const assistant = {
  faqs: [
    { q: 'Where is the AI Research Lab?',              a: 'Floor 2, CSE Block — Room CS-201. Equipped with 15 RTX 4090 GPU workstations.' },
    { q: 'What are the library hours?',                a: 'Monday–Saturday: 8:00 AM – 10:00 PM. Sunday: 9:00 AM – 5:00 PM.' },
    { q: 'How do I book a classroom?',                 a: 'Navigate to Classrooms module → Select an available slot → Click "Book" → Fill in details.' },
    { q: 'Where can I park my bike?',                  a: 'Zone B (Student Parking) has 60 slots. Current availability: 17 slots free.' },
    { q: 'When is the next cultural event?',           a: 'Annual Tech Fest "InnoVerse 2026" — August 15–17, Main Ground & Auditorium.' },
    { q: 'What is the Wi-Fi password?',                a: 'Connect to "SuhruthCampus-5G". Credentials are issued via your student portal.' },
    { q: 'How do I contact the exam department?',      a: 'Examination Dept, Ground Floor. Phone: +91-40-2345-6789. Email: exams@suhruth.edu' },
    { q: 'Where is the canteen?',                      a: 'Top row of campus, between R&D Block and CAD Lab. Open 7:30 AM – 8:00 PM.' },
  ],
  
  sampleConversations: [
    { role: 'user',      text: 'Find me a quiet study spot right now' },
    { role: 'assistant', text: '📚 Based on current occupancy data:\n\n1. **Reading Hall 2** — 58% occupied, 25 seats free (Quietest)\n2. **Library Mezzanine** — 12 seats available\n3. **S&H Block Study Room 301** — Empty, AC available\n\nRecommendation: Reading Hall 2 for the quietest environment.' },
    { role: 'user',      text: 'Navigate me to ECE Block from Main Gate' },
    { role: 'assistant', text: '🗺️ **Route: Main Gate → ECE Block**\n\n1. Enter through Main Gate (right side)\n2. Walk straight along the central pathway (~200m)\n3. Pass CSE Block on your left\n4. ECE Block is the next building on your left\n\n⏱️ Estimated walk: 4 minutes\n📍 Current crowd level: Medium (380/600)' },
  ],

  languages: ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada'],

  capabilities: [
    { icon: '💬', label: 'Campus Q&A',          desc: 'Ask anything about buildings, labs, departments, or campus facilities' },
    { icon: '🗺️', label: 'Navigation Assistance', desc: 'Get walking directions between any two campus locations' },
    { icon: '📅', label: 'Event Information',     desc: 'Find upcoming events, fests, workshops, and deadlines' },
    { icon: '🏢', label: 'Building Search',       desc: 'Locate any building, room, or office on campus' },
    { icon: '📚', label: 'Classroom Search',      desc: 'Find available classrooms by time, capacity, or equipment' },
    { icon: '🎤', label: 'Voice Support',          desc: 'Speak your query using the microphone button' },
    { icon: '🌐', label: 'Multi-language',         desc: 'Supports English, Hindi, Telugu, Tamil, and Kannada' },
    { icon: '❓', label: 'FAQ Database',            desc: 'Instant answers to frequently asked campus questions' },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// 18. Recommendation Engine
// ══════════════════════════════════════════════════════════════════════════════
export const recommendations = {
  studySpaces: [
    { id: 'ss1', name: 'Reading Hall 2',             location: 'Library, Floor 1',       noise: 'Very Low', occupancy: 58, capacity: 60, score: 96, amenities: ['Wi-Fi', 'AC', 'Power Outlets', 'Natural Light'], reason: 'Quietest space with most free seats' },
    { id: 'ss2', name: 'S&H Block Study Room 301',   location: 'S&H Block, Floor 3',     noise: 'Low',      occupancy: 0,  capacity: 20, score: 94, amenities: ['Wi-Fi', 'AC', 'Whiteboard'],                     reason: 'Completely empty — ideal for group study' },
    { id: 'ss3', name: 'Library Mezzanine',           location: 'Library, Floor 2',       noise: 'Low',      occupancy: 42, capacity: 50, score: 88, amenities: ['Wi-Fi', 'AC', 'Computers'],                      reason: 'Good availability with computer access' },
    { id: 'ss4', name: 'CSE Block Open Lab',          location: 'CSE Block, Floor 1',     noise: 'Medium',   occupancy: 30, capacity: 40, score: 78, amenities: ['Wi-Fi', 'AC', 'Projector', 'GPU Workstations'],  reason: 'Best for coding and project work' },
    { id: 'ss5', name: 'Garden Pavilion',              location: 'Circular Garden',       noise: 'Medium',   occupancy: 8,  capacity: 30, score: 72, amenities: ['Wi-Fi', 'Natural Light', 'Fresh Air'],            reason: 'Relaxed outdoor study environment' },
  ],

  parkingSpots: [
    { zone: 'B', label: 'Zone B – Students (Near CSE)',  freeSlots: 17, distance: '2 min walk',   score: 95, reason: 'Closest to CSE/ECE with most availability' },
    { zone: 'C', label: 'Zone C – Staff (Near Library)',  freeSlots: 11, distance: '3 min walk',   score: 88, reason: 'Near Library entrance — shaded parking' },
    { zone: 'D', label: 'Zone D – Visitors (Main Gate)',  freeSlots: 6,  distance: '5 min walk',   score: 70, reason: 'Near exit — good for short visits' },
    { zone: 'A', label: 'Zone A – Faculty (Reserved)',    freeSlots: 2,  distance: '1 min walk',   score: 40, reason: 'Nearly full — faculty reserved' },
  ],

  routes: [
    { id: 'r1', from: 'Main Gate',      to: 'CSE Block',      distance: '200m', time: '3 min', mode: 'Walk', crowdLevel: 'Medium', score: 92, steps: ['Enter Main Gate', 'Walk straight 200m', 'CSE Block on left'] },
    { id: 'r2', from: 'Parking Zone B', to: 'Library',         distance: '150m', time: '2 min', mode: 'Walk', crowdLevel: 'Low',    score: 96, steps: ['Exit Zone B south', 'Walk towards Library building'] },
    { id: 'r3', from: 'Canteen',        to: 'ECE Block',       distance: '180m', time: '3 min', mode: 'Walk', crowdLevel: 'High',   score: 78, steps: ['Exit Canteen south', 'Cross central pathway', 'ECE Block ahead'] },
    { id: 'r4', from: 'CSE Block',      to: 'Mech & EEE Block',distance: '250m', time: '4 min', mode: 'Walk', crowdLevel: 'Medium', score: 85, steps: ['Exit CSE east', 'Pass ECE Block', 'Mech & EEE on right'] },
  ],

  classrooms: [
    { id: 'cr1', name: 'LH-101 (CSE Block)',   capacity: 60, equipment: ['Projector', 'AC', 'Smart Board'], currentStatus: 'Available', nextSlot: '10:00 AM – 11:00 AM', score: 98, reason: 'Fully equipped, available now, in your department' },
    { id: 'cr2', name: 'LH-201 (ECE Block)',    capacity: 60, equipment: ['Projector', 'AC'],                currentStatus: 'Available', nextSlot: '10:00 AM – 12:00 PM', score: 90, reason: 'Large capacity, AC available' },
    { id: 'cr3', name: 'SR-301 (S&H Block)',    capacity: 30, equipment: ['Projector', 'Whiteboard'],        currentStatus: 'Available', nextSlot: '11:00 AM – 12:00 PM', score: 82, reason: 'Seminar room — ideal for presentations' },
    { id: 'cr4', name: 'LH-102 (Mech Block)',   capacity: 50, equipment: ['Projector', 'AC', 'Lab Setup'],   currentStatus: 'Occupied',  nextSlot: '2:00 PM – 3:00 PM',   score: 75, reason: 'Available after 2 PM — has lab equipment' },
  ],
};
