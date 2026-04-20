import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

from browser_use import Agent, ChatOllama


async def main():
    llm = ChatOllama(model="gemma4:e2b", ollama_options={"think": False})
    # llm = ChatOllama(model="qwen3.5:4b", ollama_options={"think": False})
    task = "What is the latest video of Nitish Rajput about?"
    agent = Agent(task=task, llm=llm)
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
