/**
 * AetherBin - Single-File Cloudflare Worker Deployable Script
 * Zero-Knowledge Client-Side Encrypted Pastebin
 * Supports dynamic EN/CN translation, 7-day max retention, burn-after-read, and QR Code generation.
 * 
 * Instructions:
 * 1. Create a Cloudflare Worker in your CF dashboard.
 * 2. Bind a KV Namespace to this Worker under the name "PASTE_KV".
 * 3. Copy this entire script, paste it into the Worker code editor, and deploy.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers for API requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // API Routing
    if (url.pathname.startsWith('/api/paste')) {
      return handleApiRequest(request, env, url, corsHeaders);
    }

    // Serve Frontend HTML directly
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(getHtmlPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Redirect any other route back to homepage
    return Response.redirect(url.origin, 302);
  }
};

/**
 * Handle KV CRUD Operations
 */
async function handleApiRequest(request, env, url, corsHeaders) {
  if (!env.PASTE_KV) {
    return new Response(
      JSON.stringify({ error: 'Internal Error: KV namespace "PASTE_KV" is not bound. Please bind KV in Workers settings.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const method = request.method;

  // POST /api/paste - Save encrypted paste
  if (method === 'POST' && url.pathname === '/api/paste') {
    try {
      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > 2 * 1024 * 1024) { // Max size 2MB for text
        return new Response(
          JSON.stringify({ error: 'Payload too large. Maximum size is 2MB.' }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await request.json();
      const { ciphertext, iv, options } = body;

      if (!ciphertext || !iv) {
        return new Response(
          JSON.stringify({ error: 'Missing ciphertext or iv.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate secure 16-character hex ID
      const rawId = new Uint8Array(8);
      crypto.getRandomValues(rawId);
      const id = Array.from(rawId).map(b => b.toString(16).padStart(2, '0')).join('');

      // Enforce 7-day max retention
      const expirationOpt = options?.expiration || '7d';
      const ttl = getExpirationTtl(expirationOpt);

      const pasteData = {
        ciphertext,
        iv,
        options: {
          burn_after_read: !!options?.burn_after_read,
          format: options?.format || 'plaintext',
          language: options?.language || '',
          is_encrypted_with_password: !!options?.is_encrypted_with_password,
        },
        created_at: Date.now(),
      };

      const kvOpts = { expirationTtl: ttl };
      pasteData.expires_at = Date.now() + (ttl * 1000);

      await env.PASTE_KV.put(id, JSON.stringify(pasteData), kvOpts);

      return new Response(
        JSON.stringify({ id, success: true }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload: ' + err.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET /api/paste/:id - Retrieve paste
  const match = url.pathname.match(/^\/api\/paste\/([a-f0-9]{16})$/);
  if (method === 'GET' && match) {
    const id = match[1];
    try {
      const pasteJson = await env.PASTE_KV.get(id);
      if (!pasteJson) {
        return new Response(
          JSON.stringify({ error: 'Paste not found or has expired.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pasteData = JSON.parse(pasteJson);

      // Burn after read
      if (pasteData.options?.burn_after_read) {
        await env.PASTE_KV.delete(id);
      }

      return new Response(
        JSON.stringify(pasteData),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Database retrieve failed: ' + err.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Expiration TTL Resolver (Enforced Max 7 Days)
 */
function getExpirationTtl(opt) {
  switch (opt) {
    case '5m':
      return 300; // 5 min
    case '1h':
      return 3600; // 1 hour
    case '1d':
      return 86400; // 1 day
    case '7d':
    default:
      return 604800; // 7 days (max limit)
  }
}

/**
 * Returns the entire frontend single page HTML containing styled CSS and JavaScript logic
 */
function getHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AetherBin — Zero-Knowledge Secure Pastebin</title>
  
  <!-- SEO & Social Meta -->
  <meta name="description" content="A premium, zero-knowledge online pastebin. Encrypt your text and code client-side before uploading. Secure, private, and temporary.">
  <meta property="og:title" content="AetherBin — Zero-Knowledge Secure Pastebin">
  <meta property="og:description" content="Temporary, client-side encrypted sharing for code and text.">
  <meta property="og:type" content="website">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

  <!-- Prism.js Tomorrow Night Theme for syntax highlighting -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
  
  <style>
    /* ==========================================================================
       AetherBin Stylesheet - Premium Dark Theme & Glassmorphism Design System
       ========================================================================== */

    :root {
      --bg-primary: #0a0b0e;
      --bg-secondary: rgba(18, 20, 29, 0.7);
      --bg-tertiary: rgba(30, 34, 48, 0.6);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-color-hover: rgba(255, 255, 255, 0.16);
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      
      --accent-color: #6366f1;
      --accent-color-hover: #4f46e5;
      --accent-glow: rgba(99, 102, 241, 0.45);
      
      --success-color: #10b981;
      --error-color: #ef4444;
      --warning-color: #f59e0b;
      
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
      
      --radius-lg: 18px;
      --radius-md: 10px;
      --radius-sm: 6px;
      --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      --inset-shine: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      --transition-smooth: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      --transition-fast: all 0.15s ease;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-sans);
      min-height: 100dvh;
      position: relative;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    /* Ambient Background Glows */
    .bg-glow {
      position: fixed;
      border-radius: 50%;
      filter: blur(140px);
      z-index: -1;
      opacity: 0.28;
      pointer-events: none;
      mix-blend-mode: screen;
    }

    .bg-glow-1 {
      width: 45vw;
      height: 45vw;
      background: radial-gradient(circle, var(--accent-color) 0%, rgba(0,0,0,0) 70%);
      top: -10%;
      left: -10%;
      animation: float-slow 25s infinite alternate ease-in-out;
    }

    .bg-glow-2 {
      width: 38vw;
      height: 38vw;
      background: radial-gradient(circle, #3b82f6 0%, rgba(0,0,0,0) 70%);
      bottom: -5%;
      right: -5%;
      animation: float-slow 30s infinite alternate-reverse ease-in-out;
    }

    .bg-glow-3 {
      width: 30vw;
      height: 30vw;
      background: radial-gradient(circle, #8b5cf6 0%, rgba(0,0,0,0) 70%);
      top: 40%;
      left: 60%;
      animation: float-slow 20s infinite alternate ease-in-out;
    }

    @keyframes float-slow {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(4vw, -6vh) scale(1.05); }
      100% { transform: translate(-2vw, 4vh) scale(0.95); }
    }

    /* App Layout */
    .app-container {
      width: 100%;
      max-width: 1200px;
      min-height: 100dvh;
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.5rem;
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
    }

    .logo-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--accent-color) 0%, #4f46e5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px var(--accent-glow);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .logo-icon i {
      width: 20px;
      height: 20px;
      color: #fff;
    }

    .logo-text h1 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.1;
    }

    .logo-text h1 span {
      background: linear-gradient(135deg, #a5b4fc 0%, var(--accent-color) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-text .tagline {
      font-size: 0.75rem;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .social-link {
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border-radius: var(--radius-sm);
      transition: var(--transition-fast);
      text-decoration: none;
    }

    .social-link:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    .glass {
      background: var(--bg-secondary);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      box-shadow: var(--glass-shadow), var(--inset-shine);
      border-radius: var(--radius-lg);
    }

    .main-panel {
      flex: 1;
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 600px;
    }

    .panel-section {
      display: none;
      flex-direction: column;
      flex: 1;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .panel-section.active {
      display: flex;
      opacity: 1;
      transform: translateY(0);
    }

    .hidden {
      display: none !important;
    }

    /* Editor Layout */
    .editor-container {
      display: flex;
      flex: 1;
      min-height: 380px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid var(--border-color);
      position: relative;
    }

    .line-numbers {
      width: 50px;
      padding: 1.25rem 0.5rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--text-muted);
      text-align: right;
      user-select: none;
      background: rgba(0, 0, 0, 0.1);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .line-numbers span {
      display: block;
      line-height: 1.5;
      padding-right: 4px;
    }

    textarea#paste-input {
      flex: 1;
      background: transparent;
      border: none;
      resize: none;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 0.9rem;
      line-height: 1.5;
      padding: 1.25rem 1.5rem;
      outline: none;
      min-height: 100%;
    }

    textarea#paste-input::placeholder {
      color: var(--text-muted);
      font-style: italic;
    }

    /* Toolbar Controls */
    .toolbar {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background: rgba(18, 20, 29, 0.4);
    }

    .toolbar-options {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .form-group label i {
      width: 12px;
      height: 12px;
      color: var(--accent-color);
    }

    select {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      padding: 0.6rem 2.2rem 0.6rem 0.8rem;
      border-radius: var(--radius-sm);
      outline: none;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      transition: var(--transition-fast);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1rem;
    }

    select:hover, select:focus {
      border-color: var(--border-color-hover);
      background-color: rgba(30, 34, 48, 0.8);
    }

    select:focus {
      outline: 2px solid var(--accent-color);
    }

    .toggles-container {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.5rem;
      margin-top: auto;
    }

    .toggle-switch {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
    }

    .toggle-switch input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-switch .slider {
      position: relative;
      width: 36px;
      height: 20px;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      transition: var(--transition-fast);
    }

    .toggle-switch .slider::before {
      content: "";
      position: absolute;
      height: 12px;
      width: 12px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-secondary);
      border-radius: 50%;
      transition: var(--transition-fast);
    }

    .toggle-switch input:checked + .slider {
      background-color: var(--accent-color);
      border-color: var(--accent-color);
    }

    .toggle-switch input:checked + .slider::before {
      transform: translateX(16px);
      background-color: #fff;
    }

    .toggle-switch .label-text {
      font-size: 0.85rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .toggle-switch .label-text i {
      width: 14px;
      height: 14px;
    }

    .toggle-switch input:checked ~ .label-text {
      color: var(--text-primary);
    }

    /* Buttons */
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border-color);
      padding-top: 1.25rem;
      margin-top: 0.25rem;
    }

    .size-indicator {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.65rem 1.25rem;
      border-radius: var(--radius-md);
      border: 1px solid transparent;
      cursor: pointer;
      outline: none;
      transition: var(--transition-fast);
      user-select: none;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: var(--accent-color);
      color: #fff;
      box-shadow: 0 4px 12px var(--accent-glow);
    }

    .btn-primary:hover {
      background: var(--accent-color-hover);
      box-shadow: 0 6px 16px var(--accent-glow);
    }

    .btn-primary:focus {
      outline: 2px solid #fff;
    }

    .btn-secondary {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background: rgba(30, 34, 48, 0.9);
      border-color: var(--border-color-hover);
    }

    .btn-secondary:focus {
      outline: 2px solid var(--accent-color);
    }

    .btn-sm {
      font-size: 0.75rem;
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-sm);
    }

    .btn-glow {
      position: relative;
      overflow: hidden;
    }

    .btn-glow::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      transition: all 0.6s ease;
    }

    .btn-glow:hover::after {
      left: 100%;
    }

    .btn-icon {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border-radius: var(--radius-sm);
      transition: var(--transition-fast);
    }

    .btn-icon:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.05);
    }

    .btn-icon:active {
      transform: scale(0.95);
    }

    /* Password Fields styling */
    .password-field-container {
      background: rgba(0, 0, 0, 0.15);
      border: 1px dashed var(--border-color);
      padding: 1rem;
      border-radius: var(--radius-md);
      animation: slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slide-down {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-wrapper input {
      width: 100%;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      padding: 0.6rem 2.5rem 0.6rem 0.8rem;
      font-family: var(--font-mono);
      font-size: 0.875rem;
      outline: none;
      transition: var(--transition-fast);
    }

    .input-wrapper input:focus {
      border-color: var(--border-color-hover);
      outline: 2px solid var(--accent-color);
    }

    .input-wrapper .btn-icon {
      position: absolute;
      right: 0.25rem;
    }

    .help-text {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Viewer Layout */
    .view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      background: rgba(18, 20, 29, 0.2);
    }

    .paste-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.25rem;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .meta-item i {
      width: 14px;
      height: 14px;
      color: var(--text-muted);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      border-radius: var(--radius-sm);
      letter-spacing: 0.025em;
    }

    .badge-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .view-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .burn-read-notice {
      background: rgba(245, 158, 11, 0.06);
      border-bottom: 1px solid rgba(245, 158, 11, 0.15);
      color: #fcd34d;
      font-size: 0.8rem;
      padding: 0.65rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .burn-read-notice i {
      color: var(--warning-color);
      width: 15px;
      height: 15px;
    }

    .render-viewport {
      display: flex;
      flex: 1;
      background: rgba(0, 0, 0, 0.15);
      position: relative;
      overflow: auto;
    }

    #viewer-line-numbers {
      min-height: 100%;
    }

    .content-display {
      flex: 1;
      overflow: visible;
      padding: 1.25rem 1.5rem;
    }

    pre#code-viewer-container {
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
      overflow: visible !important;
    }

    code#code-viewer {
      font-family: var(--font-mono) !important;
      font-size: 0.9rem !important;
      line-height: 1.5 !important;
      background: transparent !important;
      text-shadow: none !important;
    }

    /* Markdown Rendering Styling */
    .markdown-body {
      font-size: 0.95rem;
      line-height: 1.6;
      color: #e2e8f0;
    }

    .markdown-body h1, .markdown-body h2, .markdown-body h3 {
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }

    .markdown-body h1 { font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3rem; }
    .markdown-body h2 { font-size: 1.25rem; }
    .markdown-body h3 { font-size: 1.1rem; }

    .markdown-body p { margin-bottom: 1rem; }
    .markdown-body a { color: #818cf8; text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }
    
    .markdown-body code {
      font-family: var(--font-mono);
      background: rgba(255, 255, 255, 0.06);
      padding: 0.2rem 0.4rem;
      border-radius: var(--radius-sm);
      font-size: 0.85em;
    }

    .markdown-body pre {
      background: rgba(0, 0, 0, 0.3);
      padding: 1rem;
      border-radius: var(--radius-md);
      overflow-x: auto;
      border: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }

    .markdown-body pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-size: 0.85rem;
    }

    .markdown-body ul, .markdown-body ol { margin-left: 1.5rem; margin-bottom: 1rem; }
    .markdown-body blockquote {
      border-left: 4px solid var(--accent-color);
      padding-left: 1rem;
      color: var(--text-secondary);
      font-style: italic;
      margin-bottom: 1rem;
      background: rgba(99, 102, 241, 0.02);
    }

    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }

    .markdown-body th, .markdown-body td {
      border: 1px solid var(--border-color);
      padding: 0.5rem 0.75rem;
      text-align: left;
    }

    .markdown-body th { background: rgba(255, 255, 255, 0.04); }

    /* Password prompt card */
    .password-prompt-card {
      max-width: 420px;
      width: 100%;
      margin: 5rem auto;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 2.5rem 2rem;
      border-radius: var(--radius-lg);
      box-shadow: var(--glass-shadow);
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .prompt-icon {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-color);
      margin: 0 auto;
    }

    .prompt-icon i {
      width: 24px;
      height: 24px;
    }

    .password-prompt-card h2 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .password-prompt-card p {
      font-size: 0.875rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .btn-block { width: 100%; }
    .error-message {
      font-size: 0.8rem;
      color: var(--error-color);
      font-weight: 500;
      text-align: center;
    }

    /* Loading Overlay */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(10, 11, 14, 0.85);
      backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .loader-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(99, 102, 241, 0.15);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loader-content p {
      font-size: 0.9rem;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Toasts Container */
    .toast-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      z-index: 1000;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(21, 23, 33, 0.9);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      padding: 0.85rem 1.25rem;
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.85rem;
      font-weight: 500;
      animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      min-width: 250px;
      max-width: 400px;
    }

    @keyframes toast-slide-in {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .toast.toast-success i { color: var(--success-color); }
    .toast.toast-error i { color: var(--error-color); }
    .toast.toast-info i { color: var(--accent-color); }

    .app-footer {
      text-align: center;
      padding: 0.5rem;
    }

    .app-footer p {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    @keyframes icon-pulse {
      0% { transform: scale(1); filter: drop-shadow(0 0 2px var(--accent-glow)); }
      50% { transform: scale(1.05); filter: drop-shadow(0 0 8px var(--accent-glow)); }
      100% { transform: scale(1); filter: drop-shadow(0 0 2px var(--accent-glow)); }
    }

    .icon-pulse {
      animation: icon-pulse 3s infinite ease-in-out;
    }

    /* Language Switcher Styling */
    .lang-selector-wrapper {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 0.45rem 0.65rem;
      border-radius: var(--radius-md);
      transition: var(--transition-fast);
    }

    .lang-selector-wrapper:hover {
      border-color: var(--border-color-hover);
      background: rgba(30, 34, 48, 0.8);
    }

    .lang-icon {
      width: 14px;
      height: 14px;
      color: var(--text-secondary);
    }

    .select-lang-dropdown {
      background-color: transparent !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E") !important;
      background-repeat: no-repeat !important;
      background-position: right 0.1rem center !important;
      background-size: 0.75rem !important;
      border: none !important;
      padding: 0 1.1rem 0 0 !important;
      font-size: 0.75rem !important;
      font-weight: 600 !important;
      color: var(--text-secondary) !important;
      cursor: pointer;
      outline: none;
      margin: 0 !important;
      height: auto !important;
      appearance: none !important;
      -webkit-appearance: none !important;
    }

    .select-lang-dropdown:hover {
      color: var(--text-primary) !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23f1f5f9' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E") !important;
    }

    .select-lang-dropdown:focus {
      outline: none !important;
      box-shadow: none !important;
    }

    .select-lang-dropdown option,
    select option {
      background-color: #12141d;
      color: var(--text-primary);
    }

    .lang-selector-wrapper:focus-within {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 2px var(--accent-glow);
    }

    @media (max-width: 768px) {
      .app-container { padding: 1rem 0.75rem; }
      .app-header { flex-direction: column; gap: 1rem; align-items: flex-start; }
      .header-actions { width: 100%; justify-content: space-between; }
      .toolbar-options { flex-direction: column; align-items: stretch; gap: 1rem; }
      .toggles-container { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
      .action-bar { flex-direction: column; gap: 1rem; align-items: stretch; text-align: center; }
      .view-header { flex-direction: column; gap: 1rem; align-items: flex-start; padding: 1rem; }
      .view-actions { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
      .toast-container { left: 1rem; right: 1rem; bottom: 1rem; }
      .toast { min-width: auto; }
      .password-prompt-card { margin: 2rem 1rem; padding: 1.5rem; }
    }
  </style>
</head>
<body>
  <!-- Ambient background blobs -->
  <div class="bg-glow bg-glow-1"></div>
  <div class="bg-glow bg-glow-2"></div>
  <div class="bg-glow bg-glow-3"></div>

  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="logo-area" id="logo-btn">
        <div class="logo-icon">
          <i data-lucide="shield-alert" class="icon-pulse"></i>
        </div>
        <div class="logo-text">
          <h1>Aether<span>Bin</span></h1>
          <p class="tagline" data-i18n="tagline">Client-side encrypted sharing</p>
        </div>
      </div>
      
      <div class="header-actions">
        <!-- Language Selector -->
        <div class="lang-selector-wrapper">
          <i data-lucide="languages" class="lang-icon"></i>
          <select id="select-ui-lang" class="select-lang-dropdown">
            <option value="en">English</option>
            <option value="cn">简体中文</option>
          </select>
        </div>

        <button id="btn-new-paste" class="btn btn-secondary hidden">
          <i data-lucide="plus"></i> <span data-i18n="new_paste">New Paste</span>
        </button>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="social-link" title="Source Code">
          <i data-lucide="github"></i>
        </a>
      </div>
    </header>

    <!-- Main Content Panel -->
    <main class="main-panel glass">
      
      <!-- ================= EDITOR MODE ================= -->
      <section id="editor-section" class="panel-section active">
        <!-- Editor Input Area -->
        <div class="editor-container">
          <div class="line-numbers" id="editor-line-numbers">
            <span>1</span>
          </div>
          <textarea id="paste-input" placeholder="Type or paste your content here..." data-i18n-placeholder="editor_placeholder" spellcheck="false" autocomplete="off"></textarea>
        </div>

        <!-- Toolbar & Options Grid -->
        <div class="toolbar">
          <div class="toolbar-options">
            
            <!-- Format selector -->
            <div class="form-group">
              <label for="select-format"><i data-lucide="code-2"></i> <span data-i18n="format">Format</span></label>
              <select id="select-format">
                <option value="plaintext" data-i18n="fmt_plaintext">Plain Text</option>
                <option value="markdown" data-i18n="fmt_markdown">Markdown</option>
                <option value="code" data-i18n="fmt_code">Source Code</option>
              </select>
            </div>

            <!-- Code language -->
            <div class="form-group hidden" id="language-group">
              <label for="select-lang"><i data-lucide="cpu"></i> <span data-i18n="language">Language</span></label>
              <select id="select-lang">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="python">Python</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="cpp">C++</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
              </select>
            </div>

            <!-- Expiration selector (Max 7 Days) -->
            <div class="form-group">
              <label for="select-expiration"><i data-lucide="clock"></i> <span data-i18n="expiration">Expiration</span></label>
              <select id="select-expiration">
                <option value="5m" data-i18n="exp_5m">5 Minutes</option>
                <option value="1h" data-i18n="exp_1h">1 Hour</option>
                <option value="1d" data-i18n="exp_1d">1 Day</option>
                <option value="7d" data-i18n="exp_7d" selected>7 Days</option>
              </select>
            </div>

            <!-- Toggles (Burn, Password) -->
            <div class="toggles-container">
              <label class="toggle-switch" title="Delete paste immediately after it is read once">
                <input type="checkbox" id="check-burn">
                <span class="slider"></span>
                <span class="label-text"><i data-lucide="flame"></i> <span data-i18n="burn_after_read">Burn after reading</span></span>
              </label>

              <label class="toggle-switch" title="Require a password to decrypt this paste">
                <input type="checkbox" id="check-password-toggle">
                <span class="slider"></span>
                <span class="label-text"><i data-lucide="key-round"></i> <span data-i18n="password_protection">Password protection</span></span>
              </label>
            </div>

          </div>

          <!-- Password input field (Shown when checkbox toggled) -->
          <div id="password-field-container" class="form-group password-field-container hidden">
            <label for="paste-password"><i data-lucide="lock"></i> <span data-i18n="paste_password">Paste Password</span></label>
            <div class="input-wrapper">
              <input type="password" id="paste-password" placeholder="Enter custom password..." data-i18n-placeholder="password_placeholder" autocomplete="new-password">
              <button type="button" id="btn-toggle-password-view" class="btn-icon">
                <i data-lucide="eye"></i>
              </button>
            </div>
            <span class="help-text" data-i18n="password_help">Without this password, the link alone won't decrypt the paste.</span>
          </div>

          <!-- Upload Actions -->
          <div class="action-bar">
            <div class="size-indicator" id="size-indicator" data-i18n="size_characters_zero">0 characters</div>
            <button id="btn-create" class="btn btn-primary btn-glow">
              <i data-lucide="lock"></i> <span data-i18n="encrypt_create">Encrypt & Create</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ================= VIEW MODE ================= -->
      <section id="view-section" class="panel-section">
        <!-- View Toolbar -->
        <div class="view-header">
          <div class="paste-meta">
            <div class="meta-item hidden" id="meta-burn-warning">
              <span class="badge badge-danger"><i data-lucide="flame"></i> <span data-i18n="burn_badge">Burn After Reading</span></span>
            </div>
            <div class="meta-item">
              <i data-lucide="calendar"></i> <span id="meta-created" data-i18n="created_just_now">Created Just Now</span>
            </div>
            <div class="meta-item">
              <i data-lucide="clock"></i> <span id="meta-expiration">Expires: Never</span>
            </div>
          </div>
          
          <div class="view-actions">
            <button id="btn-copy-link" class="btn btn-secondary btn-sm">
              <i data-lucide="copy"></i> <span data-i18n="copy_link">Copy Link</span>
            </button>
            <button id="btn-qr-code" class="btn btn-secondary btn-sm">
              <i data-lucide="qr-code"></i> <span data-i18n="qr_code">QR Code</span>
            </button>
            <button id="btn-raw" class="btn btn-secondary btn-sm">
              <i data-lucide="file-text"></i> <span data-i18n="raw">Raw</span>
            </button>
            <button id="btn-duplicate" class="btn btn-secondary btn-sm">
              <i data-lucide="copy-plus"></i> <span data-i18n="duplicate">Duplicate</span>
            </button>
          </div>
        </div>

        <!-- Burn-after-read warning overlay (shows after decryption) -->
        <div id="burn-read-notice" class="burn-read-notice hidden">
          <i data-lucide="info"></i> <span data-i18n="burn_read_notice">This paste was configured to burn after reading. If you close this page or refresh, you will not be able to retrieve it again.</span>
        </div>

        <!-- Main Output Render -->
        <div class="render-viewport">
          <!-- Gutter Line Numbers (for Text & Code modes) -->
          <div class="line-numbers" id="viewer-line-numbers"></div>
          
          <!-- Content render elements -->
          <div class="content-display">
            <!-- Plain Text & Code Viewer -->
            <pre id="code-viewer-container" class="hidden"><code id="code-viewer" class="language-plaintext"></code></pre>
            
            <!-- Markdown Viewer -->
            <div id="markdown-viewer" class="markdown-body"></div>
          </div>
        </div>
      </section>

      <!-- ================= PASSWORD PROMPT MODAL (IN-LINE GLASS) ================= -->
      <section id="password-prompt-section" class="panel-section">
        <div class="password-prompt-card">
          <div class="prompt-icon">
            <i data-lucide="lock-keyhole"></i>
          </div>
          <h2 data-i18n="password_required">Password Required</h2>
          <p data-i18n="password_required_desc">This paste is encrypted with an additional password. Enter it below to decrypt the content.</p>
          
          <form id="password-prompt-form" onsubmit="return false;">
            <div class="form-group">
              <div class="input-wrapper">
                <input type="password" id="decrypt-password" placeholder="Enter password..." data-i18n-placeholder="password_placeholder" autocomplete="current-password" required>
                <button type="button" id="btn-toggle-decrypt-password-view" class="btn-icon">
                  <i data-lucide="eye"></i>
                </button>
              </div>
            </div>
            <div class="prompt-actions">
              <button type="submit" id="btn-decrypt" class="btn btn-primary btn-block">
                <i data-lucide="unlock"></i> <span data-i18n="decrypt_paste">Decrypt Paste</span>
              </button>
            </div>
            <p id="decrypt-error" class="error-message hidden" data-i18n="incorrect_password">Incorrect password. Please try again.</p>
          </form>
        </div>
      </section>

      <!-- ================= LOADING STATE ================= -->
      <div id="loading-overlay" class="loading-overlay hidden">
        <div class="loader-content">
          <div class="spinner"></div>
          <p id="loading-text">Encrypting paste...</p>
        </div>
      </div>

      <!-- ================= QR CODE MODAL (IN-LINE GLASS) ================= -->
      <div id="qr-modal" class="loading-overlay hidden" style="z-index: 200;">
        <div class="password-prompt-card" style="max-width: 320px; padding: 2rem 1.5rem;">
          <h3 data-i18n="qr_code_title" style="margin-bottom: 1rem;">Scan QR Code</h3>
          <div id="qrcode-container" style="display: flex; justify-content: center; background: white; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;"></div>
          <button id="btn-close-qr" class="btn btn-secondary btn-block" data-i18n="close">Close</button>
        </div>
      </div>

    </main>

    <!-- Toast Notification Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Info Footer -->
    <footer class="app-footer">
      <p data-i18n="footer_text">AetherBin uses AES-256-GCM client-side encryption. Keys never leave your device.</p>
    </footer>
  </div>

  <!-- Lucide Icons CDN -->
  <script src="https://unpkg.com/lucide@latest"></script>
  
  <!-- Marked Markdown Parser CDN -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <!-- Prism.js & Autoloader CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
  
  <!-- Client-side QR Code Generation Library -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

  <!-- Client Application Logic -->
  <script type="module">
    // Translation Dictionary
    const translations = {
      en: {
        tagline: 'Client-side encrypted sharing',
        new_paste: 'New Paste',
        editor_placeholder: 'Type or paste your content here...',
        format: 'Format',
        fmt_plaintext: 'Plain Text',
        fmt_markdown: 'Markdown',
        fmt_code: 'Source Code',
        language: 'Language',
        expiration: 'Expiration',
        exp_5m: '5 Minutes',
        exp_1h: '1 Hour',
        exp_1d: '1 Day',
        exp_7d: '7 Days',
        burn_after_read: 'Burn after reading',
        password_protection: 'Password protection',
        paste_password: 'Paste Password',
        password_placeholder: 'Enter custom password...',
        password_help: 'Without this password, the link alone won\\'t decrypt the paste.',
        encrypt_create: 'Encrypt & Create',
        burn_badge: 'Burn After Reading',
        created_just_now: 'Created Just Now',
        copy_link: 'Copy Link',
        qr_code: 'QR Code',
        qr_code_title: 'Scan QR Code',
        close: 'Close',
        raw: 'Raw',
        duplicate: 'Duplicate',
        burn_read_notice: 'This paste was configured to burn after reading. If you close this page or refresh, you will not be able to retrieve it again.',
        password_required: 'Password Required',
        password_required_desc: 'This paste is encrypted with an additional password. Enter it below to decrypt the content.',
        decrypt_paste: 'Decrypt Paste',
        incorrect_password: 'Incorrect password. Please try again.',
        footer_text: 'AetherBin uses AES-256-GCM client-side encryption. Keys never leave your device.',
        
        toast_copied: 'Encrypted link copied to clipboard!',
        toast_copy_failed: 'Failed to copy link.',
        toast_duplicate: 'Paste duplicated into editor.',
        toast_success: 'Paste created and encrypted successfully!',
        toast_input_empty: 'Please type some content.',
        size_characters: '{count} characters',
        loading_retrieving: 'Retrieving encrypted paste...',
        loading_decrypting: 'Decrypting data...',
        loading_encrypting: 'Encrypting paste client-side...',
        loading_uploading: 'Uploading ciphertext...',
        meta_created_at: 'Created: {date}',
        meta_expires_at: 'Expires: {date}',
        error_not_found: 'Paste not found, expired, or already burned.'
      },
      cn: {
        tagline: '客户端加密安全分享',
        new_paste: '新建粘贴',
        editor_placeholder: '在此输入或粘贴您的内容...',
        format: '格式类型',
        fmt_plaintext: '纯文本',
        fmt_markdown: 'Markdown',
        fmt_code: '源代码',
        language: '代码语言',
        expiration: '过期时间',
        exp_5m: '5分钟',
        exp_1h: '1小时',
        exp_1d: '1天',
        exp_7d: '7天',
        burn_after_read: '阅后即焚',
        password_protection: '密码保护',
        paste_password: '粘贴板密码',
        password_placeholder: '输入自定义密码...',
        password_help: '若设置密码，仅凭链接将无法解密该粘贴板内容。',
        encrypt_create: '加密并创建',
        burn_badge: '阅后即焚',
        created_just_now: '刚刚创建',
        copy_link: '复制链接',
        qr_code: '二维码',
        qr_code_title: '扫描二维码',
        close: '关闭',
        raw: '原始文本',
        duplicate: '复制编辑',
        burn_read_notice: '此粘贴板配置为“阅后即焚”。一旦关闭或刷新此页面，内容将彻底消失，无法再次读取。',
        password_required: '需要密码',
        password_required_desc: '此粘贴板已启用额外的密码保护。请输入密码进行解密。',
        decrypt_paste: '解密粘贴内容',
        incorrect_password: '密码错误，请重试。',
        footer_text: 'AetherBin 使用 AES-256-GCM 客户端加密。密钥绝不会离开您的设备。',
        
        toast_copied: '加密链接已复制到剪贴板！',
        toast_copy_failed: '复制链接失败。',
        toast_duplicate: '内容已复制回编辑器。',
        toast_success: '粘贴内容已成功加密并保存！',
        toast_input_empty: '请输入一些内容。',
        size_characters: '{count} 个字符',
        loading_retrieving: '正在获取加密内容...',
        loading_decrypting: '正在进行本地解密...',
        loading_encrypting: '正在进行客户端加密...',
        loading_uploading: '正在上传密文数据...',
        meta_created_at: '创建时间: {date}',
        meta_expires_at: '过期时间: {date}',
        error_not_found: '找不到该粘贴板内容，可能已过期或已被销毁。'
      }
    };

    // State Object
    const state = {
      activeMode: 'editor',
      lang: localStorage.getItem('lang') || (navigator.language.startsWith('zh') ? 'cn' : 'en'),
      fetchedPaste: null,
      decryptionKeyRaw: null,
    };

    // DOM Elements
    const el = {
      logoBtn: document.getElementById('logo-btn'),
      btnNewPaste: document.getElementById('btn-new-paste'),
      editorSection: document.getElementById('editor-section'),
      viewSection: document.getElementById('view-section'),
      passwordPromptSection: document.getElementById('password-prompt-section'),
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingText: document.getElementById('loading-text'),
      toastContainer: document.getElementById('toast-container'),
      selectUiLang: document.getElementById('select-ui-lang'),
      pasteInput: document.getElementById('paste-input'),
      editorLineNumbers: document.getElementById('editor-line-numbers'),
      selectFormat: document.getElementById('select-format'),
      languageGroup: document.getElementById('language-group'),
      selectLang: document.getElementById('select-lang'),
      selectExpiration: document.getElementById('select-expiration'),
      checkBurn: document.getElementById('check-burn'),
      checkPasswordToggle: document.getElementById('check-password-toggle'),
      passwordFieldContainer: document.getElementById('password-field-container'),
      pastePassword: document.getElementById('paste-password'),
      btnTogglePasswordView: document.getElementById('btn-toggle-password-view'),
      sizeIndicator: document.getElementById('size-indicator'),
      btnCreate: document.getElementById('btn-create'),
      metaBurnWarning: document.getElementById('meta-burn-warning'),
      metaCreated: document.getElementById('meta-created'),
      metaExpiration: document.getElementById('meta-expiration'),
      btnCopyLink: document.getElementById('btn-copy-link'),
      btnQrCode: document.getElementById('btn-qr-code'),
      qrModal: document.getElementById('qr-modal'),
      qrcodeContainer: document.getElementById('qrcode-container'),
      btnCloseQr: document.getElementById('btn-close-qr'),
      btnRaw: document.getElementById('btn-raw'),
      btnDuplicate: document.getElementById('btn-duplicate'),
      burnReadNotice: document.getElementById('burn-read-notice'),
      viewerLineNumbers: document.getElementById('viewer-line-numbers'),
      codeViewerContainer: document.getElementById('code-viewer-container'),
      codeViewer: document.getElementById('code-viewer'),
      markdownViewer: document.getElementById('markdown-viewer'),
      passwordPromptForm: document.getElementById('password-prompt-form'),
      decryptPassword: document.getElementById('decrypt-password'),
      btnToggleDecryptPasswordView: document.getElementById('btn-toggle-decrypt-password-view'),
      btnDecrypt: document.getElementById('btn-decrypt'),
      decryptError: document.getElementById('decrypt-error')
    };

    function t() {
      return translations[state.lang];
    }

    function translatePage() {
      const dict = t();
      document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (dict[key]) elem.textContent = dict[key];
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        if (dict[key]) elem.placeholder = dict[key];
      });
      updateSizeCounter();
      
      if (state.activeMode === 'view' && state.fetchedPaste) {
        const dateStr = new Date(state.fetchedPaste.created_at).toLocaleString(state.lang === 'cn' ? 'zh-CN' : 'en-US');
        el.metaCreated.textContent = dict.meta_created_at.replace('{date}', dateStr);
        if (state.fetchedPaste.expires_at) {
          const expDate = new Date(state.fetchedPaste.expires_at).toLocaleString(state.lang === 'cn' ? 'zh-CN' : 'en-US');
          el.metaExpiration.textContent = dict.meta_expires_at.replace('{date}', expDate);
        }
      }
    }

    // Base64url Helpers
    function bufferToBase64Url(buf) {
      const binstr = Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join('');
      return btoa(binstr).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    }

    function base64UrlToBuffer(b64url) {
      let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binstr = atob(b64);
      const buf = new Uint8Array(binstr.length);
      for (let i = 0; i < binstr.length; i++) buf[i] = binstr.charCodeAt(i);
      return buf.buffer;
    }

    function generateRandomBytes(bytesCount) {
      const array = new Uint8Array(bytesCount);
      window.crypto.getRandomValues(array);
      return array;
    }

    async function importRawAesKey(rawKey) {
      return await window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }

    async function deriveKeyFromPassword(password, salt) {
      const enc = new TextEncoder();
      const passwordKeyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
      return await window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        passwordKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Routing
    async function handleRouting() {
      const hash = window.location.hash;
      state.fetchedPaste = null;
      state.decryptionKeyRaw = null;
      resetEditorForm();
      
      const match = hash.match(/^#([a-f0-9]{16})_(.+)$/);
      if (match) {
        const id = match[1];
        const keyB64 = match[2];
        try {
          state.decryptionKeyRaw = base64UrlToBuffer(keyB64);
          setMode('loading', t().loading_retrieving);
          const response = await fetch('/api/paste/' + id);
          if (!response.ok) throw new Error(t().error_not_found);
          
          state.fetchedPaste = await response.json();
          if (state.fetchedPaste.options?.is_encrypted_with_password) {
            setMode('password');
          } else {
            await decryptAndDisplayPaste();
          }
        } catch (err) {
          showToast(err.message, 'error');
          window.location.hash = '';
          setMode('editor');
        }
      } else {
        setMode('editor');
      }
    }

    async function decryptAndDisplayPaste(password = null) {
      try {
        setMode('loading', t().loading_decrypting);
        const paste = state.fetchedPaste;
        const dict = t();
        
        let decryptionKey;
        if (paste.options?.is_encrypted_with_password) {
          if (!password) throw new Error('Password required.');
          decryptionKey = await deriveKeyFromPassword(password, state.decryptionKeyRaw);
        } else {
          decryptionKey = await importRawAesKey(state.decryptionKeyRaw);
        }
        
        const ciphertextBuf = base64UrlToBuffer(paste.ciphertext);
        const ivBuf = base64UrlToBuffer(paste.iv);
        
        let decryptedBytes;
        try {
          decryptedBytes = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, decryptionKey, ciphertextBuf);
        } catch (e) {
          if (paste.options?.is_encrypted_with_password) throw new Error('INCORRECT_PASSWORD');
          throw new Error('Decryption failed.');
        }
        
        const payload = JSON.parse(new TextDecoder().decode(decryptedBytes));
        setMode('view');
        
        const dateStr = new Date(paste.created_at).toLocaleString(state.lang === 'cn' ? 'zh-CN' : 'en-US');
        el.metaCreated.textContent = dict.meta_created_at.replace('{date}', dateStr);
        if (paste.expires_at) {
          const expDate = new Date(paste.expires_at).toLocaleString(state.lang === 'cn' ? 'zh-CN' : 'en-US');
          el.metaExpiration.textContent = dict.meta_expires_at.replace('{date}', expDate);
        }
        
        el.metaBurnWarning.classList.toggle('hidden', !paste.options?.burn_after_read);
        el.burnReadNotice.classList.toggle('hidden', !paste.options?.burn_after_read);
        el.codeViewerContainer.classList.add('hidden');
        el.markdownViewer.classList.add('hidden');
        el.viewerLineNumbers.innerHTML = '';
        
        const format = paste.options?.format || 'plaintext';
        if (format === 'markdown') {
          el.markdownViewer.classList.remove('hidden');
          el.markdownViewer.innerHTML = marked.parse(payload.content || '', { sanitize: true });
        } else {
          el.codeViewerContainer.classList.remove('hidden');
          el.codeViewer.textContent = payload.content;
          if (format === 'code') {
            const lang = paste.options?.language || 'javascript';
            el.codeViewer.className = 'language-' + lang;
            if (window.Prism) window.Prism.highlightElement(el.codeViewer);
          } else {
            el.codeViewer.className = 'language-plaintext';
          }
          generateLineNumbers(payload.content, el.viewerLineNumbers);
        }
        
        state.decryptedPayload = payload;
      } catch (err) {
        if (err.message === 'INCORRECT_PASSWORD') {
          el.decryptError.classList.remove('hidden');
          setMode('password');
        } else {
          showToast(err.message, 'error');
          window.location.hash = '';
          setMode('editor');
        }
      } finally {
        hideLoading();
      }
    }

    async function createPaste() {
      const content = el.pasteInput.value.trim();
      const format = el.selectFormat.value;
      const language = el.selectLang.value;
      const expiration = el.selectExpiration.value;
      const burnAfterRead = el.checkBurn.checked;
      const passwordProtection = el.checkPasswordToggle.checked;
      const password = el.pastePassword.value;
      
      if (!content) {
        showToast(t().toast_input_empty, 'error');
        return;
      }
      
      try {
        setMode('loading', t().loading_encrypting);
        const masterKeyRaw = generateRandomBytes(32);
        
        let encryptionKey;
        if (passwordProtection && password) {
          encryptionKey = await deriveKeyFromPassword(password, masterKeyRaw);
        } else {
          encryptionKey = await importRawAesKey(masterKeyRaw);
        }
        
        const payload = { content };
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
        const iv = generateRandomBytes(12);
        
        const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, payloadBytes);
        
        const apiBody = {
          ciphertext: bufferToBase64Url(ciphertext),
          iv: bufferToBase64Url(iv),
          options: {
            burn_after_read: burnAfterRead,
            format,
            language: format === 'code' ? language : '',
            is_encrypted_with_password: passwordProtection && !!password,
            expiration
          }
        };
        
        setMode('loading', t().loading_uploading);
        const response = await fetch('/api/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiBody)
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || ('Error status: ' + response.status));
        }
        
        const result = await response.json();
        const keyB64 = bufferToBase64Url(masterKeyRaw);
        window.location.hash = result.id + '_' + keyB64;
        showToast(t().toast_success, 'success');
      } catch (err) {
        showToast(err.message, 'error');
        hideLoading();
      }
    }

    // UI Helpers
    function setMode(mode, loadingMsg = 'Processing...') {
      state.activeMode = mode;
      el.editorSection.classList.toggle('active', mode === 'editor');
      el.viewSection.classList.toggle('active', mode === 'view');
      el.passwordPromptSection.classList.toggle('active', mode === 'password');
      
      if (mode === 'loading') {
        el.loadingText.textContent = loadingMsg;
        el.loadingOverlay.classList.remove('hidden');
      } else {
        el.loadingOverlay.classList.add('hidden');
      }
      el.btnNewPaste.classList.toggle('hidden', mode === 'editor' || mode === 'loading');
    }

    function updateLineNumbers() {
      generateLineNumbers(el.pasteInput.value, el.editorLineNumbers);
    }

    function generateLineNumbers(text, container) {
      if (!container) return;
      const lines = text.split('\\n');
      const count = Math.max(lines.length, 1);
      let html = '';
      for (let i = 1; i <= count; i++) html += '<span>' + i + '</span>';
      container.innerHTML = html;
    }

    function updateSizeCounter() {
      const chars = el.pasteInput.value.length;
      el.sizeIndicator.textContent = t().size_characters.replace('{count}', chars.toLocaleString());
    }

    function resetEditorForm() {
      el.pasteInput.value = '';
      el.selectFormat.value = 'plaintext';
      el.selectExpiration.value = '7d';
      el.checkBurn.checked = false;
      el.checkPasswordToggle.checked = false;
      el.pastePassword.value = '';
      el.languageGroup.classList.add('hidden');
      el.passwordFieldContainer.classList.add('hidden');
      updateLineNumbers();
    }

    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      let iconName = 'info';
      if (type === 'success') iconName = 'check-circle-2';
      if (type === 'error') iconName = 'x-circle';
      
      toast.innerHTML = '<i data-lucide="' + iconName + '"></i><span>' + message + '</span>';
      el.toastContainer.appendChild(toast);
      lucide.createIcons();
      setTimeout(() => toast.style.opacity = '1', 50);
      setTimeout(() => {
        toast.style.transform = 'translateY(15px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 4500);
    }

    function hideLoading() {
      if (state.activeMode === 'loading') {
        if (state.fetchedPaste && state.fetchedPaste.options?.is_encrypted_with_password && !state.decryptedPayload) {
          setMode('password');
        } else if (state.decryptedPayload) {
          setMode('view');
        } else {
          setMode('editor');
        }
      }
    }

    function initListeners() {
      el.selectUiLang.addEventListener('change', (e) => {
        state.lang = e.target.value;
        localStorage.setItem('lang', state.lang);
        translatePage();
      });
      el.logoBtn.addEventListener('click', () => { window.location.hash = ''; setMode('editor'); });
      el.btnNewPaste.addEventListener('click', () => { window.location.hash = ''; setMode('editor'); });
      el.pasteInput.addEventListener('input', () => { updateLineNumbers(); updateSizeCounter(); });
      el.pasteInput.addEventListener('scroll', () => { el.editorLineNumbers.scrollTop = el.pasteInput.scrollTop; });
      
      el.selectFormat.addEventListener('change', () => {
        el.languageGroup.classList.toggle('hidden', el.selectFormat.value !== 'code');
      });
      el.checkPasswordToggle.addEventListener('change', () => {
        el.passwordFieldContainer.classList.toggle('hidden', !el.checkPasswordToggle.checked);
        if (el.checkPasswordToggle.checked) el.pastePassword.focus();
      });
      el.btnTogglePasswordView.addEventListener('click', () => {
        const isPass = el.pastePassword.type === 'password';
        el.pastePassword.type = isPass ? 'text' : 'password';
        el.btnTogglePasswordView.querySelector('i').setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
        lucide.createIcons();
      });
      el.btnToggleDecryptPasswordView.addEventListener('click', () => {
        const isPass = el.decryptPassword.type === 'password';
        el.decryptPassword.type = isPass ? 'text' : 'password';
        el.btnToggleDecryptPasswordView.querySelector('i').setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
        lucide.createIcons();
      });

      el.btnCreate.addEventListener('click', createPaste);
      el.btnCopyLink.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href)
          .then(() => showToast(t().toast_copied, 'success'))
          .catch(() => showToast(t().toast_copy_failed, 'error'));
      });
      el.btnQrCode.addEventListener('click', () => {
        el.qrcodeContainer.innerHTML = '';
        new QRCode(el.qrcodeContainer, {
          text: window.location.href,
          width: 180,
          height: 180,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
        el.qrModal.classList.remove('hidden');
      });
      el.btnCloseQr.addEventListener('click', () => {
        el.qrModal.classList.add('hidden');
      });
      el.btnRaw.addEventListener('click', () => {
        if (state.decryptedPayload) {
          const rawWindow = window.open();
          rawWindow.document.write('<pre style="word-wrap: break-word; white-space: pre-wrap; font-family: monospace;">' + escapeHtml(state.decryptedPayload.content) + '</pre>');
          rawWindow.document.close();
        }
      });
      el.btnDuplicate.addEventListener('click', () => {
        if (state.decryptedPayload) {
          const content = state.decryptedPayload.content;
          window.location.hash = '';
          setMode('editor');
          el.pasteInput.value = content;
          updateLineNumbers();
          updateSizeCounter();
          showToast(t().toast_duplicate, 'info');
        }
      });
      el.passwordPromptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        el.decryptError.classList.add('hidden');
        const password = el.decryptPassword.value;
        if (password) await decryptAndDisplayPaste(password);
      });
    }

    function escapeHtml(text) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    window.addEventListener('load', () => {
      initListeners();
      el.selectUiLang.value = state.lang;
      lucide.createIcons();
      translatePage();
      handleRouting();
    });
    window.addEventListener('hashchange', handleRouting);
  </script>
</body>
</html>`;
}
