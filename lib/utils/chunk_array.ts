export default function chunk<T>(array: T[], n: number): T[][] {
  if (!array.length) {
    return [];
  }

  return [array.slice(0, n)].concat(chunk(array.slice(n), n));
}
