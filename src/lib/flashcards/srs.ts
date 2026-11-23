import type { StudyGrade } from '@/types';

/**
 * Lightweight Leitner spaced-repetition scheduler (pure functions).
 *
 * Boxes 0–5 map to review intervals in days. Grades:
 *  - again: back to box 0, due in 10 minutes
 *  - hard:  stay in the current box, due in half the current interval
 *  - good:  advance one box
 *  - easy:  advance two boxes
 */

export const BOX_INTERVALS_DAYS = [0, 1, 2, 4, 7, 14, 30] as const;
export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;
export const AGAIN_DELAY_MS = 10 * 60 * 1000;

export interface CardScheduleState {
  box: number;
  studies: number;
  correctStudies: number;
}

export interface ScheduleResult extends CardScheduleState {
  dueAt: Date;
}

function intervalMs(box: number): number {
  const days = BOX_INTERVALS_DAYS[Math.min(Math.max(box, 0), MAX_BOX)];
  return days * 24 * 60 * 60 * 1000;
}

export function applyGrade(state: CardScheduleState, grade: StudyGrade, now = new Date()): ScheduleResult {
  const { box, studies, correctStudies } = state;
  const safeBox = Math.min(Math.max(box, 0), MAX_BOX);
  let nextBox = safeBox;
  let dueAt: Date;

  switch (grade) {
    case 'again':
      nextBox = 0;
      dueAt = new Date(now.getTime() + AGAIN_DELAY_MS);
      break;
    case 'hard':
      nextBox = safeBox;
      dueAt = new Date(now.getTime() + Math.max(intervalMs(safeBox) / 2, 60 * 60 * 1000));
      break;
    case 'good':
      nextBox = Math.min(safeBox + 1, MAX_BOX);
      dueAt = new Date(now.getTime() + intervalMs(nextBox));
      break;
    case 'easy':
      nextBox = Math.min(safeBox + 2, MAX_BOX);
      dueAt = new Date(now.getTime() + intervalMs(nextBox));
      break;
  }

  const isCorrect = grade === 'good' || grade === 'easy';
  return {
    box: nextBox,
    studies: studies + 1,
    correctStudies: correctStudies + (isCorrect ? 1 : 0),
    dueAt,
  };
}

export function isDue(dueAt: Date, now = new Date()): boolean {
  return dueAt.getTime() <= now.getTime();
}
