async function callAI(config, systemPrompt, userPrompt) {
  if (!config) throw new Error('AI not configured')

  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, systemPrompt, userPrompt)
    case 'gemini':
      return callGemini(config, systemPrompt, userPrompt)
    case 'custom':
      return callCustom(config, systemPrompt, userPrompt)
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`)
  }
}

async function callOpenAI(config, system, user) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(`OpenAI API Error: ${errData.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

async function callGemini(config, system, user) {
  const model = config.model || 'gemini-2.0-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
      }),
    }
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(`Gemini API Error: ${errData.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

async function callCustom(config, system, user) {
  if (!config.customEndpoint) throw new Error('Custom endpoint not configured')

  // Clean endpoint
  let url = config.customEndpoint
  if (!url.endsWith('/chat/completions')) {
    url = url.replace(/\/+$/, '') + '/chat/completions'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.customModel || 'local',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Custom API Error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

module.exports = { callAI }
