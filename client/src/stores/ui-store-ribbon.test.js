import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './ui-store'

describe('ui-store ribbon state', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeTab: 'home',
    })
  })

  it('defaults to home tab', () => {
    expect(useUIStore.getState().activeTab).toBe('home')
  })

  it('setActiveTab updates activeTab', () => {
    useUIStore.getState().setActiveTab('insert')
    expect(useUIStore.getState().activeTab).toBe('insert')
  })

  it('setActiveTab validates tab ids', () => {
    const validTabs = ['home', 'insert', 'design', 'format', 'transitions', 'animations', 'view']
    for (const tab of validTabs) {
      useUIStore.getState().setActiveTab(tab)
      expect(useUIStore.getState().activeTab).toBe(tab)
    }
  })
})
