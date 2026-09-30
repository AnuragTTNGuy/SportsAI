/** Standalone HTML helper linked from Swagger — generate and copy iframe snippets. */
export function renderWidgetBuilderPage(publicApiUrl: string): string {
  const apiBase = publicApiUrl.replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Embed widget builder — Sports Insights</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 56rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1e293b; }
    h1 { font-size: 1.35rem; }
    label { display: block; font-weight: 600; margin-top: 1rem; }
    input, select { width: 100%; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
    .snippet { margin-top: 1.5rem; padding: 1rem; background: #f1f5f9; border-radius: 8px; }
    pre { white-space: pre-wrap; word-break: break-all; font-size: 0.8rem; }
    .copy { margin-left: 0.5rem; }
    a { color: #2563eb; }
    .err { color: #dc2626; }
    .preview-wrap { margin: 1rem 0; }
    .preview-wrap p { margin: 0 0 0.5rem; font-weight: 600; font-size: 0.9rem; }
    .preview-frame {
      display: block;
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #0f172a;
    }
  </style>
</head>
<body>
  <p><a href="/docs">← Back to Swagger</a></p>
  <h1>Iframe widget builder</h1>
  <p>Generate embed URLs and copy iframe HTML for any event. Uses the same API key as Swagger (<code>X-API-Key</code>).</p>

  <label for="apiKey">API key</label>
  <input id="apiKey" type="password" placeholder="dev-key-1" autocomplete="off" />

  <label for="eventId">Event ID (UUID)</label>
  <input id="eventId" type="text" placeholder="d662605f-825b-499e-a243-62bc7387b66c" />

  <button type="button" id="load">Load iframe snippets</button>
  <p id="status" class="err"></p>
  <div id="out"></div>

  <script>
    const API_BASE = ${JSON.stringify(apiBase)};

    document.getElementById('load').addEventListener('click', async () => {
      const apiKey = document.getElementById('apiKey').value.trim();
      const eventId = document.getElementById('eventId').value.trim();
      const status = document.getElementById('status');
      const out = document.getElementById('out');
      status.textContent = '';
      out.innerHTML = '';

      if (!apiKey || !eventId) {
        status.textContent = 'API key and event ID are required.';
        return;
      }

      try {
        const res = await fetch(API_BASE + '/v1/embed/events/' + encodeURIComponent(eventId) + '/iframe-snippets', {
          headers: { 'X-API-Key': apiKey },
        });
        const data = await res.json();
        if (!res.ok) {
          status.textContent = data.message || res.statusText;
          return;
        }

        const blocks = [data.board, ...(data.snippets || [])];
        out.innerHTML = '<h2>' + escapeHtml(data.matchTitle || 'Snippets') + '</h2>';

        for (const item of blocks) {
          const section = document.createElement('div');
          section.className = 'snippet';
          const height = item.recommendedHeight || 320;
          section.innerHTML =
            '<h3>' + escapeHtml(item.title) + ' <code>' + escapeHtml(item.cardType) + '</code></h3>' +
            '<p><strong>Embed URL</strong></p><pre class="url"></pre>' +
            '<div class="preview-wrap">' +
            '<p>Live preview</p>' +
            '<iframe class="preview-frame" title="' + escapeHtml(item.title) + '" loading="lazy"></iframe>' +
            '</div>' +
            '<p><strong>Iframe HTML</strong> <button type="button" class="copy">Copy iframe code</button></p>' +
            '<pre class="html"></pre>';
          section.querySelector('.url').textContent = item.embedUrl;
          section.querySelector('.html').textContent = item.iframeHtml;
          const frame = section.querySelector('.preview-frame');
          frame.src = item.embedUrl;
          frame.height = String(height);
          section.querySelector('.copy').addEventListener('click', () => {
            navigator.clipboard.writeText(item.iframeHtml);
            section.querySelector('.copy').textContent = 'Copied!';
            setTimeout(() => { section.querySelector('.copy').textContent = 'Copy iframe code'; }, 2000);
          });
          out.appendChild(section);
        }
      } catch (e) {
        status.textContent = String(e);
      }
    });

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
  </script>
</body>
</html>`;
}
