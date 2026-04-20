import React from 'react';
import { Outlet } from 'react-router-dom';
import StatusBar from './StatusBar';

export default function MainLayout() {
  return (
    <div className="main-layout">
      <div className="main-layout-content">
        <Outlet />
      </div>
      <StatusBar />
    </div>
  );
}
