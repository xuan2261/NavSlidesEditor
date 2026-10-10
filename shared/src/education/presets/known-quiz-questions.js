const { createCanonicalQuestion } = require('../question-factory.js')
const option = (id, text) => ({ id, text })
const feedback = (correct, incorrect, explanation = correct) => ({
  correct,
  incorrect,
  explanation,
})
const question = (id, kind, prompt, payload) =>
  createCanonicalQuestion({ id, kind, prompt, points: 10, timeLimit: null, ...payload })

const ohm = question(
  'quiz-multiple-choice/ohm',
  'single-choice',
  'Câu 1: Định luật Ohm được biểu diễn bằng công thức nào?',
  {
    options: ['A. P = U × I', 'B. U = I × R', 'C. F = m × a', 'D. E = mc²'].map((text, i) =>
      option(`ohm-${i + 1}`, text)
    ),
    answerKey: { optionId: 'ohm-2' },
    feedback: feedback(
      '✅ Chính xác! U = I × R là công thức của định luật Ohm.',
      '❌ Sai rồi. Đáp án đúng là B.'
    ),
  }
)
const binary = question(
  'quiz-multiple-choice/binary',
  'single-choice',
  'Câu 2: Số thập phân 10 chuyển sang hệ nhị phân là gì?',
  {
    options: ['A. 1010', 'B. 1100', 'C. 1001', 'D. 0101'].map((text, i) =>
      option(`binary-${i + 1}`, text)
    ),
    answerKey: { optionId: 'binary-1' },
    feedback: feedback(
      '✅ Chính xác! 10 = 8 + 2 = 1010 (nhị phân).',
      '❌ Sai rồi. Đáp án đúng là A.'
    ),
  }
)
const trueFalse = [
  ['1. Trái Đất xoay quanh Mặt Trời.', true, 'Trái Đất xoay quanh Mặt Trời.'],
  [
    '2. Nước sôi ở 100°C trong mọi điều kiện áp suất.',
    false,
    'Nước sôi ở 100°C ở áp suất khí quyển chuẩn, nhưng ở vùng núi cao áp suất thấp, nước sôi ở nhiệt độ thấp hơn.',
  ],
  ['3. Ánh sáng di chuyển nhanh hơn âm thanh.', true, 'Ánh sáng di chuyển nhanh hơn âm thanh.'],
  [
    '4. CPU là bộ nhớ chính của máy tính.',
    false,
    'CPU là bộ vi xử lý trung tâm, RAM mới là bộ nhớ chính.',
  ],
].map(([prompt, value, explanation], i) =>
  question(`quiz-true-false/statement-${i + 1}`, 'true-false', prompt, {
    answerKey: { value },
    feedback: feedback('Chính xác!', 'Sai rồi.', explanation),
  })
)
const fill = [
  question(
    'quiz-fill-blank/protocol',
    'fill-blank',
    'Internet là một mạng lưới máy tính toàn cầu kết nối với nhau sử dụng bộ giao thức ____.',
    {
      answerKey: { accepted: ['TCP/IP', 'TCP IP'], caseSensitive: false },
      feedback: feedback('Ô 1: TCP/IP', 'Đáp án đúng: TCP/IP'),
    }
  ),
  question(
    'quiz-fill-blank/wireless',
    'fill-blank',
    'Hệ thống này bao gồm hàng triệu mạng tư nhân, công cộng, học thuật, doanh nghiệp và chính phủ, được liên kết bởi một mảng rộng lớn các công nghệ mạng điện tử, ____ và quang học.',
    {
      answerKey: { accepted: ['không dây', 'khong day', 'wireless'], caseSensitive: false },
      feedback: feedback('Ô 2: không dây', 'Đáp án đúng: không dây'),
    }
  ),
]
const ordering = question(
  'quiz-ordering/sdlc',
  'ordering',
  'Sắp xếp các bước phát triển phần mềm (SDLC): Click theo thứ tự',
  {
    options: [
      option('sdlc-design', 'Thiết kế (Design)'),
      option('sdlc-maintenance', 'Bảo trì (Maintenance)'),
      option('sdlc-requirements', 'Phân tích yêu cầu (Requirement Analysis)'),
      option('sdlc-testing', 'Kiểm thử (Testing)'),
      option('sdlc-implementation', 'Lập trình (Implementation)'),
    ],
    answerKey: {
      itemIds: [
        'sdlc-requirements',
        'sdlc-design',
        'sdlc-implementation',
        'sdlc-testing',
        'sdlc-maintenance',
      ],
    },
    feedback: feedback(
      'Đúng thứ tự!',
      'Hãy sắp xếp lại.',
      'Phân tích yêu cầu → Thiết kế → Lập trình → Kiểm thử → Bảo trì.'
    ),
  }
)
const matching = question(
  'quiz-matching/languages',
  'matching',
  'Nối ngôn ngữ lập trình với đặc điểm nổi bật',
  {
    options: {
      left: ['Python', 'JavaScript', 'C++', 'SQL'].map((text, i) =>
        option(`language-${i + 1}`, text)
      ),
      right: [
        'Chạy trên trình duyệt web',
        'Hiệu năng cao, dùng làm game engine',
        'Cú pháp dễ đọc, phổ biến trong AI',
        'Truy vấn và thao tác cơ sở dữ liệu',
      ].map((text, i) => option(`feature-${i + 1}`, text)),
    },
    answerKey: {
      pairs: [3, 1, 2, 4].map((right, i) => ({
        leftId: `language-${i + 1}`,
        rightId: `feature-${right}`,
      })),
    },
    feedback: feedback(
      '🎉 Chúc mừng bạn đã hoàn thành!',
      'Cặp chưa đúng. Hãy thử lại.',
      'Python: AI; JavaScript: trình duyệt; C++: game engine; SQL: cơ sở dữ liệu.'
    ),
  }
)
const KNOWN_QUIZ_QUESTIONS = Object.freeze({
  'quiz-multiple-choice': [[ohm], [binary]],
  'quiz-true-false': [trueFalse],
  'quiz-fill-blank': [fill],
  'quiz-ordering': [[ordering]],
  'quiz-matching': [[matching]],
})
module.exports = { KNOWN_QUIZ_QUESTIONS }
