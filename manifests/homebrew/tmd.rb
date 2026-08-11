class Tmd < Formula
  desc "Convert files to token-efficient Markdown for LLM prompts"
  homepage "https://github.com/intelligent-username/tokens.md"
  license "AGPL-3.0-only"
  version "0.0.4"

  livecheck do
    url :stable
    strategy :github_latest
    regex(/^v?(\d+(?:\.\d+)+)$/i)
  end

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-arm64"
      sha256 "REPLACE_WITH_SHA256_MACOS_ARM64"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-x64"
      sha256 "REPLACE_WITH_SHA256_MACOS_X64"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-linux-arm64"
      sha256 "REPLACE_WITH_SHA256_LINUX_ARM64"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-linux-x64"
      sha256 "REPLACE_WITH_SHA256_LINUX_X64"
    end
  end

  def install
    bin.install Dir["tmd*"].first => "tmd"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/tmd --version")
    system bin/"tmd", "--help"
  end
end
