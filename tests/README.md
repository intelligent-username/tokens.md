# Tests

These are tests for different functionalities of the CLI.

To run them, activate the virtual environment and run:

```bash
pytest
```

## Output options

By default, pytest runs quietly and prints a dot (`.`) for each passing test, `F` for failures, and `E` for errors. For more detail:

```bash
pytest -v                          # test names + PASSED/FAILED/ERROR per line
pytest -v --tb=short               # verbose output with shorter tracebacks
pytest -v --tb=short -ra           # add a summary table of all failures at the end
pytest -x -v                       # stop at first failure
pytest --instafail -v              # show failures as they happen
```

