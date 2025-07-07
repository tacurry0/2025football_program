const schedule = require('../jsontest/schedule.json');

describe('schedule.json', () => {
  const requiredKeys = ['club', 'matchweek', 'date', 'day', 'time', 'opponent', 'venue', 'emblem'];

  test('each entry contains required keys', () => {
    expect(Array.isArray(schedule)).toBe(true);
    for (const entry of schedule) {
      requiredKeys.forEach(key => {
        expect(entry).toHaveProperty(key);
      });
    }
  });
});
