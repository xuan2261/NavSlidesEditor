import React from 'react'
import { cn } from '../../lib/utils'
import { useRibbonDensity } from './ribbon-density-context'
import RibbonOverflowGroupMenu from './ribbon-overflow-group-menu'

const RibbonTabContentRow = React.forwardRef(function RibbonTabContentRow(
  { children, className, ...props },
  ref
) {
  const density = useRibbonDensity()
  const sections = React.Children.toArray(children)
  const directCount = density === 'compact' ? 3 : density === 'condensed' ? 4 : sections.length

  return (
    <div
      ref={ref}
      data-ribbon-content-row
      className={cn(
        'flex h-full w-full min-w-0 flex-[1_1_100%] items-stretch gap-0 overflow-x-hidden',
        className
      )}
      {...props}
    >
      {sections.map((section, index) => {
        if (!React.isValidElement(section) || !section.props.label) return section
        const sectionIndex = sections
          .slice(0, index)
          .filter((candidate) => React.isValidElement(candidate) && candidate.props.label).length
        const isDirect = section.props.alwaysDirect || sectionIndex < directCount
        return isDirect ? (
          section
        ) : (
          <RibbonOverflowGroupMenu key={section.key || section.props.label} label={section.props.label}>
            {section}
          </RibbonOverflowGroupMenu>
        )
      })}
    </div>
  )
})

export default RibbonTabContentRow
