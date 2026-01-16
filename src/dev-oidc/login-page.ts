import { DevUser } from './config';

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

// eslint-disable-next-line import/prefer-default-export
export function generateLoginPage(
  users: DevUser[],
  redirectUri: string,
  state: string,
  nonce: string,
  codeChallenge: string,
  codeChallengeMethod: string,
): string {
  const userButtons = users.map((user) => `
    <button type="submit" name="user_id" value="${user.sub}" class="user-btn">
      <span class="user-icon">&#128100;</span>
      <span class="user-info">
        <span class="user-name">${user.name}</span>
        <span class="user-email">${user.email}</span>
      </span>
    </button>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkedRecords Dev Login</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .login-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      width: 100%;
      max-width: 400px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      color: #333;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .header p {
      color: #666;
      font-size: 14px;
    }

    .dev-badge {
      display: inline-block;
      background: #ff6b6b;
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      margin-left: 8px;
      vertical-align: middle;
    }

    .user-btn {
      width: 100%;
      display: flex;
      align-items: center;
      padding: 16px;
      margin-bottom: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .user-btn:hover {
      border-color: #667eea;
      background: #f8f9ff;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }

    .user-btn:active {
      transform: translateY(0);
    }

    .user-icon {
      font-size: 32px;
      margin-right: 16px;
      opacity: 0.8;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 2px;
    }

    .user-email {
      font-size: 13px;
      color: #888;
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: #999;
      font-size: 12px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e0e0e0;
    }

    .divider span {
      padding: 0 12px;
    }

    .custom-login {
      margin-top: 8px;
    }

    .custom-login input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .custom-login input[type="email"]:focus {
      border-color: #667eea;
    }

    .custom-login button {
      width: 100%;
      margin-top: 12px;
      padding: 14px 16px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .custom-login button:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }

    .custom-login button:active {
      transform: translateY(0);
    }

    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="header">
      <h1>LinkedRecords<span class="dev-badge">DEV</span></h1>
      <p>Select a test user to continue</p>
    </div>

    <form method="POST" action="">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <input type="hidden" name="nonce" value="${escapeHtml(nonce)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">

      ${userButtons}
    </form>

    <div class="divider"><span>or</span></div>

    <form method="POST" action="" class="custom-login">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <input type="hidden" name="nonce" value="${escapeHtml(nonce)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">

      <input type="email" name="custom_email" placeholder="Enter any email address" required>
      <button type="submit">Login with custom email</button>
    </form>

    <div class="footer">
      Development environment only
    </div>
  </div>
</body>
</html>`;
}
