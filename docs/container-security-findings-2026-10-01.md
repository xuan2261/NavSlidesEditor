# 71 finding bảo mật container — NavSlidesEditor

## Phạm vi và ý nghĩa

- Đây là bản chụp bằng chứng của CI đã merge, không phải scan mới hay kết luận kiểm thử xâm nhập.
- **71 finding = 71 cặp CVE–package trong image** (cùng một CVE có thể xuất hiện trên nhiều package). Tổng cộng **33 CVE khác nhau, 26 package, 3 CRITICAL và 68 HIGH**.
- Cả 71 finding thuộc lớp package hệ điều hành Debian. Trong report này không có finding HIGH/CRITICAL còn lại ở lớp dependency Node.js.
- `risk-accepted` / `advisory` nghĩa là người vận hành chấp thuận rủi ro còn lại cho phạm vi private single-user self-hosting đã lựa chọn. CI xanh chỉ chứng minh tuân thủ chính sách; **không chứng minh image không có lỗ hổng**.
- Mức độ CRITICAL/HIGH và mô tả dưới đây là dữ liệu Trivy/advisory, chưa xác minh từng đường khai thác có thực sự reachable trong cấu hình NavSlidesEditor hay không. Package có mặt không đồng nghĩa dịch vụ hoặc tính năng dễ bị khai thác đang bật.
- Cột “bản vá” ghi theo `FixedVersion` trong report. Giá trị không cung cấp **không có nghĩa upstream chưa có bản vá**; scanner Debian có thể phân loại khác binary upstream (đặc biệt rclone). Không tự coi các finding còn lại là false positive.

## Nguồn bằng chứng

- [CI trên master, run 36756667471](https://github.com/xuan2261/NavSlidesEditor/actions/runs/36756667471).
- [Artifact container-supply-chain](https://github.com/xuan2261/NavSlidesEditor/actions/runs/36756667471/artifacts/11116669369): `container-trivy.json`, `container-supply-chain-receipt.json`, `container-sbom.spdx.json`, `container-os-packages.txt`.
- Source commit: `5e324699318da8cd2950e80f6a2d0057cd3d7d33`.
- Image digest theo receipt: `sha256:a60ce393b5f7cd5cfd3e0bc88d81c43240c53a51815e27e3d631f9d754cd69f1`.
- Thời điểm scan UTC theo report: `2026-09-30T18:16:54.854868712Z`; Trivy `0.74.0`; target `navslides-editor:ci (debian 13.7)`.
- SHA-256 report (đã đối chiếu với receipt): `sha256:49a2f847a006af790db41c59ca4d5af7e0fd57aa6cd7ce3134f5482b9bb94d9c`.
- [Chính sách tại commit đã scan](https://github.com/xuan2261/NavSlidesEditor/blob/5e324699318da8cd2950e80f6a2d0057cd3d7d33/config/container-vulnerability-policy.json).

## Ba finding CRITICAL

| CVE | Package | Mô tả rủi ro theo advisory |
|---|---|---|
| CVE-2026-41176 | rclone 1.75.1 | Truy cập trái phép chức năng quản trị qua endpoint Remote Control không xác thực. |
| CVE-2026-41179 | rclone 1.75.1 | Thực thi lệnh cục bộ không xác thực qua endpoint RC bị phơi bày. |
| CVE-2026-6653 | libxml2 | Use-after-free khi xử lý XML được chế tạo, gây từ chối dịch vụ theo tiêu đề scanner. |

## Thống kê theo package

| Package | CRITICAL | HIGH | Tổng finding |
|---|---:|---:|---:|
| `bsdutils` | 0 | 4 | 4 |
| `libacl1` | 0 | 1 | 1 |
| `libblkid1` | 0 | 4 | 4 |
| `libcups2t64` | 0 | 1 | 1 |
| `libexpat1` | 0 | 4 | 4 |
| `liblastlog2-2` | 0 | 4 | 4 |
| `libmount1` | 0 | 4 | 4 |
| `libsmartcols1` | 0 | 4 | 4 |
| `libsystemd0` | 0 | 1 | 1 |
| `libtinfo6` | 0 | 1 | 1 |
| `libudev1` | 0 | 1 | 1 |
| `libuuid1` | 0 | 4 | 4 |
| `libx11-6` | 0 | 1 | 1 |
| `libx11-data` | 0 | 1 | 1 |
| `libx11-xcb1` | 0 | 1 | 1 |
| `libxml2` | 1 | 7 | 8 |
| `libxrender1` | 0 | 1 | 1 |
| `login` | 0 | 4 | 4 |
| `mount` | 0 | 4 | 4 |
| `ncurses-base` | 0 | 1 | 1 |
| `ncurses-bin` | 0 | 1 | 1 |
| `perl-base` | 0 | 1 | 1 |
| `rclone` | 2 | 7 | 9 |
| `util-linux` | 0 | 4 | 4 |
| `xserver-common` | 0 | 1 | 1 |
| `xvfb` | 0 | 1 | 1 |
| **Tổng** | **3** | **68** | **71** |

## Danh sách đầy đủ 71 finding

Giữ thứ tự CVE/package trong receipt. Mô tả giữ nguyên tiêu đề scanner để không suy diễn thêm. `affected`: scanner đánh dấu bị ảnh hưởng; `fix_deferred`: nguồn scanner đánh dấu hoãn sửa. Mọi dòng đều chưa được remediated theo receipt.

| # | Mức độ | CVE / nguồn | Package | Phiên bản trong image | Trạng thái / bản vá theo scan | Mô tả theo scanner |
|---:|---|---|---|---|---|---|
| 1 | HIGH | [CVE-2023-5574](https://avd.aquasec.com/nvd/cve-2023-5574) | `xserver-common` | `2:21.1.16-1.3+deb13u4` | `fix_deferred`; không cung cấp FixedVersion | xorg-x11-server: Use-after-free bug in DamageDestroy |
| 2 | HIGH | [CVE-2023-5574](https://avd.aquasec.com/nvd/cve-2023-5574) | `xvfb` | `2:21.1.16-1.3+deb13u4` | `fix_deferred`; không cung cấp FixedVersion | xorg-x11-server: Use-after-free bug in DamageDestroy |
| 3 | HIGH | [CVE-2025-69720](https://avd.aquasec.com/nvd/cve-2025-69720) | `libtinfo6` | `6.5+20250216-2` | `affected`; không cung cấp FixedVersion | ncurses: ncurses: Buffer overflow vulnerability may lead to arbitrary code execution. |
| 4 | HIGH | [CVE-2025-69720](https://avd.aquasec.com/nvd/cve-2025-69720) | `ncurses-base` | `6.5+20250216-2` | `affected`; không cung cấp FixedVersion | ncurses: ncurses: Buffer overflow vulnerability may lead to arbitrary code execution. |
| 5 | HIGH | [CVE-2025-69720](https://avd.aquasec.com/nvd/cve-2025-69720) | `ncurses-bin` | `6.5+20250216-2` | `affected`; không cung cấp FixedVersion | ncurses: ncurses: Buffer overflow vulnerability may lead to arbitrary code execution. |
| 6 | HIGH | [CVE-2026-16742](https://avd.aquasec.com/nvd/cve-2026-16742) | `libsystemd0` | `257.13-1~deb13u1` | `affected`; không cung cấp FixedVersion | systemd: systemd-homed: Local privilege escalation via missing home-record signature verification |
| 7 | HIGH | [CVE-2026-16742](https://avd.aquasec.com/nvd/cve-2026-16742) | `libudev1` | `257.13-1~deb13u1` | `affected`; không cung cấp FixedVersion | systemd: systemd-homed: Local privilege escalation via missing home-record signature verification |
| 8 | HIGH | [CVE-2026-34980](https://avd.aquasec.com/nvd/cve-2026-34980) | `libcups2t64` | `2.4.10-3+deb13u2` | `affected`; không cung cấp FixedVersion | cups: OpenPrinting CUPS: Shared PostScript queue lets anonymous Print-Job requests reach `lp` code execution over the network |
| 9 | CRITICAL | [CVE-2026-41176](https://avd.aquasec.com/nvd/cve-2026-41176) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | github.com/rclone/rclone: Rclone: Unauthorized access to administrative functions through unauthenticated Remote Control endpoint. |
| 10 | CRITICAL | [CVE-2026-41179](https://avd.aquasec.com/nvd/cve-2026-41179) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | github.com/rclone/rclone: Rclone: Unauthenticated local command execution via exposed RC endpoint |
| 11 | HIGH | [CVE-2026-49980](https://avd.aquasec.com/nvd/cve-2026-49980) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | github.com/rclone/rclone: Rclone: Remote Code Execution via unauthenticated requests when `rcd --rc-serve` is enabled |
| 12 | HIGH | [CVE-2026-54369](https://avd.aquasec.com/nvd/cve-2026-54369) | `libacl1` | `2.3.2-2+b1` | `affected`; không cung cấp FixedVersion | acl: Symlink traversal privilege escalation via libacl functions |
| 13 | HIGH | [CVE-2026-54572](https://avd.aquasec.com/nvd/cve-2026-54572) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | rclone: Rclone: Arbitrary file write via malicious symbolic link handling |
| 14 | HIGH | [CVE-2026-66046](https://avd.aquasec.com/nvd/cve-2026-66046) | `libexpat1` | `2.8.3-1~deb13u1` | `affected`; không cung cấp FixedVersion | expat: Expat: Denial of Service via quadratic complexity in attribute processing |
| 15 | CRITICAL | [CVE-2026-6653](https://avd.aquasec.com/nvd/cve-2026-6653) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: mingw-libxml2: libxml2: Denial of Service via crafted XML input due to use-after-free |
| 16 | HIGH | [CVE-2026-71309](https://avd.aquasec.com/nvd/cve-2026-71309) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | github.com/rclone/rclone: rclone: Backend Root Escape via Incomplete Path Validation |
| 17 | HIGH | [CVE-2026-71312](https://avd.aquasec.com/nvd/cve-2026-71312) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | github.com/rclone/rclone: rclone: Server-Side Command Execution via Malicious SFTP Filenames |
| 18 | HIGH | [CVE-2026-74860](https://avd.aquasec.com/nvd/cve-2026-74860) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: double-free/UAF in libxml2 Python bindings |
| 19 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `bsdutils` | `1:2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 20 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `libblkid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 21 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `liblastlog2-2` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 22 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `libmount1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 23 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `libsmartcols1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 24 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `libuuid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 25 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `login` | `1:4.16.0-2+really2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 26 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `mount` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 27 | HIGH | [CVE-2026-76642](https://avd.aquasec.com/nvd/cve-2026-76642) | `util-linux` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks |
| 28 | HIGH | [CVE-2026-76956](https://avd.aquasec.com/nvd/cve-2026-76956) | `libexpat1` | `2.8.3-1~deb13u1` | `affected`; không cung cấp FixedVersion | libexpat: libexpat: Denial of Service via hash flooding attack with crafted XML |
| 29 | HIGH | [CVE-2026-76957](https://avd.aquasec.com/nvd/cve-2026-76957) | `libexpat1` | `2.8.3-1~deb13u1` | `affected`; không cung cấp FixedVersion | libexpat: libexpat: Memory corruption vulnerability allows arbitrary code execution or denial of service |
| 30 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `bsdutils` | `1:2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 31 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `libblkid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 32 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `liblastlog2-2` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 33 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `libmount1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 34 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `libsmartcols1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 35 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `libuuid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 36 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `login` | `1:4.16.0-2+really2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 37 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `mount` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 38 | HIGH | [CVE-2026-78408](https://avd.aquasec.com/nvd/cve-2026-78408) | `util-linux` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority |
| 39 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `bsdutils` | `1:2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 40 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `libblkid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 41 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `liblastlog2-2` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 42 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `libmount1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 43 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `libsmartcols1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 44 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `libuuid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 45 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `login` | `1:4.16.0-2+really2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 46 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `mount` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 47 | HIGH | [CVE-2026-78409](https://avd.aquasec.com/nvd/cve-2026-78409) | `util-linux` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks |
| 48 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `bsdutils` | `1:2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 49 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `libblkid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 50 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `liblastlog2-2` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 51 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `libmount1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 52 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `libsmartcols1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 53 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `libuuid1` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 54 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `login` | `1:4.16.0-2+really2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 55 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `mount` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 56 | HIGH | [CVE-2026-78410](https://avd.aquasec.com/nvd/cve-2026-78410) | `util-linux` | `2.41.5-0+deb13u1` | `affected`; không cung cấp FixedVersion | util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection |
| 57 | HIGH | [CVE-2026-79776](https://avd.aquasec.com/nvd/cve-2026-79776) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | github.com/rclone/rclone: rclone: Authentication bypass leads to backend credential disclosure |
| 58 | HIGH | [CVE-2026-79782](https://avd.aquasec.com/nvd/cve-2026-79782) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | rclone before 1.74.4 fails to strip the X-Amz-Security-Token header wh ... |
| 59 | HIGH | [CVE-2026-86138](https://avd.aquasec.com/nvd/cve-2026-86138) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: libxml2: Arbitrary code execution via heap-based buffer overflow |
| 60 | HIGH | [CVE-2026-86139](https://avd.aquasec.com/nvd/cve-2026-86139) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: libxml2: Integer overflow in xmlURIEscapeStr may lead to arbitrary code execution |
| 61 | HIGH | [CVE-2026-86140](https://avd.aquasec.com/nvd/cve-2026-86140) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: libxml2: Arbitrary code execution via stack-based buffer overflow in xmlSnprintfElements |
| 62 | HIGH | [CVE-2026-86142](https://avd.aquasec.com/nvd/cve-2026-86142) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: libxml2: Heap-based buffer overflow in xmlXPtrEval due to xpointer length saturation |
| 63 | HIGH | [CVE-2026-86143](https://avd.aquasec.com/nvd/cve-2026-86143) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: libxml2: Data integrity issues due to integer overflow in write callbacks |
| 64 | HIGH | [CVE-2026-86144](https://avd.aquasec.com/nvd/cve-2026-86144) | `libxml2` | `2.12.7+dfsg+really2.9.14-2.1+deb13u3` | `affected`; không cung cấp FixedVersion | libxml2: libxml2: Information disclosure, SSRF, or denial of service due to improper parseFlags propagation. |
| 65 | HIGH | [CVE-2026-88018](https://avd.aquasec.com/nvd/cve-2026-88018) | `rclone` | `1.75.1` | `affected`; không cung cấp FixedVersion | rclone is a command-line program to sync files and directories to and  ... |
| 66 | HIGH | [CVE-2026-88806](https://avd.aquasec.com/nvd/cve-2026-88806) | `libx11-6` | `2:1.8.12-1` | `affected`; không cung cấp FixedVersion | libX11: libX11: Heap-based buffer overflow via malicious X server |
| 67 | HIGH | [CVE-2026-88806](https://avd.aquasec.com/nvd/cve-2026-88806) | `libx11-data` | `2:1.8.12-1` | `affected`; không cung cấp FixedVersion | libX11: libX11: Heap-based buffer overflow via malicious X server |
| 68 | HIGH | [CVE-2026-88806](https://avd.aquasec.com/nvd/cve-2026-88806) | `libx11-xcb1` | `2:1.8.12-1` | `affected`; không cung cấp FixedVersion | libX11: libX11: Heap-based buffer overflow via malicious X server |
| 69 | HIGH | [CVE-2026-88807](https://avd.aquasec.com/nvd/cve-2026-88807) | `libxrender1` | `1:0.9.12-1` | `affected`; không cung cấp FixedVersion | libXrender: libXrender: Code injection via heap overflow in RenderQueryPictFormats |
| 70 | HIGH | [CVE-2026-93990](https://avd.aquasec.com/nvd/cve-2026-93990) | `libexpat1` | `2.8.3-1~deb13u1` | `affected`; không cung cấp FixedVersion | expat: Expat: XML Injection via Malformed UTF-16 Input |
| 71 | HIGH | [CVE-2026-9538](https://avd.aquasec.com/nvd/cve-2026-9538) | `perl-base` | `5.40.1-6+deb13u1` | `fix_deferred`; không cung cấp FixedVersion | perl-Archive-Tar: perl-Archive-Tar: Denial of Service via crafted tar header with large entry size |

## Những finding không nằm trong con số 71

- Report scan có **72** finding HIGH/CRITICAL; receipt còn **71** sau ngoại lệ đã được duyệt cho **CVE-2026-88016 / rclone / InstalledVersion=1.75.1**. Ngoại lệ khóa đúng CVE/package/version; không miễn trừ toàn bộ rclone.
- [Upstream GHSA-f8g7-2xjc-7mfh](https://github.com/rclone/rclone/security/advisories/GHSA-f8g7-2xjc-7mfh) và [Debian tracker CVE-2026-88016](https://security-tracker.debian.org/tracker/CVE-2026-88016) là nguồn cho ngoại lệ bản upstream 1.75.1 đã vá. Ngoại lệ có thời hạn trong policy.
- CVE-2026-19534 và CVE-2026-84961 của standalone undici đã được xử lý bằng 7.29.1 và không xuất hiện trong scan này. Không cộng hai CVE đó vào danh sách còn lại.

## Hướng xử lý và giới hạn

- Ưu tiên thẩm định ba CRITICAL: xác định tính năng/dịch vụ thực sự được dùng, cấu hình RC và đường xử lý XML. Không bật hoặc phơi bày RC không xác thực.
- Với 68 HIGH: nhóm theo package gốc (ví dụ nhiều package util-linux cùng chia sẻ CVE), đối chiếu Debian tracker và upstream, rồi cập nhật hoặc loại package không cần thiết. Chạy lại scan trên đúng image sau thay đổi.
- Với binary upstream có metadata Debian, kiểm tra provenance và phiên bản đã vá trước khi xin ngoại lệ hẹp; không tăng số finding được chấp thuận hoặc miễn trừ cả package để làm CI xanh.
- Báo cáo này chỉ liệt kê bằng chứng; **không sửa package, không thay policy, không xác nhận exploitability**, không tự commit/push file.
