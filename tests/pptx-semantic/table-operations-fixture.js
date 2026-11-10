export function document() {
  return {
    schemaVersion: 1,
    componentId: 'table',
    properties: { firstRow: true },
    columns: [0, 1, 2].map((c) => ({ componentId: `col${c}`, widthEmu: 900001 + c })),
    rows: [0, 1, 2].map((r) => ({
      componentId: `row${r}`,
      heightEmu: 400001 + r,
      cells: [0, 1, 2].map((c) => {
        const id = `cell${r}${c}`
        return {
          componentId: id,
          merge: {},
          anchorCellId: id,
          properties: { marginLeftEmu: r + c },
          textDocument: {
            schemaVersion: 1,
            componentId: `${id}:body`,
            body: { wrap: true },
            paragraphs: [
              {
                componentId: `${id}:p`,
                properties: { alignment: 'r' },
                runs: [
                  {
                    componentId: `${id}:r`,
                    kind: 'text',
                    text: ` ${id} `,
                    properties: { bold: true, fontSizePt: 12.34 },
                  },
                ],
              },
            ],
          },
        }
      }),
    })),
  }
}

export const merge = {
  type: 'mergeCells',
  startRow: 0,
  startColumn: 0,
  rowSpan: 2,
  columnSpan: 2,
}
