function applyFilters(mangas) {
    const status = state.filters?.status;
    const type = state.filters?.type;
    const year = state.filters?.year;
    const rating = state.filters?.rating ? parseFloat(state.filters.rating) : null;
    const chapters = state.filters?.chapters ? parseInt(state.filters.chapters) : null;
    const sort = state.filters?.sort || 'newest';

    let result = mangas.filter(m => {
        if (status && m.status !== status) return false;
        if (type && m.type !== type) return false;
        if (year && m.year != year) return false;
        if (rating && m.rating < rating) return false;
        if (chapters && m.chapters && m.chapters.length < chapters) return false;
        return true;
    });

    result.sort((a, b) => {
        if (sort === 'popular') return b.hash - a.hash; // mock popularity
        if (sort === 'rating') return b.rating - a.rating;
        if (sort === 'chapters_desc') return (b.chapters ? b.chapters.length : 0) - (a.chapters ? a.chapters.length : 0);
        if (sort === 'chapters_asc') return (a.chapters ? a.chapters.length : 0) - (b.chapters ? b.chapters.length : 0);
        if (sort === 'alpha') return a.title.localeCompare(b.title);
        return 0; // newest
    });

    return result;
}