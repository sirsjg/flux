import { useState, useEffect, useCallback } from 'preact/hooks'

interface BoardPreferences {
  viewMode: 'normal' | 'condensed'
  planningCollapsed: boolean
  collapsedEpics: string[]
}

interface StoredPreferences {
  viewMode?: unknown;
  planningCollapsed?: unknown;
  collapsedEpics?: unknown;
}

const STORAGE_KEY_PREFIX = 'flux-board-preferences'

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}-${projectId}`
}

function getInitialPreferences(projectId: string): BoardPreferences {
  if (typeof window === 'undefined') {
    return {
      viewMode: 'normal',
      planningCollapsed: false,
      collapsedEpics: [],
    }
  }

  try {
    const stored = localStorage.getItem(getStorageKey(projectId))
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored) as StoredPreferences;
      return {
        viewMode: parsed.viewMode === 'condensed' ? 'condensed' : 'normal',
        planningCollapsed: Boolean(parsed.planningCollapsed),
        collapsedEpics: Array.isArray(parsed.collapsedEpics) ? parsed.collapsedEpics as string[] : [],
      }
    }
  } catch {
    // Invalid JSON, return defaults
  }

  return {
    viewMode: 'normal',
    planningCollapsed: false,
    collapsedEpics: [],
  }
}

export function useBoardPreferences(projectId: string): {
  viewMode: 'normal' | 'condensed';
  planningCollapsed: boolean;
  collapsedEpics: Set<string>;
  setViewMode: (viewMode: 'normal' | 'condensed') => void;
  setPlanningCollapsed: (planningCollapsed: boolean) => void;
  toggleEpicCollapse: (epicId: string) => void;
  isEpicCollapsed: (epicId: string) => boolean;
} {
  const [preferences, setPreferences] = useState<BoardPreferences>(() =>
    getInitialPreferences(projectId)
  )

  // Reload preferences when projectId changes
  useEffect(() => {
    setPreferences(getInitialPreferences(projectId))
  }, [projectId])

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(preferences))
  }, [projectId, preferences])

  const setViewMode = useCallback((viewMode: 'normal' | 'condensed'): void => {
    setPreferences(prev => ({ ...prev, viewMode }))
  }, [])

  const setPlanningCollapsed = useCallback((planningCollapsed: boolean): void => {
    setPreferences(prev => ({ ...prev, planningCollapsed }))
  }, [])

  const toggleEpicCollapse = useCallback((epicId: string): void => {
    setPreferences(prev => {
      const collapsedEpics = prev.collapsedEpics.includes(epicId)
        ? prev.collapsedEpics.filter(id => id !== epicId)
        : [...prev.collapsedEpics, epicId]
      return { ...prev, collapsedEpics }
    })
  }, [])

  const isEpicCollapsed = useCallback(
    (epicId: string): boolean => preferences.collapsedEpics.includes(epicId),
    [preferences.collapsedEpics]
  )

  return {
    viewMode: preferences.viewMode,
    planningCollapsed: preferences.planningCollapsed,
    collapsedEpics: new Set(preferences.collapsedEpics),
    setViewMode,
    setPlanningCollapsed,
    toggleEpicCollapse,
    isEpicCollapsed,
  }
}
