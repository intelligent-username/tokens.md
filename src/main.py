import sys
from pathlib import Path

# Ensure src package can be imported when running directly
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.converter import run_pipeline
from src.file_selector import DirectoryFileSelector, select_files


def main():
    # Resolve input directory (check "in" first, fallback to "input")
    project_root = Path(__file__).parent.parent
    in_dir = project_root / "in"
    input_dir = project_root / "input"

    if in_dir.exists():
        target_in = in_dir
    elif input_dir.exists():
        target_in = input_dir
    else:
        in_dir.mkdir(exist_ok=True)
        target_in = in_dir

    output_dir = project_root / "output"
    output_dir.mkdir(exist_ok=True)

    print(f"Selecting PDF files from: {target_in.resolve()}")
    selected_files = select_files(target_in)
    print(f"Found {len(selected_files)} file(s): {[f.name for f in selected_files]}")

    if not selected_files:
        print("No PDF files found to process.")
        return

    print("Starting conversion pipeline...")
    results = run_pipeline(
        source=DirectoryFileSelector(target_in),
        output_dir=output_dir,
    )

    for out_path in results:
        print(f"Successfully converted -> {out_path.resolve()}")


if __name__ == "__main__":
    main()
