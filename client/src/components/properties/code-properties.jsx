import { Input, Select } from '../../components/ui'
import { Button } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
/**
 * Code block properties: edit button, language, font size, border radius.
 */

const CODE_LANGUAGES = [
  { id: 'plaintext', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'r', label: 'R' },
  { id: 'scala', label: 'Scala' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'bash', label: 'Bash/Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'latex', label: 'LaTeX' },
]

export default function CodeProperties({ element, onUpdate, onEditCode }) {
  const steps = Array.isArray(element.walkthroughSteps) ? element.walkthroughSteps : []
  const defaultStepIndex = Number.isInteger(element.defaultStepIndex) ? element.defaultStepIndex : 0

  const updateStep = (index, patch) => {
    const next = [...steps]
    next[index] = { ...next[index], ...patch }
    onUpdate({ walkthroughSteps: next })
  }

  const addStep = () => {
    const nextIndex = steps.length + 1
    onUpdate({
      walkthroughSteps: [
        ...steps,
        { label: `Step ${nextIndex}`, startLine: nextIndex, endLine: nextIndex },
      ],
      defaultStepIndex: steps.length,
    })
  }

  const removeStep = (index) => {
    const next = steps.filter((_, i) => i !== index)
    onUpdate({
      walkthroughSteps: next,
      defaultStepIndex: Math.min(defaultStepIndex, Math.max(0, next.length - 1)),
    })
  }

  return (
    <div className="mb-2.5">
      <Button
        data-testid="prop-code-edit"
        variant="secondary"
        className="w-full justify-center text-xs mb-2"
        onClick={onEditCode}
      >
        Edit Code
      </Button>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Language</div>
          <Select
            data-testid="prop-code-language"
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            value={element.language || 'plaintext'}
            onChange={(e) => onUpdate({ language: e.target.value })}
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Font Size</div>
          <Input
            data-testid="prop-code-font-size"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            min="8"
            max="32"
            step="1"
            value={element.fontSize || 14}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 8, 32, null)
              if (value === null) return
              onUpdate({ fontSize: value })
            }}
          />
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[11px] text-text-muted mb-0.5">
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          data-testid="prop-code-border-radius"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="50"
          value={element.borderRadius || 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 50, null)
            if (value === null) return
            onUpdate({ borderRadius: value })
          }}
        />
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-text-muted font-semibold">Walkthrough Steps</div>
          <Button
            data-testid="prop-code-walkthrough-add"
            variant="secondary"
            className="px-2 py-1 text-[10px]"
            onClick={addStep}
          >
            + Add
          </Button>
        </div>
        {steps.length > 0 && (
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Default Step</div>
            <Select
              data-testid="prop-code-walkthrough-default"
              className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs"
              value={defaultStepIndex}
              onChange={(e) => onUpdate({ defaultStepIndex: Number(e.target.value) || 0 })}
            >
              {steps.map((step, index) => (
                <option key={index} value={index}>
                  {step.label || `Step ${index + 1}`}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          {steps.map((step, index) => (
            <div key={index} className="rounded border border-border bg-hover p-2 space-y-1">
              <div className="flex items-center gap-1">
                <Input
                  data-testid={`prop-code-walkthrough-label-${index}`}
                  className="prop-input flex-1 px-1.5 py-1 text-[11px]"
                  value={step.label || ''}
                  onChange={(e) => updateStep(index, { label: e.target.value })}
                  placeholder={`Step ${index + 1}`}
                />
                <button
                  data-testid={`prop-code-walkthrough-remove-${index}`}
                  className="text-[10px] text-text-muted hover:text-red-400 px-1"
                  onClick={() => removeStep(index)}
                >
                  X
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Input
                  data-testid={`prop-code-walkthrough-start-${index}`}
                  className="prop-input px-1.5 py-1 text-[11px]"
                  type="number"
                  min="1"
                  value={step.startLine || 1}
                  onChange={(e) => updateStep(index, { startLine: clampNumber(e.target.value, 1, 9999, 1) })}
                />
                <Input
                  data-testid={`prop-code-walkthrough-end-${index}`}
                  className="prop-input px-1.5 py-1 text-[11px]"
                  type="number"
                  min="1"
                  value={step.endLine || step.startLine || 1}
                  onChange={(e) => updateStep(index, { endLine: clampNumber(e.target.value, 1, 9999, 1) })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
