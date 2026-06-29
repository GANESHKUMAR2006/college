const test = require('node:test');
const assert = require('node:assert/strict');
const { formatDate } = require('../utils/scheduler');

test('formatDate converts date strings to YYYY-MM-DD', () => {
  assert.equal(formatDate('2024-07-15T00:00:00.000Z'), '2024-07-15');
});

test('formatDate returns empty string for invalid input', () => {
  assert.equal(formatDate('not-a-date'), '');
});
