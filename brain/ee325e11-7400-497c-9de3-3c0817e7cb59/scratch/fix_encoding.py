
import os

file_path = r'c:\project\EditoHub\src\app\dashboard\components\admin-dashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace â‚¹ with ₹
new_content = content.replace('â‚¹', '₹')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replacement complete.")
