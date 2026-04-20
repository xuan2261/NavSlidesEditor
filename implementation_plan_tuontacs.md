# Nâng cấp Interactive Simulation Templates (Pro & Interactive)

Mục tiêu: Cải tiến, nâng cấp toàn diện 6 Interactive Simulation Templates hiện có trong `scripts/generate-simulation-templates.js`. Thay vì các script cơ bản, chúng ta sẽ áp dụng UI/UX hiện đại (Glassmorphism, Neon Glow), vẽ đồ hoạ Canvas/SVG mượt mà, và thêm các mô đun chuyên sâu để đem đến trải nghiệm "Wow" thực sự cho bài giảng.

## User Review Required

> [!IMPORTANT]  
> Các thay đổi này làm tăng đáng kể dung lượng HTML nhúng của mỗi template. Tuy nhiên, nó hoàn toàn chạy độc lập (Self-contained) không cần thư viện ngoài. Bạn hãy xem qua các thiết kế dự định bên dưới để Confirm hướng tiếp cận nhé!

## Proposed Changes

Chúng ta sẽ di dời các chuỗi HTML nguyên khối ra khỏi file `generate-simulation-templates.js` thành các file độc lập đặt trong một thư mục mới: `scripts/simulations/` (Ví dụ: `sim1_logic.html`, `sim2_rlc.html`). Script chính sẽ đọc nội dung các file này. Điều này giúp dễ maintain và code các chức năng phức tạp.

### 1. Logic Gate Simulator (Kỹ thuật Số)
- **Nâng cấp UI:** Sử dụng giao diện Dark Mode Glassmorphism.
- **Tính năng mới:** Thay vì chỉ hiển thị output của 1 cổng, mô phỏng sẽ hiển thị **Truth Table** (Bảng chân trị) sáng đèn highlight theo trạng thái ngõ vào tương ứng. 
- **Animation:** Đường dẫn tín hiệu (wires) có hiệu ứng stroke-dasharray chớp nháy luồng điện.

### 2. RLC Frequency Response (Lý thuyết mạch)
- **Nâng cấp UI:** Dark dashboard với các Slider có gradient theo hệ màu của linh kiện (R - đỏ, L - xanh dương, C - xanh lá).
- **Tính năng mới (Split Screen):** Kết hợp kết quả của miền tần số (Bode Plot) và **miền thời gian (Oscilloscope / Màn hình dao động ký)**. Khi người dùng nhập sR, sL, sC, sẽ thấy được đáp ứng bước (Step response) thời gian thực của mạch.
- **Interactive:** Hover vào Bode Plot sẽ hiện toạ độ Gain & Phase ngay tại chuột.

### 3. PID Controller Tuning (Tự động hoá)
- **Tính năng mới (Vật lý mô phỏng):** Thêm một mô hình vật lý trực quan thay vì chỉ nhìn đồ thị. Chúng ta sẽ hiển thị hình ảnh một **Quadcopter (Drone) 2D bay lên độ cao Setpoint**. 
- Nếu PID chỉnh tồi: Drone sẽ dao động quá mức, vọt lố (Overshoot) đập trần hoặc rơi tự do.
- Nếu PID tốt: Drone bay tới Setpoint mượt mà, hovering ổn định.
- **Biểu đồ:** Biểu đồ chạy liên tục (Real-time tracking) với Error, Control Signal (u) được vẽ trực tiếp như ECG.

### 4. Bode Plot Generator (Mạch & Tự động hoá)
- **Nâng cấp công năng:** Giao diện tính toán Margins. Tự động hiển thị đường đánh dấu **Gain Margin (GM)** và **Phase Margin (PM)** lên biểu đồ.
- **Nhập liệu linh hoạt:** Hỗ trợ tính năng "Click to add Pole/Zero" (thêm cực/zero) trên mặt phẳng S-plane thu nhỏ để xem Bode Plot thay đổi tức thời.

### 5. 3-Phase Power System (Kỹ thuật Điện / Máy điện)
- **Tính năng "Máy điện":** Bên cạnh đồ thị sóng và vector quay, thêm đồ hoạ một mặt cắt **Stator của động cơ không đồng bộ 3 pha**. Các cực từ sẽ được tô màu intensity thay đổi theo giá trị điện áp tức thời.
- **Rotating Magnetic Field:** Vẽ một mũi tên từ trường quay tổng hợp (B) minh hoạ rõ ràng hiện tượng từ trường quay – trái tim của máy điện.

### 6. Gear Train Simulator (Cơ khí & Kỹ thuật)
- **Đồ hoạ:** Thay vì hình tròn cắt đơn giản, vẽ chi tiết đường thân khai (Involute curve geometry) của **răng bánh răng**. Bóng đổ 3D shadow map để bánh răng nhìn nổi và kim loại.
- **Planetary Gear (Bánh răng hành tinh):** Bổ sung tuỳ chọn mô phỏng hệ bánh răng hành tinh (Sun, Planet, Ring), tính năng "cố định Sun gear" hoặc "cố định Ring gear" để sinh viên tự do quan sát tỷ số truyền đảo chiều.

## Implementation Steps

1. Tạo thư mục `scripts/simulations/`.
2. Viết 6 file HTML (mỗi file tích hợp HTML, CSS nâng cao, JS canvas logic hiện đại).
3. Chỉnh sửa `scripts/generate-simulation-templates.js` đọc `fs.readFileSync` từ các file HTML thay vì string templates code gốc.
4. Chạy script để generate cục `built-in-templates.json`.
5. Đóng gói & Xác nhận tính năng trên Slides Browser.

## Verification Plan
### Automated Tests
- Đảm bảo `node scripts/generate-simulation-templates.js` thực thi không lỗi.
- File HTML embeds có dung lượng giới hạn hợp lý (dưới 50KB/file minify nếu có thể).

### Manual Verification
- Render thử trên Slides Platform App. 
- Kéo thử slider PID để xem "Drone" bay.
- Chỉnh sZ1, sZ2 xem chi tiết bánh răng ăn khớp.
