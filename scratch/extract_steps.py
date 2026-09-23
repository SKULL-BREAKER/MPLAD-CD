import sys
import re
import os

files_to_check = [f for f in os.listdir('.') if f.endswith('.txt')]

for fname in files_to_check:
    try:
        with open(fname, encoding='utf-8', errors='ignore') as f:
            text = f.read()
    except Exception as e:
        continue

    lines = text.split('\n')
    current_step = None
    step_content = []

    for line in lines:
        m = re.match(r'^(?:### |\*\*|# )?(STEP_\d{2}\.md)(?:\*\*|:)?', line.strip())
        if m:
            if current_step:
                with open(f'mplad-app/{current_step}', 'w', encoding='utf-8') as out:
                    out.write('\n'.join(step_content))
                print(f"[{fname}] Wrote {current_step} ({len(step_content)} lines)")
            current_step = m.group(1)
            step_content = [line]
        elif current_step:
            step_content.append(line)

    if current_step:
        with open(f'mplad-app/{current_step}', 'w', encoding='utf-8') as out:
            out.write('\n'.join(step_content))
        print(f"[{fname}] Wrote {current_step} ({len(step_content)} lines)")
