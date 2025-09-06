import { OAuthProviderType } from '../../entities';

/**
 * Esempi di provider OAuth custom per diversi servizi
 *
 * Questo file mostra come configurare provider OAuth personalizzati
 * con tutti i campi richiesti per l'autenticazione
 */

// Esempio 1: Discord OAuth Provider
export const discordOAuthProvider = {
  name: 'Discord',
  providerId: 'discord',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_discord_client_id',
  clientSecret: 'your_discord_client_secret',
  scopes: ['identify', 'email'],
  iconUrl: 'https://discord.com/assets/3437c10597c1526c3dbd98c737c2bcae.svg',
  color: '#5865F2',
  authorizationUrl: 'https://discord.com/api/oauth2/authorize',
  tokenUrl: 'https://discord.com/api/oauth2/token',
  userInfoUrl: 'https://discord.com/api/users/@me',
  profileFields: ['id', 'username', 'email', 'avatar', 'discriminator'],
  additionalConfig: JSON.stringify({
    strategy: 'discord',
    profileFields: ['id', 'username', 'email', 'avatar', 'discriminator'],
    userAgent: 'DiscordBot (https://github.com/your-app, 1.0.0)',
  }),
};

// Esempio 2: Microsoft OAuth Provider
export const microsoftOAuthProvider = {
  name: 'Microsoft',
  providerId: 'microsoft',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_microsoft_client_id',
  clientSecret: 'your_microsoft_client_secret',
  scopes: ['user.read', 'email', 'profile'],
  iconUrl:
    'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
  color: '#0078d4',
  authorizationUrl:
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  profileFields: [
    'id',
    'displayName',
    'userPrincipalName',
    'mail',
    'givenName',
    'surname',
  ],
  additionalConfig: JSON.stringify({
    strategy: 'microsoft',
    profileFields: [
      'id',
      'displayName',
      'userPrincipalName',
      'mail',
      'givenName',
      'surname',
    ],
    tenant: 'common',
  }),
};

// Esempio 3: LinkedIn OAuth Provider
export const linkedinOAuthProvider = {
  name: 'LinkedIn',
  providerId: 'linkedin',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_linkedin_client_id',
  clientSecret: 'your_linkedin_client_secret',
  scopes: ['r_liteprofile', 'r_emailaddress'],
  iconUrl:
    'https://content.linkedin.com/content/dam/me/business/en-us/amp/brand-site/v2/bg/LI-Bug.svg.original.svg',
  color: '#0a66c2',
  authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  userInfoUrl: 'https://api.linkedin.com/v2/me',
  profileFields: [
    'id',
    'localizedFirstName',
    'localizedLastName',
    'profilePicture',
  ],
  additionalConfig: JSON.stringify({
    strategy: 'linkedin',
    profileFields: [
      'id',
      'localizedFirstName',
      'localizedLastName',
      'profilePicture',
    ],
    apiVersion: 'v2',
  }),
};

// Esempio 4: Twitter OAuth Provider (OAuth 1.0a)
export const twitterOAuthProvider = {
  name: 'Twitter',
  providerId: 'twitter',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_twitter_api_key',
  clientSecret: 'your_twitter_api_secret',
  scopes: ['tweet.read', 'users.read'],
  iconUrl:
    'https://abs.twimg.com/responsive-web/client-web/icon-ios.b1fc727a.png',
  color: '#1DA1F2',
  authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
  tokenUrl: 'https://api.twitter.com/2/oauth2/token',
  userInfoUrl: 'https://api.twitter.com/2/users/me',
  profileFields: ['id', 'username', 'name', 'profile_image_url'],
  additionalConfig: JSON.stringify({
    strategy: 'twitter',
    profileFields: ['id', 'username', 'name', 'profile_image_url'],
    oauthVersion: '2.0',
    pkce: true,
  }),
};

// Esempio 5: Slack OAuth Provider
export const slackOAuthProvider = {
  name: 'Slack',
  providerId: 'slack',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_slack_client_id',
  clientSecret: 'your_slack_client_secret',
  scopes: ['identity.basic', 'identity.email', 'identity.avatar'],
  iconUrl: 'https://a.slack-edge.com/bv1-11/slack_logo-ebd02d48.svg',
  color: '#4A154B',
  authorizationUrl: 'https://slack.com/oauth/authorize',
  tokenUrl: 'https://slack.com/api/oauth.access',
  userInfoUrl: 'https://slack.com/api/users.identity',
  profileFields: ['id', 'name', 'email', 'image_192'],
  additionalConfig: JSON.stringify({
    strategy: 'slack',
    profileFields: ['id', 'name', 'email', 'image_192'],
    team: 'your_team_name',
  }),
};

// Esempio 6: GitLab OAuth Provider
export const gitlabOAuthProvider = {
  name: 'GitLab',
  providerId: 'gitlab',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_gitlab_client_id',
  clientSecret: 'your_gitlab_client_secret',
  scopes: ['read_user', 'email'],
  iconUrl:
    'https://gitlab.com/gitlab-com/gitlab-artwork/raw/master/logo/logo-square.png',
  color: '#FC6D26',
  authorizationUrl: 'https://gitlab.com/oauth/authorize',
  tokenUrl: 'https://gitlab.com/oauth/token',
  userInfoUrl: 'https://gitlab.com/api/v4/user',
  profileFields: ['id', 'username', 'name', 'email', 'avatar_url'],
  additionalConfig: JSON.stringify({
    strategy: 'gitlab',
    profileFields: ['id', 'username', 'name', 'email', 'avatar_url'],
    apiVersion: 'v4',
  }),
};

// Esempio 7: Bitbucket OAuth Provider
export const bitbucketOAuthProvider = {
  name: 'Bitbucket',
  providerId: 'bitbucket',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_bitbucket_client_id',
  clientSecret: 'your_bitbucket_client_secret',
  scopes: ['account', 'email'],
  iconUrl:
    'https://bitbucket.org/atlassianlabs/atlaskit-mk-2/raw/HEAD/packages/design-system/media/logo/bitbucket-logo.svg',
  color: '#0052CC',
  authorizationUrl: 'https://bitbucket.org/site/oauth2/authorize',
  tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
  userInfoUrl: 'https://api.bitbucket.org/2.0/user',
  profileFields: ['uuid', 'username', 'display_name', 'email'],
  additionalConfig: JSON.stringify({
    strategy: 'bitbucket',
    profileFields: ['uuid', 'username', 'display_name', 'email'],
    apiVersion: '2.0',
  }),
};

// Esempio 8: Dropbox OAuth Provider
export const dropboxOAuthProvider = {
  name: 'Dropbox',
  providerId: 'dropbox',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_dropbox_client_id',
  clientSecret: 'your_dropbox_client_secret',
  scopes: ['account_info.read'],
  iconUrl:
    'https://cfl.dropboxstatic.com/static/images/logo_catalog/dropbox_logo_glyph_m1.svg',
  color: '#0061FF',
  authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
  tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  userInfoUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
  profileFields: ['account_id', 'name', 'email', 'profile_photo_url'],
  additionalConfig: JSON.stringify({
    strategy: 'dropbox',
    profileFields: ['account_id', 'name', 'email', 'profile_photo_url'],
    apiVersion: '2',
  }),
};

// Esempio 9: Spotify OAuth Provider
export const spotifyOAuthProvider = {
  name: 'Spotify',
  providerId: 'spotify',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_spotify_client_id',
  clientSecret: 'your_spotify_client_secret',
  scopes: ['user-read-email', 'user-read-private'],
  iconUrl:
    'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_White.png',
  color: '#1DB954',
  authorizationUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  userInfoUrl: 'https://api.spotify.com/v1/me',
  profileFields: ['id', 'display_name', 'email', 'images'],
  additionalConfig: JSON.stringify({
    strategy: 'spotify',
    profileFields: ['id', 'display_name', 'email', 'images'],
    apiVersion: 'v1',
  }),
};

// Esempio 10: Twitch OAuth Provider
export const twitchOAuthProvider = {
  name: 'Twitch',
  providerId: 'twitch',
  type: OAuthProviderType.CUSTOM,
  clientId: 'your_twitch_client_id',
  clientSecret: 'your_twitch_client_secret',
  scopes: ['user:read:email'],
  iconUrl: 'https://www.twitch.tv/p/assets/uploads/glitch-474x36.png',
  color: '#9146FF',
  authorizationUrl: 'https://id.twitch.tv/oauth2/authorize',
  tokenUrl: 'https://id.twitch.tv/oauth2/token',
  userInfoUrl: 'https://api.twitch.tv/helix/users',
  profileFields: ['id', 'login', 'display_name', 'email', 'profile_image_url'],
  additionalConfig: JSON.stringify({
    strategy: 'twitch',
    profileFields: [
      'id',
      'login',
      'display_name',
      'email',
      'profile_image_url',
    ],
    apiVersion: 'helix',
  }),
};

// Funzione helper per creare un provider custom generico
export const createCustomOAuthProvider = (
  name: string,
  providerId: string,
  config: {
    clientId: string;
    clientSecret: string;
    scopes: string[];
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    profileFields: string[];
    iconUrl?: string;
    color?: string;
    additionalConfig?: any;
  },
) => {
  return {
    name,
    providerId,
    type: OAuthProviderType.CUSTOM,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes,
    iconUrl: config.iconUrl || 'https://via.placeholder.com/64x64?text=OAuth',
    color: config.color || '#007bff',
    authorizationUrl: config.authorizationUrl,
    tokenUrl: config.tokenUrl,
    userInfoUrl: config.userInfoUrl,
    profileFields: config.profileFields,
    additionalConfig: config.additionalConfig
      ? JSON.stringify(config.additionalConfig)
      : undefined,
  };
};

// Esempio di utilizzo della funzione helper
export const customProviderExample = createCustomOAuthProvider(
  'My Custom Service',
  'my-custom-service',
  {
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    scopes: ['profile', 'email'],
    authorizationUrl: 'https://example.com/oauth/authorize',
    tokenUrl: 'https://example.com/oauth/token',
    userInfoUrl: 'https://example.com/oauth/userinfo',
    profileFields: ['id', 'email', 'name'],
    iconUrl: 'https://example.com/icon.png',
    color: '#FF6B6B',
    additionalConfig: {
      strategy: 'custom',
      profileFields: ['id', 'email', 'name'],
    },
  },
);
