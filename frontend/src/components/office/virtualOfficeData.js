// virtualOfficeData.js
// SEIN PE Virtual Office HQ Layout matching exact architectural floorplan
// 30 Engineers across 3 divisions (PE Production, PE Mecha, PE Solution) with LEADER desks

export const TEAMS = {
  MANAGEMENT: 'PE Management',
  PRODUCTION: 'PE Production',
  MECHA: 'PE Mecha',
  SOLUTION: 'PE Solution',
};

export const ZONES = {
  PINTU_MASUK: 'Pintu Masuk (Exit/Clock-out)',
  MEETING_1: 'Meeting 1',
  MEETING_2: 'Meeting 2',
  MEETING_3: 'Meeting 3',
  JIG_DEVELOPMENT: 'JIG Development',
  UNITBOX_STORAGE: 'Unitbox Storage',
  SAMPLE_STORAGE: 'Sample Storage',
  STAIRS: 'Area Tangga',
  LAB_ANALISA: 'Lab Analisa',
  PANTRY: 'Pantry (Coffee & Refreshment)',
  TOILET_PRIA: 'Toilet Pria',
  PE_PRODUCTION: 'PE Production Area',
  PE_PRODUCTION_MANAGER: 'PE Production Manager',
  PE_MECHA: 'PE Mecha Area',
  PE_MECHA_MANAGER: 'PE Mecha Manager',
  PE_SOLUTION: 'PE Solution Area',
  PE_SOLUTION_MANAGER: 'PE Solution Manager',
  PE_MANAGEMENT: 'Executive Management Office',
  PE_DISPATCHER: 'Meja Dispatcher (Expat Korea)',
  PE_GROUP_LEADER: 'Meja Group Leader (Group Manager)',
  GAMING_ROOM: 'Gaming Room',
  LAB_SOFTWARE: 'Lab Software',
  TOILET_WANITA: 'Toilet Wanita',
};

// ponytail: Empty default - office populates purely from registered users in DB
export const INITIAL_ENGINEERS = [];

// Helper: Convert time string "HH:MM" to minutes from 00:00
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Helper: Convert minutes from 00:00 to "HH:MM"
export const minutesToTime = (mins) => {
  const norm = ((Math.floor(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Schedule Phases according to exact user specifications
export const SCHEDULE_PHASES = [
  {
    id: 'OFF_NIGHT',
    name: 'Kantor Tutup (Malam)',
    start: '00:00',
    end: '07:00',
    type: 'off',
    color: '#475569',
    description: 'Luar jam operasional. Kantor hening, lampu malam.',
  },
  {
    id: 'WORK_1',
    name: 'Jam Mulai Kerja (Sesi 1)',
    start: '07:00',
    end: '09:30',
    type: 'work',
    color: '#10b981',
    description: '30 Engineer aktif di workstation (Production, Mecha, Solution) dan meja Manager.',
  },
  {
    id: 'BREAK_1',
    name: 'Coffee Break Pagi',
    start: '09:30',
    end: '09:40',
    type: 'break',
    color: '#f59e0b',
    description: 'Istirahat 10 menit. Seduh espresso di Pantry, santai di Gaming Room, atau rehat di meja.',
  },
  {
    id: 'WORK_2',
    name: 'Lanjut Kerja (Sesi 2)',
    start: '09:40',
    end: '11:40',
    type: 'work',
    color: '#10b981',
    description: 'Kembali bekerja di meja workstation serta aktivitas di Lab Software, Lab Analisa, & Storage.',
  },
  {
    id: 'LUNCH',
    name: 'Jam Istirahat Siang',
    start: '11:40',
    end: '12:30',
    type: 'lunch',
    color: '#06b6d4',
    description: 'Istirahat makan siang (50 menit) di Pantry, Gaming Room lounge & area santai.',
  },
  {
    id: 'WORK_3',
    name: 'Lanjut Kerja (Sesi 3)',
    start: '12:30',
    end: '14:30',
    type: 'work',
    color: '#10b981',
    description: 'Sesi kerja siang intensif, pengujian software, dan validasi sample.',
  },
  {
    id: 'BREAK_2',
    name: 'Coffee Break Sore',
    start: '14:30',
    end: '14:40',
    type: 'break',
    color: '#f59e0b',
    description: 'Coffee break sore 10 menit. Rehat kopi di Pantry & main arcade di Gaming Room.',
  },
  {
    id: 'WORK_4',
    name: 'Lanjut Kerja (Wrap-up Sesi 4)',
    start: '14:40',
    end: '16:10',
    type: 'work',
    color: '#10b981',
    description: 'Final sprint harian, submit laporan daily, dan koordinasi tim.',
  },
  {
    id: 'PULANG',
    name: 'Jam Pulang (Clock Out)',
    start: '16:10',
    end: '23:59',
    type: 'off',
    color: '#6366f1',
    description: 'Jam pulang kantor. Personil clock out di Pintu Masuk.',
  },
];

export const getActivePhase = (mins) => {
  for (const phase of SCHEDULE_PHASES) {
    const s = timeToMinutes(phase.start);
    const e = timeToMinutes(phase.end);
    if (mins >= s && mins < e) {
      return phase;
    }
  }
  return SCHEDULE_PHASES[0];
};

// Coordinate mapping matching the floor plan layout exactly:
// Top row: Meeting 1, 2, 3, Unitbox Storage, Sample Storage, [Tangga], Lab Analisa, Pantry, Toilet Pria
// Middle: Pintu Masuk (far left) + Central Corridor
// Bottom row: PE Production (+Manager), PE Mecha (+Manager), PE Solution (+Manager), [gap], Gaming Room, Lab Software, Toilet Wanita
export const getCoordinatesForZone = (zoneKey, slotIndex = 0) => {
  switch (zoneKey) {
    // --- WORKSTATIONS (PE PRODUCTION) ---
    case ZONES.PE_PRODUCTION: {
      // 9 Member desks in a 3x3 block (x: 7..18, y: 53..70)
      const col = slotIndex % 3;
      const row = Math.floor(slotIndex / 3);
      return { x: 7.5 + col * 5, y: 53 + row * 8, label: `P-${slotIndex + 1}` };
    }
    case ZONES.PE_PRODUCTION_MANAGER: {
      // Dedicated MANAGER desk at bottom
      return { x: 12.5, y: 83.5, label: `P-MANAGER` };
    }

    // --- WORKSTATIONS (PE MECHA) ---
    case ZONES.PE_MECHA: {
      // 9 Member desks in a 3x3 block (x: 25..36, y: 53..70)
      const col = slotIndex % 3;
      const row = Math.floor(slotIndex / 3);
      return { x: 25.5 + col * 5, y: 53 + row * 8, label: `M-${slotIndex + 1}` };
    }
    case ZONES.PE_MECHA_MANAGER: {
      // Dedicated MANAGER desk at bottom
      return { x: 30.5, y: 83.5, label: `M-MANAGER` };
    }

    // --- WORKSTATIONS (PE SOLUTION) ---
    case ZONES.PE_SOLUTION: {
      // 9 Member desks in a 3x3 block (x: 43..54, y: 53..70)
      const col = slotIndex % 3;
      const row = Math.floor(slotIndex / 3);
      return { x: 43.5 + col * 5, y: 53 + row * 8, label: `S-${slotIndex + 1}` };
    }
    case ZONES.PE_SOLUTION_MANAGER: {
      // Dedicated MANAGER desk at bottom
      return { x: 48.5, y: 83.5, label: `S-MANAGER` };
    }

    // --- EXECUTIVE MANAGEMENT (KOREAN DISPATCHER & GROUP LEADER) ---
    case ZONES.PE_DISPATCHER: {
      return { x: 63.5, y: 60, label: `🇰🇷 DISPATCHER` };
    }
    case ZONES.PE_GROUP_LEADER: {
      return { x: 63.5, y: 80, label: `👔 GROUP-LEADER` };
    }
    case ZONES.PE_MANAGEMENT: {
      return { x: 63.5, y: 70, label: `EXEC-OFFICE` };
    }

    // --- RELAXATION & GAMING ROOM ---
    case ZONES.GAMING_ROOM: {
      // x: 71..80, y: 53..86 (holds up to 15 people)
      const col = slotIndex % 3;
      const row = Math.floor(slotIndex / 3);
      return { x: 72.5 + col * 2.8, y: 56 + row * 6.5, label: `GR-${slotIndex + 1}` };
    }

    // --- LABS ---
    case ZONES.LAB_SOFTWARE: {
      // x: 82..88, y: 54..86
      const col = slotIndex % 2;
      const row = Math.floor(slotIndex / 2);
      return { x: 83.5 + col * 3.2, y: 56 + row * 8, label: `SW-${slotIndex + 1}` };
    }
    case ZONES.LAB_ANALISA: {
      // x: 67..76, y: 16..32
      const col = slotIndex % 2;
      const row = Math.floor(slotIndex / 2);
      return { x: 68.5 + col * 4.5, y: 18 + row * 7, label: `AL-${slotIndex + 1}` };
    }

    // --- PANTRY (Coffee, Espresso, Water & Refreshment) ---
    case ZONES.PANTRY: {
      // x: 79..86, y: 16..32 (counter bar, espresso & water dispenser slots)
      const col = slotIndex % 2;
      const row = Math.floor(slotIndex / 2);
      return { x: 80.5 + col * 4.2, y: 18 + row * 5.2, label: `PANTRY-${slotIndex + 1}` };
    }

    // --- MEETING ROOMS & STORAGES ---
    case ZONES.MEETING_1:
      return { x: 9, y: 24, label: 'MTG-1' };
    case ZONES.MEETING_2:
      return { x: 21, y: 24, label: 'MTG-2' };
    case ZONES.MEETING_3:
      return { x: 33, y: 30.5, label: 'MTG-3' };
    case ZONES.UNITBOX_STORAGE:
      return { x: 44.5, y: 30.5, label: 'UB-STOR' };
    case ZONES.JIG_DEVELOPMENT: {
      const col = slotIndex % 3;
      const row = Math.floor(slotIndex / 3);
      return { x: 33 + col * 5.5, y: 16.5 + row * 3, label: `JIG-${slotIndex + 1}` };
    }
    case ZONES.SAMPLE_STORAGE:
      return { x: 55, y: 24, label: 'SMP-STOR' };

    case ZONES.STAIRS:
      return { x: 62.5, y: 24, label: 'TANGGA' };

    case ZONES.TOILET_PRIA: {
      const col = slotIndex % 2;
      return { x: 91.5 + col * 2.2, y: 24, label: 'WC-PRIA' };
    }
    case ZONES.TOILET_WANITA: {
      const col = slotIndex % 2;
      return { x: 92 + col * 2.2, y: 70, label: 'WC-WANITA' };
    }

    // --- ENTRANCE / CLOCK-OUT GATE ---
    case ZONES.PINTU_MASUK: {
      const col = slotIndex % 5;
      const row = Math.floor(slotIndex / 5);
      return { x: 5 + col * 1.4, y: 41 + row * 1.5, label: 'MASUK' };
    }

    default:
      return { x: 50, y: 50, label: 'Center' };
  }
};

// Female Engineer IDs for accurate Restroom / Toilet routing
export const FEMALE_ENGINEER_IDS = [2, 5, 8, 11, 13, 15, 18, 21, 24, 27];

// Target positioning logic for 30 engineers based on active phase and current minute
// With human-like organic randomness: hydration to pantry (kopi/teh/air putih), toilet breaks, lab visits, and staying at desks
export const getEngineerTargetPosition = (engineer, phase, index, currentTimeMins = 0) => {
  // Determine home desk zone
  // ponytail: calculate homeSlot dynamically so any number of engineers sit at desks cleanly
  let homeZone = ZONES.PE_PRODUCTION;
  let homeSlot = (engineer.slotIndex !== undefined ? engineer.slotIndex : (engineer.id ? (engineer.id - 1) : index)) % 9;
  if (engineer.id === 31 || engineer.role?.includes('Dispatcher') || engineer.employee_id === 'PE_EXP01') {
    homeZone = ZONES.PE_DISPATCHER;
  } else if (engineer.id === 32 || engineer.role?.includes('Group Leader') || engineer.employee_id === 'PE_GL01') {
    homeZone = ZONES.PE_GROUP_LEADER;
  } else if (engineer.team === TEAMS.MECHA) {
    homeZone = ZONES.PE_MECHA;
  } else if (engineer.team === TEAMS.SOLUTION) {
    homeZone = ZONES.PE_SOLUTION;
  }

  // Check if engineer is manager or leader
  const isExecutive = homeZone === ZONES.PE_DISPATCHER || homeZone === ZONES.PE_GROUP_LEADER;
  const isManager = isExecutive || engineer.isLeader || engineer.id % 10 === 0;
  const isFemale = FEMALE_ENGINEER_IDS.includes(engineer.id);

  switch (phase.type) {
    case 'work': {
      // 0. Executive Leaders at their dedicated desks
      if (homeZone === ZONES.PE_DISPATCHER) {
        return {
          zone: ZONES.PE_DISPATCHER,
          coords: getCoordinatesForZone(ZONES.PE_DISPATCHER),
          activity: engineer.currentTask || 'Supervisi koordinasi teknis PE dengan HQ Korea',
        };
      }
      if (homeZone === ZONES.PE_GROUP_LEADER) {
        return {
          zone: ZONES.PE_GROUP_LEADER,
          coords: getCoordinatesForZone(ZONES.PE_GROUP_LEADER),
          activity: engineer.currentTask || 'Strategic management & review 3 divisi PE',
        };
      }
      // 1. Specialized lab or storage visits during work sessions
      if ((phase.id === 'WORK_2' || phase.id === 'WORK_3') && [22, 23].includes(engineer.id)) {
        return {
          zone: ZONES.LAB_SOFTWARE,
          coords: getCoordinatesForZone(ZONES.LAB_SOFTWARE, engineer.id - 22),
          activity: 'Pengujian Flashing & Debugging di Lab Software',
        };
      }
      if ((phase.id === 'WORK_2' || phase.id === 'WORK_3') && [14, 15].includes(engineer.id)) {
        return {
          zone: ZONES.LAB_ANALISA,
          coords: getCoordinatesForZone(ZONES.LAB_ANALISA, engineer.id - 14),
          activity: 'Failure Analysis & Inspeksi Fisik di Lab Analisa',
        };
      }
      if (phase.id === 'WORK_2' && engineer.id === 8) {
        return {
          zone: ZONES.SAMPLE_STORAGE,
          coords: getCoordinatesForZone(ZONES.SAMPLE_STORAGE),
          activity: 'Pengecekan stok unit sample di Sample Storage',
        };
      }
      if (phase.id === 'WORK_3' && engineer.id === 6) {
        return {
          zone: ZONES.UNITBOX_STORAGE,
          coords: getCoordinatesForZone(ZONES.UNITBOX_STORAGE),
          activity: 'Audit box packaging di Unitbox Storage',
        };
      }

      // 2. Realistic, Organic Hydration (Kopi, Teh, Air Putih) & Restroom (Toilet) breaks
      // Engineers naturally take short ~3-4 minute breaks staggered throughout the hour
      const cycle = (Math.floor(currentTimeMins) + engineer.id * 17) % 60;

      if (cycle < 4) {
        const variant = (engineer.id + Math.floor(currentTimeMins / 30)) % 4;

        if (variant === 0) {
          // Bikin Kopi Espresso di Pantry
          return {
            zone: ZONES.PANTRY,
            coords: getCoordinatesForZone(ZONES.PANTRY, 0),
            activity: 'Seduh kopi espresso di Pantry untuk booster fokus ☕',
          };
        } else if (variant === 1) {
          // Bikin Teh Hangat di Pantry
          return {
            zone: ZONES.PANTRY,
            coords: getCoordinatesForZone(ZONES.PANTRY, 2),
            activity: 'Seduh teh hangat (Earl Grey / Jasmine) di Pantry 🍵',
          };
        } else if (variant === 2) {
          // Ambil Air Putih Dingin di Dispenser Pantry
          return {
            zone: ZONES.PANTRY,
            coords: getCoordinatesForZone(ZONES.PANTRY, 1),
            activity: 'Refill tumbler air putih dingin di Dispenser Pantry 💧',
          };
        } else {
          // Toilet Break (Pria / Wanita)
          const toiletZone = isFemale ? ZONES.TOILET_WANITA : ZONES.TOILET_PRIA;
          return {
            zone: toiletZone,
            coords: getCoordinatesForZone(toiletZone, engineer.id % 2),
            activity: isFemale ? 'Toilet break & cuci tangan di Toilet Wanita 🚻' : 'Toilet break & cuci tangan di Toilet Pria 🚻',
          };
        }
      }

      // 3. Manager sits at dedicated MANAGER desk
      if (isManager) {
        let managerZone = ZONES.PE_PRODUCTION_MANAGER;
        if (engineer.team === TEAMS.MECHA) managerZone = ZONES.PE_MECHA_MANAGER;
        if (engineer.team === TEAMS.SOLUTION) managerZone = ZONES.PE_SOLUTION_MANAGER;
        return {
          zone: managerZone,
          coords: getCoordinatesForZone(managerZone),
          activity: engineer.currentTask || 'Koordinasi tim & monitoring performa harian',
        };
      }

      // 4. Member sits at member desk
      return {
        zone: homeZone,
        coords: getCoordinatesForZone(homeZone, homeSlot),
        activity: engineer.currentTask || 'Bekerja aktif di meja workstation',
      };
    }

    case 'break': {
      // 09:30 or 14:30 (Coffee Break 10 mins)
      // Human behavior: NOT everyone leaves their desk!
      // ~25% stay at their desk (focusing, watching video, or sipping drink at desk)
      const stayAtDeskIds = [2, 4, 12, 17, 21, 26, 28];
      if (stayAtDeskIds.includes(engineer.id)) {
        let managerZone = isManager
          ? (engineer.team === TEAMS.MECHA ? ZONES.PE_MECHA_MANAGER : (engineer.team === TEAMS.SOLUTION ? ZONES.PE_SOLUTION_MANAGER : ZONES.PE_PRODUCTION_MANAGER))
          : homeZone;
        return {
          zone: isManager ? managerZone : homeZone,
          coords: isManager ? getCoordinatesForZone(managerZone) : getCoordinatesForZone(homeZone, homeSlot),
          activity: 'Stay di meja: Nanggung menyelesaikan tugas & minum air',
        };
      }

      // ~10% go to Toilet
      if (engineer.id === 7 || engineer.id === 13) {
        return {
          zone: ZONES.TOILET_PRIA,
          coords: getCoordinatesForZone(ZONES.TOILET_PRIA),
          activity: 'Ke Toilet Pria & cuci tangan 🚻',
        };
      }
      if (engineer.id === 5 || engineer.id === 18) {
        return {
          zone: ZONES.TOILET_WANITA,
          coords: getCoordinatesForZone(ZONES.TOILET_WANITA),
          activity: 'Ke Toilet Wanita & freshen up 🚻',
        };
      }

      // ~35% go to PANTRY (Seduh kopi espresso, bikin teh, ambil air & snack)
      const pantryBreakIds = [1, 6, 8, 10, 15, 19, 23, 29, 30];
      if (pantryBreakIds.includes(engineer.id)) {
        const pSlot = pantryBreakIds.indexOf(engineer.id);
        const actionType = pSlot % 3;
        let pActivity = 'Seduh kopi espresso & ngobrol santai di Pantry ☕';
        if (actionType === 1) pActivity = 'Seduh teh manis hangat & ambil snack di Pantry 🍵';
        if (actionType === 2) pActivity = 'Refill tumbler air mineral dingin di Pantry 💧';
        return {
          zone: ZONES.PANTRY,
          coords: getCoordinatesForZone(ZONES.PANTRY, pSlot),
          activity: pActivity,
        };
      }

      // ~30% go to Gaming Room (Arcade, foosball, relax)
      const slot = (engineer.id - 1) % 15;
      return {
        zone: ZONES.GAMING_ROOM,
        coords: getCoordinatesForZone(ZONES.GAMING_ROOM, slot),
        activity: slot % 2 === 0 ? 'Main arcade game & relaksasi di Gaming Room' : 'Santai di sofa Gaming Room Lounge',
      };
    }

    case 'lunch': {
      // 11:40 - 12:30 (Lunch break)
      // Human behavior: sebagian besar makan/santai di Gaming Room lounge & Pantry, sebagian stay di meja
      const stayAtDeskLunchIds = [3, 9, 19, 27];
      if (stayAtDeskLunchIds.includes(engineer.id)) {
        return {
          zone: homeZone,
          coords: getCoordinatesForZone(homeZone, homeSlot),
          activity: 'Stay di meja: Membaca dokumentasi sambil makan ringan',
        };
      }

      // Beberapa personil hangatkan bekal / seduh teh / kopi / air di Pantry
      const pantryLunchIds = [1, 8, 14, 20, 24, 28];
      if (pantryLunchIds.includes(engineer.id)) {
        const pSlot = pantryLunchIds.indexOf(engineer.id);
        const lAction = pSlot % 3;
        let lActivity = 'Hangatkan bekal makan siang & seduh teh di Pantry 🍵';
        if (lAction === 1) lActivity = 'Seduh kopi setelah makan siang di Pantry ☕';
        if (lAction === 2) lActivity = 'Ambil air putih dingin di Dispenser Pantry 💧';
        return {
          zone: ZONES.PANTRY,
          coords: getCoordinatesForZone(ZONES.PANTRY, pSlot),
          activity: lActivity,
        };
      }

      const slot = (engineer.id - 1) % 20;
      return {
        zone: ZONES.GAMING_ROOM,
        coords: getCoordinatesForZone(ZONES.GAMING_ROOM, slot),
        activity: 'Makan siang & santai di Gaming Room Lounge',
      };
    }

    case 'off':
    default: {
      // 16:10+ or before 07:00: Pintu Masuk (Exit)
      // Human behavior: Sebagian pulang tepat waktu jam 16:10, 2-3 orang masih lembur/standby di meja
      const overtimeIds = [10, 20, 29];
      if (phase.id === 'PULANG' && overtimeIds.includes(engineer.id)) {
        let managerZone = isManager
          ? (engineer.team === TEAMS.MECHA ? ZONES.PE_MECHA_MANAGER : (engineer.team === TEAMS.SOLUTION ? ZONES.PE_SOLUTION_MANAGER : ZONES.PE_PRODUCTION_MANAGER))
          : homeZone;
        return {
          zone: isManager ? managerZone : homeZone,
          coords: isManager ? getCoordinatesForZone(managerZone) : getCoordinatesForZone(homeZone, homeSlot),
          activity: 'Standby di meja Manager: Review log akhir shift',
        };
      }

      const slot = (engineer.id - 1) % 30;
      return {
        zone: ZONES.PINTU_MASUK,
        coords: getCoordinatesForZone(ZONES.PINTU_MASUK, slot),
        activity: 'Clock out / Jam pulang di Pintu Masuk',
      };
    }
  }
};
