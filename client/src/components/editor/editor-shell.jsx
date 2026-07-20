export default function EditorShell({
  smallScreenGuard,
  header,
  leftPanel,
  ribbon,
  canvas,
  rightPanels,
  overlays,
  tour,
  children,
}) {
  if (children) {
    return (
      <>
        {smallScreenGuard}
        <div className="relative hidden h-full flex-col overflow-hidden md:flex">
          {children}
        </div>
      </>
    )
  }

  return (
    <>
      {smallScreenGuard}
      <div className="relative hidden h-full flex-col overflow-hidden md:flex">
        {header}
        <div className="flex-1 flex overflow-hidden">
          {leftPanel}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-workspace">
            {ribbon}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {canvas}
            </div>
          </div>
          {rightPanels}
        </div>
        {overlays}
        {tour}
      </div>
    </>
  )
}
