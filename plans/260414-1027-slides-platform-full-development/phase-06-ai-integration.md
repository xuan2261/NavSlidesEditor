# Phase 6 — AI Integration

## Overview
- **Priority**: P2 (High Impact)
- **Status**: ⬜ Pending
- **Effort**: 2-3 tuần
- **Dependencies**: Phase 0 (Foundation — Settings page for API keys)
- **Mục tiêu**: AI-powered features: copywriting, slide generation, translation

## Design Decisions
- **User tự configure API key** — không tốn cost cho server operator
- **Provider agnostic** — hỗ trợ OpenAI, Google Gemini, hoặc bất kỳ OpenAI-compatible API
- **Settings page**: lưu API key + provider selector
- **API key lưu server-side** trong `settings.json` (encrypted nếu có thể)

## Configuration

```javascript
// server/data/settings.json
{
  "ai": {
    "provider": "openai",    // "openai" | "gemini" | "custom"
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",  // default model
    "customEndpoint": "",    // for custom/local LLMs
    "customModel": ""
  }
}
```

**Supported Providers**:
| Provider | API Format | Models |
|----------|-----------|--------|
| OpenAI | OpenAI API | gpt-4o-mini, gpt-4o, gpt-4-turbo |
| Google Gemini | Google AI API | gemini-2.0-flash, gemini-2.0-pro |
| Custom | OpenAI-compatible | Any model at custom endpoint |

## Features to Implement

### 6.1 AI Copywriter
**Mô tả**: Cải thiện/viết lại text content trong slides.

**UI**: 
- Chọn text element → right-click hoặc toolbar button → "AI Improve"
- Popup với options:
  ```
  ┌────────────────────────────────┐
  │ AI Copywriter                  │
  ├────────────────────────────────┤
  │ Selected text:                 │
  │ "Our product is good..."      │
  │                                │
  │ Action:                        │
  │ [Improve] [Shorten] [Expand]   │
  │ [Professional] [Casual]        │
  │ [Fix Grammar] [Translate ▾]    │
  │                                │
  │ Custom prompt: [____________]  │
  │                                │
  │ Result:                        │
  │ "Our innovative solution..."   │
  │                                │
  │ [Apply] [Regenerate] [Cancel]  │
  └────────────────────────────────┘
  ```

**Server API**:
```javascript
// POST /api/ai/rewrite
app.post('/api/ai/rewrite', async (req, res) => {
  const { text, action, customPrompt, targetLanguage } = req.body
  const settings = await readSettings()
  if (!settings.ai?.apiKey) return res.status(400).json({ error: 'AI not configured' })
  
  const systemPrompt = `You are a presentation copywriter. ${getActionPrompt(action)}`
  const result = await callAI(settings.ai, systemPrompt, text)
  res.json({ result })
})

function getActionPrompt(action) {
  const prompts = {
    improve: 'Improve this text for a presentation slide. Make it clearer and more impactful. Keep it concise.',
    shorten: 'Shorten this text significantly while keeping the key message. Bullet points preferred.',
    expand: 'Expand this text with more details, examples, or supporting points.',
    professional: 'Rewrite in a professional, formal tone suitable for corporate presentations.',
    casual: 'Rewrite in a casual, engaging tone.',
    grammar: 'Fix any grammar, spelling, or punctuation errors. Preserve the meaning.',
  }
  return prompts[action] || ''
}
```

---

### 6.2 AI Slide Generator
**Mô tả**: Generate full presentation outline từ topic/prompt.

**UI**:
```
┌──────────────────────────────────────┐
│ AI Slide Generator                   │
├──────────────────────────────────────┤
│ Topic or description:                │
│ ┌──────────────────────────────────┐ │
│ │ IoT Security in Military        │ │
│ │ Systems - covering threats,     │ │
│ │ defense strategies, and case    │ │
│ │ studies                         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Number of slides: [8 ▾]             │
│ Style: [Professional ▾]             │
│ Language: [Tiếng Việt ▾]            │
│ Template: [Military Briefing ▾]     │
│                                      │
│ [Generate Outline]                   │
├──────────────────────────────────────┤
│ Generated Outline:                   │
│ 1. Title: IoT Security...           │
│ 2. Agenda                            │
│ 3. Current Threat Landscape          │
│ 4. ...                               │
│                                      │
│ [✏ Edit] [Create Presentation]      │
└──────────────────────────────────────┘
```

**Server API**:
```javascript
// POST /api/ai/generate-outline
app.post('/api/ai/generate-outline', async (req, res) => {
  const { topic, slideCount, style, language, templateId } = req.body
  
  const systemPrompt = `You are a presentation designer. Generate a presentation outline.
Return JSON array of slides. Each slide has: title, bulletPoints (array), layout (title|content|two-column|image-text|big-number), speakerNotes.
Style: ${style}. Language: ${language}. Slides: ${slideCount}.`
  
  const result = await callAI(settings.ai, systemPrompt, topic)
  const outline = JSON.parse(result)
  res.json({ outline })
})

// POST /api/ai/generate-slides — convert outline to actual slides
app.post('/api/ai/generate-slides', async (req, res) => {
  const { outline, templateId } = req.body
  // Map outline to slide elements using template patterns
  const slides = outline.map(slide => mapOutlineToSlide(slide, templateId))
  res.json({ slides })
})
```

**Outline → Slides mapping**:
- `title` layout → title template (h1 centered)
- `content` layout → heading + bullet points
- `two-column` layout → 2 text columns
- `image-text` layout → placeholder image + text
- `big-number` layout → large stat + caption
- Apply template colors/fonts from selected template

---

### 6.3 Presentation Translator
**Mô tả**: Dịch toàn bộ text trong presentation sang ngôn ngữ khác.

**UI**:
```
┌──────────────────────────────┐
│ Translate Presentation       │
├──────────────────────────────┤
│ Target language:             │
│ [Tiếng Việt          ▾]     │
│                              │
│ Options:                     │
│ ☑ Translate slide content    │
│ ☑ Translate speaker notes    │
│ ☐ Keep original as notes     │
│                              │
│ Preview:                     │
│ "Introduction" → "Giới thiệu"│
│ "Methods" → "Phương pháp"    │
│                              │
│ [Translate All] [Cancel]     │
└──────────────────────────────┘
```

**Implementation**:
- Collect all text elements from all slides
- Batch translate via AI API (chunk to avoid token limits)
- Replace text content while preserving HTML formatting
- Option to keep original text in speaker notes

```javascript
// POST /api/ai/translate
app.post('/api/ai/translate', async (req, res) => {
  const { texts, targetLanguage, preserveFormatting } = req.body
  // texts = [{ id, html }]
  
  const systemPrompt = `Translate the following text to ${targetLanguage}.
IMPORTANT: Preserve all HTML tags exactly. Only translate the text content between tags.
Return JSON array with same structure.`
  
  const result = await callAI(settings.ai, systemPrompt, JSON.stringify(texts))
  res.json({ translations: JSON.parse(result) })
})
```

**Supported Languages**: Vietnamese, English, Japanese, Korean, Chinese, French, German, Spanish, Russian, Thai + 30 more

---

### 6.4 AI Image Suggestions (Bonus)
**Mô tả**: Gợi ý hình ảnh phù hợp cho slide content.

**Implementation**:
- Phân tích text content → extract keywords
- Search Unsplash với keywords
- Show suggestions trong side panel
- Click to insert

---

## AI Provider Abstraction

```javascript
// server/services/ai-provider.js
async function callAI(config, systemPrompt, userPrompt) {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, systemPrompt, userPrompt)
    case 'gemini':
      return callGemini(config, systemPrompt, userPrompt)
    case 'custom':
      return callCustom(config, systemPrompt, userPrompt)
  }
}

async function callOpenAI(config, system, user) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
}

async function callGemini(config, system, user) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-2.0-flash'}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }]
      })
    }
  )
  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

async function callCustom(config, system, user) {
  // OpenAI-compatible endpoint (e.g., Ollama, LM Studio, vLLM)
  const response = await fetch(`${config.customEndpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.customModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
}
```

## Settings Page — AI Section

```
┌──────────────────────────────────────┐
│ Settings > AI Configuration          │
├──────────────────────────────────────┤
│ Provider: [OpenAI ▾]                │
│                                      │
│ API Key: [sk-••••••••••••]  [Test]  │
│                                      │
│ Model: [gpt-4o-mini ▾]             │
│   Options: gpt-4o-mini, gpt-4o,     │
│   gpt-4-turbo                        │
│                                      │
│ ── OR Custom Endpoint ──             │
│ URL: [http://localhost:11434/v1]     │
│ Model: [llama3.2]                    │
│                                      │
│ [Save] [Test Connection]            │
│ Status: ✅ Connected                 │
└──────────────────────────────────────┘
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `server/services/ai-provider.js` | NEW — multi-provider AI abstraction |
| `server/routes/ai.js` | NEW — /api/ai/* endpoints |
| `server/routes/settings.js` | MODIFY — add AI config |
| `client/src/components/modals/AICopywriterModal.jsx` | NEW |
| `client/src/components/modals/AIGeneratorModal.jsx` | NEW |
| `client/src/components/modals/AITranslateModal.jsx` | NEW |
| `client/src/pages/SettingsPage.jsx` | MODIFY — add AI section |
| `client/src/utils/ai.js` | NEW — client-side AI API calls |

## Todo List

- [ ] AI provider abstraction (OpenAI, Gemini, Custom)
- [ ] Settings page AI configuration section
- [ ] API key storage + test connection endpoint
- [ ] AI Copywriter: rewrite/improve/shorten/expand/grammar
- [ ] AI Copywriter modal UI with preview
- [ ] AI Slide Generator: topic → outline → slides
- [ ] AI Generator modal with template selection
- [ ] Outline → Slide mapping logic
- [ ] Presentation Translator: batch translate all text
- [ ] Translator modal with language picker
- [ ] HTML-preserving translation
- [ ] Error handling for API failures / rate limits
- [ ] Loading states for AI operations

## Success Criteria

- [ ] User can configure OpenAI, Gemini, or custom AI provider
- [ ] Test connection button verifies API key
- [ ] AI Copywriter improves selected text with multiple styles
- [ ] AI Slide Generator creates 5-12 slide presentation from topic
- [ ] Generated slides use appropriate templates/layouts
- [ ] Translator preserves HTML formatting while translating text
- [ ] Works with OpenAI, Gemini, and Ollama (localhost)
- [ ] Graceful error handling when API key is invalid or rate limited
