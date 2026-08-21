class Tmd < Formula
  desc "Convert files to token-efficient Markdown for LLM prompts"
  homepage "https://github.com/intelligent-username/tokens.md"
  license "AGPL-3.0-only"
  version "0.0.14"

  livecheck do
    url :stable
    strategy :github_latest
    regex(/^v?(\d+(?:\.\d+)+)$/i)
  end

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-arm64"
      sha256 "a1ef76f10818b51c1e58ca93d508aeedb8da22e0490e01bb589d90c948ad41cc"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-macos-x64"
      sha256 "c664401035f6cb55bb546cfbb11bb6a7f52355af0a337d4f16226adbb26a560b"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-linux-arm64"
      sha256 "d135d720840cff69a652c544c26d2dd45acfbe9f09577da6005433be6d1f6b70"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{version}/tmd-linux-x64"
      sha256 "11b4ad968671c76e7aa4fb5cc5bc6b740e77fea86c98417a0a11a57e855718e1"
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
