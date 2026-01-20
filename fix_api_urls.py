#!/usr/bin/env python3
import re
import os

files_to_fix = [
    'frontend/src/pages/QuizPage.tsx',
    'frontend/src/pages/AdminPage.tsx',
    'frontend/src/pages/ChatPage.tsx',
    'frontend/src/components/AppEntryAward.tsx'
]

for file_path in files_to_fix:
    full_path = os.path.join(os.getcwd(), file_path)
    if not os.path.exists(full_path):
        print(f'File not found: {full_path}')
        continue
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_lines = len(content.split('\n'))
    
    # Replace fetch calls: ${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/
    # To: getAPIEndpoint('/ 
    pattern = r"\$\{import\.meta\.env\.VITE_API_URL \|\| 'http://localhost:5000'\}/api/"
    content = re.sub(pattern, "getAPIEndpoint('/", content)
    
    # Replace io() calls for Socket.io - keep them as-is (they connect to backend directly)
    # io(import.meta.env.VITE_API_URL || 'http://localhost:5000')
    # Already has a fallback, so leave it
    
    # Now add the import if it doesn't have it
    if 'import { gamificationAPI }' in content and 'getAPIEndpoint' not in content[:200]:
        content = content.replace(
            'import { gamificationAPI }',
            'import { gamificationAPI, getAPIEndpoint }'
        )
    
    if 'import {' in content and 'getAPIEndpoint' not in content[:500]:
        # Add import if needed and missing
        first_import = content.find('import {')
        if first_import != -1:
            end_import = content.find('} from', first_import)
            if end_import != -1 and 'getAPIEndpoint' not in content[first_import:end_import]:
                # Find the } and add getAPIEndpoint
                brace_pos = content.rfind('}', first_import, end_import)
                if brace_pos != -1:
                    content = content[:brace_pos] + ', getAPIEndpoint' + content[brace_pos:]
    
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    new_lines = len(content.split('\n'))
    print(f'Fixed: {file_path} ({original_lines} lines)')
