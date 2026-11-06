// Stubs for the runtime bits exposed by `assetlink-plugin-api`. They mirror just
// enough of the real API for the unit tests of the shared logic.

let _counter = 0;

export function uuidv4() {
  _counter += 1;
  return `uuid-${_counter}`;
}

export function parseJSONDate(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function formatRFC3339(date) {
  return date.toISOString();
}
