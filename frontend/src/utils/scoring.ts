export const checkAnswerClient = (qType: string, correct: any, student: any): boolean => {
  if (correct === undefined || correct === null || student === undefined || student === null) {
    return false;
  }

  if (qType === 'single_choice' || qType === 'true_false') {
    return String(correct).trim().toLowerCase() === String(student).trim().toLowerCase();
  }

  if (qType === 'multiple_choice') {
    if (!Array.isArray(correct) || !Array.isArray(student)) return false;
    const cSorted = [...correct].map(x => String(x).trim().toLowerCase()).sort();
    const sSorted = [...student].map(x => String(x).trim().toLowerCase()).sort();
    return JSON.stringify(cSorted) === JSON.stringify(sSorted);
  }

  if (qType === 'matching' || qType === 'multi_true_false') {
    if (typeof correct !== 'object' || typeof student !== 'object') return false;
    const cKeys = Object.keys(correct);
    for (const k of cKeys) {
      if (student[k] === undefined) return false;
      if (String(correct[k]).trim().toLowerCase() !== String(student[k]).trim().toLowerCase()) return false;
    }
    return true;
  }

  if (qType === 'ordering') {
    if (!Array.isArray(correct) || !Array.isArray(student)) return false;
    const cList = correct.map(x => String(x).trim().toLowerCase());
    const sList = student.map(x => String(x).trim().toLowerCase());
    return JSON.stringify(cList) === JSON.stringify(sList);
  }

  if (qType === 'hotspot') {
    // Normalize correct zones
    let correctZones: any[] = [];
    if (Array.isArray(correct)) {
      correctZones = correct;
    } else if (typeof correct === 'object' && correct.x !== undefined) {
      correctZones = [correct];
    } else {
      return false;
    }

    // Normalize student points
    let studentPoints: any[] = [];
    if (Array.isArray(student)) {
      studentPoints = student;
    } else if (typeof student === 'object' && student.x !== undefined) {
      studentPoints = [student];
    } else {
      return false;
    }

    if (!studentPoints.length || !correctZones.length) return false;

    try {
      const matchedIndices = new Set<number>();
      for (const pt of studentPoints) {
        const sx = parseFloat(pt.x);
        const sy = parseFloat(pt.y);
        let found = false;
        for (let zi = 0; zi < correctZones.length; zi++) {
          if (matchedIndices.has(zi)) continue;
          const zone = correctZones[zi];
          const cx = parseFloat(zone.x);
          const cy = parseFloat(zone.y);
          const cw = parseFloat(zone.w);
          const ch = parseFloat(zone.h);
          if (sx >= cx && sx <= cx + cw && sy >= cy && sy <= cy + ch) {
            matchedIndices.add(zi);
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      return matchedIndices.size === correctZones.length;
    } catch {
      return false;
    }
  }

  if (qType === 'short_answer') {
    if (Array.isArray(correct)) {
      return correct.some(ans => String(ans).trim().toLowerCase() === String(student).trim().toLowerCase());
    }
    return String(correct).trim().toLowerCase() === String(student).trim().toLowerCase();
  }

  return String(correct) === String(student);
};

export const encodeId = (id: number | string): string => {
  const numericId = Number(id);
  if (isNaN(numericId)) return String(id);
  const val = (numericId * 9823 + 12345);
  return 'q' + val.toString(36);
};

export const decodeId = (str: string): number => {
  if (!str || !str.startsWith('q')) {
    const parsed = parseInt(str);
    return isNaN(parsed) ? 0 : parsed;
  }
  const val = parseInt(str.substring(1), 36);
  if (isNaN(val)) return 0;
  return Math.round((val - 12345) / 9823);
};

export const slugify = (text: string): string => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // decompose characters to separate diacritics
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with dash
    .replace(/(^-|-$)+/g, ''); // remove leading/trailing dashes
};
