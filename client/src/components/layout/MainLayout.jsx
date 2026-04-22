import React from 'react'
import { Outlet } from 'react-router-dom'
import StatusBar from './StatusBar'

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-workspace text-text-primary">
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <Outlet />
      </div>
      <StatusBar />
    </div>
  )
}
