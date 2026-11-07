export const mattermostId = /^[a-z0-9]{26}$/;
export const mattermostTeam = /^[a-z0-9][a-z0-9_-]*$/;

export function mattermostBaseUrl(value) {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) &&
        !url.username && !url.password && !url.search && !url.hash &&
        !/[|<>]/.test(url.href)) return url.href.replace(/\/+$/, '');
  } catch { /* Invalid configuration. */ }
  return null;
}

export async function resolveMattermostLink(event, config, fetcher) {
  const channelId = config.mattermostSourceChannels?.[event.switch_room_id];
  const base = mattermostBaseUrl(config.mattermostUrl);
  const publicBase = mattermostBaseUrl(config.mattermostPublicUrl || config.mattermostUrl);
  const team = config.mattermostTeam;
  if (!base || !publicBase || !mattermostTeam.test(team || '') || !config.mattermostReadToken ||
      !mattermostId.test(channelId || '') ||
      (event.platform_channel_id && event.platform_channel_id !== channelId)) return null;

  async function read(path) {
    const response = await fetcher(`${base}/api/v4/${path}`, {
      headers: { authorization: `Bearer ${config.mattermostReadToken}` },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Mattermost HTTP ${response.status}`);
    return response.json();
  }

  try {
    const nativeId = event.platform_message_id;
    if (nativeId && !mattermostId.test(nativeId)) return null;
    const eventTime = Date.parse(event.timestamp);
    const posts = nativeId ? [await read(`posts/${nativeId}`)]
      : Object.values((await read(`channels/${channelId}/posts?per_page=50`)).posts);
    const matches = posts.filter(post =>
      mattermostId.test(post?.id || '') && mattermostId.test(post.user_id || '') &&
      (!nativeId || post.id === nativeId) && post.channel_id === channelId &&
      !post.type && !post.delete_at && !post.props?.from_bot && !post.props?.from_webhook &&
      post.message === event.text && Number.isFinite(post.create_at) &&
      Math.abs(post.create_at - eventTime) <= 10000 &&
      (!event.platform_sender_id || event.platform_sender_id === post.user_id));
    if (matches.length !== 1) return null;

    const post = matches[0];
    const author = await read(`users/${post.user_id}`);
    if (author.id !== post.user_id || author.is_bot) return null;
    const fullName = [author.first_name, author.last_name].filter(Boolean).join(' ');
    if (!event.platform_sender_id &&
        ![author.username, author.nickname, fullName].includes(event.sender_name)) return null;

    event.platform_channel_id = channelId;
    event.platform_message_id = post.id;
    event.platform_sender_id = author.id;
    return `${publicBase}/${team}/pl/${post.id}`;
  } catch {
    return null;
  }
}
