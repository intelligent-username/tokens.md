# tokens.md

![Moses on Mounta Sinai by Jean-Léon, 1895](.github/Cover.jpg)

Tokens.md is my tool for saving tokens when speaking to chatbots by converting files en-masse to MarkDown.

Batch converts all files in `input/` to Markdown using [MarkItDown](https://github.com/microsoft/markitdown) by Microsoft and combines them into a single `output.md`.

## Setup

For the sake of simplicitiy, I'll be using `uv` for creating the virtual environment, however, these libraries are all available via `pip` and can be installed through other means.

With uv:
```bash
uv venv --python=3.13 .venv
source .venv/bin/activate         # on Linux or Mac
.venv\Scripts\activate            # on Windows
uv pip install requirements.txt
```

## Usage

1. Place files in `input/`
2. Run: `python src/main.py`
3. Open the output files in the `output` folder

Supports PDF, DOCX, PPTX, XLSX, images, audio, HTML, CSV, JSON, XML, EPUB, and more.
