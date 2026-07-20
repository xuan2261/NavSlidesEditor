import { useCallback, useEffect, useState } from 'react'
import { api } from '../utils/api'

export function usePptxFidelity(presentation) {
  const [contract, setContract] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  const hasPptxSource = Boolean(presentation?.pptxOriginal || presentation?.pptxSourceAvailable)

  useEffect(() => {
    let active = true
    if (!presentation?.id || !hasPptxSource) {
      return () => {
        active = false
      }
    }

    api.getPptxFidelity(presentation.id)
      .then((result) => {
        if (active) setContract(result)
      })
      .catch(() => {
        if (active) setContract(null)
      })
    return () => {
      active = false
    }
  }, [presentation?.id, hasPptxSource, reloadKey])

  const currentContract = contract?.presentationId === presentation?.id ? contract : null
  return {
    contract: hasPptxSource ? currentContract : null,
    loading: Boolean(hasPptxSource && !currentContract),
    reload,
  }
}
