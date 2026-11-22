import { describe, it, expect } from 'vitest';
import { applyGrade, isDue, BOX_INTERVALS_DAYS, MAX_BOX, AGAIN_DELAY_MS } from './srs';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Leitner scheduler', () => {
  it('again resets to box 0 with a short delay', () => {
    const result = applyGrade({ box: 3, studies: 5, correctStudies: 4 }, 'again', NOW);
    expect(result.box).toBe(0);
    expect(result.studies).toBe(6);
    expect(result.correctStudies).toBe(4); // not counted as correct
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + AGAIN_DELAY_MS);
  });

  it('hard keeps the box and schedules half the interval (min 1h)', () => {
    const result = applyGrade({ box: 4, studies: 1, correctStudies: 1 }, 'hard', NOW);
    expect(result.box).toBe(4);
    const interval = BOX_INTERVALS_DAYS[4] * DAY_MS;
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + interval / 2);
    expect(result.correctStudies).toBe(1);
  });

  it('good advances one box', () => {
    const result = applyGrade({ box: 1, studies: 2, correctStudies: 1 }, 'good', NOW);
    expect(result.box).toBe(2);
    expect(result.studies).toBe(3);
    expect(result.correctStudies).toBe(2);
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + BOX_INTERVALS_DAYS[2] * DAY_MS);
  });

  it('easy advances two boxes', () => {
    const result = applyGrade({ box: 0, studies: 0, correctStudies: 0 }, 'easy', NOW);
    expect(result.box).toBe(2);
    expect(result.correctStudies).toBe(1);
  });

  it('never exceeds the maximum box', () => {
    const result = applyGrade({ box: MAX_BOX, studies: 9, correctStudies: 9 }, 'easy', NOW);
    expect(result.box).toBe(MAX_BOX);
  });

  it('never produces a negative box', () => {
    const result = applyGrade({ box: -2, studies: 0, correctStudies: 0 }, 'good', NOW);
    expect(result.box).toBeGreaterThanOrEqual(0);
  });

  it('isDue compares against now', () => {
    expect(isDue(new Date(NOW.getTime() - 1), NOW)).toBe(true);
    expect(isDue(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });
});
