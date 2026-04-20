import os
import uuid
import subprocess
from typing import Dict, Any, List

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SANDBOX_DIR = BASE_DIR / "sandbox"
CONTAINER_NAME = "python_sandbox"

MAX_STDOUT = 2000
MAX_STDERR = 1000
MAX_OUTPUT_FILES = 10
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def run_python_in_secure_env(code: str) -> Dict[str, Any]:
    """
        Executes Python code inside a Docker Compose sandbox.
        All the files that environment can use are in the input folder
        And all the outputs must be saved to output folder.

        Sandbox folder structure:
        sandbox/
        ├── input
        └── output

        3 directories, 0 files

        Args:
            code: str

        Code example:

    with open("./input/hello.md", "r", encoding="utf-8") as f:
        content = f.read()

    with open("./output/hello.md", "w", encoding="utf-8") as f:
        f.write(content)

    print("Created hello.md")

        Returns:
            {
                "stdout": str,
                "stderr": str,
                "images": [bytes],
                "error": str | None
            }
    """

    execution_id = uuid.uuid4().hex
    script_name = f"script_{execution_id}.py"
    script_path = SANDBOX_DIR / script_name
    output_dir = SANDBOX_DIR / "output"

    SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    wrapped_code = f"""
import matplotlib
matplotlib.use('Agg')

import matplotlib.pyplot as plt
import os

os.makedirs("output", exist_ok=True)

try:
{_indent(code, 4)}

except Exception as e:
    import traceback
    print("ERROR:", str(e))
    traceback.print_exc()
"""

    script_path.write_text(wrapped_code, encoding="utf-8")

    stdout = ""
    stderr = ""
    error = None

    try:
        result = subprocess.run(
            [
                "docker",
                "exec",
                "-w",
                "/sandbox",
                CONTAINER_NAME,
                "python",
                f"/sandbox/{script_name}",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        stdout = (result.stdout or "")[:MAX_STDOUT]
        stderr = (result.stderr or "")[:MAX_STDERR]
        error = None if result.returncode == 0 else "Execution failed"

        output_files = sorted(
            f.name
            for f in output_dir.iterdir()
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS
        )[:MAX_OUTPUT_FILES]

    except subprocess.TimeoutExpired:
        stdout = ""
        stderr = "Script exceeded 10 second timeout"
        error = "Execution timed out"
        output_files = []

    except Exception as e:
        stdout = ""
        stderr = str(e)[:MAX_STDERR]
        error = str(e)[:500]
        output_files = []

    finally:
        try:
            if script_path.exists():
                script_path.unlink()
        except Exception:
            pass

    return {
        "stdout": stdout,
        "stderr": stderr,
        "output_files": output_files,
        "error": error[:500] if error else None,
    }


def list_all_files() -> List[str]:
    """
    Lists all files in the sandbox/input folder.

    Returns:
        [filename1, filename2, ...]
    """
    input_dir = os.path.join(SANDBOX_DIR, "input")

    if not os.path.exists(input_dir):
        return []

    files = []

    for filename in os.listdir(input_dir):
        filepath = os.path.join(input_dir, filename)

        if os.path.isfile(filepath):
            files.append(filename)

    return files


def read_file_from_input_directory(filename: str) -> Dict[str, Any]:
    """
    Reads a specific file from sandbox/input.

    Returns:
        {
            "filename": str,
            "extension": str,
            "content": str | dict | list | bytes | None,
            "error": str | None
        }
    """
    input_dir = SANDBOX_DIR / "input"
    filepath = input_dir / filename

    if not filepath.exists():
        return {
            "filename": filename,
            "extension": None,
            "content": None,
            "error": "File not found",
        }

    if not filepath.is_file():
        return {
            "filename": filename,
            "extension": None,
            "content": None,
            "error": "Not a file",
        }

    ext = filepath.suffix.lower()

    try:
        if ext == ".json":
            import json

            content = json.loads(filepath.read_text(encoding="utf-8"))

        elif ext == ".csv":
            import csv

            with filepath.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                content = list(reader)

        elif ext == ".txt":
            content = filepath.read_text(encoding="utf-8")

        else:
            return {
                "filename": filename,
                "extension": ext,
                "content": None,
                "error": f"Binary files are not returned inline ({ext}). Use output files/artifacts instead.",
            }

        return {
            "filename": filename,
            "extension": ext,
            "content": content,
            "error": None,
        }

    except Exception as e:
        return {
            "filename": filename,
            "extension": ext,
            "content": None,
            "error": str(e)[:500],
        }


def clear_all_input() -> Dict[str, Any]:
    """
    Deletes all files from the sandbox/input folder.

    Returns:
        {
            "deleted": [str],   # filenames successfully deleted
            "failed":  [str],   # filenames that could not be deleted
            "error":   str | None
        }
    """
    return _clear_folder(os.path.join(SANDBOX_DIR, "input"))


def clear_all_output() -> Dict[str, Any]:
    """
    This function clear_all_output deletes all the files inside the sandbox/output directory
    """
    # Delete from inside the container where permissions match
    result = subprocess.run(
        ["docker", "exec", CONTAINER_NAME, "sh", "-c", "rm -f /sandbox/output/*"],
        capture_output=True,
        text=True,
    )
    # Then verify on the host side
    return _clear_folder(os.path.join(SANDBOX_DIR, "output"))


def _clear_folder(folder: str) -> Dict[str, Any]:
    """Shared implementation for clearing a sandbox folder."""
    deleted = []
    failed = []

    if not os.path.exists(folder):
        return {
            "deleted": deleted,
            "failed": failed,
            "error": f"Folder not found: {folder}",
        }

    for filename in os.listdir(folder):
        filepath = os.path.join(folder, filename)

        if not os.path.isfile(filepath):
            continue  # skip subdirectories

        try:
            # Ensure the file is writable by the current user before deletion.
            # Files created by Docker (root) may have restrictive permissions,
            # so we chmod to 0o600 first to reclaim write access.
            os.chmod(filepath, 0o600)
            os.remove(filepath)
            deleted.append(filename)
        except Exception:
            failed.append(filename)

    return {
        "deleted": deleted,
        "failed": failed,
        "error": None if not failed else f"Could not delete {len(failed)} file(s)",
    }


def _indent(text: str, spaces: int) -> str:
    prefix = " " * spaces
    return "\n".join(
        prefix + line if line.strip() else line for line in text.splitlines()
    )
