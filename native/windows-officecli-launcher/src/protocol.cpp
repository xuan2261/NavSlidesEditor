#include "launcher.h"

#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

namespace {
constexpr size_t kMaxRequestBytes = 64 * 1024;

std::optional<std::wstring> ExtractString(const std::wstring& json, const std::wstring& key) {
  const std::wstring needle = L"\"" + key + L"\":\"";
  const size_t begin = json.find(needle);
  if (begin == std::wstring::npos) return std::nullopt;

  std::wstring value;
  bool escaped = false;
  for (size_t index = begin + needle.size(); index < json.size(); ++index) {
    const wchar_t character = json[index];
    if (escaped) {
      if (character == L'\\' || character == L'"' || character == L'/') value.push_back(character);
      else if (character == L'b') value.push_back(L'\b');
      else if (character == L'f') value.push_back(L'\f');
      else if (character == L'n') value.push_back(L'\n');
      else if (character == L'r') value.push_back(L'\r');
      else if (character == L't') value.push_back(L'\t');
      else return std::nullopt;
      escaped = false;
    } else if (character == L'\\') {
      escaped = true;
    } else if (character == L'"') {
      return value.empty() ? std::nullopt : std::optional<std::wstring>(value);
    } else if (character < 0x20) {
      return std::nullopt;
    } else {
      value.push_back(character);
    }
  }
  return std::nullopt;
}

std::wstring Escape(const std::wstring& value) {
  std::wstring escaped;
  for (const wchar_t character : value) {
    if (character == L'\\' || character == L'"') escaped.push_back(L'\\');
    escaped.push_back(character);
  }
  return escaped;
}

std::optional<std::wstring> ReadUtf8File(const std::wstring& request_path) {
  std::ifstream stream(request_path, std::ios::binary);
  if (!stream) return std::nullopt;
  const std::string bytes((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
  if (stream.bad() || bytes.empty()) return std::nullopt;
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(),
      static_cast<int>(bytes.size()), nullptr, 0);
  if (size <= 0) return std::nullopt;
  std::wstring decoded(static_cast<size_t>(size), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(),
          static_cast<int>(bytes.size()), decoded.data(), size) != size) {
    return std::nullopt;
  }
  return decoded;
}
}

std::optional<LaunchRequest> ParseBoundedRequest(const std::wstring& request_path) {
  std::error_code error;
  const auto byte_length = std::filesystem::file_size(request_path, error);
  if (error || byte_length == 0 || byte_length > kMaxRequestBytes) return std::nullopt;

  const auto request = ReadUtf8File(request_path);
  if (!request) return std::nullopt;
  if (request->find(L"\"operation\":\"validate\"") == std::wstring::npos) return std::nullopt;

  const auto execution_copy = ExtractString(*request, L"executionCopy");
  const auto binary_version = ExtractString(*request, L"binaryVersion");
  const auto input_path = ExtractString(*request, L"inputPath");
  const auto workspace_path = ExtractString(*request, L"workspacePath");
  const auto policy_digest = ExtractString(*request, L"policyDigest");
  if (!execution_copy || !binary_version || !input_path || !workspace_path || !policy_digest) return std::nullopt;
  return LaunchRequest{*binary_version, *execution_copy, *input_path, *workspace_path, *policy_digest};
}

std::wstring BuildReceipt(const LaunchRequest& request, const LaunchResult& result) {
  const auto executable_hash = Sha256File(request.execution_copy);
  const auto input_hash = Sha256File(request.input_path);
  wchar_t launcher_path[MAX_PATH]{};
  const DWORD launcher_length = GetModuleFileNameW(nullptr, launcher_path, MAX_PATH);
  if (!executable_hash || !input_hash || launcher_length == 0 || launcher_length >= MAX_PATH) return L"";
  const auto launcher_hash = Sha256File(launcher_path);
  std::error_code error;
  const auto byte_length = std::filesystem::file_size(request.execution_copy, error);
  if (!launcher_hash || error) return L"";

  return L"{\"kind\":\"officecli-containment-receipt-v1\",\"verdict\":\"" +
      std::wstring(result.exit_code == 0 ? L"qualified" : L"failed") +
      L"\",\"operation\":\"validate\",\"executionCopy\":{\"canonicalPath\":\"" +
      Escape(request.execution_copy) + L"\",\"sha256\":\"" + *executable_hash +
      L"\",\"byteLength\":" + std::to_wstring(byte_length) +
      L"},\"launcher\":{\"sha256\":\"" + *launcher_hash + L"\",\"version\":\"" +
      kLauncherVersion + L"\"},\"binary\":{\"sha256\":\"" + *executable_hash +
      L"\",\"version\":\"" + Escape(request.binary_version) +
      L"\"},\"inputSha256\":\"" + *input_hash + L"\",\"policyDigest\":\"" +
      Escape(request.policy_digest) + L"\",\"exitCode\":" +
      std::to_wstring(result.exit_code) + L",\"reason\":\"" + Escape(result.reason) + L"\"}";
}
