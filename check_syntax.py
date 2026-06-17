with open('/app/app.js', 'rb') as f:
    content = f.read()
lines = content.split(b'\n')
print("Total lines:", len(lines))

# Check for unescaped single quotes inside single-quoted strings
in_string = False
quote_start_line = 0
for i, line in enumerate(lines, 1):
    j = 0
    while j < len(line):
        ch = chr(line[j])
        if ch == "'" and (j == 0 or chr(line[j-1]) != '\\'):
            if not in_string:
                in_string = True
                quote_start_line = i
            else:
                in_string = False
        j += 1

if in_string:
    print(f"UNCLOSED STRING starting at line {quote_start_line}!")
else:
    print("All strings properly closed!")

# Check lines around 79
for i in range(76, 82):
    if i < len(lines):
        print(f"Line {i}: {lines[i-1][:120]}")
