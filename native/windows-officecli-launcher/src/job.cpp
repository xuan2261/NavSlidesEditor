#include "launcher.h"

ContainmentJob::ContainmentJob() {
  job_ = CreateJobObjectW(nullptr, nullptr);
  completion_port_ = CreateIoCompletionPort(INVALID_HANDLE_VALUE, nullptr, 0, 1);
  if (!job_ || !completion_port_) return;

  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!SetInformationJobObject(
          job_, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) {
    CloseHandle(completion_port_);
    CloseHandle(job_);
    completion_port_ = nullptr;
    job_ = nullptr;
    return;
  }

  JOBOBJECT_ASSOCIATE_COMPLETION_PORT association{};
  association.CompletionKey = job_;
  association.CompletionPort = completion_port_;
  if (!SetInformationJobObject(
          job_, JobObjectAssociateCompletionPortInformation, &association, sizeof(association))) {
    CloseHandle(completion_port_);
    CloseHandle(job_);
    completion_port_ = nullptr;
    job_ = nullptr;
  }
}

ContainmentJob::~ContainmentJob() {
  if (job_) CloseHandle(job_);
  if (completion_port_) CloseHandle(completion_port_);
}

bool ContainmentJob::valid() const {
  return job_ != nullptr && completion_port_ != nullptr;
}

bool ContainmentJob::Assign(HANDLE process) const {
  return valid() && AssignProcessToJobObject(job_, process) != FALSE;
}

bool ContainmentJob::WaitForDrain(DWORD timeout_ms) const {
  if (!valid()) return false;

  const ULONGLONG deadline = GetTickCount64() + timeout_ms;
  do {
    const ULONGLONG now = GetTickCount64();
    const DWORD remaining = now >= deadline ? 0 : static_cast<DWORD>(deadline - now);
    DWORD message = 0;
    ULONG_PTR completion_key = 0;
    LPOVERLAPPED overlapped = nullptr;
    if (!GetQueuedCompletionStatus(completion_port_, &message, &completion_key, &overlapped, remaining)) {
      return false;
    }
    if (message == JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO) return true;
  } while (GetTickCount64() < deadline);
  return false;
}

void ContainmentJob::Stop(UINT exit_code) const {
  if (job_) TerminateJobObject(job_, exit_code);
}
