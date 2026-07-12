export interface Config {
  port: number;
  /** "google" requires calendarId + keyFile; "memory" is the no-creds dev mode */
  provider: 'google' | 'memory';
  calendarId: string;
  /** Path to the Google service-account JSON key file */
  keyFile: string;
  /** Directory of the built panel app to serve statically (empty = API only) */
  staticDir: string;
  /** TLS cert/key paths — both set enables HTTPS (required by the TSS panel) */
  tlsCert: string;
  tlsKey: string;
}

export function loadConfig(): Config {
  const provider = (process.env.PROVIDER ?? 'memory') as Config['provider'];
  if (provider !== 'google' && provider !== 'memory') {
    throw new Error(`PROVIDER must be "google" or "memory", got "${provider}"`);
  }
  const config: Config = {
    port: Number(process.env.PORT ?? 8080),
    provider,
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? '',
    keyFile: process.env.GOOGLE_SA_KEY_FILE ?? '',
    staticDir: process.env.STATIC_DIR ?? '',
    tlsCert: process.env.TLS_CERT ?? '',
    tlsKey: process.env.TLS_KEY ?? ''
  };
  if (config.provider === 'google') {
    if (!config.calendarId) throw new Error('GOOGLE_CALENDAR_ID is required with PROVIDER=google');
    if (!config.keyFile) throw new Error('GOOGLE_SA_KEY_FILE is required with PROVIDER=google');
  }
  return config;
}
