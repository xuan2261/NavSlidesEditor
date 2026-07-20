function applyCompatibilityWrites(presentations, writes) {
  for (const write of writes) {
    const index = presentations.findIndex((item) => item.id === write.presentationId)
    if (write.operation === 'remove') {
      if (index !== -1) presentations.splice(index, 1)
      continue
    }
    if (index === -1) presentations.push(structuredClone(write.presentation))
    else presentations[index] = structuredClone(write.presentation)
  }
}

module.exports = { applyCompatibilityWrites }
