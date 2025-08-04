function biggestCommonSuffix(str1, str2) {
  let i = str1.length - 1;
  let j = str2.length - 1;

  while (i >= 0 && j >= 0 && str1[i] === str2[j]) {
    i -= 1;
    j -= 1;
  }

  return str1.substring(i + 1);
}

function getCookieSettings(frontendURL: string, backendURL: string) {
  const frontend = new URL(frontendURL);
  const backend = new URL(backendURL);
  const backendHost = backend.host.replace(/:\d*$/, '');
  const frontendHost = frontend.host.replace(/:\d*$/, '');

  let commonHostSuffix = biggestCommonSuffix(
    backendHost,
    frontendHost,
  );

  if (backendHost === 'localhost' && frontendHost === 'localhost') {
    return {
      domain: backendHost,
    };
  }

  if (commonHostSuffix) {
    commonHostSuffix = commonHostSuffix.replace(/^\./, '');
  }

  if (!commonHostSuffix || !commonHostSuffix.match(/\./)) {
    return {
      domain: backendHost,
      sameSite: 'None',
    };
  }

  return {
    domain: commonHostSuffix,
  };
}

export default function getCookieSettingsFromEnv() {
  if (!process.env['FRONTEND_BASE_URL']) {
    throw new Error('FRONTEND_BASE_URL environment variable must be provided');
  }

  if (!process.env['SERVER_BASE_URL']) {
    throw new Error('SERVER_BASE_URL environment variable must be provided');
  }

  return getCookieSettings(process.env['FRONTEND_BASE_URL'], process.env['SERVER_BASE_URL']);
}
