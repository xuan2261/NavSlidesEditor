export const APP_FEEDBACK_EVENT = 'navslides:feedback'

export function showNotice(message, options = {}) {
  window.dispatchEvent(
    new CustomEvent(APP_FEEDBACK_EVENT, {
      detail: { type: 'notice', message, ...options },
    })
  )
}

export function showError(message, options = {}) {
  showNotice(message, { tone: 'danger', title: 'Something went wrong', ...options })
}

export function confirmUser(message, onConfirm, options = {}) {
  window.dispatchEvent(
    new CustomEvent(APP_FEEDBACK_EVENT, {
      detail: { type: 'confirm', message, onConfirm, ...options },
    })
  )
}
