/**
 * Statik veri çözücü (backend'siz mod).
 *
 * Turnuva bittikten sonra site tamamen statiktir: gerçek bir API yoktur.
 * Bu modül eski `api.get(...)` çağrılarını, `public/data/*.json` içine
 * export edilmiş anlık görüntülere eşler. Böylece view'lar büyük ölçüde
 * değişmeden çalışır. Kimlik doğrulama, token ve cookie mantığı kaldırıldı.
 *
 * Veriyi yeniden üretmek için:  npm run export-static -w server
 */

const BASE = import.meta.env.BASE_URL || '/';

type ResolverConfig = { params?: Record<string, unknown> };
// axios gibi: tür verilmezse `data` any olur (mevcut view'lar tür belirtmiyor).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolverResponse<T = any> = { data: T };

/** axios hata biçimini taklit eder ki view'lardaki `err.response.data.error` çalışsın. */
function notFound(status: number): never {
  throw { response: { status, data: { error: 'Veri bulunamadı' } } };
}

async function loadJson<T = unknown>(file: string): Promise<T> {
  const res = await fetch(`${BASE}data/${file}.json`, { cache: 'no-cache' });
  if (!res.ok) notFound(res.status);
  return (await res.json()) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get<T = any>(url: string, config?: ResolverConfig): Promise<ResolverResponse<T>> {
  const [path, qs] = url.split('?');
  const query = new URLSearchParams(qs ?? '');
  const mode = (config?.params?.mode as string | undefined) ?? query.get('mode') ?? undefined;

  switch (path) {
    case '/tournament/status':
      return { data: await loadJson('tournament-status') };
    case '/teams':
      return { data: await loadJson('teams') };
    case '/scoring-rules':
      return { data: await loadJson('scoring-rules') };
    case '/matches':
      return { data: await loadJson('matches') };
    case '/leaderboard':
      return { data: await loadJson('leaderboard') };
    case '/groups/standings': {
      const groups = await loadJson<{ groups: unknown }>('groups');
      return { data: { groups: groups.groups } as T };
    }
    case '/groups/best-thirds': {
      const groups = await loadJson<{ bestThirds: unknown }>('groups');
      return { data: { bestThirds: groups.bestThirds } as T };
    }
  }

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/players\/([^/]+)\/points$/))) {
    const slug = decodeURIComponent(m[1]);
    return { data: await loadJson(mode === 'random' ? `players/${slug}.random` : `players/${slug}`) };
  }
  if ((m = path.match(/^\/teams\/([^/]+)\/matches$/))) {
    return { data: await loadJson(`teams/${m[1]}`) };
  }

  throw new Error(`Statik veri eşlemesi bulunamadı: ${url}`);
}

const api = { get };

export default api;
