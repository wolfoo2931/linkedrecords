export default function getAllPrefixes(arr: string[]): string[][] {
  const result: string[][] = [];
  const prefix: string[] = [];

  arr.forEach((item) => {
    prefix.push(item);
    result.push([...prefix]);
  });

  return result;
}
