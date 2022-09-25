// eslint-disable-next-line import/prefer-default-export
export function waitFor(fn) {
  return new Promise<void>((resolve) => {
    const intervallId = setInterval(async () => {
      const result = await fn();

      if (result) {
        clearInterval(intervallId);
        resolve();
      }
    }, 100);
  });
}
