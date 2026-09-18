import { Button, Input, ModalShell, Select } from '../../components/ui'
import { THEMES, TRANSITIONS } from './home-page-presets'
import { getCardBg, getTemplateStartButtonStateClassName, isGradientOrImage } from './home-page-utils'

export function CreatePresentationModal({ creating, form, onFormChange, onSubmit, onClose, allTemplates }) {
  return (
        <ModalShell
          titleId="create-presentation-title"
          title="New Presentation"
          size="lg"
          onClose={() => onClose()}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => onClose()}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="create-presentation-form" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          }
        >
            <form id="create-presentation-form" onSubmit={onSubmit}>
              <div className="mb-3">
                <label
                  className="mb-1 block text-xs font-medium text-text-secondary"
                  htmlFor="create-presentation-title-input"
                >
                  Title
                </label>
                <Input
                  id="create-presentation-title-input"
                  type="text"
                  placeholder="My Presentation"
                  value={form.title}
                  onChange={(e) => onFormChange((f) => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Template selector */}
              <div className="mb-3">
                <div
                  id="create-presentation-template-label"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  Start from
                </div>
                <div
                  className="grid grid-cols-3 gap-2 mb-1"
                  role="group"
                  aria-labelledby="create-presentation-template-label"
                >
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => onFormChange((f) => ({ ...f, templateId: null }))}
                    className={`h-auto min-h-[42px] px-2 py-2.5 rounded-sm border-2 text-center text-xs font-medium ${getTemplateStartButtonStateClassName(!form.templateId)}`}
                  >
                    Blank
                  </Button>
                  {allTemplates
                    .filter(
                      (tmpl) =>
                        tmpl.title &&
                        tmpl.title !== 'New Template' &&
                        tmpl.title !== 'Untitled Template'
                    )
                    .map((tmpl) => (
                      <Button
                        variant="ghost"
                        key={tmpl.id}
                        type="button"
                        onClick={() =>
                          onFormChange((f) => ({
                            ...f,
                            templateId: tmpl.id,
                            theme: tmpl.theme || f.theme,
                            transition: tmpl.transition || f.transition,
                          }))
                        }
                        className={`h-auto min-h-[54px] px-2 py-1.5 rounded-sm border-2 text-center text-[11px] font-medium overflow-hidden flex flex-col ${getTemplateStartButtonStateClassName(form.templateId === tmpl.id)}`}
                    >
                      <div
                        className="h-7 rounded-[3px] mb-1 w-full"
                        style={
                          isGradientOrImage(tmpl.thumbnail)
                            ? { background: getCardBg(tmpl.thumbnail) }
                            : { backgroundColor: getCardBg(tmpl.thumbnail) }
                        }
                      />
                      {tmpl.title}
                    </Button>
                  ))}
                </div>
              </div>

              {!form.templateId && (
                <>
                  <div className="mb-3">
                    <label
                      className="mb-1 block text-xs font-medium text-text-secondary"
                      htmlFor="create-presentation-theme"
                    >
                      Theme
                    </label>
                    <Select
                      id="create-presentation-theme"
                      value={form.theme}
                      onChange={(e) => onFormChange((f) => ({ ...f, theme: e.target.value }))}
                    >
                      {THEMES.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="mb-3">
                    <label
                      className="mb-1 block text-xs font-medium text-text-secondary"
                      htmlFor="create-presentation-transition"
                    >
                      Transition
                    </label>
                    <Select
                      id="create-presentation-transition"
                      value={form.transition}
                      onChange={(e) => onFormChange((f) => ({ ...f, transition: e.target.value }))}
                    >
                      {TRANSITIONS.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}
            </form>
        </ModalShell>
  )
}

