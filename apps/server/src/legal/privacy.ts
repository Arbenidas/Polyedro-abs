/** Privacy policy page served at GET /privacy — a public, reachable URL
 *  required to switch the Meta app to Live mode. Plain self-contained HTML. */

const UPDATED = "July 5, 2026";

export const privacyPolicyHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polyedro /abs — Privacy Policy</title>
<style>
  :root { color-scheme: light dark; }
  body { max-width: 760px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6; }
  h1 { font-size: 1.9rem; margin-bottom: 4px; }
  h2 { margin-top: 2rem; font-size: 1.2rem; }
  .muted { color: #888; font-size: .9rem; }
  code { background: rgba(128,128,128,.15); padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<h1>Polyedro /abs — Privacy Policy</h1>
<p class="muted">Last updated: ${UPDATED}</p>

<p>Polyedro /abs ("we", "the app") is an AI marketing workspace that helps users
turn a brand into complete Meta Ads campaigns. This policy explains what data we
process and why.</p>

<h2>Information we collect</h2>
<ul>
  <li><strong>Account data:</strong> your email address, via Supabase Authentication, to sign you in and associate your work with your account.</li>
  <li><strong>Brand &amp; campaign data:</strong> the brand names, descriptions, target markets, campaign objectives, and briefs you enter.</li>
  <li><strong>Generated assets:</strong> brand kits, ad copy, images, video scripts, and voiceovers produced on your behalf.</li>
</ul>

<h2>How we use it</h2>
<p>We use your inputs solely to generate marketing assets and to prepare and
export advertising campaigns that you explicitly approve. We do not sell your
personal data.</p>

<h2>Third-party processors</h2>
<p>To provide the service we send the minimum necessary data to:</p>
<ul>
  <li><strong>OpenAI</strong> and <strong>Fal.ai</strong> — to generate text and images.</li>
  <li><strong>ElevenLabs</strong> — to generate voiceovers.</li>
  <li><strong>Supabase</strong> — authentication, database, and asset storage.</li>
  <li><strong>n8n</strong> and the <strong>Meta Marketing API</strong> — only when you choose to export an approved campaign to your own Meta ad account.</li>
</ul>

<h2>Data retention</h2>
<p>We keep your brands, campaigns, and generated assets until you delete them or
request account deletion.</p>

<h2>Your choices</h2>
<p>You may request access to, correction of, or deletion of your data at any
time by contacting us at the address below. Exporting to Meta Ads only ever
happens on campaigns you approve.</p>

<h2>Contact</h2>
<p>For any privacy request, email <code>rodrigopineda@ravn.co</code>.</p>
</body>
</html>`;
