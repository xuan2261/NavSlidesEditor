#pragma once

#include <windows.h>

#include <optional>
#include <string>

inline constexpr wchar_t kLauncherVersion[] = L"1.0.0";

struct LaunchRequest {
  std::wstring binary_version;
  std::wstring execution_copy;
  std::wstring input_path;
  std::wstring workspace_path;
  std::wstring policy_digest;
};

struct LaunchResult {
  DWORD exit_code{};
  std::wstring reason;
};

class ContainmentJob {
 public:
  ContainmentJob();
  ~ContainmentJob();

  ContainmentJob(const ContainmentJob&) = delete;
  ContainmentJob& operator=(const ContainmentJob&) = delete;

  [[nodiscard]] bool valid() const;
  [[nodiscard]] bool Assign(HANDLE process) const;
  [[nodiscard]] bool WaitForDrain(DWORD timeout_ms) const;
  void Stop(UINT exit_code) const;

 private:
  HANDLE job_{};
  HANDLE completion_port_{};
};

[[nodiscard]] std::optional<LaunchRequest> ParseBoundedRequest(const std::wstring& request_path);
[[nodiscard]] std::wstring BuildReceipt(const LaunchRequest& request, const LaunchResult& result);
[[nodiscard]] std::optional<LaunchResult> LaunchContained(const LaunchRequest& request);
[[nodiscard]] std::optional<std::wstring> Sha256File(const std::wstring& path);
