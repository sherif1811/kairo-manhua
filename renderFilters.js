function renderFilters() {
    return `
    <div class="advanced-filters-bar">
        <div class="filter-group">
            <label>الحالة <i class="fa-solid fa-bolt"></i></label>
            <select id="filter-status">
                <option value="">الكل</option>
                <option value="Ongoing">مستمرة</option>
                <option value="Completed">مكتملة</option>
                <option value="Hiatus">متوقفة</option>
            </select>
        </div>
        <div class="filter-group">
            <label>النوع <i class="fa-solid fa-globe"></i></label>
            <select id="filter-type">
                <option value="">الكل</option>
                <option value="مانهوا كورية">مانهوا كورية</option>
                <option value="مانها صينية">مانها صينية</option>
                <option value="مانجا يابانية">مانجا يابانية</option>
                <option value="رواية">رواية</option>
            </select>
        </div>
        <div class="filter-group">
            <label>السنة <i class="fa-regular fa-calendar"></i></label>
            <select id="filter-year">
                <option value="">الكل</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
                <option value="2020">2020</option>
            </select>
        </div>
        <div class="filter-group">
            <label>التقييم <i class="fa-regular fa-star"></i></label>
            <select id="filter-rating">
                <option value="">الكل</option>
                <option value="4.5">4.5+ نجوم</option>
                <option value="4.0">4.0+ نجوم</option>
                <option value="3.5">3.5+ نجوم</option>
            </select>
        </div>
        <div class="filter-group">
            <label>الفصول <i class="fa-solid fa-book-open"></i></label>
            <select id="filter-chapters">
                <option value="">الكل</option>
                <option value="100">أكثر من 100 فصل</option>
                <option value="200">أكثر من 200 فصل</option>
                <option value="500">أكثر من 500 فصل</option>
            </select>
        </div>
        <div class="filter-group sort-group">
            <label>ترتيب حسب <i class="fa-solid fa-arrow-down-short-wide"></i></label>
            <select id="filter-sort">
                <option value="newest">أحدث الإضافات</option>
                <option value="popular">الأكثر شعبية</option>
                <option value="rating">الأعلى تقييماً</option>
                <option value="chapters_desc">الأكثر فصولاً</option>
                <option value="chapters_asc">الأقل فصولاً</option>
                <option value="alpha">أبجدي</option>
            </select>
        </div>
    </div>
    `;
}