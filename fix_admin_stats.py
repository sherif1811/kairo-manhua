import io

with io.open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_stats = """        if (response.ok) {
            const data = await response.json();
            state.adminStats = data;
            state.adminStatsLoading = false;
            renderApp();
        } else {
            state.adminStatsLoading = false;
        }"""

replacement_stats = """        if (response.ok) {
            const data = await response.json();
            state.adminStats = data;
            state.adminStatsLoading = false;
            
            // Minimal DOM update without resetting the entire UI
            const dashboard = document.querySelector('.admin-stats-dashboard');
            if (dashboard) {
                let suggestionsHtml = '';
                if (data.suggestions_in_range !== undefined) {
                    suggestionsHtml = `
                    <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid #ff007f44; display: flex; flex-direction: column; gap: 6px; background: rgba(255,0,127,0.03); text-align: right;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-message" style="color: #ff007f; margin-left: 6px;"></i> الشكاوى/الرسائل (في النطاق)</span>
                        <strong style="font-size: 1.5rem; color: #ff007f; font-weight: 800;">${data.suggestions_in_range}</strong>
                    </div>`;
                } else if (data.total_suggestions !== undefined) {
                    suggestionsHtml = `
                    <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid #ff007f44; display: flex; flex-direction: column; gap: 6px; background: rgba(255,0,127,0.03); text-align: right;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-message" style="color: #ff007f; margin-left: 6px;"></i> إجمالي الاقتراحات والشكاوى</span>
                        <strong style="font-size: 1.5rem; color: #ff007f; font-weight: 800;">${data.total_suggestions}</strong>
                    </div>`;
                }

                dashboard.innerHTML = `
                    <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-eye" style="color: var(--color-secondary); margin-left: 6px;"></i> إجمالي زيارات الموقع</span>
                        <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${data.visits}</strong>
                    </div>
                    <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-users" style="color: var(--color-primary); margin-left: 6px;"></i> إجمالي المستخدمين</span>
                        <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${data.total_users}</strong>
                    </div>
                    <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-brands fa-google" style="color: #ea4335; margin-left: 6px;"></i> المسجلين من Google</span>
                        <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${data.google}</strong>
                    </div>
                    <div class="stat-card glass-card" style="padding: 16px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.01); text-align: right;">
                        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-brands fa-facebook" style="color: #1877f2; margin-left: 6px;"></i> المسجلين من Facebook</span>
                        <strong style="font-size: 1.5rem; color: var(--text-main); font-weight: 800;">${data.facebook}</strong>
                    </div>
                    ${suggestionsHtml}
                `;
            }
        } else {
            state.adminStatsLoading = false;
            const dashboard = document.querySelector('.admin-stats-dashboard');
            if (dashboard) dashboard.innerHTML = '<p style="color:var(--text-muted); padding:20px;">تعذر جلب الإحصائيات.</p>';
        }"""

content = content.replace(target_stats, replacement_stats)

with io.open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
