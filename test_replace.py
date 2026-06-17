import os

with open('flask_app.py', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('ØºÙŠØ± Ù…ØµØ±Ø­', 'غير مصرح')
c = c.replace('Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯', 'المستخدم غير موجود')
c = c.replace('Ù„Ù‚Ø¯ Ø­ØµÙ„Øª Ø¹Ù„Ù‰ Ù…ÙƒØ§Ù Ø£Ø© Ø§Ù„ÙŠÙˆÙ… Ø¨Ø§Ù„Ù Ø¹Ù„', 'لقد حصلت على مكافأة اليوم بالفعل')
c = c.replace('Ù…Ø¨Ø±ÙˆÙƒ! Ø­ØµÙ„Øª Ø¹Ù„Ù‰', 'مبروك! حصلت على')
c = c.replace('Ù†Ù‚Ø·Ø©!', 'نقطة!')

with open('flask_app_test.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done replacements!")
