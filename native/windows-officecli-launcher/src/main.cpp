#include "launcher.h"

#include <iostream>
#include <string>
#include <vector>

namespace {
void WriteReceipt(const std::wstring& receipt) {
  if (receipt.empty()) return;
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, receipt.data(),
      static_cast<int>(receipt.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) return;

  std::vector<char> bytes(static_cast<size_t>(size));
  if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, receipt.data(),
          static_cast<int>(receipt.size()), bytes.data(), size, nullptr, nullptr) <= 0) {
    return;
  }
  std::cout.write(bytes.data(), size);
  std::cout.flush();
}
}

int wmain(int argc, wchar_t* argv[]) {
  if (argc != 3 || std::wstring(argv[1]) != L"--request") return ERROR_INVALID_PARAMETER;
  const auto request = ParseBoundedRequest(argv[2]);
  if (!request) return ERROR_INVALID_DATA;

  const auto result = LaunchContained(*request);
  if (!result) return ERROR_PROCESS_ABORTED;
  const std::wstring receipt = BuildReceipt(*request, *result);
  if (receipt.empty()) return ERROR_INVALID_DATA;
  WriteReceipt(receipt);
  return result->exit_code == 0 ? ERROR_SUCCESS : ERROR_PROCESS_ABORTED;
}
