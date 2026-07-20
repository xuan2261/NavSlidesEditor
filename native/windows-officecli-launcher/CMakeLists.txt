cmake_minimum_required(VERSION 3.24)

project(officecli_containment_launcher VERSION 1.0.0 LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "officecli-containment-launcher is Windows-only")
endif()

add_executable(officecli-containment-launcher
  src/job.cpp
  src/launch.cpp
  src/main.cpp
  src/protocol.cpp
  src/sha256.cpp
)

target_compile_features(officecli-containment-launcher PRIVATE cxx_std_20)
set_property(TARGET officecli-containment-launcher PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
target_compile_definitions(officecli-containment-launcher PRIVATE
  UNICODE
  _UNICODE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
)
target_compile_options(officecli-containment-launcher PRIVATE /W4 /WX /permissive-)
target_link_libraries(officecli-containment-launcher PRIVATE advapi32 bcrypt)
