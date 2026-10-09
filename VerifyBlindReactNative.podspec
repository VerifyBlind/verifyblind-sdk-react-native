require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "VerifyBlindReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/VerifyBlind/verifyblind-sdk-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.9"
  # Lets the Objective-C++ module import the generated VerifyBlindReactNative-Swift.h.
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  # The native iOS SDK ships as a Swift Package only (no CocoaPods trunk; trunk goes read-only
  # in Dec 2026). React Native 0.75+ can attach a Swift Package to a pod with spm_dependency.
  spm_dependency(s,
    url: "https://github.com/VerifyBlind/verifyblind-sdk-ios.git",
    requirement: { kind: "upToNextMajorVersion", minimumVersion: "2.3.1" },
    products: ["VerifyBlind"]
  )

  install_modules_dependencies(s)
end
