import os

with open('../prompt.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

current_file = "STEP_01.md"
content = []

for line in lines:
    if line.startswith("STEP_") and ".md" in line:
        if current_file:
            with open(current_file, "w", encoding="utf-8") as out:
                out.writelines(content)
        current_file = line.split(" ")[0].strip()
        content = [line]
    else:
        content.append(line)

if current_file:
    with open(current_file, "w", encoding="utf-8") as out:
        out.writelines(content)

# And BUILD_STEPS.md ? The prompt says it's in the repo, but I don't see it in prompt.txt.
# Let's see if it's in MPLAD_Simple_Guide.txt or MPLADS_System_Documentation.txt
