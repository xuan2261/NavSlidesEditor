const API_BASE = '/api/ai'

export async function aiRewrite(text, action, customPrompt = '') {
  const res = await fetch(`${API_BASE}/rewrite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, action, customPrompt }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'AI request failed')
  }
  return res.json()
}

export async function aiGenerateOutline(
  topic,
  slideCount = 8,
  style = 'professional',
  language = 'English'
) {
  const res = await fetch(`${API_BASE}/generate-outline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, slideCount, style, language }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to generate outline')
  }
  return res.json()
}

export async function aiTranslate(texts, targetLanguage) {
  const res = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLanguage }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Translation failed')
  }
  return res.json()
}

export async function testAIConnection(config) {
  const res = await fetch(`${API_BASE}/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Connection test failed')
  }
  return true
}
