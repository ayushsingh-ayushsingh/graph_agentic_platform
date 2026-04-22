from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from tools import (
    clear_all_input,
    clear_all_output,
    list_all_files,
    read_file_from_input_directory,
    run_python_in_secure_env,
)

import litellm
import os

litellm._turn_on_debug()
litellm.suppress_debug_info = False
litellm.set_verbose = True

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

os.environ['LM_STUDIO_API_BASE'] = "http://localhost:1234/v1"

root_agent = Agent(
    # model=LiteLlm("lm_studio/google/gemma-4-e2b", include_reasoning=False),
    model=LiteLlm("lm_studio/google/gemma-4-e4b"),
    name="python_executor",
    description="An agent that takes the task in Natural Language as an input and can create and execute python in a secure dockerized environment",
    instruction="""
    You are Python Guru, an agent that can execute python in a secure dockerized environment,
    use the tools available to you and return the data from stdout, err, stderr and images.
    Packages available: numpy, pandas, scipy, matplotlib, seaborn, scikit-learn, joblib, tqdm.
    Use the tools only if needed! Always save the outputs.
    """,
    tools=[
        clear_all_input,
        clear_all_output,
        list_all_files,
        read_file_from_input_directory,
        run_python_in_secure_env,
    ],
)
