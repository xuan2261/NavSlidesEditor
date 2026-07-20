#include "launcher.h"

#include <bcrypt.h>

#include <array>
#include <iomanip>
#include <sstream>
#include <vector>

std::optional<std::wstring> Sha256File(const std::wstring& path) {
  HANDLE file = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
      OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) return std::nullopt;

  BCRYPT_ALG_HANDLE algorithm{};
  BCRYPT_HASH_HANDLE hash{};
  DWORD object_length = 0;
  DWORD result_length = 0;
  std::vector<BYTE> object;
  std::array<BYTE, 32> digest{};
  const NTSTATUS open_status = BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0);
  if (open_status < 0 ||
      BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&object_length),
          sizeof(object_length), &result_length, 0) < 0) {
    CloseHandle(file);
    if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
    return std::nullopt;
  }

  object.resize(object_length);
  if (BCryptCreateHash(algorithm, &hash, object.data(), object_length, nullptr, 0, 0) < 0) {
    CloseHandle(file);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    return std::nullopt;
  }

  std::array<BYTE, 16 * 1024> buffer{};
  DWORD read = 0;
  BOOL read_ok = TRUE;
  while ((read_ok = ReadFile(file, buffer.data(), static_cast<DWORD>(buffer.size()), &read, nullptr)) && read != 0) {
    if (BCryptHashData(hash, buffer.data(), read, 0) < 0) {
      BCryptDestroyHash(hash);
      CloseHandle(file);
      BCryptCloseAlgorithmProvider(algorithm, 0);
      return std::nullopt;
    }
  }
  const bool finalized = read_ok != FALSE &&
      BCryptFinishHash(hash, digest.data(), static_cast<ULONG>(digest.size()), 0) >= 0;
  BCryptDestroyHash(hash);
  CloseHandle(file);
  BCryptCloseAlgorithmProvider(algorithm, 0);
  if (!finalized) return std::nullopt;

  std::wostringstream hex;
  hex << std::uppercase << std::hex << std::setfill(L'0');
  for (const BYTE byte : digest) hex << std::setw(2) << static_cast<unsigned>(byte);
  return hex.str();
}
