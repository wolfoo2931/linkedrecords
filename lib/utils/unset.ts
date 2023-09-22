export default function unset(obj, path) {
  const keys = path.split('.');
  let currentObj = obj;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    // eslint-disable-next-line no-prototype-builtins
    if (!currentObj.hasOwnProperty(key) || typeof currentObj[key] !== 'object') {
      // If the key doesn't exist or isn't an object, stop here.
      return;
    }
    currentObj = currentObj[key];
  }

  const lastKey = keys[keys.length - 1];
  // eslint-disable-next-line no-prototype-builtins
  if (currentObj.hasOwnProperty(lastKey)) {
    delete currentObj[lastKey];
  }
}
