export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var token = process.env.GITHUB_PAT_RANDROID_DEV;
  if (!token) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  var { title, body } = req.body || {};
  if (!body || !title) {
    return res.status(400).json({ error: 'Missing title or body' });
  }

  var ghRes = await fetch(
    'https://api.github.com/repos/Randroids-Dojo/randroid.dev/issues',
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        body: body,
        labels: ['feedback']
      })
    }
  );

  if (!ghRes.ok) {
    var err = await ghRes.text();
    return res.status(ghRes.status).json({ error: 'GitHub API error', detail: err });
  }

  var issue = await ghRes.json();
  return res.status(201).json({ number: issue.number });
}
