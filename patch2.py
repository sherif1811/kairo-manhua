import sys

with open("flask_app.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "task = process_chapter.delay" in line and "image_urls=image_urls" in line:
        start_idx = i
        break
else:
    print("Could not find the delay call")
    sys.exit(1)

# we know lines[start_idx] is the delay call
# lines[start_idx+1] to lines[start_idx+5] is the return jsonify block

new_block = [
    "    try:\n",
    "        from tasks import process_chapter\n",
    "        " + lines[start_idx].strip() + "\n",
    "        return jsonify({\n",
    "            'status': 'queued',\n",
    "            'task_id': task.id,\n",
    "            'message': 'Queued successfully'\n",
    "        }), 202\n",
    "    except Exception as e:\n",
    "        import traceback\n",
    "        err = f'Server Error: {str(e)} | {traceback.format_exc()}'\n",
    "        return jsonify({'error': err}), 500\n"
]

lines = lines[:start_idx] + new_block + lines[start_idx+6:]

with open("flask_app.py", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Success")
