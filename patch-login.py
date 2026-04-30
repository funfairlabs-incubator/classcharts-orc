with open('shared/src/classcharts.ts', 'r') as f:
    content = f.read()

old = """  async login(): Promise<CCStudent[]> {
    await this.client.login();
    const raw = await this.client.getPupils();
    this.pupils = raw.map(mapPupil);
    return this.pupils;
  }"""

new = """  async login(): Promise<CCStudent[]> {
    // ClassCharts now routes API calls via TES SSO (session.tes.com).
    // The classcharts-api library hits a redirect loop on getPupils.
    // We handle the auth flow manually to avoid this.
    const c = this.client as any;

    // Step 1: POST login to get session cookies
    const formData = new URLSearchParams({
      _method: 'POST',
      email: c.email,
      logintype: 'existing',
      password: c.password,
      'recaptcha-token': 'no-token-available',
    });
    const loginRes = await fetch('https://www.classcharts.com/parent/login', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
    });
    if (loginRes.status !== 302) throw new Error(`ClassCharts login failed: ${loginRes.status}`);
    const setCookie = loginRes.headers.get('set-cookie') ?? '';
    const ccSession = setCookie.match(/cc-session=([^;]+)/)?.[1];
    const credMatch = setCookie.match(/parent_session_credentials=([^;\s]+)/)?.[1];
    if (!ccSession || !credMatch) throw new Error('ClassCharts login: missing session cookies');
    const sessionId = JSON.parse(decodeURIComponent(credMatch)).session_id as string;

    // Step 2: TES verify - follow the redirect manually then call pupils
    const cookieHeader = `cc-session=${ccSession}; parent_session_credentials=${credMatch}`;
    const tesRes = await fetch(
      'https://session.tes.com/v1/verify?returnUrl=https%3A%2F%2Fwww.classcharts.com%2Fapiv2parent%2Fpupils',
      { headers: { Cookie: cookieHeader }, redirect: 'manual' }
    );
    const tesLocation = tesRes.headers.get('location');
    if (tesLocation) {
      await fetch(tesLocation, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
    }

    // Step 3: Set session on underlying client so normal API calls work
    c.sessionId = sessionId;
    c.authCookies = cookieHeader.split('; ');
    c.lastPing = Date.now();

    // Step 4: Get pupils directly
    const pupilsRes = await fetch('https://www.classcharts.com/apiv2parent/pupils', {
      headers: { Authorization: `Basic ${sessionId}`, Cookie: cookieHeader, 'User-Agent': 'classcharts-api' },
      redirect: 'manual',
    });
    if (pupilsRes.status !== 200) throw new Error(`getPupils failed: ${pupilsRes.status}`);
    const pupilsJson = await pupilsRes.json() as { data: any[] };
    this.pupils = pupilsJson.data.map(mapPupil);

    // Sync pupils back to underlying client
    c.pupils = pupilsJson.data;
    c.studentId = pupilsJson.data[0]?.id ?? 0;

    return this.pupils;
  }"""

assert old in content, "Pattern not found in classcharts.ts"
content = content.replace(old, new)

with open('shared/src/classcharts.ts', 'w') as f:
    f.write(content)
print("done")
