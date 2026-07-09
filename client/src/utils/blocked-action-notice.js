/**
 * Stable user-facing copy for silent interaction blocks (group lock, element lock).
 * Keep strings short — shown via showNotice / aria status.
 */
export function getBlockedActionNotice(reason) {
  switch (reason) {
    case 'group-locked':
      return 'Cannot modify: group contains locked or hidden members'
    case 'element-locked':
      return 'Cannot move: element is locked'
    case 'slide-locked':
      return 'Cannot edit: slide is locked'
    default:
      return 'Action blocked'
  }
}
