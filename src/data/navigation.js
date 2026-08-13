// ── Smart Navigation & Indoor Navigation Dataset ─────────────────────────────

export const smartNavigationData = {
  destinations: {
    buildings: [
      { id: 'cse',      name: 'CSE Block',          type: 'Building', zone: 'Middle Row', floors: 4, accessible: true,  emergencyExit: 'North Gate CS-1' },
      { id: 'ece',      name: 'ECE Block',          type: 'Building', zone: 'Middle Row', floors: 4, accessible: true,  emergencyExit: 'West Gate EC-1'  },
      { id: 'mecheee',  name: 'Mech & EEE Block',   type: 'Building', zone: 'Middle Row', floors: 3, accessible: true,  emergencyExit: 'South Gate ME-1' },
      { id: 'civilit',  name: 'Civil & IT Block',   type: 'Building', zone: 'Middle Row', floors: 3, accessible: true,  emergencyExit: 'East Gate CI-1'  },
      { id: 'sh',       name: 'S&H Block',          type: 'Building', zone: 'Top Row',    floors: 3, accessible: true,  emergencyExit: 'North Exit SH-1' },
      { id: 'rnd',      name: 'R&D Block',          type: 'Building', zone: 'Top Row',    floors: 2, accessible: true,  emergencyExit: 'West Exit RD-1'  },
      { id: 'cant',     name: 'Canteen',            type: 'Facility', zone: 'Top Row',    floors: 1, accessible: true,  emergencyExit: 'Main Gate CT-1'  },
      { id: 'cad',      name: 'CAD Lab',            type: 'Building', zone: 'Top Row',    floors: 2, accessible: true,  emergencyExit: 'East Exit CAD-1' },
      { id: 'exam',     name: 'Examination Dept',   type: 'Admin',    zone: 'Top Row',    floors: 2, accessible: true,  emergencyExit: 'South Exit EX-1' },
      { id: 'lib',      name: 'Library',            type: 'Facility', zone: 'Bottom Row', floors: 2, accessible: true,  emergencyExit: 'South Exit LB-1' },
      { id: 'aud',      name: 'Auditorium',         type: 'Facility', zone: 'Bottom Row', floors: 2, accessible: true,  emergencyExit: 'Main Exit AD-1'  },
    ],

    classrooms: [
      { id: 'cs101', name: 'LH-101 (CSE)',    building: 'CSE Block',        floor: 1, capacity: 60, equipment: ['Projector', 'AC', 'Smart Board'], accessible: true },
      { id: 'cs102', name: 'LH-102 (CSE)',    building: 'CSE Block',        floor: 1, capacity: 60, equipment: ['Projector', 'AC'],                accessible: true },
      { id: 'cs201', name: 'LH-201 (CSE)',    building: 'CSE Block',        floor: 2, capacity: 60, equipment: ['Projector', 'AC', 'Smart Board'], accessible: true },
      { id: 'ec101', name: 'LH-101 (ECE)',    building: 'ECE Block',        floor: 1, capacity: 60, equipment: ['Projector', 'AC'],                accessible: true },
      { id: 'ec201', name: 'LH-201 (ECE)',    building: 'ECE Block',        floor: 2, capacity: 60, equipment: ['Projector', 'AC'],                accessible: true },
      { id: 'me101', name: 'LH-101 (Mech)',   building: 'Mech & EEE Block', floor: 1, capacity: 50, equipment: ['Projector', 'AC'],                accessible: true },
      { id: 'ci101', name: 'LH-101 (Civil)',  building: 'Civil & IT Block', floor: 1, capacity: 50, equipment: ['Projector', 'AC'],                accessible: true },
      { id: 'sh301', name: 'SR-301 (S&H)',    building: 'S&H Block',        floor: 3, capacity: 30, equipment: ['Projector', 'Whiteboard'],        accessible: true },
    ],

    labs: [
      { id: 'ai-lab',   name: 'AI Research Lab',     building: 'CSE Block',        floor: 2, room: 'CS-201', GPUs: '15x RTX 4090', accessible: true  },
      { id: 'code-lab', name: 'Coding Lab 1',        building: 'CSE Block',        floor: 1, room: 'CS-104', PCs: '40 Workstations',accessible: true },
      { id: 'vlsi-lab', name: 'VLSI Design Lab',     building: 'ECE Block',        floor: 2, room: 'EC-204', Oscilloscopes: '12 Units', accessible: true },
      { id: 'cad-lab',  name: 'CAD Simulation Studio',building: 'CAD Lab Block',   floor: 1, room: 'CAD-101', '3DPrinters': '4 Units', accessible: true },
      { id: 'mech-shop',name: 'Mechanical Workshop', building: 'Mech & EEE Block', floor: 1, room: 'ME-101', Lathes: '8 Units',     accessible: true  },
    ]
  },

  routes: [
    {
      id: 'r-main-cse',
      from: 'Main Gate',
      to: 'CSE Block',
      mode: 'Shortest Path',
      distance: 200,
      timeMins: 3,
      steps: [
        'Enter through Main Gate (Right Edge)',
        'Walk 100m straight on the central paved pathway',
        'Pass Civil & IT Block on your left',
        'Pass Mech & EEE Block',
        'Arrive at CSE Block entrance on your left'
      ],
      accessibleSteps: [
        'Enter through Main Gate ramp',
        'Follow smooth concrete path for 100m',
        'Use CSE Block East Ramp for wheel-chair access'
      ],
      emergencySteps: [
        'EVACUATION ROUTE: Exit CSE Block North Door CS-1',
        'Follow green exit glow strips to Main Pathway',
        'Assemble at Central Assembly Point Alpha (Sports Ground)'
      ]
    },
    {
      id: 'r-cant-lib',
      from: 'Canteen',
      to: 'Library',
      mode: 'Shortest Path',
      distance: 180,
      timeMins: 2.5,
      steps: [
        'Exit Canteen southward onto top row walkway',
        'Turn right and walk past CAD Lab',
        'Cross central corridor down to Bottom Row',
        'Library main entrance is ahead on your left'
      ],
      accessibleSteps: [
        'Exit Canteen wide glass doors',
        'Take shaded covered ramp towards Library',
        'Use Library automatic sliding doors'
      ],
      emergencySteps: [
        'EVACUATION ROUTE: Exit Library South Exit LB-1',
        'Proceed directly to Ground Assembly Area'
      ]
    }
  ]
};

export const indoorNavigationData = {
  buildingsFloorMaps: {
    'CSE Block': [
      {
        floor: 0,
        name: 'Ground Floor',
        rooms: [
          { name: 'Entrance Lobby', type: 'Common', x: 20, y: 80, w: 60, h: 15, status: 'Clear' },
          { name: 'CS-101 (LH-1)',   type: 'Classroom', x: 10, y: 20, w: 35, h: 30, status: 'Occupied' },
          { name: 'CS-102 (LH-2)',   type: 'Classroom', x: 55, y: 20, w: 35, h: 30, status: 'Available' },
          { name: 'Coding Lab 1',    type: 'Lab',       x: 10, y: 55, w: 35, h: 20, status: 'Occupied' },
          { name: 'Elevator A',      type: 'Lift',      x: 88, y: 75, w: 8,  h: 10, status: 'Operational' },
          { name: 'Staircase East',  type: 'Stairs',    x: 2,  y: 75, w: 8,  h: 10, status: 'Clear' },
        ]
      },
      {
        floor: 1,
        name: 'First Floor',
        rooms: [
          { name: 'CS-201 (AI Lab)', type: 'Lab',       x: 10, y: 20, w: 45, h: 35, status: 'Occupied' },
          { name: 'CS-202 (LH-3)',   type: 'Classroom', x: 60, y: 20, w: 30, h: 35, status: 'Available' },
          { name: 'HOD Office',      type: 'Office',    x: 10, y: 60, w: 25, h: 20, status: 'Clear' },
          { name: 'Faculty Cabins',  type: 'Office',    x: 40, y: 60, w: 45, h: 20, status: 'Clear' },
          { name: 'Elevator A',      type: 'Lift',      x: 88, y: 75, w: 8,  h: 10, status: 'Operational' },
          { name: 'Staircase East',  type: 'Stairs',    x: 2,  y: 75, w: 8,  h: 10, status: 'Clear' },
        ]
      }
    ],
    'Library': [
      {
        floor: 0,
        name: 'Ground Floor',
        rooms: [
          { name: 'Issue Desk & Circulation', type: 'Admin',     x: 20, y: 70, w: 60, h: 20, status: 'Clear' },
          { name: 'Reading Hall 1',           type: 'Study',     x: 10, y: 15, w: 40, h: 50, status: 'Occupied' },
          { name: 'Digital Archives',          type: 'Computer',  x: 55, y: 15, w: 35, h: 50, status: 'Available' },
          { name: 'Elevator L1',              type: 'Lift',      x: 88, y: 75, w: 8,  h: 10, status: 'Operational' },
        ]
      },
      {
        floor: 1,
        name: 'First Floor',
        rooms: [
          { name: 'Reading Hall 2',           type: 'Study',     x: 10, y: 15, w: 45, h: 55, status: 'Available' },
          { name: 'Reference & Periodicals',   type: 'Books',     x: 60, y: 15, w: 30, h: 55, status: 'Clear' },
          { name: 'Discussion Room 1',        type: 'Study',     x: 10, y: 72, w: 20, h: 18, status: 'Occupied' },
          { name: 'Elevator L1',              type: 'Lift',      x: 88, y: 75, w: 8,  h: 10, status: 'Operational' },
        ]
      }
    ]
  }
};
