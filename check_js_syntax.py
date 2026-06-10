import sys

def check_js_syntax(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    string_stack = [] # To keep track of template literal states
    line = 1
    col = 1
    in_string = None # None, 'single', 'double', 'template'
    escape = False
    comment = None # None, 'single', 'multi'
    
    errors = []
    
    i = 0
    n = len(content)
    while i < n:
        char = content[i]
        
        # Track line and column numbers
        if char == '\n':
            line += 1
            col = 1
        else:
            col += 1
            
        # Handle escaping inside strings
        if escape:
            escape = False
            i += 1
            continue
            
        if char == '\\' and in_string:
            escape = True
            i += 1
            continue
            
        # Handle comments
        if comment == 'single':
            if char == '\n':
                comment = None
            i += 1
            continue
        elif comment == 'multi':
            if char == '*' and i + 1 < n and content[i+1] == '/':
                comment = None
                i += 2
                col += 1
                continue
            i += 1
            continue
            
        if not in_string:
            # Check for comment start
            if char == '/' and i + 1 < n:
                if content[i+1] == '/':
                    comment = 'single'
                    i += 2
                    col += 1
                    continue
                elif content[i+1] == '*':
                    comment = 'multi'
                    i += 2
                    col += 1
                    continue
                    
        # Handle string states
        if in_string == 'single':
            if char == "'":
                in_string = string_stack.pop() if string_stack else None
            i += 1
            continue
        elif in_string == 'double':
            if char == '"':
                in_string = string_stack.pop() if string_stack else None
            i += 1
            continue
        elif in_string == 'template':
            if char == '`':
                in_string = string_stack.pop() if string_stack else None
                i += 1
                continue
            elif char == '$' and i + 1 < n and content[i+1] == '{':
                # We enter a JS expression inside a template literal
                stack.append(('${', line, col))
                string_stack.append(in_string)
                in_string = None
                i += 2
                col += 1
                continue
            i += 1
            continue
            
        # Outside strings and comments
        if char == "'":
            string_stack.append(in_string)
            in_string = 'single'
            i += 1
            continue
        elif char == '"':
            string_stack.append(in_string)
            in_string = 'double'
            i += 1
            continue
        elif char == '`':
            string_stack.append(in_string)
            in_string = 'template'
            i += 1
            continue
            
        # Brackets and parentheses
        if char in ('(', '[', '{'):
            stack.append((char, line, col))
        elif char in (')', ']', '}'):
            if not stack:
                errors.append(f"Unexpected closing character '{char}' at line {line}, col {col}")
            else:
                top, t_line, t_col = stack.pop()
                if char == ')' and top != '(':
                    errors.append(f"Mismatched closing parenthese ')' matching '{top}' from line {t_line}, col {t_col} at line {line}, col {col}")
                    stack.append((top, t_line, t_col)) # put back
                elif char == ']' and top != '[':
                    errors.append(f"Mismatched closing bracket ']' matching '{top}' from line {t_line}, col {t_col} at line {line}, col {col}")
                    stack.append((top, t_line, t_col)) # put back
                elif char == '}':
                    if top == '${':
                        # We exit the JS expression inside the template literal
                        in_string = string_stack.pop() if string_stack else None
                    elif top != '{':
                        errors.append(f"Mismatched closing brace '}}' matching '{top}' from line {t_line}, col {t_col} at line {line}, col {col}")
                        stack.append((top, t_line, t_col)) # put back
                    
        i += 1
        
    if in_string:
        errors.append(f"Unclosed string literal '{in_string}' at end of file")
    if comment:
        errors.append(f"Unclosed comment '{comment}' at end of file")
        
    while stack:
        top, t_line, t_col = stack.pop()
        errors.append(f"Unclosed '{top}' from line {t_line}, col {t_col}")
        
    if errors:
        print(f"Found {len(errors)} errors:")
        for err in errors[:50]:
            print(err)
        if len(errors) > 50:
            print(f"... and {len(errors) - 50} more")
    else:
        print("No syntax errors found by basic parser!")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        check_js_syntax(sys.argv[1])
    else:
        check_js_syntax('app.js')
