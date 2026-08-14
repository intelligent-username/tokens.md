class Tmd < Formula
  desc "Convert files to token-efficient Markdown for LLM prompts"
  homepage "https://github.com/intelligent-username/tokens.md"
  license "AGPL-3.0-only"
  version "0.0.12"

  livecheck do
    url :stable
    strategy :github_latest
    regex(/^v?(\d+(?:\.\d+)+)$/i)
  end

  on_macos do
    url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-arm64"
    sha256 "35c44ef53dcfa9ee1d077e6c1ee14892d2ab400e55712c4f7b7beb09cc0494fe"
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
