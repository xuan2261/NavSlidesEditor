#include "launcher.h"

#include <vector>

namespace {
constexpr DWORD kTimeoutMs = 30'000;

std::wstring Quote(const std::wstring& value) {
  return L"\"" + value + L"\"";
}

std::optional<std::vector<wchar_t>> MinimalEnvironment() {
  wchar_t windows_directory[MAX_PATH]{};
  const UINT length = GetWindowsDirectoryW(windows_directory, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) return std::nullopt;

  std::wstring value = L"SystemRoot=";
  value.append(windows_directory, length);
  value.push_back(L'\0');
  value.append(L"OFFICECLI_NO_AUTO_RESIDENT=1");
  value.push_back(L'\0');
  value.append(L"OFFICECLI_SKIP_UPDATE=1");
  value.push_back(L'\0');
  value.push_back(L'\0');
  return std::vector<wchar_t>(value.begin(), value.end());
}
}

std::optional<LaunchResult> LaunchContained(const LaunchRequest& request) {
  ContainmentJob job;
  if (!job.valid()) return std::nullopt;

  const std::wstring command = Quote(request.execution_copy) + L" validate " +
      Quote(request.input_path) + L" --json";
  std::vector<wchar_t> command_buffer(command.begin(), command.end());
  command_buffer.push_back(L'\0');
  auto environment = MinimalEnvironment();
  if (!environment) return std::nullopt;

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  const BOOL created = CreateProcessW(
      request.execution_copy.c_str(),
      command_buffer.data(),
      nullptr,
      nullptr,
      FALSE,
      CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT,
      environment->data(),
      request.workspace_path.c_str(),
      &startup,
      &process);
  if (!created) return std::nullopt;

  const bool assigned = job.Assign(process.hProcess);
  const DWORD resumed = assigned ? ResumeThread(process.hThread) : static_cast<DWORD>(-1);
  CloseHandle(process.hThread);
  if (!assigned || resumed == static_cast<DWORD>(-1)) {
    job.Stop(ERROR_ACCESS_DENIED);
    CloseHandle(process.hProcess);
    return std::nullopt;
  }

  const DWORD wait = WaitForSingleObject(process.hProcess, kTimeoutMs);
  if (wait != WAIT_OBJECT_0) {
    job.Stop(ERROR_TIMEOUT);
    CloseHandle(process.hProcess);
    return std::nullopt;
  }

  DWORD exit_code = 0;
  const BOOL read_exit = GetExitCodeProcess(process.hProcess, &exit_code);
  CloseHandle(process.hProcess);
  if (!read_exit || !job.WaitForDrain(kTimeoutMs)) return std::nullopt;

  return LaunchResult{exit_code, exit_code == 0 ? L"completed" : L"target-failed"};
}
