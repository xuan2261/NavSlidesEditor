import RibbonHeaderBar from './ribbon-header-bar'
import RibbonPanel from './ribbon-panel'

export default function RibbonShell(props) {
  return (
    <>
      <RibbonHeaderBar {...props} />
      <RibbonPanel {...props} />
    </>
  )
}
