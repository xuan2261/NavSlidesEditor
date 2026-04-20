import { useEffect, useRef, useCallback } from 'react';
import { usePresentationStore } from '../stores/presentation-store';

export function useHistory() {
  const presentation = usePresentationStore(s => s.presentation);
  const setPresentation = usePresentationStore(s => s.setPresentation);
  const loading = usePresentationStore(s => s.loading);
  
  const historyRef = useRef([]);
  const redoStackRef = useRef([]);
  const applyingUndoRef = useRef(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (loading || !presentation) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    
    if (applyingUndoRef.current) {
      applyingUndoRef.current = false;
      return;
    }
    
    const timer = setTimeout(() => {
      if (presentation) {
        historyRef.current = [
          ...historyRef.current.slice(-50),
          JSON.parse(JSON.stringify(presentation))
        ];
        redoStackRef.current = [];
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [presentation, loading]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    
    const previous = historyRef.current.pop();
    if (presentation) {
      redoStackRef.current.push(JSON.parse(JSON.stringify(presentation)));
    }
    
    applyingUndoRef.current = true;
    setPresentation(previous);
  }, [presentation, setPresentation]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    
    const next = redoStackRef.current.pop();
    if (presentation) {
      historyRef.current.push(JSON.parse(JSON.stringify(presentation)));
    }
    
    applyingUndoRef.current = true;
    setPresentation(next);
  }, [presentation, setPresentation]);

  const pushHistory = useCallback(() => {
    if (presentation) {
      historyRef.current = [
        ...historyRef.current.slice(-50),
        JSON.parse(JSON.stringify(presentation))
      ];
      redoStackRef.current = [];
    }
  }, [presentation]);

  return { undo, redo, pushHistory, historyRef, redoStackRef };
}
