export function IconRenderer({ element, iconPaths }) {
  const rawName = element.iconName || 'Star'
  const iconKey = rawName.endsWith('Icon') && rawName !== 'ImageIcon' ? rawName.replace(/Icon$/, '') : rawName
  const svgPath = iconPaths[iconKey] || iconPaths['Star']
  const color = element.iconColor || '#ffffff'
  const sw = element.iconStrokeWidth || 2
  const iconWrapperStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  return (
    <div style={iconWrapperStyle}>
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: svgPath }}
      />
    </div>
  )
}
