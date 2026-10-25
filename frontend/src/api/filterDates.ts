// datetime-local inputs contain no timezone. Our labels explicitly mean UTC.
export function toUtcInstant(value: string, fieldName: string): string {
  if (value === '') return '';

  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (parts === null) throw new Error(`${fieldName} must be a valid UTC date and time.`);

  const seconds = parts[2] ?? '00';
  const milliseconds = (parts[3] ?? '').padEnd(3, '0');
  const instant = `${parts[1]}:${seconds}.${milliseconds}Z`;
  const date = new Date(instant);

  // Comparing the result also rejects dates JS would normalize, such as February 30.
  if (value.startsWith('0000') || Number.isNaN(date.getTime()) || date.toISOString() !== instant) {
    throw new Error(`${fieldName} must be a valid UTC date and time.`);
  }
  return date.toISOString();
}

export function getTimeRange(fromInput: string, toInput: string) {
  const from = toUtcInstant(fromInput, 'From');
  const to = toUtcInstant(toInput, 'To');
  if (from !== '' && to !== '' && from > to) {
    throw new Error('From must be at or before To. All times are UTC.');
  }
  return { from, to };
}
