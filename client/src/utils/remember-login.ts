const STORAGE_KEY = 'rememberLogin';

type RememberLogin = {
  username: string;
};

export function saveRememberLogin(username: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: username.trim() }));
}

export function clearRememberLogin() {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadRememberLogin(): RememberLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RememberLogin;
    if (!parsed.username?.trim()) return null;

    return { username: parsed.username.trim() };
  } catch {
    return null;
  }
}
