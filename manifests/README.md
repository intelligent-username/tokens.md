# Manifests

Here, I store the manifests, formulas, and configuration files for the different platforms on which the `tmd` CLI binary is to be distributed. I want to make this tool universally accessible.

During releases, the [manifest update script](../scripts/update_manifest_hashes.py) runs inside GitHub Actions to pull newly compiled release binaries from the GitHub Release, calculate their SHA-256 checksums, and update these manifest files before pushing them back to the repository.

The following is a list of the supported platforms as well as how to publish and distribute the tool on each, both manually and automatically.

## Supported Platforms

### Arch User Repository (AUR)

- **Manifest**: [`manifests/aur/PKGBUILD`](aur/PKGBUILD)
- **Target OS**: Arch Linux, Manjaro, EndeavourOS, and Arch-based distributions
- **Package Name**: `tmd` (or `tmd-bin`)

#### Description

The Arch User Repository (AUR) is a community-operated repository for Arch Linux users. It uses `PKGBUILD` scripts to instruct package managers like `yay`, `paru`, or `makepkg` on where to download the pre-compiled binary, verify its checksum, and install it into `/usr/bin/tmd`.

#### How to Publish

1. **Register an Account**: Sign up at [aur.archlinux.org/register](https://aur.archlinux.org/register).
2. **Configure SSH Keys**:
   - Generate an SSH key (`ssh-keygen -t ed25519 -f ~/.ssh/aur`).
   - Add the public key (`~/.ssh/aur.pub`) under the "My Account" section in [AUR Account Settings](https://aur.archlinux.org/account).
   - Configure your SSH client in `~/.ssh/config`:
     ```text
     Host aur.archlinux.org
       IdentityFile ~/.ssh/aur
       User aur
     ```
3. **Clone or Initialize Package Repository**:
   ```bash
   git clone ssh://aur@aur.archlinux.org/tmd-bin.git
   cd tmd-bin
   ```
   *(For a brand new package, cloning the non-existent remote will clone an empty repository ready for your initial commit).*
4. **Copy Updated Manifest**:
   Copy [`manifests/aur/PKGBUILD`](aur/PKGBUILD) into your local package directory.
5. **Generate `.SRCINFO`**:
   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```
6. **Commit and Push to `master`**:
   ```bash
   git add PKGBUILD .SRCINFO
   git commit -m "Update tmd to v<VERSION>"
   git push origin master
   ```
7. **CI/CD Automation (Optional)**:
   Add your AUR private SSH key as a GitHub Actions secret (`AUR_SSH_PRIVATE_KEY`) and use [`KSXGitHub/github-actions-deploy-aur`](https://github.com/KSXGitHub/github-actions-deploy-aur) in your workflow to push updates automatically when release tags are created.

---

### Chocolatey

- **Manifests**: [`manifests/chocolatey/tmd.nuspec`](chocolatey/tmd.nuspec), [`manifests/chocolatey/tools/chocolateyinstall.ps1`](chocolatey/tools/chocolateyinstall.ps1)
- **Target OS**: Windows (x64)
- **Package ID**: `tmd`

#### Description

Chocolatey is a Windows machine-level package manager. The `.nuspec` file defines the package metadata, while `chocolateyinstall.ps1` downloads the standalone Windows binary (`tmd-windows-x64.exe`) directly from GitHub Releases, checks its SHA-256 hash, and puts the binary on the system PATH.

#### How to Publish

1. **Register an Account**: Sign up on the [Chocolatey Community Repository](https://community.chocolatey.org/account/Register).
2. **Retrieve Your API Key**: Navigate to [community.chocolatey.org/account](https://community.chocolatey.org/account) and copy your API key.
3. **Manual Publishing**:
   ```powershell
   choco apikey --key "<YOUR_API_KEY>" --source https://push.chocolatey.org/
   cd manifests/chocolatey
   choco pack
   choco push tmd.<VERSION>.nupkg --source https://push.chocolatey.org/
   ```
4. **Automated CI/CD**:
   Add your API key to GitHub Repository Secrets as `CHOCOLATEY_API_KEY`. The release workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) automatically packs and pushes the package via [`.github/actions/publish-chocolatey`](../.github/actions/publish-chocolatey) whenever a new version tag is released.

---

### Flatpak

- **Manifest**: [`manifests/flatpak/com.intelligent_username.tmd.yaml`](flatpak/com.intelligent_username.tmd.yaml)
- **Target OS**: Linux (Desktops / SteamOS / Immutable distributions)
- **Application ID**: `com.intelligent_username.tmd`

#### Description

Flatpak provides an isolated, sandboxed environment for desktop applications and command-line tools across Linux distributions. Flathub serves as the primary centralized app store and build service for Flatpak applications.

#### How to Publish

1. **Prepare the Manifest**: Create a YAML/JSON manifest defining the runtime, SDK, and GitHub binary download URLs along with an AppStream metadata file (`com.intelligent_username.tmd.metainfo.xml`).
2. **Submit to Flathub via Pull Request**:
   - Fork the [flathub/flathub](https://github.com/flathub/flathub) repository on GitHub.
   - Clone your fork using the submission branch:
     ```bash
     git clone --branch=new-pr git@github.com:<YOUR_GITHUB_USERNAME>/flathub.git
     cd flathub
     git checkout -b add-tmd
     ```
   - Add your app manifest to the branch, commit, and push.
   - Open a pull request against `flathub/flathub`.
   - Once approved and merged, Flathub provisions a dedicated repository under `https://github.com/flathub/com.intelligent_username.tmd`.
3. **Releasing Updates**:
   Push version updates directly to your provisioned Flathub repository, or configure Flathub Buildbot. See the [Flathub App Submission Guide](https://docs.flathub.org/docs/for-app-authors/submission/) for technical details.

---

### Homebrew

- **Manifest**: [`manifests/homebrew/tmd.rb`](homebrew/tmd.rb)
- **Target OS**: macOS (Apple Silicon & Intel) and Linux (x86_64 & ARM64)
- **Formula Name**: `tmd`

#### Description

Homebrew is the package manager for macOS and Linux. The Ruby formula (`tmd.rb`) detects the host architecture, downloads the matching pre-built binary from the latest GitHub Release, verifies its SHA-256 hash, and installs it into `/opt/homebrew/bin/tmd` or `/usr/local/bin/tmd`.

#### How to Publish

1. **Using a Custom Tap (Recommended)**:
   - Create a public GitHub repository named `homebrew-tap` under your GitHub account (e.g. `https://github.com/intelligent-username/homebrew-tap`).
   - Copy [`manifests/homebrew/tmd.rb`](homebrew/tmd.rb) into `Formula/tmd.rb` in that repo.
   - Users install via:
     ```bash
     brew tap intelligent-username/tap
     brew install tmd
     ```
2. **Homebrew Core Submission**:
   - Once the repository meets [Homebrew's acceptance criteria](https://docs.brew.sh/Acceptable-Formulae), submit a PR directly using:
     ```bash
     brew bump-formula-pr tmd --url="<RELEASE_URL>" --sha256="<SHA256>"
     ```
3. **CI/CD Automation**:
   Create a GitHub Personal Access Token (PAT) with `repo` and `workflow` scopes, save it as `TAP_GITHUB_TOKEN` in GitHub Secrets, and use [`mislav/bump-homebrew-formula-action`](https://github.com/mislav/bump-homebrew-formula-action):
   ```yaml
   - uses: mislav/bump-homebrew-formula-action@v4
     with:
       formula-name: tmd
       tap-repo: intelligent-username/homebrew-tap
     env:
       COMMITTER_TOKEN: ${{ secrets.TAP_GITHUB_TOKEN }}
   ```

---

### MacPorts

- **Manifest**: [`manifests/macports/Portfile`](macports/Portfile)
- **Target OS**: macOS (Darwin)
- **Port Name**: `tmd`

#### Description

MacPorts is an open-source package manager designed for macOS systems. The `Portfile` specifies the build steps, dependencies, architecture targets (`arm64`), and checksums (`sha256`, `rmd160`) for the `tmd` macOS binary.

#### How to Publish

1. **Custom Port Repository**:
   - Host your own ports tree on GitHub or via an HTTP/rsync mirror.
   - Users append the port directory URL to `/opt/local/etc/macports/sources.conf` and run `sudo port sync && sudo port install tmd`.
2. **Official MacPorts Repository**:
   - Fork [macports/macports-ports](https://github.com/macports/macports-ports) on GitHub.
   - Place the port under `textproc/tmd/Portfile`.
   - Lint and test locally:
     ```bash
     port lint --nitpick tmd
     sudo port install tmd
     ```
   - Open a pull request against `macports/macports-ports`. Refer to the [MacPorts Portfile Guidelines](https://guide.macports.org/#project.contributing) for submission standards.

---

### Scoop

- **Manifest**: [`manifests/scoop/tmd.json`](scoop/tmd.json)
- **Target OS**: Windows (x64)
- **Manifest Name**: `tmd.json`

#### Description

Scoop is a command-line package manager for Windows that installs tools into your user directory without requiring Administrator privileges or triggering UAC prompts.

#### How to Publish

1. **Using a Custom Scoop Bucket**:
   - Create a GitHub repository named `scoop-bucket` (e.g. `https://github.com/intelligent-username/scoop-bucket`).
   - Place [`manifests/scoop/tmd.json`](scoop/tmd.json) in the `bucket/` folder.
   - Users install via:
     ```powershell
     scoop bucket add intelligent-username https://github.com/intelligent-username/scoop-bucket
     scoop install tmd
     ```
2. **Scoop Main / Extras Submission**:
   - Fork [ScoopInstaller/Main](https://github.com/ScoopInstaller/Main) or [ScoopInstaller/Extras](https://github.com/ScoopInstaller/Extras).
   - Add `bucket/tmd.json` and submit a pull request.
3. **Auto-Update Configuration**:
   The manifest includes `checkver` and `autoupdate` directives. Scoop parses new GitHub releases and updates the manifest hashes using Scoop's checkver automation or GitHub Actions workflows.

---

### Snapcraft / Canonical Snap Store

- **Manifest**: [`manifests/snap/snapcraft.yaml`](snap/snapcraft.yaml)
- **Target OS**: Linux (Ubuntu, Debian, Fedora, Arch, and any system with `snapd`)
- **Snap Name**: `tmd`

#### Description

Snaps are containerized software packages that bundle dependencies and work across multiple Linux distributions. They run with strict confinement and are distributed directly through Canonical's Snap Store.

#### How to Publish

1. **Register on Snapcraft**: Create an account at [snapcraft.io](https://snapcraft.io/).
2. **Register the Snap Name**:
   ```bash
   snapcraft login
   snapcraft register tmd
   ```
3. **Build and Upload Locally**:
   ```bash
   # Build the snap package (using LXD container)
   snapcraft --use-lxd

   # Upload and release directly to the stable channel
   snapcraft upload --release=stable tmd_<VERSION>_amd64.snap
   ```
4. **Automated CI/CD via GitHub Actions**:
   - Generate an export login credential file:
     ```bash
     snapcraft export-login --snaps=tmd --channels=edge,stable --acls=package_upload,package_push,package_release snapcraft.login
     ```
   - Copy the contents of `snapcraft.login` and add them to GitHub Repository Secrets as `SNAPCRAFT_STORE_CREDENTIALS`.
   - Use the official [`snapcore/action-publish`](https://github.com/snapcore/action-publish) action in your workflow to publish releases automatically:
     ```yaml
     - uses: snapcore/action-publish@v1
       env:
         SNAPCRAFT_STORE_CREDENTIALS: ${{ secrets.SNAPCRAFT_STORE_CREDENTIALS }}
       with:
         snap: tmd_*.snap
         release: stable
     ```

---

### Windows Package Manager (WinGet)

- **Manifest**: [`manifests/winget/tmd.yaml`](winget/tmd.yaml)
- **Target OS**: Windows 10 & Windows 11 (x64)
- **Package Identifier**: `intelligent-username.tmd`

#### Description

WinGet is Microsoft's built-in package manager for Windows. The singleton YAML manifest describes package details, installer architecture (`x64`), download URLs, and SHA-256 checksums used by the `winget install` command.

#### How to Publish

1. **Method A: `wingetcreate` CLI Tool (Recommended)**:
   - Install the tool: `winget install Microsoft.WingetCreate`
   - Store or configure your GitHub token: `wingetcreate token -s` or pass `--token <GITHUB_PAT>`
   - Submit an update and pull request in one command:
     ```powershell
     wingetcreate update intelligent-username.tmd --version <VERSION> --urls "https://github.com/intelligent-username/tokens.md/releases/download/v<VERSION>/tmd-windows-x64.exe" --submit --token <GITHUB_PAT>
     ```
   - `wingetcreate` automatically validates the binary checksum, generates the updated YAML schema, forks `microsoft/winget-pkgs`, and submits the pull request.
2. **Method B: Manual Pull Request**:
   - Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) on GitHub.
   - Copy [`manifests/winget/tmd.yaml`](winget/tmd.yaml) to `manifests/i/intelligent-username/tmd/<VERSION>/intelligent-username.tmd.yaml`.
   - Submit a pull request to `microsoft/winget-pkgs`.
3. **Automated CI/CD**:
   - Create a GitHub Personal Access Token with `public_repo` permissions and store it in GitHub Secrets as `WINGET_TOKEN`.
   - Use the [`vedantmgoyal2009/winget-releaser`](https://github.com/vedantmgoyal2009/winget-releaser) GitHub Action to automate PR submissions to `microsoft/winget-pkgs` when releases are published.
