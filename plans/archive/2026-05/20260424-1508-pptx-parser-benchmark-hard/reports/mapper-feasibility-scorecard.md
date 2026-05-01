# Mapper Feasibility Scorecard

| Parser | Runs OK | Score | Text | Images | Shapes | Tables | Mapper Complexity | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| pptxtojson | 4/4 | 94/100 | 18/20 | 14/15 | 14/15 | 15/15 | 8/10 | Best semantic candidate if all runs pass. |
| pptx2json | 4/4 | 68/100 | 11/20 | 12/15 | 9/15 | 8/15 | 4/10 | Best raw fallback; preserves package facts. |
| ppt-parser | 4/4 | 86/100 | 18/20 | 14/15 | 14/15 | 15/15 | 8/10 | Secondary semantic challenger. |
| pptx-compose | 4/4 | 68/100 | 11/20 | 12/15 | 9/15 | 8/15 | 4/10 | Older raw baseline. |
