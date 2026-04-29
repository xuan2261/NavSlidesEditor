# Parser Execution Matrix

| Parser | Deck | Parse | Slides | Text | Images | Shapes | Tables | Media | Notes | Time ms | Peak RSS MB | Raw MB | Verdict |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| pptxtojson | Bai_2_1.pptx | ok | 41 | 207 | 27 | 161 | 5 | 27 | 0 | 607 | 88.85 | 1.25 | pass |
| pptxtojson | Bai_2_2.pptx | ok | 39 | 294 | 2 | 277 | 15 | 2 | 1 | 902 | 91.14 | 2.78 | pass |
| pptxtojson | Bai_2_5.pptx | ok | 45 | 267 | 31 | 335 | 18 | 31 | 4 | 873 | 95.11 | 2.48 | pass |
| pptxtojson | STTre_Duc.pptx | ok | 20 | 90 | 28 | 193 | 0 | 28 | 15 | 476 | 87.65 | 0.63 | pass |
| pptx2json | Bai_2_1.pptx | ok | 41 | 1684 | 33 | 46 | 5 | 43 | 0 | 1300 | 98.24 | 24.87 | partial |
| pptx2json | Bai_2_2.pptx | ok | 39 | 2921 | 34 | 87 | 15 | 35 | 1 | 2943 | 122.9 | 66.55 | partial |
| pptx2json | Bai_2_5.pptx | ok | 45 | 3347 | 46 | 102 | 18 | 63 | 4 | 2118 | 122.09 | 47.39 | partial |
| pptx2json | STTre_Duc.pptx | ok | 20 | 486 | 23 | 20 | 0 | 15 | 15 | 961 | 95.74 | 16.28 | partial |
| ppt-parser | Bai_2_1.pptx | ok | 41 | 125 | 27 | 79 | 5 | 27 | 0 | 745 | 95.08 | 1.06 | pass |
| ppt-parser | Bai_2_2.pptx | ok | 39 | 216 | 2 | 199 | 15 | 2 | 0 | 1144 | 99.74 | 1.86 | pass |
| ppt-parser | Bai_2_5.pptx | ok | 45 | 177 | 31 | 245 | 18 | 31 | 0 | 1018 | 93.48 | 1.99 | pass |
| ppt-parser | STTre_Duc.pptx | ok | 20 | 30 | 28 | 73 | 0 | 28 | 0 | 661 | 111.89 | 0.52 | pass |
| pptx-compose | Bai_2_1.pptx | ok | 41 | 1684 | 33 | 46 | 5 | 43 | 0 | 1189 | 97.97 | 24.87 | partial |
| pptx-compose | Bai_2_2.pptx | ok | 39 | 2921 | 34 | 87 | 15 | 35 | 1 | 2555 | 118.88 | 66.55 | partial |
| pptx-compose | Bai_2_5.pptx | ok | 45 | 3347 | 46 | 102 | 18 | 63 | 4 | 1894 | 111.33 | 47.39 | partial |
| pptx-compose | STTre_Duc.pptx | ok | 20 | 486 | 23 | 20 | 0 | 15 | 15 | 939 | 92.74 | 16.28 | partial |

## Failure Details

No parser/deck failures.

## Package Versions

| Parser | Version | npm modified |
| --- | --- | --- |
| pptxtojson | 2.0.2 | 2026-04-19T03:23:10.561Z |
| pptx2json | 0.0.10 | 2024-07-07T15:24:30.383Z |
| ppt-parser | 0.0.8 | 2024-12-24T11:33:06.482Z |
| pptx-compose | 1.0.0 | 2022-06-24T12:53:21.439Z |
