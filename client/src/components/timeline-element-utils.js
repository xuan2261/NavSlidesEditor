export { buildTicks, parseDatePos } from 'revealjs-shared'

export function getTimelineRange(element) {
  return {
    startDate: element.timelineStart ?? element.startDate ?? '2000',
    endDate: element.timelineEnd ?? element.endDate ?? '2025',
  }
}

export function getTimelineItems(element) {
  return (element.events || element.items || []).map((item) => ({
    ...item,
    label: item.title ?? item.label ?? '',
    image: item.imageUrl ?? item.image ?? '',
    detailedDescription: item.detailedDescription ?? item.details ?? '',
    connectorLength: item.connectorLength ?? item.connectorOffset ?? element.connectorOffset ?? 0,
  }))
}
