import PromptPopover from '../PromptPopover'
import { resolveUrlEntry } from '../../utils/url-safety'

export default function EditorLinkPrompt({ open, editor, onClose }) {
  if (!open) return null

  return (
    <PromptPopover
      title="Insert link"
      label="Link URL"
      description="Use an HTTP(S), email, phone, anchor, or project-relative URL."
      placeholder="https://example.com"
      submitLabel="Insert link"
      validate={(href) => resolveUrlEntry(href, 'link').error}
      onSubmit={(href) => {
        editor?.chain().focus().setLink({ href }).run()
        onClose()
      }}
      onCancel={onClose}
      className="top-24 left-1/2 -translate-x-1/2"
    />
  )
}
