// Indonesian National Public Holidays (Hari Libur Nasional & Cuti Bersama)
// Accurate dataset covering 2024, 2025, 2026, and 2027 based on official SKB 3 Menteri

const HOLIDAYS_BY_DATE = {
  // --- 2024 ---
  '2024-01-01': { name: 'Tahun Baru 2024 Masehi' },
  '2024-02-08': { name: 'Isra Mi\'raj Nabi Muhammad SAW' },
  '2024-02-09': { name: 'Cuti Bersama Tahun Baru Imlek', isCutiBersama: true },
  '2024-02-10': { name: 'Tahun Baru Imlek 2575 Kongzili' },
  '2024-03-11': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1946)' },
  '2024-03-12': { name: 'Cuti Bersama Nyepi', isCutiBersama: true },
  '2024-03-29': { name: 'Wafat Yesus Kristus (Jumat Agung)' },
  '2024-03-31': { name: 'Hari Paskah' },
  '2024-04-08': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2024-04-09': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2024-04-10': { name: 'Hari Raya Idul Fitri 1445 H' },
  '2024-04-11': { name: 'Hari Raya Idul Fitri 1445 H' },
  '2024-04-12': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2024-04-15': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2024-05-01': { name: 'Hari Buruh Internasional' },
  '2024-05-09': { name: 'Kenaikan Yesus Kristus' },
  '2024-05-10': { name: 'Cuti Bersama Kenaikan Yesus Kristus', isCutiBersama: true },
  '2024-05-23': { name: 'Hari Raya Waisak 2568 BE' },
  '2024-05-24': { name: 'Cuti Bersama Hari Raya Waisak', isCutiBersama: true },
  '2024-06-01': { name: 'Hari Lahir Pancasila' },
  '2024-06-17': { name: 'Hari Raya Idul Adha 1445 H' },
  '2024-06-18': { name: 'Cuti Bersama Idul Adha', isCutiBersama: true },
  '2024-07-07': { name: 'Tahun Baru Islam 1446 H' },
  '2024-08-17': { name: 'Hari Kemerdekaan RI (HUT RI ke-79)' },
  '2024-09-16': { name: 'Maulid Nabi Muhammad SAW' },
  '2024-12-25': { name: 'Hari Raya Natal' },
  '2024-12-26': { name: 'Cuti Bersama Hari Raya Natal', isCutiBersama: true },

  // --- 2025 ---
  '2025-01-01': { name: 'Tahun Baru 2025 Masehi' },
  '2025-01-27': { name: 'Isra Mi\'raj Nabi Muhammad SAW' },
  '2025-01-28': { name: 'Cuti Bersama Tahun Baru Imlek', isCutiBersama: true },
  '2025-01-29': { name: 'Tahun Baru Imlek 2576 Kongzili' },
  '2025-03-28': { name: 'Cuti Bersama Hari Suci Nyepi', isCutiBersama: true },
  '2025-03-29': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1947)' },
  '2025-03-31': { name: 'Hari Raya Idul Fitri 1446 H' },
  '2025-04-01': { name: 'Hari Raya Idul Fitri 1446 H' },
  '2025-04-02': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2025-04-03': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2025-04-04': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2025-04-07': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2025-04-18': { name: 'Wafat Yesus Kristus (Jumat Agung)' },
  '2025-04-20': { name: 'Hari Paskah' },
  '2025-05-01': { name: 'Hari Buruh Internasional' },
  '2025-05-12': { name: 'Hari Raya Waisak 2569 BE' },
  '2025-05-13': { name: 'Cuti Bersama Hari Raya Waisak', isCutiBersama: true },
  '2025-05-29': { name: 'Kenaikan Yesus Kristus' },
  '2025-05-30': { name: 'Cuti Bersama Kenaikan Yesus Kristus', isCutiBersama: true },
  '2025-06-01': { name: 'Hari Lahir Pancasila' },
  '2025-06-06': { name: 'Hari Raya Idul Adha 1446 H' },
  '2025-06-09': { name: 'Cuti Bersama Idul Adha', isCutiBersama: true },
  '2025-06-27': { name: '1 Muharram / Tahun Baru Islam 1447 H' },
  '2025-08-17': { name: 'Hari Kemerdekaan RI (HUT RI ke-80)' },
  '2025-09-05': { name: 'Maulid Nabi Muhammad SAW' },
  '2025-12-25': { name: 'Hari Raya Natal' },
  '2025-12-26': { name: 'Cuti Bersama Hari Raya Natal', isCutiBersama: true },

  // --- 2026 ---
  '2026-01-01': { name: 'Tahun Baru 2026 Masehi' },
  '2026-01-16': { name: 'Isra Mi\'raj Nabi Muhammad SAW' },
  '2026-02-16': { name: 'Cuti Bersama Tahun Baru Imlek', isCutiBersama: true },
  '2026-02-17': { name: 'Tahun Baru Imlek 2577 Kongzili' },
  '2026-03-19': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
  '2026-03-20': { name: 'Hari Raya Idul Fitri 1447 H' },
  '2026-03-21': { name: 'Hari Raya Idul Fitri 1447 H' },
  '2026-03-23': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2026-03-24': { name: 'Cuti Bersama Idul Fitri', isCutiBersama: true },
  '2026-04-03': { name: 'Wafat Yesus Kristus (Jumat Agung)' },
  '2026-04-05': { name: 'Hari Paskah' },
  '2026-05-01': { name: 'Hari Buruh Internasional' },
  '2026-05-14': { name: 'Kenaikan Yesus Kristus' },
  '2026-05-27': { name: 'Hari Raya Idul Adha 1447 H' },
  '2026-05-31': { name: 'Hari Raya Waisak 2570 BE' },
  '2026-06-01': { name: 'Hari Lahir Pancasila' },
  '2026-06-16': { name: '1 Muharram / Tahun Baru Islam 1448 H' },
  '2026-08-17': { name: 'Hari Kemerdekaan RI (HUT RI ke-81)' },
  '2026-08-25': { name: 'Maulid Nabi Muhammad SAW' },
  '2026-12-25': { name: 'Hari Raya Natal' },
  '2026-12-26': { name: 'Cuti Bersama Hari Raya Natal', isCutiBersama: true },

  // --- 2027 ---
  '2027-01-01': { name: 'Tahun Baru 2027 Masehi' },
  '2027-01-06': { name: 'Isra Mi\'raj Nabi Muhammad SAW' },
  '2027-02-06': { name: 'Tahun Baru Imlek 2578 Kongzili' },
  '2027-03-09': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1949)' },
  '2027-03-10': { name: 'Hari Raya Idul Fitri 1448 H' },
  '2027-03-11': { name: 'Hari Raya Idul Fitri 1448 H' },
  '2027-03-26': { name: 'Wafat Yesus Kristus' },
  '2027-03-28': { name: 'Hari Paskah' },
  '2027-05-01': { name: 'Hari Buruh Internasional' },
  '2027-05-06': { name: 'Kenaikan Yesus Kristus' },
  '2027-05-16': { name: 'Hari Raya Idul Adha 1448 H' },
  '2027-05-20': { name: 'Hari Raya Waisak 2571 BE' },
  '2027-06-01': { name: 'Hari Lahir Pancasila' },
  '2027-06-06': { name: 'Tahun Baru Islam 1449 H' },
  '2027-08-15': { name: 'Maulid Nabi Muhammad SAW' },
  '2027-08-17': { name: 'Hari Kemerdekaan RI (HUT RI ke-82)' },
  '2027-12-25': { name: 'Hari Raya Natal' },
};

/**
 * Check if a given date string ('YYYY-MM-DD') is an Indonesian national holiday or cuti bersama
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {{ name: string, isHoliday: boolean, isCutiBersama: boolean } | null}
 */
export const getIndonesianHoliday = (dateStr) => {
  if (!dateStr) return null;
  const clean = dateStr.substring(0, 10);
  const found = HOLIDAYS_BY_DATE[clean];
  if (found) {
    return {
      name: found.name,
      isHoliday: true,
      isCutiBersama: Boolean(found.isCutiBersama),
    };
  }

  // Check generic fixed annual holidays for any year beyond the hardcoded map
  const monthDay = clean.substring(5);
  switch (monthDay) {
    case '01-01':
      return { name: 'Tahun Baru Masehi', isHoliday: true, isCutiBersama: false };
    case '05-01':
      return { name: 'Hari Buruh Internasional', isHoliday: true, isCutiBersama: false };
    case '06-01':
      return { name: 'Hari Lahir Pancasila', isHoliday: true, isCutiBersama: false };
    case '08-17':
      return { name: 'Hari Kemerdekaan Republik Indonesia', isHoliday: true, isCutiBersama: false };
    case '12-25':
      return { name: 'Hari Raya Natal', isHoliday: true, isCutiBersama: false };
    default:
      return null;
  }
};

/**
 * Checks if a Date object is a weekend (Saturday or Sunday)
 * @param {Date} date
 * @returns {boolean}
 */
export const isWeekend = (date) => {
  if (!(date instanceof Date)) return false;
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

/**
 * Checks if a Date object is Sunday (day 0)
 * @param {Date} date
 * @returns {boolean}
 */
export const isSunday = (date) => {
  return date instanceof Date && date.getDay() === 0;
};

/**
 * Retrieves all Indonesian holidays and cuti bersama for a specific year and month (0-indexed)
 * @param {number} year
 * @param {number} month (0 - 11)
 * @returns {Array<{ dateStr: string, day: number, name: string, isCutiBersama: boolean }>}
 */
export const getHolidaysForMonth = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const h = getIndonesianHoliday(dStr);
    if (h) {
      holidays.push({
        dateStr: dStr,
        day: d,
        ...h,
      });
    }
  }
  return holidays;
};
