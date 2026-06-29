// Shared utility functions for academic batch year format conversion

/**
 * Converts a short-format batch (e.g., "2024-28") to long-format (e.g., "2024-2028").
 * Handles century rollover (e.g., "1998-02" -> "1998-2002").
 */
function formatBatchToLong(batchStr) {
  if (!batchStr) return batchStr;
  const match = batchStr.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const startYear = parseInt(match[1], 10);
    const century = Math.floor(startYear / 100) * 100;
    let endYear = century + parseInt(match[2], 10);
    if (endYear < startYear) {
      endYear += 100;
    }
    return `${startYear}-${endYear}`;
  }
  return batchStr;
}

/**
 * Normalizes any long-format batch (e.g., "2024-2028") to short-format (e.g., "2024-28").
 * Leaves short-format batches (e.g., "2024-28") untouched.
 */
function normalizeBatchToShort(batch) {
  if (!batch) return batch;
  if (/^\d{4}-\d{2}$/.test(batch)) {
    return batch;
  }
  const match = batch.match(/^(\d{4})-\d{2}(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return batch;
}

module.exports = {
  formatBatchToLong,
  normalizeBatchToShort
};
