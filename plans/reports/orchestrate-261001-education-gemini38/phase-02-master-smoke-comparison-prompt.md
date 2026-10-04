# Kongming failed verification checkpoint — real master smoke comparison
Explicit local52186/gpt-6.1-sol installed kongming role, read/glob/grep only; no Gemini/model switch/delegation/commands/tests/build/lint/browser/edits/questions. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Parent stops source edits and further diagnosis pending counsel.

Bounded master/history/group/connector repair implemented after your design GO. Expected-RED recorded:10 failed/21pass for exact source causes; GREEN31tests plus2layout and5actualEditorPage history tests =38PASS. History callback uses restored snapshot and normalizes clamped/invalid child address through new utils/history-authoring-slide.js. Explicit lock intent admitted locally inside presentation updater. No geometry/UI policy changes.

Actual managed editor smoke succeeded: Design -> Open Layout Manager -> Edit master Safety master -> Selection Pane -> Shift-select master-a/master-b -> Shape Format -> Enter Align Left. DOM X became [100,100,250,700]. Immediate Undo restored [100,400] and retained master banner +2selected. Redo then real X position=0 resulted [0,0,250,700] and2selected. API persistence confirms [0,0,250,700] and stored lock metadata [true,false,true,ABSENT]; reload/reenter master confirms same coordinates. Screenshot exists.

FAILED invariant proof: parent compared JSON.stringify(persisted.slides)===JSON.stringify(raw PUT fixture.slides) and likewise otherMaster. Both FALSE. Raw request is not a captured canonical loaded baseline; string comparison is order-sensitive. Canonical pre-UI PUT response still available unconsumed in parent host kernel. No diagnosis made after those booleans. Need advice before any correction: establish whether this is normalization/comparison-boundary error versus real unintended mutation. Do not waive sentinel invariants. Proposed read-only first step: compare actual persisted sentinels against canonical pre-UI PUT response with deep structural equality and enumerate field differences. If legitimate load migrations prevent that baseline comparison, use fresh fixture, load and capture settled API baseline BEFORE any gesture, then same exact smoke and structural sentinel equality. Keep original failure receipt.

Exact captured expected raw sentinels:
{
  "slides": [
    {
      "id": "parent",
      "background": {
        "type": "color",
        "color": "#ffffff"
      },
      "elements": [
        {
          "id": "a",
          "name": "Shape A",
          "type": "shape",
          "shape": "rect",
          "x": 100,
          "y": 50,
          "width": 200,
          "height": 100,
          "fill": "#4f46e5",
          "stroke": "#111111",
          "strokeWidth": 2,
          "text": "A"
        },
        {
          "id": "b",
          "name": "Shape B",
          "type": "shape",
          "shape": "rect",
          "x": 400,
          "y": 100,
          "width": 100,
          "height": 100,
          "fill": "#16a34a",
          "stroke": "#111111",
          "strokeWidth": 2,
          "text": "B"
        },
        {
          "id": "c",
          "name": "Shape C",
          "type": "shape",
          "shape": "rect",
          "x": 250,
          "y": 200,
          "width": 80,
          "height": 60,
          "fill": "#f59e0b",
          "stroke": "#111111",
          "strokeWidth": 2,
          "text": "C"
        }
      ],
      "children": [
        {
          "id": "child",
          "background": {
            "type": "color",
            "color": "#f8fafc"
          },
          "elements": [
            {
              "id": "child-a",
              "name": "Child A",
              "type": "shape",
              "shape": "rect",
              "x": 100,
              "y": 50,
              "width": 200,
              "height": 100,
              "fill": "#4f46e5",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "A"
            },
            {
              "id": "child-b",
              "name": "Child B",
              "type": "shape",
              "shape": "rect",
              "x": 400,
              "y": 100,
              "width": 100,
              "height": 100,
              "fill": "#16a34a",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "B"
            },
            {
              "id": "child-c",
              "name": "Child C",
              "type": "shape",
              "shape": "rect",
              "x": 250,
              "y": 200,
              "width": 80,
              "height": 60,
              "fill": "#f59e0b",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "C"
            }
          ]
        },
        {
          "id": "sibling",
          "background": {
            "type": "color",
            "color": "#ffffff"
          },
          "elements": [
            {
              "id": "sibling-guard",
              "name": "Sibling guard",
              "type": "shape",
              "shape": "rect",
              "x": 100,
              "y": 50,
              "width": 200,
              "height": 100,
              "fill": "#4f46e5",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "A"
            }
          ]
        }
      ]
    }
  ],
  "otherMaster": {
    "id": "other-master",
    "name": "Other master",
    "placeholders": [],
    "fixedElements": [
      {
        "id": "other-guard",
        "name": "Shape A",
        "type": "shape",
        "shape": "rect",
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 100,
        "fill": "#4f46e5",
        "stroke": "#111111",
        "strokeWidth": 2,
        "text": "A",
        "locked": true
      }
    ]
  }
}
Exact actual persisted sentinels:
{
  "slides": [
    {
      "id": "parent",
      "elements": [
        {
          "id": "a",
          "type": "shape",
          "x": 100,
          "y": 50,
          "width": 200,
          "height": 100,
          "name": "Shape A",
          "shape": "rect",
          "fill": "#4f46e5",
          "stroke": "#111111",
          "strokeWidth": 2,
          "text": "A"
        },
        {
          "id": "b",
          "type": "shape",
          "x": 400,
          "y": 100,
          "width": 100,
          "height": 100,
          "name": "Shape B",
          "shape": "rect",
          "fill": "#16a34a",
          "stroke": "#111111",
          "strokeWidth": 2,
          "text": "B"
        },
        {
          "id": "c",
          "type": "shape",
          "x": 250,
          "y": 200,
          "width": 80,
          "height": 60,
          "name": "Shape C",
          "shape": "rect",
          "fill": "#f59e0b",
          "stroke": "#111111",
          "strokeWidth": 2,
          "text": "C"
        }
      ],
      "notes": "",
      "background": {
        "type": "color",
        "color": "#ffffff"
      },
      "children": [
        {
          "id": "child",
          "elements": [
            {
              "id": "child-a",
              "type": "shape",
              "x": 100,
              "y": 50,
              "width": 200,
              "height": 100,
              "name": "Child A",
              "shape": "rect",
              "fill": "#4f46e5",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "A"
            },
            {
              "id": "child-b",
              "type": "shape",
              "x": 400,
              "y": 100,
              "width": 100,
              "height": 100,
              "name": "Child B",
              "shape": "rect",
              "fill": "#16a34a",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "B"
            },
            {
              "id": "child-c",
              "type": "shape",
              "x": 250,
              "y": 200,
              "width": 80,
              "height": 60,
              "name": "Child C",
              "shape": "rect",
              "fill": "#f59e0b",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "C"
            }
          ],
          "notes": "",
          "background": {
            "type": "color",
            "color": "#f8fafc"
          }
        },
        {
          "id": "sibling",
          "elements": [
            {
              "id": "sibling-guard",
              "type": "shape",
              "x": 100,
              "y": 50,
              "width": 200,
              "height": 100,
              "name": "Sibling guard",
              "shape": "rect",
              "fill": "#4f46e5",
              "stroke": "#111111",
              "strokeWidth": 2,
              "text": "A"
            }
          ],
          "notes": "",
          "background": {
            "type": "color",
            "color": "#ffffff"
          }
        }
      ]
    }
  ],
  "otherMaster": {
    "id": "other-master",
    "name": "Other master",
    "fixedElements": [
      {
        "id": "other-guard",
        "type": "shape",
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 100,
        "name": "Shape A",
        "shape": "rect",
        "fill": "#4f46e5",
        "stroke": "#111111",
        "strokeWidth": 2,
        "text": "A",
        "locked": true
      }
    ],
    "placeholders": []
  }
}

No source fix proposed without demonstrated mutation. Advise GO/no-go for discrimination/comparison correction and smallest scope. Distinguish assertion setup failures from acceptance; no Phase02 completion. All16phases retained, no commit/push/deploy.