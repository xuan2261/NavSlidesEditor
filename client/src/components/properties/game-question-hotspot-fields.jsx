import QuestionOptionList from './game-question-option-list'
import {
  buttonClass,
  ItemSelect,
  moveItem,
  NumericField,
  RowActions,
  SelectField,
} from './game-question-controls'

function changeRegionShape(region, shape) {
  if (shape === region.shape) return region
  if (shape === 'circle')
    return {
      id: region.id,
      shape,
      cx: region.x + region.width / 2,
      cy: region.y + region.height / 2,
      r: Math.min(region.width, region.height) / 2,
    }
  return {
    id: region.id,
    shape,
    x: region.cx - region.r,
    y: region.cy - region.r,
    width: region.r * 2,
    height: region.r * 2,
  }
}

export default function HotspotQuestionFields({ value, onChange }) {
  const options = value.options || []
  const regions = value.answerKey.regions || []
  const setRegions = (next) => onChange({ ...value, answerKey: { regions: next } })
  const patchRegion = (index, patch) =>
    setRegions(
      regions.map((region, position) => (position === index ? { ...region, ...patch } : region))
    )
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">
          Candidate region labels (public)
        </legend>
        <p className="text-xs text-text-muted">
          Give every candidate region a neutral descriptive label for keyboard and text selection,
          including incorrect candidates. Labels must not disclose correctness.
        </p>
        <QuestionOptionList
          noun="region label"
          media={false}
          options={options}
          onChange={(next) => onChange({ ...value, options: next })}
        />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Correct regions (private)</legend>
        <p className="text-xs text-text-muted">
          Coordinates are fractions of image size: 0 at the top/left and 1 at the bottom/right. The
          entire rectangle or circle must fit inside the image. Deleting a label requires explicitly
          repairing its correct region.
        </p>
        {regions.map((region, index) => (
          <fieldset key={index} className="rounded border border-border p-2 space-y-2">
            <legend className="text-xs font-medium text-text-primary">
              Correct region {index + 1}
            </legend>
            <ItemSelect
              label={`Correct region ${index + 1} label`}
              path={['answerKey', 'regions', index, 'id']}
              value={region.id}
              options={options}
              onChange={(id) => patchRegion(index, { id })}
            />
            <SelectField
              label={`Correct region ${index + 1} shape`}
              path={['answerKey', 'regions', index, 'shape']}
              value={region.shape}
              onChange={(shape) =>
                setRegions(
                  regions.map((item, position) =>
                    position === index ? changeRegionShape(item, shape) : item
                  )
                )
              }
            >
              <option value="rect">Rectangle</option>
              <option value="circle">Circle</option>
            </SelectField>
            <div className="grid grid-cols-2 gap-2">
              {(region.shape === 'circle' ? ['cx', 'cy', 'r'] : ['x', 'y', 'width', 'height']).map(
                (coordinate) => (
                  <NumericField
                    key={coordinate}
                    label={`Correct region ${index + 1} ${coordinate}`}
                    path={['answerKey', 'regions', index, coordinate]}
                    value={region[coordinate]}
                    min={0}
                    max={1}
                    onChange={(number) => patchRegion(index, { [coordinate]: number })}
                  />
                )
              )}
            </div>
            <p className="text-xs text-text-muted">
              {region.shape === 'circle'
                ? 'cx/cy = center, r = radius (greater than 0).'
                : 'x/y = upper-left corner, width/height = size (greater than 0).'}
            </p>
            <RowActions
              label={`correct region ${index + 1}`}
              index={index}
              count={regions.length}
              onMove={(offset) => setRegions(moveItem(regions, index, offset))}
              onDelete={() => setRegions(regions.filter((_, position) => position !== index))}
            />
          </fieldset>
        ))}
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            setRegions([
              ...regions,
              { id: '', shape: 'rect', x: 0.1, y: 0.1, width: 0.25, height: 0.25 },
            ])
          }
        >
          Add correct region
        </button>
      </fieldset>
    </div>
  )
}
