class Tmd < Formula
  desc "Convert files to token-efficient Markdown for LLM prompts"
  homepage "https://github.com/intelligent-username/tokens.md"
  license "AGPL-3.0-only"
  version "0.0.18"

  livecheck do
    url :stable
    strategy :github_latest
    regex(/^v?(\d+(?:\.\d+)+)$/i)
  end

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-arm64"
      sha256 "23c994329e4fdeb5f39c0fde788af6c60da4da6976640f954345d496bb41ba65"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-x64"
      sha256 "bf9d5aee1b415ad6fe5e9711455bd2b88c5059acfe21b2c8a84065262727cf90"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-linux-arm64"
      sha256 "c87bd85024802ceebadf5a68f60700f0b96d92d5c495d9fe784c5e66d117f9e5"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-linux-x64"
      sha256 "b50b69d79af5a504f76db6696a1b2790e7917374b039b8cf9b6a15e21e73b487"
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
