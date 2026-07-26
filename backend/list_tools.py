from tool_schemas import TOOLS_SCHEMA
print(f"Total tools count: {len(TOOLS_SCHEMA)}")
for idx, t in enumerate(TOOLS_SCHEMA):
    print(f"{idx+1:2d}. {t['function']['name']}")
