import { Button, Select } from '../ui'
import geometryRecords from 'revealjs-shared/src/pptx-geometry-style-records.js'
import geometryStyles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import connectors from 'revealjs-shared/src/pptx-semantic-connectors.js'
import { semanticInstances, semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

export default function ConnectorProperties({ instance, document, editable, submit }) {
  const definition = geometryRecords.geometryProvider(document, instance).definition
  const attachable =
    connectors.connectorEndpointLocators(
      geometryStyles.structuralGeometry(document, instance.id)
    ) !== null
  const targets = Array.from(semanticInstances(document), ([, target]) => target).filter((target) => {
    const source = geometryRecords.geometryProvider(document, target).definition
    const geometry = geometryStyles.structuralGeometry(document, target.id)
    return (
      target.slideId === instance.slideId &&
      !target.lineage?.tombstone &&
      !target.lineage?.paintOnly &&
      geometry?.connector === undefined &&
      source.source?.partUri === definition.source.partUri &&
      JSON.stringify(connectors.providerPlacement(document, target)) ===
        JSON.stringify(connectors.providerPlacement(document, instance)) &&
      geometry?.connections?.length > 0
    )
  })
  return (
    <div className="flex flex-col gap-2">
      {!attachable && (
        <p className="text-xs text-text-secondary">
          This route cannot bind endpoints; geometry points remain editable.
        </p>
      )}
      {['start', 'end'].map((end) => {
        const binding = instance.connectorBindings[end]
        const target = binding && semanticInstance(document, binding.targetInstanceId)
        const geometry = target && geometryStyles.structuralGeometry(document, target.id)
        return (
          <div key={end} className="flex flex-col gap-1 text-xs text-text-secondary">
            <label>
              Connector {end} target
              <Select
                aria-label={`Connector ${end} target`}
                disabled={!editable || !attachable}
                value={binding?.targetInstanceId ?? ''}
                onChange={(event) =>
                  submit(
                    event.target.value
                      ? {
                          type: 'connector-attach',
                          end,
                          targetInstanceId: event.target.value,
                          index: 0,
                        }
                      : { type: 'connector-detach', end }
                  )
                }
              >
                <option value="">Unattached</option>
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    Shape {semanticDefinition(document, item.definitionId)?.source?.nativeId}
                  </option>
                ))}
              </Select>
            </label>
            {binding && (
              <>
                <label>
                  Connector {end} site
                  <Select
                    aria-label={`Connector ${end} site`}
                    disabled={!editable}
                    value={String(binding.index)}
                    onChange={(event) =>
                      submit({
                        type: 'connector-attach',
                        end,
                        targetInstanceId: binding.targetInstanceId,
                        index: Number(event.target.value),
                      })
                    }
                  >
                    {geometry.connections.map((site, index) => (
                      <option key={site.componentId} value={index}>
                        Site {index + 1}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button
                  disabled={!editable}
                  onClick={() => submit({ type: 'connector-detach', end })}
                >
                  Detach connector {end}
                </Button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
